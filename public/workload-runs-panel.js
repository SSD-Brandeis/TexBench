(function initWorkloadRunsPanelModule(global) {
  "use strict";

  function createController(config) {
    const refs = (config && config.refs) || {};
    const createRunsController =
      typeof global.createWorkloadRunsController === "function"
        ? global.createWorkloadRunsController
        : null;
    const getCurrentWorkloadJson =
      typeof config.getCurrentWorkloadJson === "function"
        ? config.getCurrentWorkloadJson
        : function getCurrentWorkloadJsonFallback() {
            return null;
          };
    const getSelectedDatabases =
      typeof config.getSelectedDatabases === "function"
        ? config.getSelectedDatabases
        : function getSelectedDatabasesFallback() {
            return ["rocksdb"];
          };
    const setValidationStatus =
      typeof config.setValidationStatus === "function"
        ? config.setValidationStatus
        : function setValidationStatusFallback() {};

    let runsController = null;

    function setBusy(isBusy) {
      if (!refs.runWorkloadBtn) {
        return;
      }
      refs.runWorkloadBtn.disabled = !!isBusy;
      refs.runWorkloadBtn.textContent = isBusy ? "Launching..." : "Run Workload";
    }

    function init() {
      if (!createRunsController || !refs.runsList) {
        return null;
      }
      runsController = createRunsController({
        runsListEl: refs.runsList,
        onError(message) {
          setValidationStatus(message, "invalid");
        },
        onBusyChange(isBusy) {
          setBusy(isBusy);
        },
      });
      return runsController;
    }

    async function handleRun() {
      if (!runsController) {
        setValidationStatus(
          "Workload run controller is unavailable in this build.",
          "invalid",
        );
        return;
      }

      const specJson = getCurrentWorkloadJson();
      if (
        !specJson ||
        typeof specJson !== "object" ||
        !Array.isArray(specJson.sections) ||
        specJson.sections.length === 0
      ) {
        setValidationStatus(
          "Build a valid spec with at least one section before running workload generation.",
          "invalid",
        );
        return;
      }

      const databases = getSelectedDatabases();
      if (!Array.isArray(databases) || databases.length === 0) {
        setValidationStatus(
          "Select at least one database before running the workload.",
          "invalid",
        );
        return;
      }

      await runsController.startRun(specJson, {
        databases,
      });
    }

    function bindEvents() {
      if (refs.runWorkloadBtn) {
        refs.runWorkloadBtn.addEventListener("click", function onRunClick() {
          void handleRun();
        });
      }
    }

    function clearRuns() {
      if (!runsController || typeof runsController.clear !== "function") {
        return;
      }
      runsController.clear();
    }

    return {
      bindEvents,
      clearRuns,
      handleRun,
      init,
      setBusy,
    };
  }

  global.TectonicWorkloadRunsPanel = {
    createController,
  };
})(globalThis);
