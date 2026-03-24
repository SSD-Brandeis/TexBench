# Tectonic JSON Generator

A chat + form interface for designing Tectonic workload specs, then generating real workloads with a locally installed `tectonic-cli` binary.

## Features

- Assistant-guided workload spec authoring
- Fully editable form-backed spec generation
- Live JSON preview + validation
- Local workload execution (`tectonic-cli generate`)
- Download both `spec.json` and generated `workload.tar.gz`

## Requirements

- Node.js 18+
- `tectonic-cli` installed on host machine and available on PATH
- one configured AI provider for assistant prompts:
  - OpenAI-compatible API
  - Cloudflare AI
  - local Ollama

## Setup

```bash
npm install
```

## Development

Run everything with one command:

```bash
npm run dev
```

Open [http://localhost:8787](http://localhost:8787).

To force a specific provider in local development:

```bash
AI_PROVIDER=openai npm run dev
AI_PROVIDER=cloudflare npm run dev
AI_PROVIDER=ollama npm run dev
```

This starts:
- static UI hosting from `public/`
- `POST /api/assist`
- `POST/GET /api/workloads/*` (direct local `tectonic-cli` execution)

Known artifact location on host:

- Latest workload file: `generated-workloads/latest-workload.tar.gz`
- Latest spec file: `generated-workloads/latest-spec.json`
- Per-run artifacts: `generated-workloads/runs/<run_id>/`

## Supported natural-language demo prompts

The assistant is tested against three prompt families.

### 1. Single shot workload

Example:

```text
Generate a single shot workload with 1M inserts
```

Expected shape:
- `1` section
- `1` group
- operations in that one group

### 2. Two phase interleaved workload

These prompts mean:
- phase 1: preload the database
- phase 2: a second group with interleaved operations that share the same valid keys

Supported phrasing includes:
- `Preload the DB with 1M inserts, then interleave 300k updates and 200k short range queries`
- `Preload the DB with 1M inserts, then interleave 80% point queries and 20% updates for 500k operations`
- `Preload the DB with 1M inserts, then interleave a write heavy phase with 70% updates and 30% point queries for 400k operations`
- `Preload the DB with 1M inserts, then write only for 250k operations`
- `Preload the DB with 1M inserts, then interleave 300k point queries and 200k long range queries`

Expected shape:
- `1` section
- `2` groups
- group 1 = preload
- group 2 = interleaved serving/query phase

### 3. Three phase interleaved workload

These prompts are intentionally higher level:
- preload phase
- interleaved middle phase
- interleaved final phase

Supported phrasing includes:
- `Build a three phase workload: preload the DB with 1M inserts, then interleave a write-heavy phase with 70% updates and 30% point queries for 400k operations, then interleave 60% point queries and 40% long range queries for 600k operations.`
- `I want three phases: seed the database, then a hot serving phase, then a broader scan phase. Preload 1M inserts, then interleave 80% point queries and 20% updates for 500k operations, then interleave 70% point queries and 30% long range queries for 300k operations.`
- `Generate a three phase workload: first load the database with 5M inserts, next run a write-only phase for 1M operations, then run an interleaved read phase with 80% point queries and 20% short range queries for 2M operations.`

Expected shape:
- `1` section
- `3` groups
- one group per phase

The dedicated regression coverage for these demo prompt families lives in:
- `test/assist-natural-language-demo.test.mjs`

Additional natural-language regression coverage lives in:
- `test/assist-natural-language-extended.test.mjs`
- `test/assist-provider-coverage.test.mjs`

Those additional suites cover:
- ambiguity handling, where the app should clarify instead of guessing
- synonym and filler-phrase variants such as `seed the database`, `load the database`, `Please ...`, and `Can you ...`
- operation synonyms such as `point reads`, `read-modify-write`, and `rmw`
- multi-turn regressions where later prompts refine or remove earlier workload choices
- provider-path coverage for OpenAI, Cloudflare, and Ollama assist modes

Run the demo-oriented NL coverage with:

```bash
make test-demo
```

Run the local Ollama-backed demo coverage with:

```bash
AI_PROVIDER=ollama make test-demo-ollama
```

## LLM env vars

`/api/assist` is AI-only. Configure one provider:

OpenAI-compatible API:

```bash
export AI_PROVIDER=openai
export OPENAI_API_KEY=...
export OPENAI_MODEL=gpt-5.1
# Optional overrides:
# export OPENAI_MODELS=gpt-5.1,gpt-5.4
# export OPENAI_BASE_URL=https://api.openai.com/v1
# export OPENAI_API_ENDPOINT=/responses
# export OPENAI_CHAT_ENDPOINT=/chat/completions
```

Cloudflare AI:

```bash
export AI_PROVIDER=cloudflare
export CLOUDFLARE_ACCOUNT_ID=...
export CLOUDFLARE_API_TOKEN=...
export CLOUDFLARE_MODEL=@cf/meta/llama-3.1-8b-instruct
# Optional multi-model retry chain:
# export CLOUDFLARE_MODELS=@cf/meta/llama-3.1-8b-instruct,@cf/meta/llama-3.3-70b-instruct-fp8-fast
```

Local Ollama:

```bash
export AI_PROVIDER=ollama
export OLLAMA_MODEL=llama3.2:3b
# Optional overrides:
# export OLLAMA_BASE_URL=http://127.0.0.1:11434
# export OLLAMA_API_ENDPOINT=/api/generate
# export OLLAMA_TIMEOUT_MS=60000
```

### Set up Ollama locally

1. Install Ollama.

macOS with Homebrew:

```bash
brew install ollama
```

Or install the desktop app from [ollama.com](https://ollama.com/download).

2. Start the Ollama server.

```bash
ollama serve
```

3. Pull a local model.

```bash
ollama pull llama3.2:3b
```

4. Verify the local API is reachable.

```bash
curl http://127.0.0.1:11434/api/tags
```

5. Start this app against Ollama.

```bash
AI_PROVIDER=ollama OLLAMA_MODEL=llama3.2:3b make dev
```

6. Run the Ollama-backed demo tests.

```bash
AI_PROVIDER=ollama make test-demo-ollama
```

`openai` is the local default when `AI_PROVIDER` is unset.

Preferred naming:
- OpenAI: `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_MODELS`
- Cloudflare: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_MODEL`, `CLOUDFLARE_MODELS`
- Ollama: `OLLAMA_MODEL`, `OLLAMA_BASE_URL`, `OLLAMA_API_ENDPOINT`, `OLLAMA_TIMEOUT_MS`

Legacy compatibility aliases:
- `AI_NAME` is still accepted as a Cloudflare model alias
- `AI_MODELS` is still accepted as a Cloudflare retry-chain alias

When `AI_PROVIDER=openai`, `/api/assist` uses Structured Outputs via the OpenAI tool/structured-output path.

When `AI_PROVIDER=ollama`, `/api/assist` uses the local Ollama HTTP API. The default endpoint is `/api/generate`.

The default OpenAI endpoint is `/responses`. Set `OPENAI_API_ENDPOINT` or `OPENAI_CHAT_ENDPOINT` only if you need a non-default compatible API shape.

If you set `CLOUDFLARE_AI_BASE_URL`, include the Cloudflare API version path (`/client/v4`), for example:
`https://api.cloudflare.com/client/v4`

If no provider credentials are set, `/api/assist` returns a runtime config error (`ai_credentials_missing`, `openai_token_missing`, or `cloudflare_ai_credentials_missing`).

## If `tectonic-cli` is not found

If `Run Workload` fails with `tectonic_cli_not_found` (or `which tectonic-cli` is empty), build from your local Tectonic repo and add it to `PATH`:

```bash
cd ~/src/Tectonic
cargo build --release --bin tectonic-cli
mkdir -p ~/.cargo/bin
ln -sf ~/src/Tectonic/target/release/tectonic-cli ~/.cargo/bin/tectonic-cli
echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> ~/.zshrc
exec zsh -l
which tectonic-cli
tectonic-cli --help
```

## Notes

- No Worker, D1, R2, or container is required in local mode.
- Run state is session-local in UI and process-local in the local server.
