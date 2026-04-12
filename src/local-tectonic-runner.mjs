import http from "node:http";
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
const LATEST_OUTPUT_PATH = path.join(
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
  7200,
);
const MAX_PARALLEL_RUNS = parseInteger(process.env.RUN_MAX_PARALLEL_RUNS, 8);
const DEFAULT_TIMEOUT_SECONDS = 7200;
const MIN_TIMEOUT_SECONDS = 30;
const OUTPUT_FILENAME = "benchmark-output.txt";
const SPEC_FILENAME = "spec.json";
const META_FILENAME = "meta.json";
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
    latest_output_path: LATEST_OUTPUT_PATH,
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
    if (method === "GET") {
      await handleListRuns(res);
      return;
    }
    if (method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }
    await handleStartRun(req, res);
    return;
  }

  const runMatch = pathname.match(
    /^\/api\/workloads\/runs\/([^/]+)(?:\/(cancel|download\/spec|download\/output))?$/,
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

  if (action === "download/output") {
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

async function handleListRuns(res) {
  try {
    const entries = await fs.readdir(RUNS_DIR).catch(() => []);
    const runDirs = entries.filter((e) => e.startsWith("run-")).sort().reverse();
    // Limit to last 20 runs
    const limited = runDirs.slice(0, 20);
    const results = [];
    for (const dir of limited) {
      const runId = dir;
      const runDir = path.join(RUNS_DIR, dir);
      const outputPath = path.join(runDir, OUTPUT_FILENAME);
      const metaPath = path.join(runDir, META_FILENAME);
      // Try to read persisted metadata
      let meta = null;
      try {
        meta = JSON.parse(await fs.readFile(metaPath, "utf8"));
      } catch (_e) { /* no meta file — legacy run */ }
      // Try to detect database from the first line of output
      let database = (meta && meta.database) || null;
      let benchmarkStats = null;
      let createdAt = (meta && meta.created_at) || null;
      if (!createdAt) {
        try {
          const stat = await fs.stat(runDir);
          createdAt = stat.birthtime ? stat.birthtime.toISOString() : stat.mtime.toISOString();
        } catch (_e) { /* ignore */ }
      }
      try {
        const outputText = await fs.readFile(outputPath, "utf8");
        benchmarkStats = parseBenchmarkStats(outputText);
        if (!database) {
          const firstLine = outputText.split("\n")[0] || "";
          const dbMatch = firstLine.match(/--database\s+(\S+)/);
          if (dbMatch) database = dbMatch[1];
        }
      } catch (_e) { /* no output yet */ }
      results.push({
        run_id: runId,
        status: benchmarkStats ? "succeeded" : "unknown",
        database: database,
        created_at: createdAt,
        benchmark_stats: benchmarkStats,
        batch_id: (meta && meta.batch_id) || null,
        batch_index: (meta && Number.isFinite(meta.batch_index)) ? meta.batch_index : null,
        batch_size: (meta && Number.isFinite(meta.batch_size)) ? meta.batch_size : null,
        links: buildRunLinks(runId, benchmarkStats ? "succeeded" : "unknown"),
      });
    }
    // For runs without a persisted batch_id, fall back to timestamp clustering
    const needsClustering = results.filter(function (r) { return !r.batch_id; });
    if (needsClustering.length > 0) {
      needsClustering.sort(function (a, b) { return String(a.created_at || "").localeCompare(String(b.created_at || "")); });
      let currentBatchId = null;
      let currentBatchTime = null;
      let batchIdx = 0;
      const batchMembers = new Map();
      for (const run of needsClustering) {
        const t = run.created_at ? new Date(run.created_at).getTime() : 0;
        if (currentBatchTime === null || Math.abs(t - currentBatchTime) > 30000) {
          currentBatchId = "hist-" + (run.run_id || String(Date.now()));
          currentBatchTime = t;
          batchIdx = 0;
          batchMembers.set(currentBatchId, []);
        }
        run.batch_id = currentBatchId;
        run.batch_index = batchIdx++;
        batchMembers.get(currentBatchId).push(run);
        currentBatchTime = t;
      }
      for (const [bid, members] of batchMembers) {
        for (const m of members) {
          m.batch_size = members.length;
        }
      }
    }

    sendJson(res, 200, { runs: results });
  } catch (error) {
    sendJson(res, 500, { error: "Failed to list runs.", details: String(error.message || error) });
  }
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
  const runOptions =
    body.value && body.value.run_options && typeof body.value.run_options === "object"
      ? body.value.run_options
      : {};
  const databases = normalizeDatabaseBatch(
    runOptions.databases,
    runOptions.database,
  );
  const batchId = databases.length > 1 ? createBatchId() : null;
  const startedRuns = [];
  for (let index = 0; index < databases.length; index += 1) {
    const run = await queueRun({
      normalizedSpec,
      specText,
      timeoutSeconds,
      database: databases[index],
      benchmarkOptions: resolveDatabaseBenchmarkOptions(
        databases[index],
        runOptions,
      ),
      batchId,
      batchIndex: index + 1,
      batchSize: databases.length,
    });
    startedRuns.push(run);
  }

  if (startedRuns.length === 1) {
    sendJson(res, 202, buildStartRunResponse(startedRuns[0]));
    return;
  }

  sendJson(res, 202, {
    batch_id: batchId,
    status: "starting",
    requested_runs: databases.length,
    runs: startedRuns.map((run) => buildStartRunResponse(run)),
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
  const outputStat = await safeStat(run.output_path);

  sendJson(res, 200, {
    run_id: run.run_id,
    status: run.status,
    progress_text: run.progress_text,
    progress: run.progress,
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
        filename: OUTPUT_FILENAME,
        ready: !!outputStat,
        bytes: outputStat ? outputStat.size : null,
      },
    ],
    links: buildRunLinks(run.run_id, run.status),
    created_at: run.created_at,
    batch_id: run.batch_id || null,
    batch_index: Number.isFinite(run.batch_index) ? run.batch_index : null,
    batch_size: Number.isFinite(run.batch_size) ? run.batch_size : null,
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
  setRunProgressText(run, "Cancellation requested.");
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

  const filePath = kind === "spec" ? run.spec_path : run.output_path;
  const filename = kind === "spec" ? SPEC_FILENAME : OUTPUT_FILENAME;
  const contentType =
    kind === "spec"
      ? "application/json; charset=utf-8"
      : "text/plain; charset=utf-8";
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
    latest_spec_path: run.latest_spec_path || LATEST_SPEC_PATH,
    latest_output_path: run.latest_output_path || LATEST_OUTPUT_PATH,
  };
}

function buildStartRunResponse(run) {
  return {
    run_id: run.run_id,
    status: "starting",
    created_at: run.created_at,
    progress_text: run.progress_text,
    progress: run.progress,
    database: run.database,
    batch_id: run.batch_id || null,
    batch_index: Number.isFinite(run.batch_index) ? run.batch_index : null,
    batch_size: Number.isFinite(run.batch_size) ? run.batch_size : null,
    output_paths: buildOutputPaths(run),
    links: buildRunLinks(run.run_id, "starting"),
    downloads: {
      spec_download_path:
        "/api/workloads/runs/" +
        encodeURIComponent(run.run_id) +
        "/download/spec",
      output_download_path:
        "/api/workloads/runs/" +
        encodeURIComponent(run.run_id) +
        "/download/output",
    },
  };
}

async function queueRun({
  normalizedSpec,
  specText,
  timeoutSeconds,
  database,
  benchmarkOptions,
  batchId,
  batchIndex,
  batchSize,
}) {
  const createdAt = new Date().toISOString();
  const runId = createRunId();
  const runDir = path.join(RUNS_DIR, runId);
  const specPath = path.join(runDir, SPEC_FILENAME);
  const outputPath = path.join(runDir, OUTPUT_FILENAME);
  const databasePath = resolvePerRunDatabasePath(
    runDir,
    database,
    benchmarkOptions && typeof benchmarkOptions.databasePath === "string"
      ? benchmarkOptions.databasePath
      : "",
  );

  await fs.mkdir(runDir, { recursive: true });
  if (databasePath) {
    await fs.mkdir(databasePath, { recursive: true });
  }
  await fs.writeFile(specPath, specText, "utf8");

  const run = {
    run_id: runId,
    created_at: createdAt,
    status: "starting",
    progress_text: "Queued local benchmark run.",
    progress: createRunProgress("Queued local benchmark run.", {
      indeterminate: true,
    }),
    error: null,
    spec_path: specPath,
    output_path: outputPath,
    run_dir: runDir,
    latest_spec_path: LATEST_SPEC_PATH,
    latest_output_path: LATEST_OUTPUT_PATH,
    timeout_seconds: timeoutSeconds,
    database,
    database_path: databasePath,
    config:
      benchmarkOptions && typeof benchmarkOptions.config === "string"
        ? benchmarkOptions.config
        : "",
    batch_id: batchId || null,
    batch_index: Number.isFinite(batchIndex) ? batchIndex : null,
    batch_size: Number.isFinite(batchSize) ? batchSize : null,
    benchmark_stats: null,
    progress_context: buildRunProgressContext(normalizedSpec),
    child: null,
    timeout_timer: null,
    started_at: null,
  };
  runs.set(runId, run);
  await fs.writeFile(
    path.join(runDir, META_FILENAME),
    JSON.stringify({
      batch_id: run.batch_id,
      batch_index: run.batch_index,
      batch_size: run.batch_size,
      database: run.database,
      created_at: run.created_at,
    }),
    "utf8",
  );
  await fs.copyFile(specPath, LATEST_SPEC_PATH);

  startTectonicRun(run).catch((error) => {
    console.error("Run execution failed unexpectedly:", error);
    markRunFailed(
      run,
      "runner_execution_failed",
      "Runner failed to execute tectonic-cli.",
    );
  });

  return run;
}

async function startTectonicRun(run) {
  run.started_at = Date.now();
  run.status = "running";
  setRunProgressText(run, "Running benchmark...");
  run.error = null;
  run.benchmark_stats = null;
  run.timeout_timer = setTimeout(() => {
    if (!ACTIVE_STATUSES.has(run.status)) {
      return;
    }
    run.status = "timed_out";
    setRunProgressText(run, "Run timed out.");
    run.error = {
      code: "run_timed_out",
      message: "Run exceeded timeout of " + run.timeout_seconds + " seconds.",
    };
    try {
      if (run.child) {
        run.child.kill("SIGTERM");
      }
    } catch {
      // Ignore kill failures during timeout.
    }
  }, run.timeout_seconds * 1000);
  try {
    const benchmarkArgs = buildTectonicBenchmarkArgs(run);
    const benchmarkResult = await runTectonicCommand(run, benchmarkArgs, {
      startText:
        "Running benchmark against " + String(run.database || DEFAULT_DATABASE) + "...",
      failureProgressText: "tectonic-cli benchmark failed.",
    });
    if (!benchmarkResult || !shouldContinueRun(run)) {
      return;
    }

    const benchmarkOutput = benchmarkResult.combinedOutput.trim();
    if (!benchmarkOutput) {
      markRunFailed(
        run,
        "no_benchmark_output",
        "tectonic-cli benchmark completed but produced no benchmark output.",
      );
      return;
    }

    const outputText = buildRunOutputLog(benchmarkArgs, benchmarkResult);
    try {
      await fs.writeFile(run.output_path, outputText, "utf8");
    } catch (error) {
      markRunFailed(
        run,
        "output_write_failed",
        "Failed to write benchmark output file: " +
          (error && error.message ? error.message : "unknown error"),
      );
      return;
    }

    const outputStat = await safeStat(run.output_path);
    if (!outputStat) {
      markRunFailed(
        run,
        "artifact_missing",
        "Failed to write benchmark output artifact.",
      );
      return;
    }

    try {
      await fs.copyFile(
        run.output_path,
        run.latest_output_path || LATEST_OUTPUT_PATH,
      );
    } catch (error) {
      markRunFailed(
        run,
        "latest_output_write_failed",
        "Benchmark completed but failed to write latest output file: " +
          (error && error.message ? error.message : "unknown error"),
      );
      return;
    }

    run.benchmark_stats = parseBenchmarkStats(benchmarkOutput);
    run.status = "succeeded";
    setRunProgressText(run, buildBenchmarkCompletionText(run.benchmark_stats));
    run.error = null;
  } finally {
    clearRunTimeout(run);
    run.child = null;
  }
}

function markRunFailed(run, code, message) {
  run.status = "failed";
  setRunProgressText(run, "Benchmark run failed.");
  run.error = {
    code,
    message,
  };
}

function setRunProgressText(run, text) {
  run.progress_text = String(text || "").trim();
  run.progress = buildRunProgress(run, run.progress_text);
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

function shouldContinueRun(run) {
  if (!run || typeof run !== "object") {
    return false;
  }
  if (run.status === "cancelled") {
    setRunProgressText(run, "Run cancelled.");
    return false;
  }
  if (run.status === "timed_out") {
    return false;
  }
  return true;
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

function createBatchId() {
  return "batch-" + randomUUID().replace(/-/g, "").slice(0, 16);
}

function normalizeTimeoutSeconds(rawValue) {
  const parsed = parseInteger(rawValue, DEFAULT_TIMEOUT_SECONDS);
  const cappedMax = Math.max(MIN_TIMEOUT_SECONDS, MAX_TIMEOUT_SECONDS);
  return clamp(parsed, MIN_TIMEOUT_SECONDS, cappedMax);
}

function normalizeDatabaseBatch(rawValues, fallbackValue) {
  const rawList = Array.isArray(rawValues) ? rawValues : [];
  const normalizedList = rawList
    .map((entry) => normalizeDatabaseName(entry))
    .filter(Boolean);
  const uniqueList = Array.from(new Set(normalizedList));
  if (uniqueList.length > 0) {
    return uniqueList.slice(0, Math.max(1, MAX_PARALLEL_RUNS));
  }
  return [normalizeDatabaseName(fallbackValue)];
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
    "Run `make up` from this repo to download the matching prebuilt tectonic-cli automatically, or set `TECTONIC_BIN` to an installed binary and retry.",
  ].join(" ");
}

function buildTectonicBenchmarkArgs(run) {
  const args = ["benchmark", "-w", run.spec_path, "--database", run.database];
  if (typeof run.database_path === "string" && run.database_path.trim()) {
    args.push("-p", run.database_path.trim());
  }
  if (typeof run.config === "string" && run.config.trim()) {
    args.push("-c", run.config.trim());
  }
  return args;
}

async function runTectonicCommand(run, args, options = {}) {
  console.log("Running tectonic-cli from:", TECTONIC_BIN);
  const child = spawn(TECTONIC_BIN, args, {
    stdio: ["ignore", "pipe", "pipe"],
  });
  run.child = child;
  run.status = "running";
  run.error = null;
  setRunProgressText(
    run,
    typeof options.startText === "string" && options.startText.trim()
      ? options.startText.trim()
      : "Running tectonic-cli...",
  );

  let stderrTail = "";
  let stdoutTail = "";
  let stderrText = "";
  let stdoutText = "";

  child.stdout.on("data", (chunk) => {
    stdoutTail = appendTail(stdoutTail, chunk);
    stdoutText = appendOutputText(stdoutText, chunk);
    if (stdoutTail.trim()) {
      setRunProgressText(run, trimLine(stdoutTail));
    }
  });

  child.stderr.on("data", (chunk) => {
    stderrTail = appendTail(stderrTail, chunk);
    stderrText = appendOutputText(stderrText, chunk);
    if (stderrTail.trim()) {
      setRunProgressText(run, trimLine(stderrTail));
    }
  });

  const exit = await waitForChild(child);
  run.child = null;

  if (!shouldContinueRun(run)) {
    return null;
  }

  if (
    exit.error &&
    typeof exit.error === "object" &&
    exit.error.code === "ENOENT"
  ) {
    run.status = "failed";
    setRunProgressText(run, "tectonic-cli binary not found.");
    run.error = {
      code: "tectonic_cli_not_found",
      message: buildMissingTectonicCliMessage(TECTONIC_BIN),
    };
    return null;
  }

  if (exit.code !== 0) {
    const detail = trimLine(stderrTail || stdoutTail);
    run.status = "failed";
    setRunProgressText(
      run,
      typeof options.failureProgressText === "string" &&
        options.failureProgressText.trim()
        ? options.failureProgressText.trim()
        : "tectonic-cli failed.",
    );
    run.error = {
      code: exit.signal ? "tectonic_killed" : "tectonic_failed",
      message: detail
        ? "tectonic-cli failed: " + detail
        : "tectonic-cli exited with code " + String(exit.code) + ".",
    };
    return null;
  }

  return {
    stdoutText,
    stderrText,
    combinedOutput: [stdoutText.trim(), stderrText.trim()]
      .filter(Boolean)
      .join("\n"),
  };
}

function buildRunOutputLog(benchmarkArgs, benchmarkResult) {
  const parts = [];
  parts.push("$ " + [TECTONIC_BIN, ...benchmarkArgs].join(" "));
  if (benchmarkResult && typeof benchmarkResult.combinedOutput === "string") {
    const benchmarkOutput = benchmarkResult.combinedOutput.trim();
    if (benchmarkOutput) {
      parts.push(benchmarkOutput);
    }
  }
  return parts.filter(Boolean).join("\n\n");
}

function parseBenchmarkStats(outputText) {
  const text = String(outputText || "");
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const overall = [];
  const operations = [];
  const phases = [];
  const operationMap = new Map();
  const phaseMap = new Map();
  let currentStatsSection = null;

  lines.forEach((line) => {
    const statsSection = parseStatsSectionHeader(line);
    if (statsSection) {
      currentStatsSection = statsSection;
      return;
    }

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
    const isOverallMetric = sectionLabel.toLowerCase() === "overall";

    if (!currentStatsSection) {
      if (isOverallMetric) {
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
      return;
    }

    if (currentStatsSection.type === "overall") {
      if (isOverallMetric) {
        overall.push(metric);
        return;
      }
      const overallSectionKey = toMetricKey(sectionLabel);
      let overallBucket = operationMap.get(overallSectionKey);
      if (!overallBucket) {
        overallBucket = {
          key: overallSectionKey,
          name: sectionLabel,
          metrics: [],
        };
        operationMap.set(overallSectionKey, overallBucket);
        operations.push(overallBucket);
      }
      overallBucket.metrics.push(metric);
      return;
    }

    let phaseBucket = phaseMap.get(currentStatsSection.name);
    if (!phaseBucket) {
      phaseBucket = {
        key: toMetricKey(currentStatsSection.name),
        name: currentStatsSection.name,
        metrics: [],
      };
      phaseMap.set(currentStatsSection.name, phaseBucket);
      phases.push(phaseBucket);
    }
    phaseBucket.metrics.push({
      key: metric.key,
      label:
        sectionLabel.toLowerCase() === "overall"
          ? "Overall " + metricLabel
          : sectionLabel + " " + metricLabel,
      value: metricValue,
    });
  });

  return {
    overall,
    operations,
    phases,
  };
}

function buildRunProgressContext(spec) {
  const sections =
    spec && Array.isArray(spec.sections) ? spec.sections : [];
  let totalGroups = 0;
  const sectionOffsets = [];

  sections.forEach((section) => {
    sectionOffsets.push(totalGroups);
    const groups =
      section && Array.isArray(section.groups) ? section.groups : [];
    totalGroups += groups.length;
  });

  return {
    total_groups: totalGroups,
    section_offsets: sectionOffsets,
  };
}

function buildRunProgress(run, label) {
  const text = String(label || "").trim();
  const parsed = parseGeneratingProgress(run && run.progress_context, text);
  if (parsed) {
    return parsed;
  }
  const executeProgress = parseExecutingProgress(text);
  if (executeProgress) {
    return executeProgress;
  }

  if (run && run.status === "succeeded") {
    const totalGroups =
      run &&
      run.progress_context &&
      Number.isFinite(run.progress_context.total_groups)
        ? run.progress_context.total_groups
        : null;
    return createRunProgress(text || "Benchmark completed.", {
      current: totalGroups,
      total: totalGroups,
      percent: 100,
      indeterminate: false,
    });
  }

  if (run && ACTIVE_STATUSES.has(run.status)) {
    return createRunProgress(text || "Running tectonic-cli benchmark...", {
      indeterminate: true,
    });
  }

  return createRunProgress(text || "Benchmark status updated.", {
    indeterminate: false,
  });
}

function parseGeneratingProgress(progressContext, label) {
  const match = String(label || "").match(
    /^\[Generating\]\s*Section\s+(\d+)\s*\|\s*Group\s+(\d+)$/i,
  );
  if (!match) {
    return null;
  }

  const sectionIndex = Number.parseInt(match[1], 10);
  const groupIndex = Number.parseInt(match[2], 10);
  const context =
    progressContext && typeof progressContext === "object"
      ? progressContext
      : null;
  const sectionOffsets =
    context && Array.isArray(context.section_offsets)
      ? context.section_offsets
      : [];
  const totalGroups =
    context && Number.isFinite(context.total_groups)
      ? context.total_groups
      : 0;

  if (
    !Number.isFinite(sectionIndex) ||
    !Number.isFinite(groupIndex) ||
    sectionIndex < 0 ||
    groupIndex < 0 ||
    sectionIndex >= sectionOffsets.length
  ) {
    return createRunProgress("Generating workload groups...", {
      indeterminate: true,
    });
  }

  const currentGroup = sectionOffsets[sectionIndex] + groupIndex + 1;
  const friendlyLabel =
    "Generating group " +
    String(currentGroup) +
    " of " +
    String(Math.max(totalGroups, currentGroup)) +
    ".";

  if (totalGroups > 1) {
    const completedGroups = Math.max(0, currentGroup - 1);
    return createRunProgress(friendlyLabel, {
      current: currentGroup,
      total: totalGroups,
      percent: Math.round((completedGroups / totalGroups) * 100),
      indeterminate: false,
    });
  }

  return createRunProgress(friendlyLabel, {
    current: currentGroup,
    total: totalGroups || currentGroup,
    indeterminate: true,
  });
}

function parseExecutingProgress(label) {
  const text = String(label || "").trim();
  if (!text) {
    return null;
  }
  const match = text.match(/(\d{1,3})%\s*\(([^)]*)\)\s*$/);
  if (!match) {
    return null;
  }
  const percent = clamp(Number.parseInt(match[1], 10), 0, 100);
  const eta = String(match[2] || "").trim();
  const progressLabel =
    "Running benchmark" +
    (Number.isFinite(percent) ? " (" + String(percent) + "%)" : ".") +
    (eta ? " • " + eta + " remaining" : "");
  return createRunProgress(progressLabel, {
    percent,
    indeterminate: false,
  });
}

function createRunProgress(label, options) {
  const opts = options && typeof options === "object" ? options : {};
  const percent = Number.isFinite(opts.percent)
    ? clamp(Math.round(opts.percent), 0, 100)
    : null;
  return {
    label: String(label || "").trim(),
    current: Number.isFinite(opts.current) ? Math.max(0, opts.current) : null,
    total: Number.isFinite(opts.total) ? Math.max(0, opts.total) : null,
    percent,
    indeterminate:
      typeof opts.indeterminate === "boolean"
        ? opts.indeterminate
        : !Number.isFinite(percent),
  };
}

function buildBenchmarkCompletionText(stats) {
  const overall = stats && Array.isArray(stats.overall) ? stats.overall : [];
  const throughput = overall.find((entry) => {
    return (
      entry &&
      typeof entry.key === "string" &&
      (entry.key === "throughput_using_start_and_end_time_ops_ms" ||
        entry.key === "throughput_using_start_and_end_time")
    );
  });
  if (throughput && typeof throughput.value === "string" && throughput.value) {
    const parsedThroughput = Number.parseFloat(
      String(throughput.value).replace(/,/g, "").trim(),
    );
    if (Number.isFinite(parsedThroughput)) {
      const rawThroughput = String(throughput.value).trim().toLowerCase();
      const throughputSec =
        rawThroughput.indexOf("ops/ms") !== -1
          ? parsedThroughput * 1000
          : parsedThroughput;
      return (
        "Benchmark completed. Throughput: " +
        throughputSec.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }) +
        " ops/sec."
      );
    }
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

function normalizeOptionalString(rawValue) {
  const value = String(rawValue || "").trim();
  return value || "";
}

function databaseKeyForEnv(database) {
  return String(database || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function resolvePerRunDatabasePath(runDir, database, configuredPath) {
  const explicitPath = normalizeOptionalString(configuredPath);
  if (explicitPath) {
    return explicitPath;
  }
  const normalizedDatabase = normalizeDatabaseName(database).toLowerCase();
  if (normalizedDatabase === "rocksdb") {
    return path.join(runDir, "db", normalizedDatabase);
  }
  return "";
}

function readDatabaseOptionMap(mapValue, database) {
  if (!mapValue || typeof mapValue !== "object" || Array.isArray(mapValue)) {
    return "";
  }
  const normalizedDatabase = normalizeDatabaseName(database);
  const key = databaseKeyForEnv(normalizedDatabase);
  return normalizeOptionalString(
    mapValue[normalizedDatabase] ??
      mapValue[normalizedDatabase.toLowerCase()] ??
      mapValue[key],
  );
}

function resolveDatabaseBenchmarkOptions(database, runOptions = {}, env = process.env) {
  const normalizedDatabase = normalizeDatabaseName(database);
  const dbKey = databaseKeyForEnv(normalizedDatabase);
  const safeRunOptions =
    runOptions && typeof runOptions === "object" && !Array.isArray(runOptions)
      ? runOptions
      : {};
  const safeEnv =
    env && typeof env === "object" && !Array.isArray(env) ? env : {};

  const requestedPath =
    readDatabaseOptionMap(safeRunOptions.database_paths, normalizedDatabase) ||
    normalizeOptionalString(safeRunOptions.database_path);
  const requestedConfig =
    readDatabaseOptionMap(safeRunOptions.database_configs, normalizedDatabase) ||
    normalizeOptionalString(safeRunOptions.config);

  const envPath =
    normalizeOptionalString(safeEnv["RUN_DATABASE_PATH_" + dbKey]) ||
    (normalizedDatabase.toLowerCase() === "cassandra"
      ? normalizeOptionalString(safeEnv.CASSANDRA_DATABASE_PATH) || "127.0.0.1"
      : "") ||
    (normalizedDatabase.toLowerCase() === "scylla"
      ? normalizeOptionalString(safeEnv.SCYLLA_DATABASE_PATH) || "127.0.0.1"
      : "") ||
    normalizeOptionalString(safeEnv.RUN_DATABASE_PATH);
  const envConfig =
    normalizeOptionalString(safeEnv["RUN_DATABASE_CONFIG_" + dbKey]) ||
    normalizeOptionalString(safeEnv.RUN_DATABASE_CONFIG);

  return {
    databasePath: requestedPath || envPath,
    config: requestedConfig || envConfig,
  };
}

function parseStatsSectionHeader(line) {
  const text = String(line || "").trim();
  if (!text) {
    return null;
  }
  const overallMatch = text.match(/^\[\[\*{3}Overall Stats\*{3}\]\]$/i);
  if (overallMatch) {
    return {
      type: "overall",
      name: "Overall Stats",
    };
  }
  const phaseMatch = text.match(/^\[\[\*{3}Stats for (.+?)\*{3}\]\]$/i);
  if (!phaseMatch) {
    return null;
  }
  return {
    type: "phase",
    name: String(phaseMatch[1] || "").trim(),
  };
}

function toMetricKey(label) {
  return String(label || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export const __test = {
  buildTectonicBenchmarkArgs,
  parseBenchmarkStats,
  parseStatsSectionHeader,
  resolvePerRunDatabasePath,
  resolveDatabaseBenchmarkOptions,
};
