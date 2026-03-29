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
  const WORKLOAD_RUNS_STORAGE_KEY = "tectonic.workloadRuns.v2";
  const SECONDS_DISPLAY_THRESHOLD_MICROS = 10000;

  function defaultNoop() {}

  function readPersistedRuns() {
    try {
      if (window.__TECTONIC_RESTORE_UI_STATE__ !== true) {
        clearPersistedRuns();
        return [];
      }
      const raw = window.localStorage.getItem(WORKLOAD_RUNS_STORAGE_KEY);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      return [];
    }
  }

  function writePersistedRuns(runs) {
    try {
      window.localStorage.setItem(
        WORKLOAD_RUNS_STORAGE_KEY,
        JSON.stringify(Array.isArray(runs) ? runs : []),
      );
    } catch (_error) {
      // Ignore unavailable storage.
    }
  }

  function clearPersistedRuns() {
    try {
      window.localStorage.removeItem(WORKLOAD_RUNS_STORAGE_KEY);
    } catch (_error) {
      // Ignore unavailable storage.
    }
  }

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

  function getCancelProgressText(body) {
    const explicitText =
      body && typeof body.progress_text === "string" && body.progress_text.trim()
        ? body.progress_text.trim()
        : "";
    if (explicitText) {
      return explicitText;
    }
    const status =
      body && typeof body.status === "string" && body.status.trim()
        ? body.status.trim()
        : "";
    if (status === "cancelled") {
      return "Run cancelled.";
    }
    if (status === "timed_out") {
      return "Run timed out.";
    }
    if (status === "failed") {
      return "Run failed.";
    }
    return "Cancellation requested.";
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

  function clampNumber(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function normalizeRunProgress(rawProgress, progressText, status) {
    const input =
      rawProgress && typeof rawProgress === "object" ? rawProgress : {};
    const label =
      typeof input.label === "string" && input.label.trim()
        ? input.label.trim()
        : typeof progressText === "string" && progressText.trim()
          ? progressText.trim()
          : ACTIVE_STATUSES.has(status)
            ? "Running benchmark..."
            : "Benchmark status updated.";
    const percent = Number.isFinite(input.percent)
      ? clampNumber(Math.round(input.percent), 0, 100)
      : TERMINAL_STATUSES.has(status) && status === "succeeded"
        ? 100
        : null;
    const current = Number.isFinite(input.current)
      ? Math.max(0, Math.round(input.current))
      : null;
    const total = Number.isFinite(input.total)
      ? Math.max(0, Math.round(input.total))
      : null;
    return {
      label,
      current,
      total,
      percent,
      indeterminate:
        typeof input.indeterminate === "boolean"
          ? input.indeterminate
          : !Number.isFinite(percent),
    };
  }

  function buildProgressBar(progress, compact) {
    const normalized = normalizeRunProgress(progress, "", "");
    const shell = document.createElement("div");
    shell.className = compact ? "run-progress compact" : "run-progress";

    const meta = document.createElement("div");
    meta.className = "run-progress-meta";

    const label = document.createElement("span");
    label.className = "run-progress-label";
    label.textContent = normalized.label;
    meta.appendChild(label);

    if (Number.isFinite(normalized.percent) && !normalized.indeterminate) {
      const value = document.createElement("span");
      value.className = "run-progress-value";
      value.textContent = String(normalized.percent) + "%";
      meta.appendChild(value);
    }

    const track = document.createElement("div");
    track.className =
      "run-progress-track" +
      (normalized.indeterminate ? " indeterminate" : "");
    if (!normalized.indeterminate && Number.isFinite(normalized.percent)) {
      const fill = document.createElement("div");
      fill.className = "run-progress-fill";
      fill.style.width = String(normalized.percent) + "%";
      track.appendChild(fill);
    }

    shell.appendChild(meta);
    shell.appendChild(track);
    return shell;
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
      "Total Time Spent (using start and end time)":
        "Workload Execution latency",
      "Aggregate Operation Time": "Aggregate Op Time",
    };
    if (replacements[normalized]) {
      return replacements[normalized];
    }
    const prefixedMatch = normalized.match(/^(.+?)\s+(Count|Successful Operations Count|Total Latency|Average Latency|Minimum Latency|Maximum Latency|95th Percentile Latency|99th Percentile Latency|Total Operations|Throughput \(using start and end time\)|Throughput \(using aggregate operation times\)|Total Time Spent \(using start and end time\)|Aggregate Operation Time)$/);
    if (!prefixedMatch) {
      return normalized;
    }
    const prefix = String(prefixedMatch[1] || "").trim();
    const suffix = String(prefixedMatch[2] || "").trim();
    const formattedSuffix = replacements[suffix] || suffix;
    return prefix ? prefix + " " + formattedSuffix : formattedSuffix;
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

  function formatDurationMicrosForMetric(micros) {
    if (!Number.isFinite(micros)) {
      return "—";
    }
    if (Math.abs(micros) >= SECONDS_DISPLAY_THRESHOLD_MICROS) {
      return formatNumericString(micros / 1000000, 2) + " s";
    }
    return formatNumericString(micros, 2) + " µs";
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
      return formatDurationMicrosForMetric(Number.parseFloat(numberPart));
    }

    if (rawValue.endsWith("ms")) {
      const numberPart = rawValue.slice(0, -2).trim();
      const parsed = Number.parseFloat(numberPart);
      if (!Number.isFinite(parsed)) {
        return rawValue;
      }
      return formatDurationMicrosForMetric(parsed * 1000);
    }

    if (/secs?$/i.test(rawValue)) {
      const numberPart = rawValue.replace(/secs?$/i, "").trim();
      return formatNumericString(numberPart, 2) + " s";
    }

    if (/s$/i.test(rawValue) && !/ops\/sec$/i.test(rawValue)) {
      const numberPart = rawValue.slice(0, -1).trim();
      const parsed = Number.parseFloat(numberPart);
      if (!Number.isFinite(parsed)) {
        return rawValue;
      }
      return formatNumericString(parsed, 2) + " s";
    }

    if (label.indexOf("Throughput") !== -1) {
      const parsed = Number.parseFloat(rawValue);
      if (!Number.isFinite(parsed)) {
        return rawValue;
      }
      if (/ops\/ms/i.test(rawValue)) {
        return formatNumericString(parsed, 2) + " ops/ms";
      }
      if (/ops\/sec/i.test(rawValue)) {
        return formatNumericString(parsed, 2) + " ops/sec";
      }
      if (/ops\/us|ops\/µs/i.test(rawValue)) {
        return formatNumericString(parsed, 2) + " ops/µs";
      }
      return formatNumericString(parsed, 2);
    }

    if (/^-?\d+(?:\.\d+)?$/.test(rawValue)) {
      return formatNumericString(rawValue, 2);
    }

    return rawValue;
  }

  function parseNumericMetricValue(rawValue) {
    const cleaned = String(rawValue || "")
      .trim()
      .replace(/,/g, "");
    if (!cleaned) {
      return null;
    }
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function parseThroughputMetricValue(metric) {
    if (!metric || typeof metric !== "object") {
      return null;
    }
    return parseNumericMetricValue(metric.value);
  }

  function parseLatencyMetricValueMicros(metric) {
    if (!metric || typeof metric !== "object") {
      return null;
    }
    const rawValue = String(metric.value || "").trim();
    if (!rawValue) {
      return null;
    }
    if (/us$/i.test(rawValue)) {
      return parseNumericMetricValue(rawValue.slice(0, -2));
    }
    if (/ms$/i.test(rawValue)) {
      const parsedMs = parseNumericMetricValue(rawValue.slice(0, -2));
      return parsedMs === null ? null : parsedMs * 1000;
    }
    if (/secs?$/i.test(rawValue)) {
      const parsedSeconds = parseNumericMetricValue(
        rawValue.replace(/secs?$/i, ""),
      );
      return parsedSeconds === null ? null : parsedSeconds * 1000000;
    }
    if (/s$/i.test(rawValue) && !/ops\/sec$/i.test(rawValue)) {
      const parsedSeconds = parseNumericMetricValue(rawValue.slice(0, -1));
      return parsedSeconds === null ? null : parsedSeconds * 1000000;
    }
    return parseNumericMetricValue(rawValue);
  }

  function normalizeThroughputUnit(value) {
    const text = String(value || "").trim().toLowerCase();
    if (text.indexOf("ops/ms") !== -1) {
      return "ops/ms";
    }
    if (text.indexOf("ops/us") !== -1 || text.indexOf("ops/µs") !== -1) {
      return "ops/µs";
    }
    if (text.indexOf("ops/sec") !== -1) {
      return "ops/sec";
    }
    return "ops/sec";
  }

  function formatThroughputLabel(value, unit) {
    return formatChartDecimalValue(value) + " " + normalizeThroughputUnit(unit);
  }

  function formatChartDecimalValue(value, options = {}) {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) {
      return "—";
    }
    if (
      options.compact === true &&
      Number.isInteger(parsed) &&
      Math.abs(parsed) >= 1000
    ) {
      return new Intl.NumberFormat(undefined, {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(parsed);
    }
    if (Number.isInteger(parsed)) {
      return parsed.toLocaleString();
    }
    return parsed.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function chooseLatencyChartUnit(maxValueMicros) {
    if (!Number.isFinite(maxValueMicros)) {
      return { divisor: 1, unit: "µs" };
    }
    if (Math.abs(maxValueMicros) >= 1000000) {
      return {
        divisor: 1000000,
        unit: "s",
      };
    }
    if (Math.abs(maxValueMicros) >= 1000) {
      return {
        divisor: 1000,
        unit: "ms",
      };
    }
    return { divisor: 1, unit: "µs" };
  }

  function createMetricChartDescriptor(metricKey, maxValue, throughputUnit) {
    const key = String(metricKey || "").trim().toLowerCase();
    if (
      key === "throughput_using_start_and_end_time_ops_ms" ||
      key === "throughput_using_start_and_end_time"
    ) {
      const unit = normalizeThroughputUnit(throughputUnit);
      return {
        emphasis: "positive",
        trendLabel: "Higher is better",
        formatAxisValue(value) {
          return formatChartDecimalValue(value) + " " + unit;
        },
        formatValue(value) {
          return formatThroughputLabel(value, unit);
        },
      };
    }
    if (
      key.indexOf("latency") !== -1 ||
      key.indexOf("time") !== -1
    ) {
      const latencyUnit = chooseLatencyChartUnit(maxValue);
      return {
        emphasis: "caution",
        trendLabel: "Lower is better",
        formatAxisValue(value) {
          return formatChartDecimalValue(value / latencyUnit.divisor) + " " + latencyUnit.unit;
        },
        formatValue(value) {
          return formatChartDecimalValue(value / latencyUnit.divisor) + " " + latencyUnit.unit;
        },
      };
    }
    return {
      emphasis: "neutral",
      trendLabel: "Higher is better",
      formatAxisValue(value) {
        return formatChartDecimalValue(value, { compact: true });
      },
      formatValue(value) {
        return formatChartDecimalValue(value);
      },
    };
  }

  function metricChartPalette(metricKey) {
    const key = String(metricKey || "").trim().toLowerCase();
    if (key.indexOf("throughput") !== -1) {
      return {
        start: "#0f766e",
        end: "#34d399",
        stroke: "#0b5f59",
        text: "#0b4d47",
      };
    }
    if (key.indexOf("latency") !== -1 || key.indexOf("time") !== -1) {
      return {
        start: "#c27a12",
        end: "#f4b74d",
        stroke: "#9a5d08",
        text: "#6b4308",
      };
    }
    return {
      start: "#2563eb",
      end: "#60a5fa",
      stroke: "#1d4ed8",
      text: "#1e3a8a",
    };
  }

  function metricPriority(metric) {
    const key = metric && typeof metric.key === "string" ? metric.key : "";
    const order = {
      total_operations: 1,
      count: 1,
      successful_operations_count: 2,
      throughput_using_start_and_end_time_ops_ms: 3,
      throughput_using_start_and_end_time: 3,
      throughput_using_aggregate_operation_times_ops_ms: 4,
      throughput_using_aggregate_operation_times: 4,
      average_latency: 5,
      total_latency: 6,
      end_to_end_time: 7,
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

  function normalizeStatsBuckets(value) {
    return Array.isArray(value)
      ? value.filter((entry) => {
          return (
            entry &&
            typeof entry === "object" &&
            typeof entry.name === "string" &&
            normalizeMetricsList(entry.metrics).length > 0
          );
        })
      : [];
  }

  function isPhaseStatsBucket(entry) {
    const name =
      entry && typeof entry.name === "string"
        ? entry.name.trim().toLowerCase()
        : "";
    if (!name) {
      return false;
    }
    return /\bphase\b|\bgroup\b/.test(name) || /\bsection\b/.test(name);
  }

  function formatStatsBucketTitle(name) {
    return String(name || "")
      .trim()
      .replace(/_/g, " ")
      .replace(/\s*\|\s*/g, " • ")
      .replace(/\s*\/\s*/g, " • ");
  }

  function buildStatsBucketCollection(titleText, buckets) {
    if (!Array.isArray(buckets) || buckets.length === 0) {
      return null;
    }

    const section = document.createElement("section");
    section.className = "benchmark-stats-group";

    const title = document.createElement("div");
    title.className = "benchmark-stats-group-title";
    title.textContent = titleText;
    section.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "benchmark-operations";

    buckets.forEach((bucket) => {
      const item = document.createElement("section");
      item.className = "benchmark-section";

      const itemTitle = document.createElement("div");
      itemTitle.className = "benchmark-section-title";
      itemTitle.textContent = formatStatsBucketTitle(bucket.name);
      item.appendChild(itemTitle);

      item.appendChild(buildMetricGrid(normalizeMetricsList(bucket.metrics)));
      grid.appendChild(item);
    });

    section.appendChild(grid);
    return section;
  }

  function buildBenchmarkStats(stats) {
    if (!stats || typeof stats !== "object") {
      return null;
    }

    const overallMetrics = normalizeMetricsList(stats.overall);
    const rawBuckets = normalizeStatsBuckets(stats.operations);
    const explicitPhaseBuckets = normalizeStatsBuckets(stats.phases);
    const phaseBuckets =
      explicitPhaseBuckets.length > 0
        ? explicitPhaseBuckets
        : rawBuckets.filter((entry) => isPhaseStatsBucket(entry));
    const operationBuckets = rawBuckets.filter(
      (entry) => !isPhaseStatsBucket(entry),
    );

    if (
      overallMetrics.length === 0 &&
      phaseBuckets.length === 0 &&
      operationBuckets.length === 0
    ) {
      return null;
    }

    const container = document.createElement("div");
    container.className = "benchmark-stats";

    if (overallMetrics.length > 0) {
      const section = document.createElement("section");
      section.className = "benchmark-section benchmark-section-overall";

      const title = document.createElement("div");
      title.className = "benchmark-section-title";
      title.textContent = "Overall Stats";
      section.appendChild(title);
      section.appendChild(buildMetricGrid(overallMetrics));
      container.appendChild(section);
    }

    const phasesSection = buildStatsBucketCollection(
      "Phase-wise Stats",
      phaseBuckets,
    );
    if (phasesSection) {
      container.appendChild(phasesSection);
    }

    const operationsSection = buildStatsBucketCollection(
      "Per-operation Stats",
      operationBuckets,
    );
    if (operationsSection) {
      container.appendChild(operationsSection);
    }

    return container;
  }

  function slugifyMetricLabel(label) {
    return String(label || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function findOverallMetric(stats, candidates) {
    const wanted = new Set(
      (Array.isArray(candidates) ? candidates : [])
        .map((entry) => String(entry || "").trim().toLowerCase())
        .filter(Boolean),
    );
    if (wanted.size === 0) {
      return null;
    }
    const metrics =
      stats && typeof stats === "object"
        ? normalizeMetricsList(stats.overall)
        : [];
    for (const metric of metrics) {
      const keys = [
        String(metric && metric.key ? metric.key : "")
          .trim()
          .toLowerCase(),
        slugifyMetricLabel(metric && metric.label ? metric.label : ""),
      ].filter(Boolean);
      if (keys.some((key) => wanted.has(key))) {
        return metric;
      }
    }
    return null;
  }

  function buildRunActions(run, actions) {
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
            entry.kind === "output" &&
            entry.ready === true,
        )
      : run.status === "succeeded";
    const outputDownloadPath =
      run.links && run.links.output_download_path
        ? run.links.output_download_path
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

    return runActions;
  }

  function buildMetricBarChart(metricSeries) {
    const points =
      metricSeries && Array.isArray(metricSeries.points)
        ? metricSeries.points.filter(
            (entry) => entry && Number.isFinite(entry.value),
          )
        : [];
    if (points.length === 0) {
      return null;
    }

    const width = Math.max(440, points.length * 88 + 120);
    const height = 244;
    const margin = { top: 24, right: 20, bottom: 48, left: 96 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const maxValue = Math.max(
      1,
      ...points.map((entry) => (Number.isFinite(entry.value) ? entry.value : 0)),
    );
    const chartDescriptor = createMetricChartDescriptor(
      metricSeries.key,
      maxValue,
      metricSeries.throughputUnit,
    );
    const ns = "http://www.w3.org/2000/svg";
    const palette = metricChartPalette(metricSeries.key);
    const assetId =
      "metric-" + Math.random().toString(36).slice(2, 10);
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("class", "benchmark-chart");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("role", "img");
    svg.setAttribute(
      "aria-label",
      String(metricSeries && metricSeries.label ? metricSeries.label : "Benchmark metric"),
    );

    const defs = document.createElementNS(ns, "defs");
    const gradient = document.createElementNS(ns, "linearGradient");
    gradient.setAttribute("id", assetId + "-bar");
    gradient.setAttribute("x1", "0");
    gradient.setAttribute("x2", "0");
    gradient.setAttribute("y1", "0");
    gradient.setAttribute("y2", "1");
    const stopTop = document.createElementNS(ns, "stop");
    stopTop.setAttribute("offset", "0%");
    stopTop.setAttribute("stop-color", palette.end);
    const stopBottom = document.createElementNS(ns, "stop");
    stopBottom.setAttribute("offset", "100%");
    stopBottom.setAttribute("stop-color", palette.start);
    gradient.appendChild(stopTop);
    gradient.appendChild(stopBottom);
    defs.appendChild(gradient);

    const shadow = document.createElementNS(ns, "filter");
    shadow.setAttribute("id", assetId + "-shadow");
    shadow.setAttribute("x", "-20%");
    shadow.setAttribute("y", "-20%");
    shadow.setAttribute("width", "140%");
    shadow.setAttribute("height", "150%");
    const blur = document.createElementNS(ns, "feDropShadow");
    blur.setAttribute("dx", "0");
    blur.setAttribute("dy", "5");
    blur.setAttribute("stdDeviation", "5");
    blur.setAttribute("flood-color", palette.start);
    blur.setAttribute("flood-opacity", "0.12");
    shadow.appendChild(blur);
    defs.appendChild(shadow);
    svg.appendChild(defs);

    const plotBg = document.createElementNS(ns, "rect");
    plotBg.setAttribute("x", String(margin.left));
    plotBg.setAttribute("y", String(margin.top));
    plotBg.setAttribute("width", String(plotWidth));
    plotBg.setAttribute("height", String(plotHeight));
    plotBg.setAttribute("rx", "16");
    plotBg.setAttribute("fill", "#fcfdff");
    plotBg.setAttribute("stroke", "#dde8f1");
    svg.appendChild(plotBg);

    for (let index = 0; index <= 4; index += 1) {
      const ratio = index / 4;
      const y = margin.top + plotHeight * ratio;
      const grid = document.createElementNS(ns, "line");
      grid.setAttribute("x1", String(margin.left));
      grid.setAttribute("x2", String(width - margin.right));
      grid.setAttribute("y1", String(y));
      grid.setAttribute("y2", String(y));
      grid.setAttribute("stroke", index === 4 ? "#ccd9e4" : "#e3ebf2");
      grid.setAttribute("stroke-width", "1");
      svg.appendChild(grid);

      const axisLabel = document.createElementNS(ns, "text");
      axisLabel.setAttribute("x", String(margin.left - 12));
      axisLabel.setAttribute("y", String(y + 4));
      axisLabel.setAttribute("text-anchor", "end");
      axisLabel.setAttribute("font-size", "12");
      axisLabel.setAttribute("fill", "#5f7388");
      axisLabel.textContent = chartDescriptor.formatAxisValue(
        maxValue * (1 - ratio),
      );
      svg.appendChild(axisLabel);
    }

    const baseline = document.createElementNS(ns, "line");
    baseline.setAttribute("x1", String(margin.left));
    baseline.setAttribute("x2", String(width - margin.right));
    baseline.setAttribute("y1", String(margin.top + plotHeight));
    baseline.setAttribute("y2", String(margin.top + plotHeight));
    baseline.setAttribute("stroke", "#bfd0dc");
    baseline.setAttribute("stroke-width", "1.5");
    svg.appendChild(baseline);

    const step = plotWidth / Math.max(points.length, 1);
    const barWidth = Math.min(52, step * 0.56);

    points.forEach((point, index) => {
      const centerX = margin.left + step * index + step / 2;
      const barHeight = (point.value / maxValue) * plotHeight;
      const rect = document.createElementNS(ns, "rect");
      rect.setAttribute("x", String(centerX - barWidth / 2));
      rect.setAttribute("y", String(margin.top + (plotHeight - barHeight)));
      rect.setAttribute("width", String(barWidth));
      rect.setAttribute("height", String(barHeight));
      rect.setAttribute("rx", "10");
      rect.setAttribute("fill", `url(#${assetId}-bar)`);
      rect.setAttribute("stroke", palette.stroke);
      rect.setAttribute("stroke-opacity", "0.16");
      rect.setAttribute("filter", `url(#${assetId}-shadow)`);
      svg.appendChild(rect);

      const label = document.createElementNS(ns, "text");
      label.setAttribute("x", String(centerX));
      label.setAttribute("y", String(height - 14));
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("font-size", "12");
      label.setAttribute("font-weight", "600");
      label.setAttribute("fill", "#496276");
      label.textContent = point.label;
      svg.appendChild(label);
    });

    return svg;
  }

  function buildMetricChartSummary(metricSeries) {
    const points =
      metricSeries && Array.isArray(metricSeries.points)
        ? metricSeries.points.filter(
            (entry) => entry && Number.isFinite(entry.value),
          )
        : [];
    if (points.length === 0) {
      return null;
    }
    const maxValue = Math.max(...points.map((entry) => entry.value));
    const descriptor = createMetricChartDescriptor(
      metricSeries.key,
      maxValue,
      metricSeries.throughputUnit,
    );
    const bestValue = descriptor.emphasis === "caution"
      ? Math.min(...points.map((entry) => entry.value))
      : Math.max(...points.map((entry) => entry.value));

    const list = document.createElement("div");
    list.className = "benchmark-metric-chart-summary";
    points.forEach((point) => {
      const item = document.createElement("div");
      item.className = "benchmark-metric-chart-summary-item";
      if (point.value === bestValue) {
        item.classList.add("is-best");
      }

      const label = document.createElement("span");
      label.className = "benchmark-metric-chart-summary-label";
      label.textContent = point.label;
      item.appendChild(label);

      const value = document.createElement("span");
      value.className = "benchmark-metric-chart-summary-value";
      value.textContent = descriptor.formatValue(point.value);
      item.appendChild(value);

      list.appendChild(item);
    });
    return list;
  }

  function selectBestMetricPoint(metricSeries) {
    const points =
      metricSeries && Array.isArray(metricSeries.points)
        ? metricSeries.points.filter(
            (entry) => entry && Number.isFinite(entry.value),
          )
        : [];
    if (points.length === 0) {
      return null;
    }
    const maxValue = Math.max(...points.map((entry) => entry.value));
    const descriptor = createMetricChartDescriptor(
      metricSeries.key,
      maxValue,
      metricSeries.throughputUnit,
    );
    return points.reduce((selected, point) => {
      if (!selected) {
        return point;
      }
      if (descriptor.emphasis === "caution") {
        return point.value < selected.value ? point : selected;
      }
      return point.value > selected.value ? point : selected;
    }, null);
  }

  function getRunComparisonLabel(run) {
    if (typeof run.database === "string" && run.database.trim()) {
      return run.database.trim();
    }
    if (Number.isFinite(run.batch_index) && run.batch_index > 0) {
      return "R" + String(run.batch_index);
    }
    return "Run";
  }

  function parseChartSeriesMetricValue(metric) {
    const key =
      metric && typeof metric.key === "string" ? metric.key.trim().toLowerCase() : "";
    if (!key) {
      return null;
    }
    if (
      key === "throughput_using_start_and_end_time_ops_ms" ||
      key === "throughput_using_start_and_end_time" ||
      key === "throughput_using_aggregate_operation_times_ops_ms" ||
      key === "throughput_using_aggregate_operation_times"
    ) {
      return parseThroughputMetricValue(metric);
    }
    if (key.indexOf("latency") !== -1 || key.indexOf("time") !== -1) {
      return parseLatencyMetricValueMicros(metric);
    }
    return parseNumericMetricValue(metric.value);
  }

  function createMetricSeriesId(metric) {
    const key =
      metric && typeof metric.key === "string" ? metric.key.trim().toLowerCase() : "";
    const label = slugifyMetricLabel(metric && metric.label ? metric.label : "");
    return [key || "metric", label || "metric"].join("::");
  }

  function finalizeMetricSeriesList(seriesMap) {
    return Array.from(seriesMap.values())
      .filter((series) => Array.isArray(series.points) && series.points.length > 0)
      .sort((left, right) => {
        const leftPriority = metricPriority({ key: left.key });
        const rightPriority = metricPriority({ key: right.key });
        if (leftPriority !== rightPriority) {
          return leftPriority - rightPriority;
        }
        return left.label.localeCompare(right.label);
      });
  }

  function appendMetricSeriesPoint(seriesMap, metric, runLabel) {
    const numericValue = parseChartSeriesMetricValue(metric);
    if (!Number.isFinite(numericValue)) {
      return;
    }

    const seriesId = createMetricSeriesId(metric);
    const key =
      metric && typeof metric.key === "string" ? metric.key.trim().toLowerCase() : "";
    let series = seriesMap.get(seriesId);
    if (!series) {
      series = {
        id: seriesId,
        key,
        rawLabel: String(metric && metric.label ? metric.label : "").trim(),
        label: formatMetricLabel(metric && metric.label ? metric.label : ""),
        points: [],
        throughputUnit:
          key.indexOf("throughput") !== -1
            ? normalizeThroughputUnit(metric && metric.value ? metric.value : "")
            : "",
      };
      seriesMap.set(seriesId, series);
    }

    series.points.push({
      label: runLabel,
      value: numericValue,
    });
  }

  function appendBucketMetrics(bucketMap, buckets, runLabel) {
    normalizeStatsBuckets(buckets).forEach((bucket) => {
      const bucketKey = slugifyMetricLabel(bucket.name) || bucket.name;
      let entry = bucketMap.get(bucketKey);
      if (!entry) {
        entry = {
          key: bucketKey,
          name: formatStatsBucketTitle(bucket.name),
          seriesMap: new Map(),
        };
        bucketMap.set(bucketKey, entry);
      }
      normalizeMetricsList(bucket.metrics).forEach((metric) => {
        appendMetricSeriesPoint(entry.seriesMap, metric, runLabel);
      });
    });
  }

  function buildMetricSeriesCatalog(batch) {
    const successfulRuns = batch.runs.filter(
      (run) => run.status === "succeeded" && run.benchmark_stats,
    );
    if (successfulRuns.length === 0) {
      return null;
    }

    const overallMap = new Map();
    const phaseMap = new Map();
    const operationMap = new Map();

    successfulRuns.forEach((run) => {
      const runLabel = getRunComparisonLabel(run);
      normalizeMetricsList(run.benchmark_stats && run.benchmark_stats.overall).forEach(
        (metric) => {
          appendMetricSeriesPoint(overallMap, metric, runLabel);
        },
      );
      appendBucketMetrics(phaseMap, run.benchmark_stats && run.benchmark_stats.phases, runLabel);
      appendBucketMetrics(
        operationMap,
        run.benchmark_stats && run.benchmark_stats.operations,
        runLabel,
      );
    });

    return {
      successfulRuns,
      overall: finalizeMetricSeriesList(overallMap),
      phases: Array.from(phaseMap.values())
        .map((entry) => ({
          key: entry.key,
          name: entry.name,
          series: finalizeMetricSeriesList(entry.seriesMap),
        }))
        .filter((entry) => entry.series.length > 0)
        .sort((left, right) => left.name.localeCompare(right.name)),
      operations: Array.from(operationMap.values())
        .map((entry) => ({
          key: entry.key,
          name: entry.name,
          series: finalizeMetricSeriesList(entry.seriesMap),
        }))
        .filter((entry) => entry.series.length > 0)
        .sort((left, right) => left.name.localeCompare(right.name)),
    };
  }

  function buildMetricSeriesCard(metricSeries, options = {}) {
    if (
      !metricSeries ||
      !Array.isArray(metricSeries.points) ||
      metricSeries.points.length === 0
    ) {
      return null;
    }

    const opts = options && typeof options === "object" ? options : {};
    const card = document.createElement("section");
    card.className =
      "benchmark-metric-chart-card" + (opts.explorer ? " explorer" : "");

    const head = document.createElement("div");
    head.className = "benchmark-metric-chart-head";

    const headCopy = document.createElement("div");
    headCopy.className = "benchmark-metric-chart-copy";

    if (typeof opts.kicker === "string" && opts.kicker.trim()) {
      const kicker = document.createElement("div");
      kicker.className = "benchmark-metric-chart-kicker";
      kicker.textContent = opts.kicker.trim();
      headCopy.appendChild(kicker);
    }

    const title = document.createElement("div");
    title.className = "benchmark-metric-chart-title";
    title.textContent =
      typeof opts.title === "string" && opts.title.trim()
        ? opts.title.trim()
        : metricSeries.label;
    headCopy.appendChild(title);
    head.appendChild(headCopy);

    const seriesMaxValue = Math.max(...metricSeries.points.map((entry) => entry.value));
    const chartDescriptor = createMetricChartDescriptor(
      metricSeries.key,
      seriesMaxValue,
      metricSeries.throughputUnit,
    );
    const meta = document.createElement("div");
    meta.className = "benchmark-metric-chart-meta";

    const trend = document.createElement("span");
    trend.className =
      "benchmark-metric-chart-trend benchmark-metric-chart-trend-" +
      chartDescriptor.emphasis;
    trend.textContent = chartDescriptor.trendLabel;
    meta.appendChild(trend);

    head.appendChild(meta);
    card.appendChild(head);

    const chart = buildMetricBarChart(metricSeries);
    if (chart) {
      card.appendChild(chart);
    }
    const summary = buildMetricChartSummary(metricSeries);
    if (summary) {
      card.appendChild(summary);
    }
    return card;
  }

  function selectOverviewMetricSeries(seriesList) {
    const allSeries = Array.isArray(seriesList) ? seriesList : [];
    if (allSeries.length === 0) {
      return [];
    }

    const preferredGroups = [
      ["throughput_using_start_and_end_time_ops_ms", "throughput_using_start_and_end_time"],
      ["average_latency"],
      ["end_to_end_time", "total_time_spent_using_start_and_end_time"],
    ];
    const selected = [];
    const seen = new Set();

    preferredGroups.forEach((candidateKeys) => {
      const match = allSeries.find((series) => {
        if (!series || seen.has(series.id)) {
          return false;
        }
        const key = String(series.key || "").trim().toLowerCase();
        return candidateKeys.includes(key);
      });
      if (match) {
        selected.push(match);
        seen.add(match.id);
      }
    });

    allSeries.forEach((series) => {
      if (selected.length >= 3 || !series || seen.has(series.id)) {
        return;
      }
      selected.push(series);
      seen.add(series.id);
    });

    return selected.slice(0, 3);
  }

  function buildOverviewMetricGrid(catalog) {
    const seriesList = selectOverviewMetricSeries(catalog && catalog.overall);
    if (seriesList.length === 0) {
      return null;
    }

    const section = document.createElement("section");
    section.className = "benchmark-chart-section";

    const head = document.createElement("div");
    head.className = "benchmark-chart-section-head";

    const title = document.createElement("div");
    title.className = "benchmark-chart-section-title";
    title.textContent = "Overview";
    head.appendChild(title);

    const subtitle = document.createElement("div");
    subtitle.className = "benchmark-chart-section-copy";
    subtitle.textContent = "Pinned comparisons for the primary benchmark signals.";
    head.appendChild(subtitle);
    section.appendChild(head);

    const grid = document.createElement("div");
    grid.className = "benchmark-metric-chart-grid benchmark-metric-chart-grid-overview";
    seriesList.forEach((series) => {
      const card = buildMetricSeriesCard(series, {
        kicker: "Overall benchmark",
      });
      if (card) {
        grid.appendChild(card);
      }
    });
    section.appendChild(grid);
    return section;
  }

  function buildMetricExplorer(catalog) {
    if (!catalog) {
      return null;
    }

    const scopeDefinitions = [
      { key: "overall", label: "Overall", getBuckets: () => [{ key: "overall", name: "Overall benchmark", series: catalog.overall || [] }] },
      { key: "phase", label: "Phase", getBuckets: () => catalog.phases || [] },
      { key: "operation", label: "Operation", getBuckets: () => catalog.operations || [] },
    ];
    const availableScopes = scopeDefinitions.filter((entry) => {
      const buckets = entry.getBuckets();
      return Array.isArray(buckets) && buckets.some((bucket) => Array.isArray(bucket.series) && bucket.series.length > 0);
    });
    if (availableScopes.length === 0) {
      return null;
    }

    const state = {
      scope: availableScopes[0].key,
      bucketKey: "",
      metricId: "",
    };

    const section = document.createElement("section");
    section.className = "benchmark-chart-explorer";

    const head = document.createElement("div");
    head.className = "benchmark-chart-section-head";

    const title = document.createElement("div");
    title.className = "benchmark-chart-section-title";
    title.textContent = "Metric Explorer";
    head.appendChild(title);

    const subtitle = document.createElement("div");
    subtitle.className = "benchmark-chart-section-copy";
    subtitle.textContent = "Switch between overall, phase, and operation measurements without opening more charts.";
    head.appendChild(subtitle);
    section.appendChild(head);

    const controls = document.createElement("div");
    controls.className = "benchmark-chart-explorer-controls";

    const scopeSwitch = document.createElement("div");
    scopeSwitch.className = "benchmark-chart-scope-switch";
    controls.appendChild(scopeSwitch);

    const pickerRow = document.createElement("div");
    pickerRow.className = "benchmark-chart-picker-row";
    controls.appendChild(pickerRow);
    section.appendChild(controls);

    const explorerBody = document.createElement("div");
    explorerBody.className = "benchmark-chart-explorer-body";
    section.appendChild(explorerBody);

    function getScopeDefinition(scope) {
      return scopeDefinitions.find((entry) => entry.key === scope) || availableScopes[0];
    }

    function getBucketsForScope(scope) {
      const definition = getScopeDefinition(scope);
      const buckets = definition && typeof definition.getBuckets === "function"
        ? definition.getBuckets()
        : [];
      return Array.isArray(buckets) ? buckets.filter((bucket) => Array.isArray(bucket.series) && bucket.series.length > 0) : [];
    }

    function syncExplorerState() {
      const availableScopeKeys = new Set(availableScopes.map((entry) => entry.key));
      if (!availableScopeKeys.has(state.scope)) {
        state.scope = availableScopes[0].key;
      }

      const buckets = getBucketsForScope(state.scope);
      if (buckets.length === 0) {
        state.bucketKey = "";
        state.metricId = "";
        return { buckets, bucket: null, metric: null };
      }

      if (state.scope === "overall") {
        state.bucketKey = buckets[0].key;
      } else if (!buckets.some((bucket) => bucket.key === state.bucketKey)) {
        state.bucketKey = buckets[0].key;
      }

      const selectedBucket =
        buckets.find((bucket) => bucket.key === state.bucketKey) || buckets[0];
      const metrics = selectedBucket && Array.isArray(selectedBucket.series)
        ? selectedBucket.series
        : [];
      if (!metrics.some((series) => series.id === state.metricId)) {
        state.metricId = metrics[0] ? metrics[0].id : "";
      }

      const selectedMetric =
        metrics.find((series) => series.id === state.metricId) || metrics[0] || null;
      return {
        buckets,
        bucket: selectedBucket || null,
        metric: selectedMetric,
      };
    }

    function buildPicker(labelText, selectEl) {
      const field = document.createElement("label");
      field.className = "benchmark-chart-picker";

      const label = document.createElement("span");
      label.className = "benchmark-chart-picker-label";
      label.textContent = labelText;
      field.appendChild(label);

      field.appendChild(selectEl);
      return field;
    }

    function renderExplorer() {
      const selection = syncExplorerState();

      scopeSwitch.innerHTML = "";
      availableScopes.forEach((entry) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className =
          "benchmark-chart-scope-btn" +
          (entry.key === state.scope ? " is-active" : "");
        button.textContent = entry.label;
        button.addEventListener("click", () => {
          state.scope = entry.key;
          renderExplorer();
        });
        scopeSwitch.appendChild(button);
      });

      pickerRow.innerHTML = "";
      if (state.scope !== "overall" && selection.buckets.length > 0) {
        const bucketSelect = document.createElement("select");
        bucketSelect.className = "benchmark-chart-select";
        selection.buckets.forEach((bucket) => {
          const option = document.createElement("option");
          option.value = bucket.key;
          option.textContent = bucket.name;
          if (bucket.key === state.bucketKey) {
            option.selected = true;
          }
          bucketSelect.appendChild(option);
        });
        bucketSelect.addEventListener("change", (event) => {
          state.bucketKey = event.target.value;
          state.metricId = "";
          renderExplorer();
        });
        pickerRow.appendChild(
          buildPicker(
            state.scope === "phase" ? "Phase" : "Operation",
            bucketSelect,
          ),
        );
      }

      const metricSelect = document.createElement("select");
      metricSelect.className = "benchmark-chart-select";
      const metricOptions =
        selection.bucket && Array.isArray(selection.bucket.series)
          ? selection.bucket.series
          : [];
      metricOptions.forEach((series) => {
        const option = document.createElement("option");
        option.value = series.id;
        option.textContent = series.label;
        if (series.id === state.metricId) {
          option.selected = true;
        }
        metricSelect.appendChild(option);
      });
      metricSelect.addEventListener("change", (event) => {
        state.metricId = event.target.value;
        renderExplorer();
      });
      pickerRow.appendChild(buildPicker("Measurement", metricSelect));

      explorerBody.innerHTML = "";
      if (!selection.metric) {
        const empty = document.createElement("p");
        empty.className = "benchmark-chart-explorer-empty";
        empty.textContent = "No chartable numeric measurements are available for this scope.";
        explorerBody.appendChild(empty);
        return;
      }

      const kicker =
        state.scope === "overall"
          ? "Overall benchmark"
          : (state.scope === "phase" ? "Phase" : "Operation") +
            " • " +
            (selection.bucket ? selection.bucket.name : "");
      const card = buildMetricSeriesCard(selection.metric, {
        kicker,
        title: selection.metric.label,
        explorer: true,
      });
      if (card) {
        explorerBody.appendChild(card);
      }
    }

    renderExplorer();
    return section;
  }

  function collectBatchGraphGroups(runs) {
    const batches = new Map();
    runs.forEach((run) => {
      const batchId =
        typeof run.batch_id === "string" && run.batch_id.trim()
          ? run.batch_id.trim()
          : "";
      if (!batchId) {
        return;
      }
      let bucket = batches.get(batchId);
      if (!bucket) {
        bucket = {
          batch_id: batchId,
          batch_size:
            Number.isFinite(run.batch_size) && run.batch_size > 0
              ? run.batch_size
              : 1,
          created_at: run.created_at || "",
          runs: [],
        };
        batches.set(batchId, bucket);
      }
      bucket.runs.push(run);
      if (
        Number.isFinite(run.batch_size) &&
        run.batch_size > bucket.batch_size
      ) {
        bucket.batch_size = run.batch_size;
      }
    });
    return Array.from(batches.values())
      .filter((batch) => batch.batch_size > 1 || batch.runs.length > 1)
      .map((batch) => {
        batch.runs.sort((left, right) => {
          const leftIndex = Number.isFinite(left.batch_index) ? left.batch_index : 0;
          const rightIndex = Number.isFinite(right.batch_index)
            ? right.batch_index
            : 0;
          if (leftIndex !== rightIndex) {
            return leftIndex - rightIndex;
          }
          return String(left.created_at || "").localeCompare(
            String(right.created_at || ""),
          );
        });
        return batch;
      })
      .sort((left, right) =>
        String(right.created_at || "").localeCompare(String(left.created_at || "")),
      );
  }

  function buildBatchGraphCard(batch) {
    const shell = document.createElement("section");
    shell.className = "benchmark-batch-card";

    const head = document.createElement("div");
    head.className = "benchmark-batch-head";

    const titleWrap = document.createElement("div");
    const title = document.createElement("div");
    title.className = "benchmark-batch-title";
    title.textContent = "Parallel batch • " + String(batch.batch_size) + " runs";
    titleWrap.appendChild(title);

    const subtitle = document.createElement("div");
    subtitle.className = "benchmark-batch-meta";
    const completedCount = batch.runs.filter((run) => run.status === "succeeded").length;
    const runningCount = batch.runs.filter((run) => ACTIVE_STATUSES.has(run.status)).length;
    const failedCount = batch.runs.filter(
      (run) => run.status === "failed" || run.status === "timed_out",
    ).length;
    const cancelledCount = batch.runs.filter((run) => run.status === "cancelled").length;
    const statusBits = [
      completedCount > 0 ? String(completedCount) + " complete" : "",
      runningCount > 0 ? String(runningCount) + " running" : "",
      failedCount > 0 ? String(failedCount) + " failed" : "",
      cancelledCount > 0 ? String(cancelledCount) + " cancelled" : "",
    ].filter(Boolean);
    subtitle.textContent = statusBits.join(" • ") || "Queued";
    titleWrap.appendChild(subtitle);
    head.appendChild(titleWrap);
    shell.appendChild(head);

    const catalog = buildMetricSeriesCatalog(batch);
    if (!catalog || !Array.isArray(catalog.successfulRuns) || catalog.successfulRuns.length === 0) {
      const empty = document.createElement("p");
      empty.className = "benchmark-batch-empty";
      empty.textContent =
        "Waiting for completed runs before plotting benchmark comparisons.";
      shell.appendChild(empty);
      return shell;
    }

    const overview = buildOverviewMetricGrid(catalog);
    if (overview) {
      shell.appendChild(overview);
    }

    const explorer = buildMetricExplorer(catalog);
    if (explorer) {
      shell.appendChild(explorer);
    }
    return shell;
  }

  function buildBatchGraphDeck(runs) {
    const batches = collectBatchGraphGroups(runs);
    if (batches.length === 0) {
      return null;
    }
    const shell = document.createElement("div");
    shell.className = "benchmark-batch-graphs";
    batches.forEach((batch) => {
      shell.appendChild(buildBatchGraphCard(batch));
    });
    return shell;
  }

  function buildRunTable(runs, actions, expandedRunIds) {
    const shell = document.createElement("div");
    shell.className = "runs-table-shell";

    const table = document.createElement("table");
    table.className = "runs-table";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    [
      "Started",
      "Database",
      "Status",
      "Throughput",
      "Avg Latency",
      "Details",
    ].forEach((labelText) => {
      const th = document.createElement("th");
      th.textContent = labelText;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    runs.forEach((run) => {
      const isExpanded =
        expandedRunIds instanceof Set && expandedRunIds.has(run.run_id);
      const throughputMetric = findOverallMetric(run.benchmark_stats, [
        "throughput_using_start_and_end_time_ops_ms",
        "throughput_using_start_and_end_time",
      ]);
      const avgLatencyMetric = findOverallMetric(run.benchmark_stats, [
        "average_latency",
      ]);

      const summaryRow = document.createElement("tr");
      summaryRow.className = "runs-table-summary-row";
      summaryRow.tabIndex = 0;
      summaryRow.setAttribute("role", "button");
      summaryRow.setAttribute("aria-expanded", isExpanded ? "true" : "false");

      const startedCell = document.createElement("td");
      const startedPrimary = document.createElement("div");
      startedPrimary.className = "runs-table-primary";
      startedPrimary.textContent = formatLocalTime(run.created_at) || "—";
      const startedSecondary = document.createElement("div");
      startedSecondary.className = "runs-table-secondary";
      const secondaryParts = [];
      if (
        Number.isFinite(run.batch_size) &&
        run.batch_size > 1 &&
        Number.isFinite(run.batch_index) &&
        run.batch_index > 0
      ) {
        secondaryParts.push(
          "run " + String(run.batch_index) + " of " + String(run.batch_size),
        );
      }
      secondaryParts.push(
        typeof run.run_id === "string" && run.run_id.trim()
          ? run.run_id.trim()
          : "local run",
      );
      startedSecondary.textContent = secondaryParts.join(" • ");
      startedCell.appendChild(startedPrimary);
      startedCell.appendChild(startedSecondary);
      summaryRow.appendChild(startedCell);

      const databaseCell = document.createElement("td");
      databaseCell.textContent = run.database || "—";
      summaryRow.appendChild(databaseCell);

      const statusCell = document.createElement("td");
      const badge = document.createElement("span");
      badge.className = "run-status-badge " + toStatusClass(run.status);
      badge.textContent = statusLabel(run.status);
      statusCell.appendChild(badge);
      summaryRow.appendChild(statusCell);

      const throughputCell = document.createElement("td");
      throughputCell.textContent = throughputMetric
        ? formatMetricValue(throughputMetric)
        : "—";
      summaryRow.appendChild(throughputCell);

      const latencyCell = document.createElement("td");
      latencyCell.textContent = avgLatencyMetric
        ? formatMetricValue(avgLatencyMetric)
        : "—";
      summaryRow.appendChild(latencyCell);

      const outputCell = document.createElement("td");
      outputCell.className = "runs-table-output";
      if (ACTIVE_STATUSES.has(run.status)) {
        outputCell.classList.add("active");
        outputCell.appendChild(buildProgressBar(run.progress, true));
      } else {
        outputCell.textContent = isExpanded ? "Hide all stats" : "Show all stats";
      }
      summaryRow.appendChild(outputCell);

      const detailRow = document.createElement("tr");
      detailRow.className = "runs-table-detail-row";
      detailRow.hidden = !isExpanded;

      const detailCell = document.createElement("td");
      detailCell.className = "runs-table-detail-cell";
      detailCell.colSpan = 6;

      const detail = document.createElement("div");
      detail.className = "runs-table-detail";

      if (
        run.progress &&
        (ACTIVE_STATUSES.has(run.status) ||
          Number.isFinite(run.progress.percent) ||
          run.progress.indeterminate)
      ) {
        detail.appendChild(buildProgressBar(run.progress, false));
      }

      const progressText =
        typeof run.progress_text === "string" ? run.progress_text.trim() : "";
      const progressLabel =
        run.progress &&
        typeof run.progress.label === "string" &&
        run.progress.label.trim()
          ? run.progress.label.trim()
          : "";
      if (progressText && progressText !== progressLabel) {
        const progress = document.createElement("p");
        progress.className = "runs-table-detail-copy";
        progress.textContent = progressText;
        detail.appendChild(progress);
      }

      if (
        run.output_paths &&
        typeof run.output_paths.latest_output_path === "string" &&
        run.output_paths.latest_output_path.trim()
      ) {
        const locationEl = document.createElement("p");
        locationEl.className = "run-location";
        locationEl.textContent =
          "Known output: " + run.output_paths.latest_output_path.trim();
        detail.appendChild(locationEl);
      }

      if (
        run.error &&
        typeof run.error.message === "string" &&
        run.error.message.trim()
      ) {
        const errorEl = document.createElement("p");
        errorEl.className = "run-error";
        errorEl.textContent = run.error.message.trim();
        detail.appendChild(errorEl);
      }

      const statsEl = buildBenchmarkStats(run.benchmark_stats);
      if (statsEl) {
        detail.appendChild(statsEl);
      }

      detail.appendChild(buildRunActions(run, actions));
      detailCell.appendChild(detail);
      detailRow.appendChild(detailCell);

      const toggleExpanded = () => {
        const nextExpanded = detailRow.hidden;
        detailRow.hidden = !nextExpanded;
        summaryRow.classList.toggle("expanded", nextExpanded);
        summaryRow.setAttribute("aria-expanded", nextExpanded ? "true" : "false");
        if (!ACTIVE_STATUSES.has(run.status)) {
          outputCell.textContent = nextExpanded
            ? "Hide all stats"
            : "Show all stats";
        }
        if (expandedRunIds instanceof Set) {
          if (nextExpanded) {
            expandedRunIds.add(run.run_id);
          } else {
            expandedRunIds.delete(run.run_id);
          }
        }
      };

      summaryRow.classList.toggle("expanded", isExpanded);

      summaryRow.addEventListener("click", toggleExpanded);
      summaryRow.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggleExpanded();
        }
      });

      tbody.appendChild(summaryRow);
      tbody.appendChild(detailRow);
    });

    table.appendChild(tbody);
    shell.appendChild(table);
    return shell;
  }

  function normalizeRunEntry(raw, fallbackRunId) {
    const input = raw && typeof raw === "object" ? raw : {};
    const status =
      typeof input.status === "string" && input.status.trim()
        ? input.status.trim()
        : "running";
    const progressText =
      typeof input.progress_text === "string" ? input.progress_text : "";
    return {
      run_id:
        typeof input.run_id === "string" && input.run_id.trim()
          ? input.run_id.trim()
          : fallbackRunId,
      database:
        typeof input.database === "string" && input.database.trim()
          ? input.database.trim()
          : input.run_options &&
              typeof input.run_options === "object" &&
              typeof input.run_options.database === "string" &&
              input.run_options.database.trim()
            ? input.run_options.database.trim()
            : "",
      status:
        status,
      created_at:
        typeof input.created_at === "string"
          ? input.created_at
          : new Date().toISOString(),
      progress_text: progressText,
      progress: normalizeRunProgress(input.progress, progressText, status),
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
      batch_id:
        typeof input.batch_id === "string" && input.batch_id.trim()
          ? input.batch_id.trim()
          : "",
      batch_index: Number.isFinite(Number(input.batch_index))
        ? Math.max(1, Number.parseInt(String(input.batch_index), 10))
        : null,
      batch_size: Number.isFinite(Number(input.batch_size))
        ? Math.max(1, Number.parseInt(String(input.batch_size), 10))
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
                  : "",
              cancel_path: "",
            },
    };
  }

  function createWorkloadRunsController(options) {
    const opts = options && typeof options === "object" ? options : {};
    const runsListEl = opts.runsListEl || null;
    const onError =
      typeof opts.onError === "function" ? opts.onError : defaultNoop;
    const onBusyChange =
      typeof opts.onBusyChange === "function" ? opts.onBusyChange : defaultNoop;
    const runs = readPersistedRuns().map((entry) =>
      normalizeRunEntry(entry, createRunId()),
    );
    const expandedRunIds = new Set();
    let pollTimer = null;
    let requestInFlight = false;

    function persistRuns() {
      writePersistedRuns(runs);
    }

    function findRun(runId) {
      return runs.find((entry) => entry.run_id === runId) || null;
    }

    function mergeRun(rawRun) {
      const normalized = normalizeRunEntry(rawRun, createRunId());
      const existing = findRun(normalized.run_id);
      if (!existing) {
        runs.unshift(normalized);
        persistRuns();
        return normalized;
      }
      if (!normalized.database && existing.database) {
        normalized.database = existing.database;
      }
      if (!normalized.batch_id && existing.batch_id) {
        normalized.batch_id = existing.batch_id;
      }
      if (!Number.isFinite(normalized.batch_index) && Number.isFinite(existing.batch_index)) {
        normalized.batch_index = existing.batch_index;
      }
      if (!Number.isFinite(normalized.batch_size) && Number.isFinite(existing.batch_size)) {
        normalized.batch_size = existing.batch_size;
      }
      Object.assign(existing, normalized);
      persistRuns();
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
              persistRuns();
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
        const nextStatus =
          body && typeof body.status === "string" && body.status.trim()
            ? body.status.trim()
            : "cancelled";
        const optimisticStatus = ACTIVE_STATUSES.has(run.status)
          ? run.status
          : nextStatus;
        mergeRun({
          run_id: run.run_id,
          status: optimisticStatus,
          progress_text:
            optimisticStatus === nextStatus
              ? getCancelProgressText(body)
              : "Cancellation requested.",
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
        expandedRunIds.clear();
        const empty = document.createElement("p");
        empty.className = "runs-empty";
        empty.textContent =
          'No runs yet. Click "Run Workload" to execute a tectonic benchmark.';
        runsListEl.appendChild(empty);
        return;
      }
      const batchGraphs = buildBatchGraphDeck(runs);
      if (batchGraphs) {
        runsListEl.appendChild(batchGraphs);
      }
      runsListEl.appendChild(
        buildRunTable(runs, { cancel: cancelRun }, expandedRunIds),
      );
    }

    async function startRun(specJson, options) {
      if (!specJson || typeof specJson !== "object") {
        onError("Cannot start run without a valid spec JSON object.");
        return null;
      }
      const databases =
        options &&
        typeof options === "object" &&
        Array.isArray(options.databases)
          ? options.databases
              .map((entry) => String(entry || "").trim())
              .filter(Boolean)
          : [];
      const database = databases.length > 0 ? databases[0] : "rocksdb";
      onBusyChange(true);
      try {
        const response = await fetch(START_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            spec_json: specJson,
            run_options: {
              database: database,
              databases: databases.length > 0 ? databases : [database],
            },
          }),
        });
        const body = await parseJsonResponse(response);
        const responseRuns =
          Array.isArray(body.runs) && body.runs.length > 0 ? body.runs : [body];
        let merged = null;
        for (let index = responseRuns.length - 1; index >= 0; index -= 1) {
          merged = mergeRun({
            ...responseRuns[index],
            database:
              responseRuns[index] &&
              typeof responseRuns[index].database === "string" &&
              responseRuns[index].database.trim()
                ? responseRuns[index].database.trim()
                : database,
          });
        }
        render();
        ensurePolling();
        void pollRuns();
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
      expandedRunIds.clear();
      stopPolling();
      clearPersistedRuns();
      render();
    }

    function dispose() {
      stopPolling();
    }

    render();
    ensurePolling();
    if (hasActiveRuns()) {
      void pollRuns();
    }
    return {
      startRun,
      clear,
      dispose,
      pollNow: pollRuns,
    };
  }

  window.createWorkloadRunsController = createWorkloadRunsController;
})();
