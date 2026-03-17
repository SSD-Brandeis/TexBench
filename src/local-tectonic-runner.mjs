import http from "node:http";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { validateWorkloadSpec } from "./workload-spec-validation.mjs";

const HOST = process.env.LOCAL_RUNNER_HOST || "127.0.0.1";
const PORT = parseInteger(process.env.LOCAL_RUNNER_PORT, 8788);
const KNOWN_OUTPUT_DIR = path.resolve(
  process.env.LOCAL_RUNNER_OUTPUT_DIR ||
    path.join(process.cwd(), "generated-workloads"),
);
const RUNS_DIR =
  process.env.LOCAL_RUNNER_RUNS_DIR || path.join(KNOWN_OUTPUT_DIR, "runs");
const LATEST_SPEC_PATH = path.join(KNOWN_OUTPUT_DIR, "latest-spec.json");
const LATEST_WORKLOAD_PATH = path.join(
  KNOWN_OUTPUT_DIR,
  "latest-benchmark-output.txt",
);
const TECTONIC_BIN =
  (process.env.TECTONIC_BIN || "tectonic-cli").trim() || "tectonic-cli";
const DEFAULT_DATABASE =
  (process.env.RUN_BENCHMARK_DATABASE || "rocksdb").trim() || "rocksdb";
const MAX_SPEC_BYTES = parseInteger(process.env.RUN_MAX_SPEC_BYTES, 512 * 1024);
const MAX_TIMEOUT_SECONDS = parseInteger(
  process.env.RUN_MAX_TIMEOUT_SECONDS,
  1800,
);
const DEFAULT_TIMEOUT_SECONDS = 1800;
const MIN_TIMEOUT_SECONDS = 30;
const WORKLOAD_FILENAME = "benchmark-output.txt";
const SPEC_FILENAME = "spec.json";
const ACTIVE_STATUSES = new Set(["starting", "running"]);
const TERMINAL_STATUSES = new Set([
  "succeeded",
  "failed",
  "cancelled",
  "timed_out",
]);

const runs = new Map();

await fs.mkdir(KNOWN_OUTPUT_DIR, { recursive: true });
await fs.mkdir(RUNS_DIR, { recursive: true });

export function getLocalRunnerConfig() {
  return {
    host: HOST,
    port: PORT,
    known_output_dir: KNOWN_OUTPUT_DIR,
    runs_dir: RUNS_DIR,
    tectonic_bin: TECTONIC_BIN,
    benchmark_database: DEFAULT_DATABASE,
  };
}

export async function handleWorkloadRequest(req, res) {
  try {
    await routeRequest(req, res);
  } catch (error) {
    console.error("Local runner unhandled error:", error);
    sendJson(res, 500, {
      error: "Unhandled local runner error.",
      code: "runner_unhandled_error",
    });
  }
}

export async function stopActiveRuns() {
  for (const run of runs.values()) {
    if (run && run.child && ACTIVE_STATUSES.has(run.status)) {
      try {
        run.child.kill("SIGTERM");
      } catch {
        // Ignore process kill errors during shutdown.
      }
    }
  }
}

function createStandaloneServer() {
  const server = http.createServer(async (req, res) => {
    await handleWorkloadRequest(req, res);
  });
  server.on("error", (error) => {
    console.error(buildListenErrorMessage(error));
    process.exit(1);
  });
  return server;
}

async function shutdownStandalone(signal, server) {
  console.log("Received " + signal + ", stopping local runner...");
  await stopActiveRuns();
  await new Promise((resolve) => server.close(resolve));
  process.exit(0);
}

