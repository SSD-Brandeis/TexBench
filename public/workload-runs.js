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

  var DB_DISPLAY_NAMES = { rocksdb: "RocksDB", cassandra: "Cassandra", printdb: "PrintDB", scylla: "ScyllaDB" };
  function dbDisplayName(name) {
    if (!name) return "unknown";
    return DB_DISPLAY_NAMES[name.toLowerCase()] || name;
  }

  function defaultNoop() {}

  function readPersistedRuns() {
    try {
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

  function findScrollContainer(node) {
    let current = node && node.parentElement ? node.parentElement : null;
    while (current) {
      const style = window.getComputedStyle(current);
      const overflowY = style ? style.overflowY : "";
      if (
        /(auto|scroll|overlay)/.test(String(overflowY || "").toLowerCase()) &&
        current.scrollHeight > current.clientHeight
      ) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }

  function captureScrollState(node) {
    const container = findScrollContainer(node);
    const scrollingElement =
      document.scrollingElement || document.documentElement || document.body;
    const activeElement =
      document.activeElement && typeof document.activeElement.closest === "function"
        ? document.activeElement
        : null;
    const focusedRunId =
      activeElement &&
      activeElement.closest &&
      activeElement.closest("[data-run-id]")
        ? activeElement.closest("[data-run-id]").getAttribute("data-run-id")
        : "";
    return {
      container: container || null,
      top: container ? container.scrollTop : 0,
      left: container ? container.scrollLeft : 0,
      pageTop: scrollingElement ? scrollingElement.scrollTop : 0,
      pageLeft: scrollingElement ? scrollingElement.scrollLeft : 0,
      focusedRunId: focusedRunId || "",
    };
  }

  function restoreScrollState(state, rootNode) {
    if (!state) {
      return;
    }
    const scrollingElement =
      document.scrollingElement || document.documentElement || document.body;
    const apply = () => {
      if (state.container) {
        state.container.scrollTop = state.top;
        state.container.scrollLeft = state.left;
      }
      if (scrollingElement) {
        scrollingElement.scrollTop = state.pageTop;
        scrollingElement.scrollLeft = state.pageLeft;
      }
      if (state.focusedRunId && rootNode && typeof rootNode.querySelector === "function") {
        const focusTarget = rootNode.querySelector(
          '[data-run-id="' + CSS.escape(state.focusedRunId) + '"]',
        );
        if (focusTarget && typeof focusTarget.focus === "function") {
          try {
            focusTarget.focus({ preventScroll: true });
          } catch (_error) {
            focusTarget.focus();
          }
        }
      }
    };
    apply();
    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(apply);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(apply);
      });
    }
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

  function formatWholeNumberAxisValue(value, options = {}) {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) {
      return "—";
    }
    const rounded = Math.max(0, Math.round(parsed));
    if (options.compact === true && rounded >= 1000) {
      return new Intl.NumberFormat(undefined, {
        notation: "compact",
        maximumFractionDigits: 0,
      }).format(rounded);
    }
    return rounded.toLocaleString();
  }

  function formatAxisTickValue(value, step, options = {}) {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) {
      return "—";
    }
    if (options.compact === true && Math.abs(parsed) >= 1000) {
      return new Intl.NumberFormat(undefined, {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(parsed);
    }
    const safeStep = Number.isFinite(step) && step > 0 ? step : 1;
    let maximumFractionDigits = 0;
    if (safeStep < 1) {
      maximumFractionDigits = Math.min(
        3,
        Math.max(0, Math.ceil(-Math.log10(safeStep))),
      );
    }
    return parsed.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits,
    });
  }

  function niceAxisStep(value) {
    const safeValue = Number.isFinite(value) && value > 0 ? value : 1;
    const exponent = Math.floor(Math.log10(safeValue));
    const fraction = safeValue / Math.pow(10, exponent);
    let niceFraction = 1;
    if (fraction <= 1) {
      niceFraction = 1;
    } else if (fraction <= 2) {
      niceFraction = 2;
    } else if (fraction <= 2.5) {
      niceFraction = 2.5;
    } else if (fraction <= 5) {
      niceFraction = 5;
    } else {
      niceFraction = 10;
    }
    return niceFraction * Math.pow(10, exponent);
  }

  function buildWholeNumberAxis(maxValue, divisor = 1, intervalCount = 4) {
    const safeDivisor =
      Number.isFinite(divisor) && divisor > 0 ? divisor : 1;
    const safeIntervals =
      Number.isInteger(intervalCount) && intervalCount > 0 ? intervalCount : 4;
    const displayMax = Number.isFinite(maxValue) ? maxValue / safeDivisor : 0;
    const targetStep = Math.max(displayMax / safeIntervals, 0.0001);
    const displayStep = niceAxisStep(targetStep);
    const tickCount = Math.max(1, Math.ceil(displayMax / displayStep));
    const axisDisplayMax = displayStep * tickCount;
    return {
      axisMaxRaw: axisDisplayMax * safeDivisor,
      stepDisplay: displayStep,
      ticks: Array.from({ length: tickCount + 1 }, (_, index) =>
        Math.max(0, axisDisplayMax - displayStep * index),
      ),
    };
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
        axisDivisor: 1,
        titleUnit: unit,
        formatAxisValue(value) {
          return formatChartDecimalValue(value) + " " + unit;
        },
        formatAxisBucketValue(value, axisDescriptor) {
          return formatAxisTickValue(
            value,
            axisDescriptor && axisDescriptor.stepDisplay,
          );
        },
        formatValue(value) {
          return formatThroughputLabel(value, unit);
        },
        formatSummaryValue(value) {
          return formatNumericString(value, 2);
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
        axisDivisor: latencyUnit.divisor,
        titleUnit: latencyUnit.unit === "µs" ? "us" : latencyUnit.unit,
        formatAxisValue(value) {
          return formatChartDecimalValue(value / latencyUnit.divisor) + " " + latencyUnit.unit;
        },
        formatAxisBucketValue(value, axisDescriptor) {
          return formatAxisTickValue(
            value,
            axisDescriptor && axisDescriptor.stepDisplay,
          );
        },
        formatValue(value) {
          return formatChartDecimalValue(value / latencyUnit.divisor) + " " + latencyUnit.unit;
        },
        formatSummaryValue(value) {
          return formatChartDecimalValue(value / latencyUnit.divisor);
        },
      };
    }
    return {
      emphasis: "neutral",
      trendLabel: "Higher is better",
      axisDivisor: 1,
      titleUnit: "",
      formatAxisValue(value) {
        return formatChartDecimalValue(value, { compact: true });
      },
      formatAxisBucketValue(value, axisDescriptor) {
          return formatAxisTickValue(
            value,
            axisDescriptor && axisDescriptor.stepDisplay,
            { compact: true },
          );
      },
      formatValue(value) {
        return formatChartDecimalValue(value);
      },
      formatSummaryValue(value) {
        return formatChartDecimalValue(value);
      },
      };
  }

  function formatMetricChartTitle(label, descriptor) {
    const baseLabel = String(label || "").trim() || "Benchmark metric";
    const unit =
      descriptor && typeof descriptor.titleUnit === "string"
        ? descriptor.titleUnit.trim()
        : "";
    if (!unit) {
      return baseLabel;
    }
    return `${baseLabel} (${unit})`;
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
    const metrics = normalizeMetricsList(entry && entry.metrics);
    if (name && (/\bphase\b|\bgroup\b/.test(name) || /\bsection\b/.test(name))) {
      return true;
    }
    if (name) {
      const operationBucketNames = new Set([
        "insert",
        "inserts",
        "update",
        "updates",
        "merge",
        "merges",
        "point query",
        "point queries",
        "range query",
        "range queries",
        "point delete",
        "point deletes",
        "range delete",
        "range deletes",
        "empty point query",
        "empty point queries",
        "empty point delete",
        "empty point deletes",
        "sorted",
      ]);
      if (operationBucketNames.has(name)) {
        return false;
      }
    }
    if (metrics.length === 0) {
      return false;
    }

    const phaseMetricPrefixPattern =
      /^(?:overall|insert|update|merge|point query|range query|point delete|range delete|empty point query|empty point delete|sorted)\b/i;
    return metrics.some((metric) =>
      phaseMetricPrefixPattern.test(String(metric && metric.label ? metric.label : "").trim()),
    );
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

  // ── Paper-style benchmark plots ──

  var DB_COLORS = ["#2d2d2d", "#7f8c8d", "#b85c4f", "#4a90a4", "#5a8f5a", "#b89b4f"];
  var DB_FIXED_COLORS = {
    RocksDB: "#2d2d2d",
    Cassandra: "#b85c4f",
    PrintDB: "#7f8c8d",
    ScyllaDB: "#4a90a4",
  };
  function dbColor(label, index) {
    return DB_FIXED_COLORS[label] || DB_COLORS[index % DB_COLORS.length];
  }

  function niceAxisTicks(maxVal, targetTicks) {
    if (!maxVal || maxVal <= 0) return [0, 1];
    var rough = maxVal / (targetTicks || 4);
    var mag = Math.pow(10, Math.floor(Math.log10(rough)));
    var res = rough / mag;
    var step;
    if (res <= 1) step = mag;
    else if (res <= 2) step = 2 * mag;
    else if (res <= 5) step = 5 * mag;
    else step = 10 * mag;
    var ticks = [];
    for (var v = 0; v <= maxVal + step * 0.01; v += step) {
      ticks.push(Math.round(v * 1e6) / 1e6);
    }
    // Ensure at least one tick above maxVal for headroom
    if (ticks[ticks.length - 1] < maxVal) ticks.push(ticks[ticks.length - 1] + step);
    return ticks;
  }

  function fmtAxisVal(v) {
    if (v >= 1000000) return Math.round(v / 1000000) + "M";
    if (v >= 1000) {
      var k = v / 1000;
      return (k === Math.floor(k)) ? Math.floor(k) + "K" : k.toFixed(1) + "K";
    }
    return String(Math.round(v));
  }

  function extractOperationLatencyData(run) {
    if (!run || !run.benchmark_stats) return [];
    var operations = normalizeStatsBuckets(run.benchmark_stats.operations);
    return operations.map(function (op) {
      var metrics = normalizeMetricsList(op.metrics);
      function fm(candidates) {
        for (var c = 0; c < candidates.length; c++) {
          var found = metrics.find(function (m) {
            var k = String(m.key || "").toLowerCase();
            var l = slugifyMetricLabel(m.label);
            return k === candidates[c] || l === candidates[c];
          });
          if (found) return found;
        }
        return null;
      }
      return {
        operation: formatStatsBucketTitle(op.name),
        operationKey: slugifyMetricLabel(op.name) || op.name,
        min: parseLatencyMetricValueMicros(fm(["minimum_latency", "min_latency"])),
        max: parseLatencyMetricValueMicros(fm(["maximum_latency", "max_latency"])),
        avg: parseLatencyMetricValueMicros(fm(["average_latency", "avg_latency"])),
        p50: parseLatencyMetricValueMicros(fm(["50th_percentile_latency", "median_latency", "percentile_50_latency"])),
        p95: parseLatencyMetricValueMicros(fm(["95th_percentile_latency", "percentile_95_latency"])),
        p99: parseLatencyMetricValueMicros(fm(["99th_percentile_latency", "percentile_99_latency"])),
      };
    });
  }

  function paperBarChart(points, yAxisLabel, chartTitle) {
    // points: [{ label, value }]
    if (!points || points.length === 0) return null;
    var ns = "http://www.w3.org/2000/svg";
    var w = 460, h = 300;
    var m = { t: 18, r: 20, b: 36, l: 62 };
    var pw = w - m.l - m.r, ph = h - m.t - m.b;
    var maxVal = Math.max(1, ...points.map(function (p) { return p.value; }));
    var ticks = niceAxisTicks(maxVal, 5);
    var ceil = ticks[ticks.length - 1];

    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("class", "paper-chart");
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);

    // Tooltip element (shared, repositioned on hover)
    var tooltip = document.createElementNS(ns, "g");
    tooltip.setAttribute("visibility", "hidden");
    tooltip.setAttribute("pointer-events", "none");
    var ttBg = document.createElementNS(ns, "rect");
    ttBg.setAttribute("rx", "4"); ttBg.setAttribute("ry", "4");
    ttBg.setAttribute("fill", "#222"); ttBg.setAttribute("fill-opacity", "0.92");
    tooltip.appendChild(ttBg);
    var ttText = document.createElementNS(ns, "text");
    ttText.setAttribute("fill", "#fff"); ttText.setAttribute("font-size", "11");
    ttText.setAttribute("font-weight", "600"); ttText.setAttribute("font-family", "inherit");
    ttText.setAttribute("text-anchor", "middle");
    tooltip.appendChild(ttText);

    // Y-axis line
    var yAxis = document.createElementNS(ns, "line");
    yAxis.setAttribute("x1", String(m.l)); yAxis.setAttribute("x2", String(m.l));
    yAxis.setAttribute("y1", String(m.t)); yAxis.setAttribute("y2", String(m.t + ph));
    yAxis.setAttribute("stroke", "#000"); yAxis.setAttribute("stroke-width", "1");
    svg.appendChild(yAxis);
    // X-axis line
    var xAxis = document.createElementNS(ns, "line");
    xAxis.setAttribute("x1", String(m.l)); xAxis.setAttribute("x2", String(m.l + pw));
    xAxis.setAttribute("y1", String(m.t + ph)); xAxis.setAttribute("y2", String(m.t + ph));
    xAxis.setAttribute("stroke", "#000"); xAxis.setAttribute("stroke-width", "1");
    svg.appendChild(xAxis);

    // Grid lines
    ticks.forEach(function (tv) {
      if (tv === 0) return;
      var y = m.t + ph - (tv / ceil) * ph;
      var gl = document.createElementNS(ns, "line");
      gl.setAttribute("x1", String(m.l)); gl.setAttribute("x2", String(m.l + pw));
      gl.setAttribute("y1", String(y)); gl.setAttribute("y2", String(y));
      gl.setAttribute("stroke", "#e5e5e5"); gl.setAttribute("stroke-width", "0.5");
      svg.appendChild(gl);
    });

    // Y ticks + labels
    ticks.forEach(function (tv) {
      var y = m.t + ph - (tv / ceil) * ph;
      var tick = document.createElementNS(ns, "line");
      tick.setAttribute("x1", String(m.l - 4)); tick.setAttribute("x2", String(m.l));
      tick.setAttribute("y1", String(y)); tick.setAttribute("y2", String(y));
      tick.setAttribute("stroke", "#000"); tick.setAttribute("stroke-width", "0.8");
      svg.appendChild(tick);
      var lbl = document.createElementNS(ns, "text");
      lbl.setAttribute("x", String(m.l - 6)); lbl.setAttribute("y", String(y + 4));
      lbl.setAttribute("text-anchor", "end"); lbl.setAttribute("font-size", "13");
      lbl.setAttribute("fill", "#444"); lbl.setAttribute("font-family", "inherit");
      lbl.textContent = fmtAxisVal(tv);
      svg.appendChild(lbl);
    });

    // Y-axis title (chart title goes here)
    var yLbl = document.createElementNS(ns, "text");
    yLbl.setAttribute("x", String(13)); yLbl.setAttribute("y", String(m.t + ph / 2));
    yLbl.setAttribute("text-anchor", "middle"); yLbl.setAttribute("font-size", "14");
    yLbl.setAttribute("font-weight", "600"); yLbl.setAttribute("fill", "#222");
    yLbl.setAttribute("font-family", "inherit");
    yLbl.setAttribute("transform", "rotate(-90 13 " + (m.t + ph / 2) + ")");
    yLbl.textContent = chartTitle || yAxisLabel || "";
    svg.appendChild(yLbl);

    // Bars
    var step = pw / Math.max(points.length, 1);
    var barW = Math.min(56, step * 0.5);
    points.forEach(function (pt, i) {
      var cx = m.l + step * i + step / 2;
      var barH = (pt.value / ceil) * ph;
      var barY = m.t + ph - barH;
      var rect = document.createElementNS(ns, "rect");
      rect.setAttribute("x", String(cx - barW / 2)); rect.setAttribute("y", String(barY));
      rect.setAttribute("width", String(barW)); rect.setAttribute("height", String(barH));
      rect.setAttribute("rx", "2"); rect.setAttribute("ry", "2");
      rect.setAttribute("fill", dbColor(pt.label, i));
      rect.setAttribute("style", "cursor:pointer");
      svg.appendChild(rect);
      // Hover hit area (invisible wider rect for easier hover)
      var hitArea = document.createElementNS(ns, "rect");
      hitArea.setAttribute("x", String(cx - step / 2)); hitArea.setAttribute("y", String(m.t));
      hitArea.setAttribute("width", String(step)); hitArea.setAttribute("height", String(ph));
      hitArea.setAttribute("fill", "transparent");
      hitArea.setAttribute("style", "cursor:pointer");
      // Hover tooltip
      var exactVal = pt.value;
      hitArea.addEventListener("mouseenter", function () {
        ttText.textContent = pt.label + ": " + exactVal.toLocaleString(undefined, { maximumFractionDigits: 2 });
        var bbox = ttText.getBBox();
        ttBg.setAttribute("x", String(cx - bbox.width / 2 - 6));
        ttBg.setAttribute("y", String(barY - 24));
        ttBg.setAttribute("width", String(bbox.width + 12));
        ttBg.setAttribute("height", String(18));
        ttText.setAttribute("x", String(cx));
        ttText.setAttribute("y", String(barY - 10));
        tooltip.setAttribute("visibility", "visible");
      });
      hitArea.addEventListener("mouseleave", function () {
        tooltip.setAttribute("visibility", "hidden");
      });
      svg.appendChild(hitArea);
      // Value on top
      var vt = document.createElementNS(ns, "text");
      vt.setAttribute("x", String(cx)); vt.setAttribute("y", String(barY - 4));
      vt.setAttribute("text-anchor", "middle"); vt.setAttribute("font-size", "13");
      vt.setAttribute("font-weight", "600"); vt.setAttribute("fill", "#111");
      vt.setAttribute("font-family", "inherit");
      vt.setAttribute("pointer-events", "none");
      vt.textContent = fmtAxisVal(Math.round(pt.value));
      svg.appendChild(vt);
      // X label
      var xl = document.createElementNS(ns, "text");
      xl.setAttribute("x", String(cx)); xl.setAttribute("y", String(m.t + ph + 20));
      xl.setAttribute("text-anchor", "middle"); xl.setAttribute("font-size", "13");
      xl.setAttribute("font-weight", "600"); xl.setAttribute("fill", "#333");
      xl.setAttribute("font-family", "inherit");
      xl.textContent = pt.label;
      svg.appendChild(xl);
    });
    // Tooltip layer on top of everything
    svg.appendChild(tooltip);
    return svg;
  }

  function paperBoxPlot(databases, yAxisLabel, unitDiv, chartTitle) {
    // databases: [{ label, min, max, avg, p50, p95, p99 }]
    if (!databases || databases.length === 0) return null;
    var ns = "http://www.w3.org/2000/svg";
    var ndb = databases.length;
    // Extra height for legend row below x-labels
    var w = 460, h = 320;
    var m = { t: 18, r: 20, b: 56, l: 62 };
    var pw = w - m.l - m.r, ph = h - m.t - m.b;
    var div = unitDiv || 1;

    // Collect all values for y range
    var allVals = [];
    databases.forEach(function (d) {
      [d.min, d.max, d.avg, d.p50, d.p95, d.p99].forEach(function (v) {
        if (v != null && Number.isFinite(v)) allVals.push(v / div);
      });
    });
    if (allVals.length === 0) return null;
    var rawMax = Math.max(1, ...allVals);
    var ticks = niceAxisTicks(rawMax, 5);
    var ceil = ticks[ticks.length - 1];

    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("class", "paper-chart");
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);

    // Tooltip element (shared)
    var tooltip = document.createElementNS(ns, "g");
    tooltip.setAttribute("visibility", "hidden");
    tooltip.setAttribute("pointer-events", "none");
    var ttBg = document.createElementNS(ns, "rect");
    ttBg.setAttribute("rx", "4"); ttBg.setAttribute("ry", "4");
    ttBg.setAttribute("fill", "#222"); ttBg.setAttribute("fill-opacity", "0.92");
    tooltip.appendChild(ttBg);
    var ttLines = [];
    for (var ti = 0; ti < 7; ti++) {
      var tl = document.createElementNS(ns, "text");
      tl.setAttribute("fill", "#fff"); tl.setAttribute("font-size", "12");
      tl.setAttribute("font-family", "inherit");
      tl.setAttribute("text-anchor", "start");
      tooltip.appendChild(tl);
      ttLines.push(tl);
    }

    // Y-axis + X-axis
    var yAx = document.createElementNS(ns, "line");
    yAx.setAttribute("x1", String(m.l)); yAx.setAttribute("x2", String(m.l));
    yAx.setAttribute("y1", String(m.t)); yAx.setAttribute("y2", String(m.t + ph));
    yAx.setAttribute("stroke", "#000"); yAx.setAttribute("stroke-width", "1");
    svg.appendChild(yAx);
    var xAx = document.createElementNS(ns, "line");
    xAx.setAttribute("x1", String(m.l)); xAx.setAttribute("x2", String(m.l + pw));
    xAx.setAttribute("y1", String(m.t + ph)); xAx.setAttribute("y2", String(m.t + ph));
    xAx.setAttribute("stroke", "#000"); xAx.setAttribute("stroke-width", "1");
    svg.appendChild(xAx);

    // Grid lines
    ticks.forEach(function (tv) {
      if (tv === 0) return;
      var y = m.t + ph - (tv / ceil) * ph;
      var gl = document.createElementNS(ns, "line");
      gl.setAttribute("x1", String(m.l)); gl.setAttribute("x2", String(m.l + pw));
      gl.setAttribute("y1", String(y)); gl.setAttribute("y2", String(y));
      gl.setAttribute("stroke", "#e5e5e5"); gl.setAttribute("stroke-width", "0.5");
      svg.appendChild(gl);
    });

    // Y ticks + labels
    ticks.forEach(function (tv) {
      var y = m.t + ph - (tv / ceil) * ph;
      var tk = document.createElementNS(ns, "line");
      tk.setAttribute("x1", String(m.l - 4)); tk.setAttribute("x2", String(m.l));
      tk.setAttribute("y1", String(y)); tk.setAttribute("y2", String(y));
      tk.setAttribute("stroke", "#000"); tk.setAttribute("stroke-width", "0.8");
      svg.appendChild(tk);
      var lbl = document.createElementNS(ns, "text");
      lbl.setAttribute("x", String(m.l - 6)); lbl.setAttribute("y", String(y + 4));
      lbl.setAttribute("text-anchor", "end"); lbl.setAttribute("font-size", "13");
      lbl.setAttribute("fill", "#444"); lbl.setAttribute("font-family", "inherit");
      lbl.textContent = fmtAxisVal(tv);
      svg.appendChild(lbl);
    });

    // Y-axis title
    var yLbl = document.createElementNS(ns, "text");
    yLbl.setAttribute("x", String(13)); yLbl.setAttribute("y", String(m.t + ph / 2));
    yLbl.setAttribute("text-anchor", "middle"); yLbl.setAttribute("font-size", "12");
    yLbl.setAttribute("font-weight", "600"); yLbl.setAttribute("fill", "#222");
    yLbl.setAttribute("font-family", "inherit");
    yLbl.setAttribute("transform", "rotate(-90 13 " + (m.t + ph / 2) + ")");
    yLbl.textContent = chartTitle || yAxisLabel || "";
    svg.appendChild(yLbl);

    function valToY(v) { return m.t + ph - (Math.min(v, ceil) / ceil) * ph; }

    var step = pw / Math.max(ndb, 1);
    var boxW = Math.min(36, step * 0.4);

    databases.forEach(function (db, i) {
      var cx = m.l + step * i + step / 2;
      var color = dbColor(db.label, i);
      var mn = (db.min || 0) / div;
      var mx = (db.max || 0) / div;
      var avg = (db.avg || 0) / div;
      var p50 = db.p50 != null ? db.p50 / div : avg;
      var p95 = (db.p95 || mx) / div;
      var p99 = (db.p99 || mx) / div;

      // Whisker line: min to max
      var wl = document.createElementNS(ns, "line");
      wl.setAttribute("x1", String(cx)); wl.setAttribute("x2", String(cx));
      wl.setAttribute("y1", String(valToY(mx))); wl.setAttribute("y2", String(valToY(mn)));
      wl.setAttribute("stroke", color); wl.setAttribute("stroke-width", "1.2");
      svg.appendChild(wl);

      // Caps at min and max (T-shaped ends)
      var capW = boxW * 0.6;
      [mn, mx].forEach(function (v) {
        var c = document.createElementNS(ns, "line");
        c.setAttribute("x1", String(cx - capW / 2)); c.setAttribute("x2", String(cx + capW / 2));
        c.setAttribute("y1", String(valToY(v))); c.setAttribute("y2", String(valToY(v)));
        c.setAttribute("stroke", color); c.setAttribute("stroke-width", "1.2");
        svg.appendChild(c);
      });

      // Box: p50 to p95
      var bTop = valToY(p95);
      var bBot = valToY(p50);
      var bH = Math.max(2, bBot - bTop);
      var bx = document.createElementNS(ns, "rect");
      bx.setAttribute("x", String(cx - boxW / 2)); bx.setAttribute("y", String(bTop));
      bx.setAttribute("width", String(boxW)); bx.setAttribute("height", String(bH));
      bx.setAttribute("fill", color); bx.setAttribute("fill-opacity", "0.15");
      bx.setAttribute("stroke", color); bx.setAttribute("stroke-width", "1");
      svg.appendChild(bx);

      // Avg/p50 median line inside box
      var ml = document.createElementNS(ns, "line");
      ml.setAttribute("x1", String(cx - boxW / 2)); ml.setAttribute("x2", String(cx + boxW / 2));
      ml.setAttribute("y1", String(valToY(avg))); ml.setAttribute("y2", String(valToY(avg)));
      ml.setAttribute("stroke", color); ml.setAttribute("stroke-width", "2");
      svg.appendChild(ml);

      // P99 marker — small filled diamond
      var p99y = valToY(p99);
      var dia = document.createElementNS(ns, "polygon");
      var ds = 3;
      dia.setAttribute("points", cx + "," + (p99y - ds) + " " + (cx + ds) + "," + p99y + " " + cx + "," + (p99y + ds) + " " + (cx - ds) + "," + p99y);
      dia.setAttribute("fill", color);
      svg.appendChild(dia);

      // Hover hit area for tooltip
      var hitArea = document.createElementNS(ns, "rect");
      hitArea.setAttribute("x", String(cx - step / 2)); hitArea.setAttribute("y", String(m.t));
      hitArea.setAttribute("width", String(step)); hitArea.setAttribute("height", String(ph));
      hitArea.setAttribute("fill", "transparent");
      hitArea.setAttribute("style", "cursor:pointer");
      (function (dbRef, cxRef, mnRef, mxRef, avgRef, p50Ref, p95Ref, p99Ref) {
        hitArea.addEventListener("mouseenter", function () {
          var fv = function (v) { return v.toLocaleString(undefined, { maximumFractionDigits: 2 }); };
          ttLines[0].textContent = dbRef.label;
          ttLines[0].setAttribute("font-weight", "700");
          ttLines[1].textContent = "Avg: " + fv(avgRef);
          ttLines[2].textContent = "P50: " + fv(p50Ref);
          ttLines[3].textContent = "P95: " + fv(p95Ref);
          ttLines[4].textContent = "P99: " + fv(p99Ref);
          ttLines[5].textContent = "Min: " + fv(mnRef);
          ttLines[6].textContent = "Max: " + fv(mxRef);
          var maxTextW = 0;
          ttLines.forEach(function (tl, idx) {
            tl.setAttribute("x", String(cxRef - 50));
            tl.setAttribute("y", String(m.t + 14 + idx * 14));
            var bb = tl.getBBox();
            if (bb.width > maxTextW) maxTextW = bb.width;
          });
          ttBg.setAttribute("x", String(cxRef - 56));
          ttBg.setAttribute("y", String(m.t));
          ttBg.setAttribute("width", String(maxTextW + 16));
          ttBg.setAttribute("height", String(102));
          ttLines.forEach(function (tl) {
            tl.setAttribute("x", String(cxRef - 48));
          });
          tooltip.setAttribute("visibility", "visible");
        });
        hitArea.addEventListener("mouseleave", function () {
          tooltip.setAttribute("visibility", "hidden");
        });
      })(db, cx, mn, mx, avg, p50, p95, p99);
      svg.appendChild(hitArea);

      // X label
      var xl = document.createElementNS(ns, "text");
      xl.setAttribute("x", String(cx)); xl.setAttribute("y", String(m.t + ph + 20));
      xl.setAttribute("text-anchor", "middle"); xl.setAttribute("font-size", "13");
      xl.setAttribute("font-weight", "600"); xl.setAttribute("fill", "#333");
      xl.setAttribute("font-family", "inherit");
      xl.textContent = db.label;
      svg.appendChild(xl);
    });

    // Legend row at the bottom explaining box plot elements
    var legendY = h - 10;
    var legendItems = [
      { sym: "line", label: "min/max" },
      { sym: "box", label: "p50–p95" },
      { sym: "dashline", label: "avg" },
      { sym: "diamond", label: "p99" },
    ];
    var legendStartX = m.l;
    var lgSpacing = pw / legendItems.length;
    legendItems.forEach(function (item, li) {
      var lx = legendStartX + lgSpacing * li;
      var symColor = "#555";
      if (item.sym === "line") {
        var ll = document.createElementNS(ns, "line");
        ll.setAttribute("x1", String(lx)); ll.setAttribute("x2", String(lx + 14));
        ll.setAttribute("y1", String(legendY - 3)); ll.setAttribute("y2", String(legendY - 3));
        ll.setAttribute("stroke", symColor); ll.setAttribute("stroke-width", "1");
        svg.appendChild(ll);
        // T caps
        [lx, lx + 14].forEach(function (tx) {
          var tc = document.createElementNS(ns, "line");
          tc.setAttribute("x1", String(tx)); tc.setAttribute("x2", String(tx));
          tc.setAttribute("y1", String(legendY - 6)); tc.setAttribute("y2", String(legendY));
          tc.setAttribute("stroke", symColor); tc.setAttribute("stroke-width", "0.8");
          svg.appendChild(tc);
        });
      } else if (item.sym === "box") {
        var br = document.createElementNS(ns, "rect");
        br.setAttribute("x", String(lx)); br.setAttribute("y", String(legendY - 6));
        br.setAttribute("width", "14"); br.setAttribute("height", "6");
        br.setAttribute("fill", symColor); br.setAttribute("fill-opacity", "0.15");
        br.setAttribute("stroke", symColor); br.setAttribute("stroke-width", "0.8");
        svg.appendChild(br);
      } else if (item.sym === "dashline") {
        var dl = document.createElementNS(ns, "line");
        dl.setAttribute("x1", String(lx)); dl.setAttribute("x2", String(lx + 14));
        dl.setAttribute("y1", String(legendY - 3)); dl.setAttribute("y2", String(legendY - 3));
        dl.setAttribute("stroke", symColor); dl.setAttribute("stroke-width", "2");
        svg.appendChild(dl);
      } else if (item.sym === "diamond") {
        var dcx = lx + 7, dcy = legendY - 3, dds = 3;
        var dd = document.createElementNS(ns, "polygon");
        dd.setAttribute("points", dcx + "," + (dcy - dds) + " " + (dcx + dds) + "," + dcy + " " + dcx + "," + (dcy + dds) + " " + (dcx - dds) + "," + dcy);
        dd.setAttribute("fill", symColor);
        svg.appendChild(dd);
      }
      var lt = document.createElementNS(ns, "text");
      lt.setAttribute("x", String(lx + 18)); lt.setAttribute("y", String(legendY));
      lt.setAttribute("text-anchor", "start"); lt.setAttribute("font-size", "12");
      lt.setAttribute("fill", "#555"); lt.setAttribute("font-family", "inherit");
      lt.textContent = item.label;
      svg.appendChild(lt);
    });

    // Tooltip layer on top
    svg.appendChild(tooltip);
    return svg;
  }

  function buildCircleProgress(run) {
    var size = 32, stroke = 3;
    var r = (size - stroke) / 2;
    var circ = 2 * Math.PI * r;
    var isActive = ACTIVE_STATUSES.has(run.status);
    var isDone = run.status === "succeeded";
    var isFail = run.status === "failed" || run.status === "timed_out";
    var pct = isDone ? 100 : (run.progress && Number.isFinite(run.progress.percent) ? run.progress.percent : (isActive ? 50 : 0));
    var offset = circ - (pct / 100) * circ;
    var color = isDone ? "#22c55e" : isFail ? "#ef4444" : "#f59e0b";

    var wrap = document.createElement("div");
    wrap.className = "db-progress-item";
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("width", String(size)); svg.setAttribute("height", String(size));
    svg.setAttribute("class", "db-progress-ring");
    // BG circle
    var bg = document.createElementNS(ns, "circle");
    bg.setAttribute("cx", String(size / 2)); bg.setAttribute("cy", String(size / 2));
    bg.setAttribute("r", String(r)); bg.setAttribute("fill", "none");
    bg.setAttribute("stroke", "#e5e7eb"); bg.setAttribute("stroke-width", String(stroke));
    svg.appendChild(bg);
    // Progress circle
    var prog = document.createElementNS(ns, "circle");
    prog.setAttribute("cx", String(size / 2)); prog.setAttribute("cy", String(size / 2));
    prog.setAttribute("r", String(r)); prog.setAttribute("fill", "none");
    prog.setAttribute("stroke", color); prog.setAttribute("stroke-width", String(stroke));
    prog.setAttribute("stroke-dasharray", String(circ));
    prog.setAttribute("stroke-dashoffset", String(offset));
    prog.setAttribute("stroke-linecap", "round");
    prog.setAttribute("transform", "rotate(-90 " + (size / 2) + " " + (size / 2) + ")");
    if (isActive) prog.setAttribute("class", "ring-animate");
    svg.appendChild(prog);
    // Check mark for done
    if (isDone) {
      var check = document.createElementNS(ns, "polyline");
      check.setAttribute("points", "10,17 14,21 22,12");
      check.setAttribute("fill", "none"); check.setAttribute("stroke", "#22c55e");
      check.setAttribute("stroke-width", "2"); check.setAttribute("stroke-linecap", "round");
      check.setAttribute("stroke-linejoin", "round");
      svg.appendChild(check);
    }
    wrap.appendChild(svg);
    var lbl = document.createElement("span");
    lbl.className = "db-progress-label";
    lbl.textContent = dbDisplayName(run.database);
    wrap.appendChild(lbl);
    return wrap;
  }

  function buildResultPanel(batchRuns, isExpanded) {
    var panel = document.createElement("div");
    panel.className = "results-panel" + (isExpanded ? " expanded" : "");

    // Header
    var header = document.createElement("div");
    header.className = "results-panel-header";
    var titleWrap = document.createElement("div");
    var title = document.createElement("div");
    title.className = "results-panel-title";
    var ts = batchRuns[0] ? formatLocalTime(batchRuns[0].created_at) : "";
    var dbList = batchRuns.map(function (r) { return dbDisplayName(r.database); }).filter(function (n) { return n !== "unknown"; }).join(", ");
    title.textContent = ts + (dbList ? " — " + dbList : "");
    titleWrap.appendChild(title);
    if (!isExpanded) {
      var sub = document.createElement("div");
      sub.className = "results-panel-subtitle";
      var done = batchRuns.filter(function (r) { return r.status === "succeeded"; }).length;
      sub.textContent = done + " of " + batchRuns.length + " completed";
      titleWrap.appendChild(sub);
    }
    header.appendChild(titleWrap);

    // Circle progress indicators
    var circles = document.createElement("div");
    circles.className = "results-panel-circles";
    batchRuns.forEach(function (r) { circles.appendChild(buildCircleProgress(r)); });
    header.appendChild(circles);
    panel.appendChild(header);

    // Toggle
    header.style.cursor = "pointer";
    var body = document.createElement("div");
    body.className = "results-panel-body";
    body.hidden = !isExpanded;
    header.addEventListener("click", function () {
      body.hidden = !body.hidden;
      panel.classList.toggle("expanded", !body.hidden);
    });

    // Build plots for succeeded runs
    var succeeded = batchRuns.filter(function (r) { return r.status === "succeeded" && r.benchmark_stats; });
    // Sort by batch_index so x-axis labels stay consistent regardless of finish order
    succeeded.sort(function (a, b) {
      var ai = Number.isFinite(a.batch_index) ? a.batch_index : 0;
      var bi = Number.isFinite(b.batch_index) ? b.batch_index : 0;
      return ai - bi;
    });
    if (succeeded.length === 0) {
      var running = batchRuns.some(function (r) { return ACTIVE_STATUSES.has(r.status); });
      var msg = document.createElement("p");
      msg.className = "results-panel-empty";
      msg.textContent = running ? "Benchmark in progress..." : "No completed results.";
      body.appendChild(msg);
      // Show progress text
      batchRuns.forEach(function (r) {
        if (r.progress_text) {
          var pt = document.createElement("p");
          pt.className = "results-panel-progress-text";
          pt.textContent = r.progress_text;
          body.appendChild(pt);
        }
      });
    } else {
      // ── Row 1: Overall — Throughput + Avg Latency ──
      var row1 = document.createElement("div");
      row1.className = "results-plots-row";

      // Throughput
      var tpPoints = succeeded.map(function (r) {
        var met = findOverallMetric(r.benchmark_stats, [
          "throughput_using_start_and_end_time_ops_ms",
          "throughput_using_start_and_end_time",
        ]);
        return { label: dbDisplayName(r.database), value: parseThroughputMetricValue(met) || 0 };
      }).filter(function (p) { return p.value > 0; });

      if (tpPoints.length > 0) {
        var tpCell = document.createElement("div");
        tpCell.className = "results-plot-cell";
        var tpLbl = document.createElement("div");
        tpLbl.className = "results-plot-label";
        tpLbl.textContent = "Throughput (ops/sec)";
        tpCell.appendChild(tpLbl);
        tpCell.appendChild(paperBarChart(tpPoints, "ops/sec", "Throughput (ops/sec)"));
        row1.appendChild(tpCell);
      }

      // Avg Latency
      var latPoints = succeeded.map(function (r) {
        var met = findOverallMetric(r.benchmark_stats, ["average_latency"]);
        var v = parseLatencyMetricValueMicros(met);
        return { label: dbDisplayName(r.database), value: v || 0 };
      }).filter(function (p) { return p.value > 0; });
      var latUnit = chooseLatencyChartUnit(Math.max(1, ...latPoints.map(function (p) { return p.value; })));
      var latConverted = latPoints.map(function (p) { return { label: p.label, value: p.value / latUnit.divisor }; });
      if (latConverted.length > 0) {
        var latCell = document.createElement("div");
        latCell.className = "results-plot-cell";
        var latLbl = document.createElement("div");
        latLbl.className = "results-plot-label";
        latLbl.textContent = "Avg Latency (" + latUnit.unit + ")";
        latCell.appendChild(latLbl);
        latCell.appendChild(paperBarChart(latConverted, latUnit.unit, "Avg Latency (" + latUnit.unit + ")"));
        row1.appendChild(latCell);
      }
      if (row1.children.length > 0) body.appendChild(row1);

      // ── Row 2+: Per-operation latency box plots ──
      var opMap = new Map();
      succeeded.forEach(function (r) {
        var ops = extractOperationLatencyData(r);
        ops.forEach(function (od) {
          if (!opMap.has(od.operationKey)) opMap.set(od.operationKey, { name: od.operation, databases: [] });
          opMap.get(od.operationKey).databases.push({
            label: dbDisplayName(r.database), min: od.min, max: od.max,
            avg: od.avg, p50: od.p50, p95: od.p95, p99: od.p99,
          });
        });
      });

      if (opMap.size > 0) {
        var opTitle = document.createElement("div");
        // opTitle.className = "results-section-title";
        // opTitle.textContent = "Per-Operation Latency";
        // body.appendChild(opTitle);

        // var opRow = document.createElement("div");
        // opRow.className = "results-plots-row";
        opMap.forEach(function (entry) {
          // Use µs for box plots so small-value databases aren't squished
          var opUnit = { divisor: 1, unit: "µs" };
          var cell = document.createElement("div");
          cell.className = "results-plot-cell";
          var lbl = document.createElement("div");
          lbl.className = "results-plot-label";
          lbl.textContent = entry.name + " (" + opUnit.unit + ")";
          cell.appendChild(lbl);
          var bp = paperBoxPlot(entry.databases, opUnit.unit, opUnit.divisor, entry.name + " (" + opUnit.unit + ")");
          if (bp) cell.appendChild(bp);
          row1.appendChild(cell);
        });
        body.appendChild(row1);
      }

      // Download links
      var links = document.createElement("div");
      links.className = "results-panel-links";
      succeeded.forEach(function (r) {
        if (r.links && r.links.output_download_path) {
          var a = document.createElement("a");
          a.className = "results-download-link";
          a.href = r.links.output_download_path;
          a.target = "_blank";
          a.textContent = "Download " + dbDisplayName(r.database);
          links.appendChild(a);
        }
      });
      if (links.children.length > 0) body.appendChild(links);
    }

    panel.appendChild(body);
    return panel;
  }

  function groupRunsIntoBatches(runs) {
    var batchMap = new Map();
    var noBatch = [];
    runs.forEach(function (r) {
      if (r.batch_id) {
        if (!batchMap.has(r.batch_id)) batchMap.set(r.batch_id, []);
        batchMap.get(r.batch_id).push(r);
      } else {
        noBatch.push(r);
      }
    });
    var groups = [];
    batchMap.forEach(function (batchRuns) {
      batchRuns.sort(function (a, b) { return (a.batch_index || 0) - (b.batch_index || 0); });
      groups.push(batchRuns);
    });
    // Sort batches newest first
    groups.sort(function (a, b) {
      return String(b[0].created_at || "").localeCompare(String(a[0].created_at || ""));
    });
    // Single runs (no batch)
    noBatch.forEach(function (r) { groups.push([r]); });
    return groups;
  }

  function buildBenchmarkStatsPlots(run, allRuns) {
    // Called from individual run detail — delegate to result panel builder
    var comparisonRuns = [];
    if (run && run.batch_id) {
      comparisonRuns = (allRuns || []).filter(function (r) {
        return r.batch_id === run.batch_id && (r.status === "succeeded" || ACTIVE_STATUSES.has(r.status));
      });
    }
    if (comparisonRuns.length === 0) comparisonRuns = [run];
    // Just build the plots section
    var succeeded = comparisonRuns.filter(function (r) { return r.status === "succeeded" && r.benchmark_stats; });
    if (succeeded.length === 0) return null;
    var dummy = document.createElement("div");
    return dummy;
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
    const axisDescriptor = buildWholeNumberAxis(
      maxValue,
      chartDescriptor.axisDivisor,
      4,
    );
    const axisMax = Math.max(1, axisDescriptor.axisMaxRaw);
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

    const tickDivisor = Math.max(1, axisDescriptor.ticks.length - 1);
    axisDescriptor.ticks.forEach((tickValue, index) => {
      const ratio = index / tickDivisor;
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
      axisLabel.textContent = chartDescriptor.formatAxisBucketValue(
        tickValue,
        axisDescriptor,
      );
      svg.appendChild(axisLabel);
    });

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
      const barHeight = (point.value / axisMax) * plotHeight;
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
      value.textContent =
        typeof descriptor.formatSummaryValue === "function"
          ? descriptor.formatSummaryValue(point.value)
          : descriptor.formatValue(point.value);
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
      const rawOperationBuckets = normalizeStatsBuckets(
        run.benchmark_stats && run.benchmark_stats.operations,
      );
      const explicitPhaseBuckets = normalizeStatsBuckets(
        run.benchmark_stats && run.benchmark_stats.phases,
      );
      const phaseBuckets =
        explicitPhaseBuckets.length > 0
          ? explicitPhaseBuckets
          : rawOperationBuckets.filter((entry) => isPhaseStatsBucket(entry));
      const operationBuckets = rawOperationBuckets.filter(
        (entry) => !isPhaseStatsBucket(entry),
      );
      normalizeMetricsList(run.benchmark_stats && run.benchmark_stats.overall).forEach(
        (metric) => {
          appendMetricSeriesPoint(overallMap, metric, runLabel);
        },
      );
      appendBucketMetrics(phaseMap, phaseBuckets, runLabel);
      appendBucketMetrics(operationMap, operationBuckets, runLabel);
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
    const seriesMaxValue = Math.max(...metricSeries.points.map((entry) => entry.value));
    const chartDescriptor = createMetricChartDescriptor(
      metricSeries.key,
      seriesMaxValue,
      metricSeries.throughputUnit,
    );

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
        : formatMetricChartTitle(metricSeries.label, chartDescriptor);
    headCopy.appendChild(title);
    head.appendChild(headCopy);
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

  function buildPhaseOverviewGrid(catalog) {
    const phaseBuckets =
      catalog && Array.isArray(catalog.phases) ? catalog.phases : [];
    const highlightedPhases = phaseBuckets
      .map((bucket) => ({
        bucket,
        series: selectOverviewMetricSeries(bucket && bucket.series),
      }))
      .filter((entry) => entry.series.length > 0);
    if (highlightedPhases.length === 0) {
      return null;
    }

    const section = document.createElement("section");
    section.className = "benchmark-chart-section";

    const head = document.createElement("div");
    head.className = "benchmark-chart-section-head";

    const title = document.createElement("div");
    title.className = "benchmark-chart-section-title";
    title.textContent = "Section Highlights";
    head.appendChild(title);

    const subtitle = document.createElement("div");
    subtitle.className = "benchmark-chart-section-copy";
    subtitle.textContent =
      "Pinned phase-by-phase comparisons for the most important benchmark signals.";
    head.appendChild(subtitle);
    section.appendChild(head);

    highlightedPhases.forEach((entry) => {
      const group = document.createElement("div");
      group.className = "benchmark-chart-phase-group";

      const groupTitle = document.createElement("div");
      groupTitle.className = "benchmark-chart-phase-title";
      groupTitle.textContent = entry.bucket.name;
      group.appendChild(groupTitle);

      const grid = document.createElement("div");
      grid.className =
        "benchmark-metric-chart-grid benchmark-metric-chart-grid-overview";
      entry.series.forEach((series) => {
        const card = buildMetricSeriesCard(series, {
          kicker: "Phase benchmark • " + entry.bucket.name,
          title: series.label,
        });
        if (card) {
          grid.appendChild(card);
        }
      });
      group.appendChild(grid);
      section.appendChild(group);
    });

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

    const phaseOverview = buildPhaseOverviewGrid(catalog);
    if (phaseOverview) {
      shell.appendChild(phaseOverview);
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
      summaryRow.dataset.runId = run.run_id;
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
      databaseCell.textContent = dbDisplayName(run.database);
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

      const statsEl = buildBenchmarkStatsPlots(run, runs);
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
      const scrollState = captureScrollState(runsListEl);
      runsListEl.innerHTML = "";
      if (runs.length === 0) {
        expandedRunIds.clear();
        const empty = document.createElement("p");
        empty.className = "runs-empty";
        empty.textContent =
          'No runs yet. Select databases and click "Run Workload" to start a benchmark.';
        runsListEl.appendChild(empty);
        return;
      }

      // Group runs into batch panels
      var batches = groupRunsIntoBatches(runs);
      var dashboard = document.createElement("div");
      dashboard.className = "results-dashboard";
      batches.forEach(function (batchRuns, i) {
        dashboard.appendChild(buildResultPanel(batchRuns, i === 0));
      });
      runsListEl.appendChild(dashboard);
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

    // Load historical runs from server disk
    async function loadHistoricalRuns() {
      try {
        const response = await fetch("/api/workloads/runs", { method: "GET", cache: "no-store" });
        if (!response.ok) return;
        const body = await response.json();
        if (!Array.isArray(body.runs)) return;
        var added = 0;
        body.runs.forEach(function (serverRun) {
          if (!serverRun.run_id) return;
          // Skip if already in local list
          if (runs.some(function (r) { return r.run_id === serverRun.run_id; })) return;
          // Only add runs that have benchmark stats (completed)
          if (!serverRun.benchmark_stats) return;
          runs.push(normalizeRunEntry(serverRun, serverRun.run_id));
          added++;
        });
        if (added > 0) {
          persistRuns();
          render();
        }
      } catch (_e) { /* ignore */ }
    }

    render();
    ensurePolling();
    if (hasActiveRuns()) {
      void pollRuns();
    }
    void loadHistoricalRuns();
    return {
      startRun,
      clear,
      dispose,
      pollNow: pollRuns,
    };
  }

  window.createWorkloadRunsController = createWorkloadRunsController;
})();
