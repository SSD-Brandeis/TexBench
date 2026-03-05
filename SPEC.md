# Tectonic JSON Generator - Specification

## Project Overview
- **Project name**: Tectonic JSON Generator
- **Type**: Local macOS Node app (single process)
- **Core functionality**:
- Build workload spec JSON with assistant + editable form controls.
- Execute `tectonic-cli` workload generation on the same host machine.
- Download both generated `spec.json` and `workload.tar.gz`.
- **Non-goals**:
- No D1 metadata persistence.
- No R2 artifact storage.
- No Cloudflare Worker runtime requirement.

## Local Architecture (Single Process)

### Server
- File: `src/server.mjs`
- Hosts static frontend from `public/`.
- Exposes:
- `POST /api/assist`
- `POST/GET /api/workloads/*`
- `GET /api/health`
- Uses same in-process workload execution logic (no proxy to another service).

### Assistant Execution
- Existing assistant logic remains in `src/index.js`.
- Server invokes the assistant route directly in-process.
- Supports provider selection in local mode:
- Cloudflare AI via `AI_PROVIDER=cloudflare`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`.
- OpenAI-compatible API via `AI_PROVIDER=openai`, `OPENAI_API_KEY`, `OPENAI_MODEL`.
- OpenAI provider uses Structured Outputs (`response_format: json_schema`, strict mode) for assist responses.
- No deterministic fallback path for prompts.
- `/api/assist` returns runtime config errors when credentials are missing (`ai_credentials_missing`, `openai_token_missing`, `cloudflare_ai_credentials_missing`).

### Workload Execution
- File: `src/local-tectonic-runner.mjs` (shared module logic)
- Executes:
- `tectonic-cli generate -w <spec_path> -o <output_path>`
- Creates downloadable artifacts:
- per-run: `generated-workloads/runs/<run_id>/spec.json`
- per-run: `generated-workloads/runs/<run_id>/workload.tar.gz`
- latest: `generated-workloads/latest-spec.json`
- latest: `generated-workloads/latest-workload.tar.gz`
- Run state is process-memory only.

## API Contracts

### `POST /api/workloads/runs`
```ts
type StartRunRequest = {
  spec_json: Record<string, unknown>;
  run_options?: {
    timeout_seconds?: number; // default: 1800
  };
};
```

```ts
type StartRunResponse = {
  run_id: string;
  status: "starting" | "running";
  created_at: string;
  output_paths: {
    known_output_dir: string;
    run_dir: string;
    spec_path: string;
    generated_output_path: string;
    workload_path: string;
    latest_spec_path: string;
    latest_workload_path: string;
  };
  downloads: {
    spec_download_path: string;
    workload_download_path: string;
  };
};
```

### `GET /api/workloads/runs/:runId`
```ts
type RunStatusResponse = {
  run_id: string;
  status: "starting" | "running" | "succeeded" | "failed" | "cancelled" | "timed_out";
  progress_text: string;
  error: { code: string; message: string } | null;
  output_paths: StartRunResponse["output_paths"];
  artifacts: Array<{
    kind: "spec" | "workload";
    filename: string;
    ready: boolean;
    bytes: number | null;
  }>;
  links: {
    spec_download_path: string;
    workload_download_path: string;
    cancel_path: string | null;
  };
  created_at: string;
};
```

### `POST /api/workloads/runs/:runId/cancel`
- Cancels active local `tectonic-cli` process.

### `GET /api/workloads/runs/:runId/download/spec`
- Streams run `spec.json`.

### `GET /api/workloads/runs/:runId/download/workload`
- Streams `workload.tar.gz` when ready.
- Returns `409 artifact_not_ready` when workload is not yet produced.

## UI Flow
- JSON actions:
- `Validate`
- `Run Workload`
- `Download Spec JSON`
- `Copy`
- Runs panel (session-only) shows:
- status badge
- progress/error text
- known output path
- `Download Spec`
- `Download Workload` (enabled when ready)
- `Cancel` for active runs

## Operational Defaults
- App default URL: `http://127.0.0.1:8787`
- `tectonic-cli` binary default: `tectonic-cli` from PATH
- Max spec bytes and timeout enforced server-side
- No persistence of run metadata across server restart

## Failure Modes
- Invalid JSON body: `400 invalid_json`
- Invalid `spec_json`: `400 invalid_spec` (with details)
- Missing AI credentials for `/api/assist`: `503` with explicit configuration code.
- Missing `tectonic-cli` in PATH: run status `failed` with code `tectonic_cli_not_found` and local build instructions.
- Other command failures: run status `failed`
- Workload artifact not ready: `409 artifact_not_ready`

## Acceptance Criteria
1. One command (`npm run dev`) starts complete local app.
2. `/api/assist` works in local mode with AI-only prompt handling.
3. Starting valid run returns `202` and transitions to terminal status.
4. Download endpoints return spec/workload artifacts as expected.
5. No Worker, D1, R2, or container dependency is required.