function isDirectExecution() {
  const argvEntry = process.argv[1];
  if (!argvEntry) {
    return false;
  }
  try {
    return path.resolve(argvEntry) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isDirectExecution()) {
  const standalone = createStandaloneServer();
  standalone.listen(PORT, HOST, () => {
    console.log(
      "Local tectonic runner listening on http://" + HOST + ":" + PORT,
    );
    console.log("Using binary:", TECTONIC_BIN);
    console.log("Known output directory:", KNOWN_OUTPUT_DIR);
    console.log("Runs directory:", RUNS_DIR);
  });

  let shutdownPromise = null;
  const requestShutdown = (signal) => {
    if (!shutdownPromise) {
      shutdownPromise = shutdownStandalone(signal, standalone);
      return;
    }
    console.log("Received " + signal + ", shutdown already in progress...");
  };

  process.once("SIGINT", () => {
    requestShutdown("SIGINT");
  });

  process.once("SIGTERM", () => {
    requestShutdown("SIGTERM");
  });
}

async function routeRequest(req, res) {
  const method = String(req.method || "GET").toUpperCase();
  const url = new URL(req.url || "/", "http://127.0.0.1");
  const pathname = url.pathname.replace(/\/+$/, "") || "/";

  if (pathname === "/api/workloads/health") {
    if (method !== "GET") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }
    sendJson(res, 200, {
      ok: true,
      runner: "local_tectonic_runner",
      host: HOST,
      port: PORT,
      tectonic_bin: TECTONIC_BIN,
      known_output_dir: KNOWN_OUTPUT_DIR,
    });
    return;
  }

  if (pathname === "/api/workloads/runs") {
    if (method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }
    await handleStartRun(req, res);
    return;
  }

  const runMatch = pathname.match(
    /^\/api\/workloads\/runs\/([^/]+)(?:\/(cancel|download\/spec|download\/output|download\/workload))?$/,
  );
  if (!runMatch) {
    sendJson(res, 404, {
      error: "Not found.",
      code: "not_found",
    });
    return;
  }

  const runId = safeDecodeURIComponent(runMatch[1]);
  const action = runMatch[2] || "status";
  if (!runId) {
    sendJson(res, 400, {
      error: "Invalid run id.",
      code: "invalid_run_id",
    });
    return;
  }

  if (action === "status") {
    if (method !== "GET") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }
    await handleRunStatus(res, runId);
    return;
  }

  if (action === "cancel") {
    if (method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }
    await handleCancelRun(res, runId);
    return;
  }

  if (action === "download/spec") {
    if (method !== "GET") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }
    await handleDownloadArtifact(res, runId, "spec");
    return;
  }

  if (action === "download/output" || action === "download/workload") {
    if (method !== "GET") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }
    await handleDownloadArtifact(res, runId, "output");
    return;
  }

  sendJson(res, 404, {
    error: "Not found.",
    code: "not_found",
  });
}

