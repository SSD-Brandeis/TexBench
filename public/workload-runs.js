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
      typeof run.output_paths.latest_workload_path === "string" &&
      run.output_paths.latest_workload_path.trim()
    ) {
      const locationEl = document.createElement("p");
      locationEl.className = "run-location";
      locationEl.textContent =
        "Known output: " + run.output_paths.latest_workload_path.trim();
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
    workloadLink.textContent = "Download Workload";
    workloadLink.target = "_blank";
    workloadLink.rel = "noopener noreferrer";
    const workloadReady = Array.isArray(run.artifacts)
      ? run.artifacts.some(
          (entry) => entry && entry.kind === "workload" && entry.ready === true,
        )
      : run.status === "succeeded";
    if (run.links && run.links.workload_download_path && workloadReady) {
      workloadLink.href = run.links.workload_download_path;
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
      links:
        input.links && typeof input.links === "object"
          ? input.links
          : {
              spec_download_path:
                input.downloads && input.downloads.spec_download_path
                  ? input.downloads.spec_download_path
                  : "",
              workload_download_path:
                input.downloads && input.downloads.workload_download_path
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
          'No runs yet. Click "Run Workload" to generate a workload artifact.';
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
