(function () {
  const ACTIVE_STATUSES = new Set(["starting", "running"]);
  const TERMINAL_STATUSES = new Set([
    "succeeded",
    "failed",
    "cancelled",
    "timed_out",
  ]);
  const START_ENDPOINT = "/api/workloads/runs";
  const POLL_INTERVAL_MS = 2500;

  function defaultNoop() {}

  function normalizeErrorMessage(errorLike) {
    if (
      errorLike &&
      typeof errorLike.message === "string" &&
      errorLike.message.trim()
    ) {
      return errorLike.message.trim();
    }
    return "Unexpected workload-run error.";
  }

  async function parseJsonResponse(response) {
    let body = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    if (!response.ok) {
      const message =
        body && typeof body.error === "string"
          ? body.error
          : "HTTP " + response.status;
      const error = new Error(message);
      error.status = response.status;
      error.code = body && typeof body.code === "string" ? body.code : "";
      error.body = body && typeof body === "object" ? body : null;
      throw error;
    }
    return body && typeof body === "object" ? body : {};
  }

  function formatApiError(errorLike) {
    const message = normalizeErrorMessage(errorLike);
    const body =
      errorLike &&
      typeof errorLike === "object" &&
      errorLike.body &&
      typeof errorLike.body === "object"
        ? errorLike.body
        : null;
    if (!body) {
      return message;
    }
    const parts = [message];
    if (typeof body.hint === "string" && body.hint.trim()) {
      parts.push(body.hint.trim());
    }
    if (typeof body.runner_url === "string" && body.runner_url.trim()) {
      parts.push("Runner URL: " + body.runner_url.trim() + ".");
    }
    return parts.join(" ");
  }

  function createRunId() {
    return (
      "local-" +
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2, 7)
    );
  }

  function formatLocalTime(isoLike) {
    const date = isoLike ? new Date(isoLike) : new Date();
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function toStatusClass(status) {
    const value = String(status || "")
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_");
    return value || "running";
  }

  function statusLabel(status) {
    const text = String(status || "").trim();
    return text ? text.replace(/_/g, " ") : "running";
  }

  function normalizeMetricsList(value) {
    return Array.isArray(value)
      ? value.filter((entry) => {
          return (
            entry &&
            typeof entry === "object" &&
            typeof entry.label === "string" &&
            typeof entry.value === "string"
          );
        })
      : [];
  }

  function formatMetricLabel(label) {
    const normalized = String(label || "").trim();
    const replacements = {
      Count: "Operations",
      "Successful Operations Count": "Successful Ops",
      "Total Latency": "Total Latency",
      "Average Latency": "Avg Latency",
      "Minimum Latency": "Min Latency",
      "Maximum Latency": "Max Latency",
      "95th Percentile Latency": "P95 Latency",
      "99th Percentile Latency": "P99 Latency",
      "Total Operations": "Total Ops",
      "Throughput (using start and end time) (ops/ms)": "Throughput",
      "Throughput (using aggregate operation times) (ops/ms)":
        "Throughput (CPU time)",
      "Total Time Spent (using start and end time)": "Wall Time",
      "Aggregate Operation Time": "Aggregate Op Time",
    };
    return replacements[normalized] || normalized;
  }

  function formatNumericString(value, fractionDigits) {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) {
      return value;
    }
    return parsed.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: fractionDigits,
    });
  }

  function formatMetricValue(metric) {
    const label = String(metric && metric.label ? metric.label : "").trim();
    const rawValue = String(metric && metric.value ? metric.value : "").trim();
    if (!rawValue) {
      return rawValue;
    }

    if (/^-?\d+$/.test(rawValue)) {
      return Number.parseInt(rawValue, 10).toLocaleString();
    }

    if (rawValue.endsWith("us")) {
      const numberPart = rawValue.slice(0, -2).trim();
      return formatNumericString(numberPart, 2) + " us";
    }

    if (rawValue.endsWith("ms")) {
      const numberPart = rawValue.slice(0, -2).trim();
      return formatNumericString(numberPart, 2) + " ms";
    }

    if (label.indexOf("Throughput") !== -1 && rawValue.indexOf("ops/ms") === -1) {
      return formatNumericString(rawValue, 2) + " ops/ms";
    }

    if (/^-?\d+(?:\.\d+)?$/.test(rawValue)) {
      return formatNumericString(rawValue, 2);
    }

    return rawValue;
  }

  function metricPriority(metric) {
    const key = metric && typeof metric.key === "string" ? metric.key : "";
    const order = {
      total_operations: 1,
      count: 1,
      successful_operations_count: 2,
      throughput_using_start_and_end_time_ops_ms: 3,
      throughput_using_aggregate_operation_times_ops_ms: 4,
      average_latency: 5,
      total_latency: 6,
      total_time_spent_using_start_and_end_time: 7,
      aggregate_operation_time: 8,
      minimum_latency: 9,
      maximum_latency: 10,
      percentile_95_latency: 11,
      percentile_99_latency: 12,
      p95_latency: 11,
      p99_latency: 12,
    };
    return order[key] || 100;
  }

  function sortMetrics(metrics) {
    return normalizeMetricsList(metrics)
      .slice()
      .sort((left, right) => {
        const priorityDelta = metricPriority(left) - metricPriority(right);
        if (priorityDelta !== 0) {
          return priorityDelta;
        }
        return formatMetricLabel(left.label).localeCompare(
          formatMetricLabel(right.label),
        );
      });
  }

  function buildMetricGrid(metrics) {
    const grid = document.createElement("div");
    grid.className = "benchmark-metric-grid";
    sortMetrics(metrics).forEach((metric) => {
      const item = document.createElement("div");
      item.className = "benchmark-metric";

      const label = document.createElement("div");
      label.className = "benchmark-metric-label";
      label.textContent = formatMetricLabel(metric.label);
      item.appendChild(label);

      const value = document.createElement("div");
      value.className = "benchmark-metric-value";
      value.textContent = formatMetricValue(metric);
      item.appendChild(value);

      grid.appendChild(item);
    });
    return grid;
  }

  function buildBenchmarkStats(stats) {
    if (!stats || typeof stats !== "object") {
      return null;
    }

    const overallMetrics = normalizeMetricsList(stats.overall);
    const operations = Array.isArray(stats.operations)
      ? stats.operations.filter((entry) => {
          return (
            entry &&
            typeof entry === "object" &&
            typeof entry.name === "string" &&
            normalizeMetricsList(entry.metrics).length > 0
          );
        })
      : [];

    if (overallMetrics.length === 0 && operations.length === 0) {
      return null;
    }

    const container = document.createElement("div");
    container.className = "benchmark-stats";

    if (overallMetrics.length > 0) {
      const section = document.createElement("section");
      section.className = "benchmark-section benchmark-section-overall";

      const title = document.createElement("div");
      title.className = "benchmark-section-title";
      title.textContent = "Overall";
      section.appendChild(title);
      section.appendChild(buildMetricGrid(overallMetrics));
      container.appendChild(section);
    }

    if (operations.length > 0) {
      const operationsWrap = document.createElement("div");
      operationsWrap.className = "benchmark-operations";
      operations.forEach((operation) => {
        const section = document.createElement("section");
        section.className = "benchmark-section";

        const title = document.createElement("div");
        title.className = "benchmark-section-title";
        title.textContent = operation.name.replace(/_/g, " ");
        section.appendChild(title);
        section.appendChild(buildMetricGrid(normalizeMetricsList(operation.metrics)));
        operationsWrap.appendChild(section);
      });
      container.appendChild(operationsWrap);
    }

    return container;
  }

  function buildRunCard(run, actions) {
    const card = document.createElement("article");
    card.className = "run-card";

    const head = document.createElement("div");
    head.className = "run-card-head";
    const left = document.createElement("span");
    left.textContent = formatLocalTime(run.created_at);
    const badge = document.createElement("span");
    badge.className = "run-status-badge " + toStatusClass(run.status);
    badge.textContent = statusLabel(run.status);
    head.appendChild(left);
    head.appendChild(badge);
    card.appendChild(head);

    const progress = document.createElement("p");
    progress.className = "run-progress";
    progress.textContent = run.progress_text || "No status message.";
    card.appendChild(progress);

    if (
      run.output_paths &&
      ((typeof run.output_paths.latest_output_path === "string" &&
        run.output_paths.latest_output_path.trim()) ||
        (typeof run.output_paths.latest_workload_path === "string" &&
          run.output_paths.latest_workload_path.trim()))
    ) {
      const locationEl = document.createElement("p");
      locationEl.className = "run-location";
      locationEl.textContent =
        "Known output: " +
        (
          run.output_paths.latest_output_path ||
          run.output_paths.latest_workload_path
        ).trim();
      card.appendChild(locationEl);
    }

    if (
      run.error &&
      typeof run.error.message === "string" &&
      run.error.message.trim()
    ) {
      const errorEl = document.createElement("p");
      errorEl.className = "run-error";
      errorEl.textContent = run.error.message.trim();
      card.appendChild(errorEl);
    }

    const statsEl = buildBenchmarkStats(run.benchmark_stats);
    if (statsEl) {
      card.appendChild(statsEl);
    }

    const runActions = document.createElement("div");
    runActions.className = "run-actions";

    const specLink = document.createElement("a");
    specLink.className = "run-action-link";
    specLink.textContent = "Download Spec";
    specLink.href =
      run.links && run.links.spec_download_path
        ? run.links.spec_download_path
        : "#";
    specLink.target = "_blank";
    specLink.rel = "noopener noreferrer";
    if (!run.links || !run.links.spec_download_path) {
      specLink.classList.add("disabled");
      specLink.removeAttribute("href");
    }
    runActions.appendChild(specLink);

    const workloadLink = document.createElement("a");
    workloadLink.className = "run-action-link";
    workloadLink.textContent = "Download Benchmark Log";
    workloadLink.target = "_blank";
    workloadLink.rel = "noopener noreferrer";
    const workloadReady = Array.isArray(run.artifacts)
      ? run.artifacts.some(
          (entry) =>
            entry &&
            (entry.kind === "output" || entry.kind === "workload") &&
            entry.ready === true,
        )
      : run.status === "succeeded";
    const outputDownloadPath =
      run.links &&
      (run.links.output_download_path || run.links.workload_download_path)
        ? run.links.output_download_path || run.links.workload_download_path
        : "";
    if (outputDownloadPath && workloadReady) {
      workloadLink.href = outputDownloadPath;
    } else {
      workloadLink.classList.add("disabled");
      workloadLink.removeAttribute("href");
      workloadLink.addEventListener("click", (event) => event.preventDefault());
    }
    runActions.appendChild(workloadLink);

    if (ACTIVE_STATUSES.has(run.status) && run.links && run.links.cancel_path) {
      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "run-action-link";
      cancelBtn.textContent = "Cancel";
      cancelBtn.addEventListener("click", () => actions.cancel(run));
      runActions.appendChild(cancelBtn);
    }

    card.appendChild(runActions);
    return card;
  }

  function normalizeRunEntry(raw, fallbackRunId) {
    const input = raw && typeof raw === "object" ? raw : {};
    return {
      run_id:
        typeof input.run_id === "string" && input.run_id.trim()
          ? input.run_id.trim()
          : fallbackRunId,
      status:
        typeof input.status === "string" && input.status.trim()
          ? input.status.trim()
          : "running",
      created_at:
        typeof input.created_at === "string"
          ? input.created_at
          : new Date().toISOString(),
      progress_text:
        typeof input.progress_text === "string" ? input.progress_text : "",
      error:
        input.error && typeof input.error === "object" ? input.error : null,
      artifacts: Array.isArray(input.artifacts) ? input.artifacts : [],
      output_paths:
        input.output_paths && typeof input.output_paths === "object"
          ? input.output_paths
          : null,
      benchmark_stats:
        input.benchmark_stats && typeof input.benchmark_stats === "object"
          ? input.benchmark_stats
          : null,
      links:
        input.links && typeof input.links === "object"
          ? input.links
          : {
              spec_download_path:
                input.downloads && input.downloads.spec_download_path
                  ? input.downloads.spec_download_path
                  : "",
              output_download_path:
                input.downloads && input.downloads.output_download_path
                  ? input.downloads.output_download_path
                  : input.downloads && input.downloads.workload_download_path
                    ? input.downloads.workload_download_path
                  : "",
              cancel_path: "",
            },
    };
  }

  function createWorkloadRunsController(options) {
    const opts = options && typeof options === "object" ? options : {};
    const runsListEl = opts.runsListEl || null;
    const onInfo =
      typeof opts.onInfo === "function" ? opts.onInfo : defaultNoop;
    const onError =
      typeof opts.onError === "function" ? opts.onError : defaultNoop;
    const onBusyChange =
      typeof opts.onBusyChange === "function" ? opts.onBusyChange : defaultNoop;
    const runs = [];
    let pollTimer = null;
    let requestInFlight = false;

    function findRun(runId) {
      return runs.find((entry) => entry.run_id === runId) || null;
    }

    function mergeRun(rawRun) {
      const normalized = normalizeRunEntry(rawRun, createRunId());
      const existing = findRun(normalized.run_id);
      if (!existing) {
        runs.unshift(normalized);
        return normalized;
      }
      Object.assign(existing, normalized);
      return existing;
    }

    function hasActiveRuns() {
      return runs.some((entry) => ACTIVE_STATUSES.has(entry.status));
    }

    function stopPolling() {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }

    function ensurePolling() {
      if (pollTimer || !hasActiveRuns()) {
        return;
      }
      pollTimer = setInterval(() => {
        void pollRuns();
      }, POLL_INTERVAL_MS);
    }

    async function pollRuns() {
      if (requestInFlight) {
        return;
      }
      const active = runs.filter((entry) => ACTIVE_STATUSES.has(entry.status));
      if (active.length === 0) {
        stopPolling();
        return;
      }
      requestInFlight = true;
      try {
        await Promise.all(
          active.map(async (entry) => {
            try {
              const response = await fetch(
                "/api/workloads/runs/" + encodeURIComponent(entry.run_id),
                {
                  method: "GET",
                  cache: "no-store",
                },
              );
              const body = await parseJsonResponse(response);
              mergeRun(body);
            } catch (error) {
              entry.status = "failed";
              entry.error = {
                code: "status_fetch_failed",
                message: normalizeErrorMessage(error),
              };
              entry.progress_text = "Failed to poll run status.";
            }
          }),
        );
        render();
        if (!hasActiveRuns()) {
          stopPolling();
        }
      } finally {
        requestInFlight = false;
      }
    }

    async function cancelRun(run) {
      if (!run || !run.links || !run.links.cancel_path) {
        return;
      }
      try {
        const response = await fetch(run.links.cancel_path, {
          method: "POST",
        });
        const body = await parseJsonResponse(response);
        mergeRun({
          run_id: run.run_id,
          status: body && body.status ? body.status : "cancelled",
          progress_text: "Cancellation requested.",
          error: null,
        });
        render();
      } catch (error) {
        onError("Failed to cancel run: " + normalizeErrorMessage(error));
      }
    }

    function render() {
      if (!runsListEl) {
        return;
      }
      runsListEl.innerHTML = "";
      if (runs.length === 0) {
        const empty = document.createElement("p");
        empty.className = "runs-empty";
        empty.textContent =
          'No runs yet. Click "Run Workload" to execute a tectonic benchmark.';
        runsListEl.appendChild(empty);
        return;
      }
      runs.forEach((run) => {
        runsListEl.appendChild(buildRunCard(run, { cancel: cancelRun }));
      });
    }

    async function startRun(specJson) {
      if (!specJson || typeof specJson !== "object") {
        onError("Cannot start run without a valid spec JSON object.");
        return null;
      }
      onBusyChange(true);
      try {
        const response = await fetch(START_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            spec_json: specJson,
          }),
        });
        const body = await parseJsonResponse(response);
        const merged = mergeRun(body);
        render();
        ensurePolling();
        void pollRuns();
        onInfo("Workload run started.");
        return merged;
      } catch (error) {
        onError("Failed to start workload run: " + formatApiError(error));
        return null;
      } finally {
        onBusyChange(false);
      }
    }

    function clear() {
      runs.length = 0;
      stopPolling();
      render();
    }

    function dispose() {
      stopPolling();
    }

    render();
    return {
      startRun,
      clear,
      dispose,
      pollNow: pollRuns,
    };
  }

  window.createWorkloadRunsController = createWorkloadRunsController;
})();