async function handleStartRun(req, res) {
  const body = await readJsonBody(req);
  if (!body.ok) {
    sendJson(res, body.status, {
      error: body.error,
      code: body.code,
      ...(body.details ? { details: body.details } : {}),
    });
    return;
  }

  const normalizedSpec = normalizeSpecPayload(
    body.value && body.value.spec_json,
  );
  if (!normalizedSpec) {
    sendJson(res, 400, {
      error: "spec_json must be a JSON object or a sections array.",
      code: "invalid_spec",
      details: ["spec_json must be an object or array."],
    });
    return;
  }

  const validationErrors = validateWorkloadSpec(normalizedSpec);
  if (validationErrors.length > 0) {
    sendJson(res, 400, {
      error: "Invalid spec_json for workload execution.",
      code: "invalid_spec",
      details: validationErrors,
    });
    return;
  }

  const specText = JSON.stringify(normalizedSpec, null, 2);
  const specBytes = Buffer.byteLength(specText, "utf8");
  if (specBytes > MAX_SPEC_BYTES) {
    sendJson(res, 413, {
      error: "Spec JSON exceeds maximum allowed size.",
      code: "spec_too_large",
      max_bytes: MAX_SPEC_BYTES,
    });
    return;
  }

  const timeoutSeconds = normalizeTimeoutSeconds(
    body.value &&
      body.value.run_options &&
      body.value.run_options.timeout_seconds,
  );
  const database = normalizeDatabaseName(
    body.value &&
      body.value.run_options &&
      body.value.run_options.database,
  );
  const createdAt = new Date().toISOString();
  const runId = createRunId();
  const runDir = path.join(RUNS_DIR, runId);
  const specPath = path.join(runDir, SPEC_FILENAME);
  const outputPath = path.join(runDir, WORKLOAD_FILENAME);
  const workloadPath = outputPath;

  await fs.mkdir(runDir, { recursive: true });
  await fs.writeFile(specPath, specText, "utf8");

  const run = {
    run_id: runId,
    created_at: createdAt,
    status: "starting",
    progress_text: "Queued local benchmark run.",
    error: null,
    spec_path: specPath,
    workload_path: workloadPath,
    output_path: outputPath,
    run_dir: runDir,
    latest_spec_path: LATEST_SPEC_PATH,
    latest_workload_path: LATEST_WORKLOAD_PATH,
    timeout_seconds: timeoutSeconds,
    database,
    benchmark_stats: null,
    child: null,
    timeout_timer: null,
    started_at: null,
  };
  runs.set(runId, run);
  await fs.copyFile(specPath, LATEST_SPEC_PATH);

  startTectonicRun(run).catch((error) => {
    console.error("Run execution failed unexpectedly:", error);
    markRunFailed(
      run,
      "runner_execution_failed",
      "Runner failed to execute tectonic-cli.",
    );
  });

  sendJson(res, 202, {
    run_id: runId,
    status: "starting",
    created_at: createdAt,
    output_paths: buildOutputPaths(run),
    downloads: {
      spec_download_path:
        "/api/workloads/runs/" + encodeURIComponent(runId) + "/download/spec",
      output_download_path:
        "/api/workloads/runs/" + encodeURIComponent(runId) + "/download/output",
    },
  });
}

async function handleRunStatus(res, runId) {
  const run = runs.get(runId);
  if (!run) {
    sendJson(res, 404, {
      error: "Run not found.",
      code: "run_not_found",
    });
    return;
  }

  const specStat = await safeStat(run.spec_path);
  const workloadStat = await safeStat(run.workload_path);

  sendJson(res, 200, {
    run_id: run.run_id,
    status: run.status,
    progress_text: run.progress_text,
    error: run.error,
    output_paths: buildOutputPaths(run),
    artifacts: [
      {
        kind: "spec",
        filename: SPEC_FILENAME,
        ready: !!specStat,
        bytes: specStat ? specStat.size : null,
      },
      {
        kind: "output",
        filename: WORKLOAD_FILENAME,
        ready: !!workloadStat,
        bytes: workloadStat ? workloadStat.size : null,
      },
    ],
    links: buildRunLinks(run.run_id, run.status),
    created_at: run.created_at,
    benchmark_stats:
      run.benchmark_stats && typeof run.benchmark_stats === "object"
        ? run.benchmark_stats
        : null,
  });
}

async function handleCancelRun(res, runId) {
  const run = runs.get(runId);
  if (!run) {
    sendJson(res, 404, {
      error: "Run not found.",
      code: "run_not_found",
    });
    return;
  }

  if (!ACTIVE_STATUSES.has(run.status)) {
    sendJson(res, 200, {
      run_id: run.run_id,
      status: run.status,
      cancelled: run.status === "cancelled",
    });
    return;
  }

  run.status = "cancelled";
  run.progress_text = "Cancellation requested.";
  run.error = null;
  clearRunTimeout(run);

  if (run.child) {
    try {
      run.child.kill("SIGTERM");
    } catch {
      // Ignore cancellation kill errors.
    }
  }

  sendJson(res, 200, {
    run_id: run.run_id,
    status: "cancelled",
    cancelled: true,
  });
}

