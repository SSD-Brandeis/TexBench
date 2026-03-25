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
      return formatNumericString(numberPart, 2) + " µs";
    }

    if (rawValue.endsWith("ms")) {
      const numberPart = rawValue.slice(0, -2).trim();
      const parsed = Number.parseFloat(numberPart);
      if (!Number.isFinite(parsed)) {
        return rawValue;
      }
      return formatNumericString(parsed * 1000, 2) + " µs";
    }

    if (label.indexOf("Throughput") !== -1 && rawValue.indexOf("ops/ms") === -1) {
      const parsed = Number.parseFloat(rawValue);
      if (!Number.isFinite(parsed)) {
        return rawValue;
      }
      return formatNumericString(parsed / 1000, 4) + " ops/µs";
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
    return parseNumericMetricValue(rawValue);
  }

  function formatThroughputLabel(value) {
    return formatNumericString(value, 3) + " ops/ms";
  }

  function formatLatencyLabelMicros(value) {
    return formatNumericString(value, 2) + " µs";
  }

  function formatMetricChartValue(metricKey, value) {
    if (!Number.isFinite(value)) {
      return "—";
    }
    const key = String(metricKey || "").trim().toLowerCase();
    if (
      key === "throughput_using_start_and_end_time_ops_ms" ||
      key === "throughput_using_start_and_end_time"
    ) {
      return formatThroughputLabel(value);
    }
    if (
      key.indexOf("latency") !== -1 ||
      key === "total_time_spent_using_start_and_end_time"
    ) {
      return formatLatencyLabelMicros(value);
    }
    return formatNumericString(value, 2);
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
    const height = 220;
    const margin = { top: 18, right: 18, bottom: 42, left: 72 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const maxValue = Math.max(
      1,
      ...points.map((entry) => (Number.isFinite(entry.value) ? entry.value : 0)),
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
    shadow.setAttribute("height", "160%");
    const blur = document.createElementNS(ns, "feDropShadow");
    blur.setAttribute("dx", "0");
    blur.setAttribute("dy", "8");
    blur.setAttribute("stdDeviation", "8");
    blur.setAttribute("flood-color", palette.start);
    blur.setAttribute("flood-opacity", "0.15");
    shadow.appendChild(blur);
    defs.appendChild(shadow);
    svg.appendChild(defs);

    const plotBg = document.createElementNS(ns, "rect");
    plotBg.setAttribute("x", String(margin.left));
    plotBg.setAttribute("y", String(margin.top));
    plotBg.setAttribute("width", String(plotWidth));
    plotBg.setAttribute("height", String(plotHeight));
    plotBg.setAttribute("rx", "12");
    plotBg.setAttribute("fill", "#fbfdff");
    plotBg.setAttribute("stroke", "#e1eaf2");
    svg.appendChild(plotBg);

    for (let index = 0; index <= 4; index += 1) {
      const ratio = index / 4;
      const y = margin.top + plotHeight * ratio;
      const grid = document.createElementNS(ns, "line");
      grid.setAttribute("x1", String(margin.left));
      grid.setAttribute("x2", String(width - margin.right));
      grid.setAttribute("y1", String(y));
      grid.setAttribute("y2", String(y));
      grid.setAttribute("stroke", "#dbe7ef");
      grid.setAttribute("stroke-width", "1");
      svg.appendChild(grid);

      const axisLabel = document.createElementNS(ns, "text");
      axisLabel.setAttribute("x", String(margin.left - 8));
      axisLabel.setAttribute("y", String(y + 4));
      axisLabel.setAttribute("text-anchor", "end");
      axisLabel.setAttribute("font-size", "11");
      axisLabel.setAttribute("fill", "#607588");
      axisLabel.textContent = formatMetricChartValue(
        metricSeries.key,
        maxValue * (1 - ratio),
      );
      svg.appendChild(axisLabel);
    }

    const baseline = document.createElementNS(ns, "line");
    baseline.setAttribute("x1", String(margin.left));
    baseline.setAttribute("x2", String(width - margin.right));
    baseline.setAttribute("y1", String(margin.top + plotHeight));
    baseline.setAttribute("y2", String(margin.top + plotHeight));
    baseline.setAttribute("stroke", "#cfdce7");
    baseline.setAttribute("stroke-width", "1.5");
    svg.appendChild(baseline);

    const step = plotWidth / Math.max(points.length, 1);
    const barWidth = Math.min(38, step * 0.52);

    points.forEach((point, index) => {
      const centerX = margin.left + step * index + step / 2;
      const barHeight = (point.value / maxValue) * plotHeight;
      const rect = document.createElementNS(ns, "rect");
      rect.setAttribute("x", String(centerX - barWidth / 2));
      rect.setAttribute("y", String(margin.top + (plotHeight - barHeight)));
      rect.setAttribute("width", String(barWidth));
      rect.setAttribute("height", String(barHeight));
      rect.setAttribute("rx", "8");
      rect.setAttribute("fill", `url(#${assetId}-bar)`);
      rect.setAttribute("stroke", palette.stroke);
      rect.setAttribute("stroke-opacity", "0.22");
      rect.setAttribute("filter", `url(#${assetId}-shadow)`);
      svg.appendChild(rect);

      const valueLabel = document.createElementNS(ns, "text");
      valueLabel.setAttribute("x", String(centerX));
      valueLabel.setAttribute(
        "y",
        String(Math.max(margin.top + 10, margin.top + (plotHeight - barHeight) - 6)),
      );
      valueLabel.setAttribute("text-anchor", "middle");
      valueLabel.setAttribute("font-size", "10");
      valueLabel.setAttribute("font-weight", "600");
      valueLabel.setAttribute("fill", palette.text);
      valueLabel.textContent = formatMetricChartValue(metricSeries.key, point.value);
      svg.appendChild(valueLabel);

      const label = document.createElementNS(ns, "text");
      label.setAttribute("x", String(centerX));
      label.setAttribute("y", String(height - 12));
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("font-size", "11");
      label.setAttribute("fill", "#607588");
      label.textContent = point.label;
      svg.appendChild(label);
    });

    return svg;
  }

  function buildMetricChartGrid(batch) {
    const excluded = new Set([
      "throughput_using_aggregate_operation_times_ops_ms",
      "aggregate_operation_time",
    ]);
    const successfulRuns = batch.runs.filter(
      (run) => run.status === "succeeded" && run.benchmark_stats,
    );
    if (successfulRuns.length === 0) {
      return null;
    }

    const seriesMap = new Map();
    successfulRuns.forEach((run) => {
      const metrics = normalizeMetricsList(
        run.benchmark_stats && run.benchmark_stats.overall,
      );
      metrics.forEach((metric) => {
        const key = String(metric && metric.key ? metric.key : "").trim();
        if (!key || excluded.has(key)) {
          return;
        }
        let numericValue = null;
        if (
          key === "throughput_using_start_and_end_time_ops_ms" ||
          key === "throughput_using_start_and_end_time"
        ) {
          numericValue = parseThroughputMetricValue(metric);
        } else if (
          key.indexOf("latency") !== -1 ||
          key === "total_time_spent_using_start_and_end_time"
        ) {
          numericValue = parseLatencyMetricValueMicros(metric);
        } else {
          numericValue = parseNumericMetricValue(metric.value);
        }
        if (!Number.isFinite(numericValue)) {
          return;
        }
        let series = seriesMap.get(key);
        if (!series) {
          series = {
            key,
            label: formatMetricLabel(metric.label),
            points: [],
          };
          seriesMap.set(key, series);
        }
        series.points.push({
          label:
            typeof run.database === "string" && run.database.trim()
              ? run.database.trim()
              : Number.isFinite(run.batch_index) && run.batch_index > 0
                ? "R" + String(run.batch_index)
                : "Run",
          value: numericValue,
        });
      });
    });

    const seriesList = Array.from(seriesMap.values())
      .filter((series) => Array.isArray(series.points) && series.points.length > 0)
      .sort((left, right) => {
        const leftPriority = metricPriority({ key: left.key });
        const rightPriority = metricPriority({ key: right.key });
        if (leftPriority !== rightPriority) {
          return leftPriority - rightPriority;
        }
        return left.label.localeCompare(right.label);
      });

    if (seriesList.length === 0) {
      return null;
    }

    const grid = document.createElement("div");
    grid.className = "benchmark-metric-chart-grid";
    seriesList.forEach((series) => {
      const card = document.createElement("section");
      card.className = "benchmark-metric-chart-card";

      const title = document.createElement("div");
      title.className = "benchmark-metric-chart-title";
      title.textContent = series.label;
      card.appendChild(title);

      const chart = buildMetricBarChart(series);
      if (chart) {
        card.appendChild(chart);
      }
      grid.appendChild(card);
    });
    return grid;
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
    const points = batch.runs
      .map((run) => {
        if (run.status !== "succeeded") {
          return null;
        }
        const throughputMetric = findOverallMetric(run.benchmark_stats, [
          "throughput_using_start_and_end_time_ops_ms",
          "throughput_using_start_and_end_time",
        ]);
        const latencyMetric = findOverallMetric(run.benchmark_stats, [
          "average_latency",
        ]);
        const throughput = parseThroughputMetricValue(throughputMetric);
        const avgLatencyMicros = parseLatencyMetricValueMicros(latencyMetric);
        if (!Number.isFinite(throughput) && !Number.isFinite(avgLatencyMicros)) {
          return null;
        }
        return {
          label:
            typeof run.database === "string" && run.database.trim()
              ? run.database.trim()
              : Number.isFinite(run.batch_index) && run.batch_index > 0
                ? "R" + String(run.batch_index)
                : "Run",
          throughput,
          avgLatencyMicros,
        };
      })
      .filter(Boolean);
    shell.appendChild(head);

    if (points.length === 0) {
      const empty = document.createElement("p");
      empty.className = "benchmark-batch-empty";
      empty.textContent =
        "Waiting for completed runs before plotting throughput and latency.";
      shell.appendChild(empty);
      return shell;
    }
    const chartGrid = buildMetricChartGrid(batch);
    if (chartGrid) {
      shell.appendChild(chartGrid);
    } else {
      const empty = document.createElement("p");
      empty.className = "benchmark-batch-empty";
      empty.textContent =
        "Waiting for completed runs before plotting comparable metrics.";
      shell.appendChild(empty);
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