async function handleDownloadArtifact(res, runId, kind) {
  const run = runs.get(runId);
  if (!run) {
    sendJson(res, 404, {
      error: "Run not found.",
      code: "run_not_found",
    });
    return;
  }

  const filePath = kind === "spec" ? run.spec_path : run.workload_path;
  const filename = kind === "spec" ? SPEC_FILENAME : WORKLOAD_FILENAME;
  const contentType =
    kind === "spec" ? "application/json; charset=utf-8" : "text/plain; charset=utf-8";
  const stat = await safeStat(filePath);

  if (!stat) {
    if (kind === "output") {
      sendJson(res, 409, {
        error: "Benchmark output is not ready yet.",
        code: "artifact_not_ready",
      });
    } else {
      sendJson(res, 404, {
        error: "Spec artifact not found.",
        code: "artifact_not_found",
      });
    }
    return;
  }

  res.statusCode = 200;
  res.setHeader("content-type", contentType);
  res.setHeader("content-length", String(stat.size));
  res.setHeader(
    "content-disposition",
    'attachment; filename="' + filename + '"',
  );
  createReadStream(filePath).pipe(res);
}

function buildRunLinks(runId, status) {
  const terminal = TERMINAL_STATUSES.has(status);
  return {
    spec_download_path:
      "/api/workloads/runs/" + encodeURIComponent(runId) + "/download/spec",
    output_download_path:
      "/api/workloads/runs/" + encodeURIComponent(runId) + "/download/output",
    cancel_path: terminal
      ? null
      : "/api/workloads/runs/" + encodeURIComponent(runId) + "/cancel",
  };
}

function buildOutputPaths(run) {
  return {
    known_output_dir: KNOWN_OUTPUT_DIR,
    run_dir: run.run_dir,
    spec_path: run.spec_path,
    benchmark_output_path: run.output_path,
    workload_path: run.workload_path,
    latest_spec_path: run.latest_spec_path || LATEST_SPEC_PATH,
    latest_output_path: run.latest_workload_path || LATEST_WORKLOAD_PATH,
  };
}

async function startTectonicRun(run) {
  run.started_at = Date.now();
  run.status = "running";
  run.progress_text = "Running tectonic-cli benchmark...";
  run.error = null;
  run.benchmark_stats = null;

  let stderrTail = "";
  let stdoutTail = "";
  let stderrText = "";
  let stdoutText = "";

  const args = ["benchmark", "-w", run.spec_path, "-d", run.database];
  const child = spawn(TECTONIC_BIN, args, {
    stdio: ["ignore", "pipe", "pipe"],
  });
  run.child = child;

  child.stdout.on("data", (chunk) => {
    stdoutTail = appendTail(stdoutTail, chunk);
    stdoutText = appendOutputText(stdoutText, chunk);
    if (stdoutTail.trim()) {
      run.progress_text = trimLine(stdoutTail);
    }
  });

  child.stderr.on("data", (chunk) => {
    stderrTail = appendTail(stderrTail, chunk);
    stderrText = appendOutputText(stderrText, chunk);
    if (stderrTail.trim()) {
      run.progress_text = trimLine(stderrTail);
    }
  });

  run.timeout_timer = setTimeout(() => {
    if (!ACTIVE_STATUSES.has(run.status)) {
      return;
    }
    run.status = "timed_out";
    run.progress_text = "Run timed out.";
    run.error = {
      code: "run_timed_out",
      message: "Run exceeded timeout of " + run.timeout_seconds + " seconds.",
    };
    try {
      child.kill("SIGTERM");
    } catch {
      // Ignore kill failures during timeout.
    }
  }, run.timeout_seconds * 1000);

  const exit = await waitForChild(child);
  clearRunTimeout(run);
  run.child = null;

  if (run.status === "cancelled" || run.status === "timed_out") {
    return;
  }

  if (
    exit.error &&
    typeof exit.error === "object" &&
    exit.error.code === "ENOENT"
  ) {
    run.status = "failed";
    run.progress_text = "tectonic-cli binary not found.";
    run.error = {
      code: "tectonic_cli_not_found",
      message: buildMissingTectonicCliMessage(TECTONIC_BIN),
    };
    return;
  }

  if (exit.code !== 0) {
    const detail = trimLine(stderrTail || stdoutTail);
    run.status = "failed";
    run.progress_text = "tectonic-cli benchmark failed.";
    run.error = {
      code: exit.signal ? "tectonic_killed" : "tectonic_failed",
      message: detail
        ? "tectonic-cli failed: " + detail
        : "tectonic-cli exited with code " + String(exit.code) + ".",
    };
    return;
  }

  const combinedOutput = [stdoutText.trim(), stderrText.trim()]
    .filter(Boolean)
    .join("\n");
  if (!combinedOutput.trim()) {
    markRunFailed(
      run,
      "no_benchmark_output",
      "tectonic-cli completed but produced no benchmark output.",
    );
    return;
  }

  try {
    await fs.writeFile(run.workload_path, combinedOutput, "utf8");
  } catch (error) {
    markRunFailed(
      run,
      "output_write_failed",
      "Failed to write benchmark output file: " +
        (error && error.message ? error.message : "unknown error"),
    );
    return;
  }

  const workloadStat = await safeStat(run.workload_path);
  if (!workloadStat) {
    markRunFailed(
      run,
      "artifact_missing",
      "Failed to write benchmark output artifact.",
    );
    return;
  }

  try {
    await fs.copyFile(
      run.workload_path,
      run.latest_workload_path || LATEST_WORKLOAD_PATH,
    );
  } catch (error) {
    markRunFailed(
      run,
      "latest_artifact_write_failed",
      "Benchmark completed but failed to write latest output file: " +
        (error && error.message ? error.message : "unknown error"),
    );
    return;
  }

  run.benchmark_stats = parseBenchmarkStats(combinedOutput);
  run.status = "succeeded";
  run.progress_text = buildBenchmarkCompletionText(run.benchmark_stats);
  run.error = null;
}

function markRunFailed(run, code, message) {
  run.status = "failed";
  run.progress_text = "Benchmark run failed.";
  run.error = {
    code,
    message,
  };
}

async function waitForChild(child) {
  return await new Promise((resolve) => {
    child.on("error", (error) => {
      resolve({ code: 1, signal: null, error });
    });
    child.on("close", (code, signal) => {
      resolve({
        code: Number.isFinite(code) ? code : 1,
        signal: signal || null,
      });
    });
  });
}

function clearRunTimeout(run) {
  if (run.timeout_timer) {
    clearTimeout(run.timeout_timer);
    run.timeout_timer = null;
  }
}

async function readJsonBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    chunks.push(buf);
    total += buf.length;
    if (total > MAX_SPEC_BYTES * 2) {
      return {
        ok: false,
        status: 413,
        code: "request_too_large",
        error: "Request body is too large.",
      };
    }
  }
  if (chunks.length === 0) {
    return {
      ok: false,
      status: 400,
      code: "invalid_json",
      error: "Invalid JSON request body.",
    };
  }
  const text = Buffer.concat(chunks).toString("utf8");
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return {
      ok: false,
      status: 400,
      code: "invalid_json",
      error: "Invalid JSON request body.",
    };
  }
}

function normalizeSpecPayload(rawSpec) {
  if (Array.isArray(rawSpec)) {
    return { sections: rawSpec };
  }
  if (rawSpec && typeof rawSpec === "object") {
    try {
      return JSON.parse(JSON.stringify(rawSpec));
    } catch {
      return null;
    }
  }
  return null;
}

function createRunId() {
  return "run-" + randomUUID().replace(/-/g, "").slice(0, 20);
}

function normalizeTimeoutSeconds(rawValue) {
  const parsed = parseInteger(rawValue, DEFAULT_TIMEOUT_SECONDS);
  const cappedMax = Math.max(MIN_TIMEOUT_SECONDS, MAX_TIMEOUT_SECONDS);
  return clamp(parsed, MIN_TIMEOUT_SECONDS, cappedMax);
}

function buildListenErrorMessage(error) {
  const code = error && typeof error.code === "string" ? error.code : "";
  const base =
    "Local tectonic runner failed to listen on http://" +
    HOST +
    ":" +
    PORT +
    ".";
  if (code === "EADDRINUSE") {
    return (
      base +
      " Address already in use. Stop the existing service or change LOCAL_RUNNER_PORT."
    );
  }
  if (code === "EACCES" || code === "EPERM") {
    return (
      base +
      " Permission denied. Check local security/network policy or use a different port."
    );
  }
  const detail = error && error.message ? error.message : "unknown error";
  return base + " " + detail;
}

function buildMissingTectonicCliMessage(binaryName) {
  const bin = String(binaryName || "tectonic-cli");
  return [
    '"' + bin + '" was not found in PATH.',
    "Build it from ~/src/Tectonic:",
    "`cd ~/src/Tectonic && cargo build --release --bin tectonic-cli`.",
    "Then add it to PATH, for example:",
    "`mkdir -p ~/.cargo/bin && ln -sf ~/src/Tectonic/target/release/tectonic-cli ~/.cargo/bin/tectonic-cli`.",
    "Ensure ~/.cargo/bin is in PATH and retry.",
  ].join(" ");
}

function parseBenchmarkStats(outputText) {
  const text = String(outputText || "");
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const overall = [];
  const operations = [];
  const operationMap = new Map();

  lines.forEach((line) => {
    const match = line.match(/^\[([^\]]+)\]\s+([^:]+):\s+(.+)$/);
    if (!match) {
      return;
    }
    const sectionLabel = match[1].trim();
    const metricLabel = match[2].trim();
    const metricValue = match[3].trim();
    const metric = {
      key: toMetricKey(metricLabel),
      label: metricLabel,
      value: metricValue,
    };

    if (sectionLabel.toLowerCase() === "overall") {
      overall.push(metric);
      return;
    }

    const sectionKey = toMetricKey(sectionLabel);
    let bucket = operationMap.get(sectionKey);
    if (!bucket) {
      bucket = {
        key: sectionKey,
        name: sectionLabel,
        metrics: [],
      };
      operationMap.set(sectionKey, bucket);
      operations.push(bucket);
    }
    bucket.metrics.push(metric);
  });

  return {
    overall,
    operations,
  };
}

function buildBenchmarkCompletionText(stats) {
  const overall = stats && Array.isArray(stats.overall) ? stats.overall : [];
  const throughput = overall.find((entry) => {
    return (
      entry &&
      typeof entry.key === "string" &&
      entry.key === "throughput_using_start_and_end_time_ops_ms"
    );
  });
  if (throughput && typeof throughput.value === "string" && throughput.value) {
    return "Benchmark completed. Throughput: " + throughput.value + " ops/ms.";
  }
  return "Benchmark completed. Stats are available below.";
}

function appendTail(current, chunk) {
  const text = (current || "") + Buffer.from(chunk).toString("utf8");
  return text.slice(-4000);
}

function appendOutputText(current, chunk) {
  const text = (current || "") + Buffer.from(chunk).toString("utf8");
  return text.slice(-1024 * 1024);
}

function trimLine(text) {
  const cleaned = String(text || "").trim();
  if (!cleaned) {
    return "";
  }
  const lines = cleaned
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length > 0 ? lines[lines.length - 1] : cleaned;
}

async function safeStat(filePath) {
  try {
    return await fs.stat(filePath);
  } catch {
    return null;
  }
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload || {});
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.setHeader("content-length", Buffer.byteLength(body));
  res.end(body);
}

function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(String(value || ""));
  } catch {
    return "";
  }
}

function parseInteger(rawValue, fallback) {
  const value = Number.parseInt(String(rawValue ?? ""), 10);
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeDatabaseName(rawValue) {
  const value = String(rawValue || "").trim();
  return value || DEFAULT_DATABASE;
}

function toMetricKey(label) {
  return String(label || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
