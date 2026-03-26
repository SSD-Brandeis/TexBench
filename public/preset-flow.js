(function initPresetFlowModule(global) {
  "use strict";

  function createController(config) {
    const refs = (config && config.refs) || {};
    const state = (config && config.state) || {};

    const getActivePresetJson =
      typeof state.getActivePresetJson === "function"
        ? state.getActivePresetJson
        : function getActivePresetJsonFallback() {
            return null;
          };
    const setActivePresetJson =
      typeof state.setActivePresetJson === "function"
        ? state.setActivePresetJson
        : function setActivePresetJsonFallback() {};
    const getCustomWorkloadMode =
      typeof state.getCustomWorkloadMode === "function"
        ? state.getCustomWorkloadMode
        : function getCustomWorkloadModeFallback() {
            return false;
          };
    const setCustomWorkloadMode =
      typeof state.setCustomWorkloadMode === "function"
        ? state.setCustomWorkloadMode
        : function setCustomWorkloadModeFallback() {};
    const hasConfiguredWorkload =
      typeof state.hasConfiguredWorkload === "function"
        ? state.hasConfiguredWorkload
        : function hasConfiguredWorkloadFallback() {
            return false;
          };

    const cloneJsonValue =
      typeof config.cloneJsonValue === "function"
        ? config.cloneJsonValue
        : function cloneJsonValueFallback(value) {
            return value;
          };
    const ensureWorkloadStructureState =
      typeof config.ensureWorkloadStructureState === "function"
        ? config.ensureWorkloadStructureState
        : function ensureWorkloadStructureStateFallback() {};
    const loadActiveStructureIntoForm =
      typeof config.loadActiveStructureIntoForm === "function"
        ? config.loadActiveStructureIntoForm
        : function loadActiveStructureIntoFormFallback() {};
    const loadPresetIntoBuilder =
      typeof config.loadPresetIntoBuilder === "function"
        ? config.loadPresetIntoBuilder
        : function loadPresetIntoBuilderFallback() {};
    const updateJsonFromForm =
      typeof config.updateJsonFromForm === "function"
        ? config.updateJsonFromForm
        : function updateJsonFromFormFallback() {};
    const clearWorkloadRuns =
      typeof config.clearWorkloadRuns === "function"
        ? config.clearWorkloadRuns
        : function clearWorkloadRunsFallback() {};
    const setValidationStatus =
      typeof config.setValidationStatus === "function"
        ? config.setValidationStatus
        : function setValidationStatusFallback() {};

    const presetIndexPath =
      typeof config.presetIndexPath === "string" && config.presetIndexPath
        ? config.presetIndexPath
        : "/presets/index.json";

    let presetCatalog = [];
    const SCALE_ERROR_MESSAGE = "Scale must be a positive integer.";

    function syncPresetScaleInputState() {
      if (!refs.presetScaleInput) {
        return;
      }
      const hasFamily =
        refs.presetFamilySelect &&
        typeof refs.presetFamilySelect.value === "string" &&
        refs.presetFamilySelect.value.trim() !== "";
      const hasFile =
        refs.presetFileSelect &&
        typeof refs.presetFileSelect.value === "string" &&
        refs.presetFileSelect.value.trim() !== "";
      refs.presetScaleInput.disabled = !(hasFamily && hasFile);
    }

    function parsePositiveInteger(rawValue) {
      const text =
        typeof rawValue === "string" || typeof rawValue === "number"
          ? String(rawValue).trim()
          : "";
      if (!/^[1-9]\d*$/.test(text)) {
        return null;
      }
      const parsed = Number.parseInt(text, 10);
      return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
    }

    function getPresetScaleValue() {
      if (!refs.presetScaleInput) {
        return 1;
      }
      return parsePositiveInteger(refs.presetScaleInput.value);
    }

    function normalizePresetScaleInput() {
      if (!refs.presetScaleInput) {
        return 1;
      }
      const scale = getPresetScaleValue();
      refs.presetScaleInput.setCustomValidity(
        scale === null ? SCALE_ERROR_MESSAGE : "",
      );
      if (scale === null) {
        return null;
      }
      refs.presetScaleInput.value = String(scale);
      return scale;
    }

    function scalePresetOperationCounts(value, scale) {
      if (!value || typeof value !== "object" || scale === 1) {
        return value;
      }
      if (Array.isArray(value)) {
        value.forEach(function scaleArrayEntry(entry) {
          scalePresetOperationCounts(entry, scale);
        });
        return value;
      }
      Object.keys(value).forEach(function scaleObjectEntry(key) {
        const entry = value[key];
        if (key === "op_count" && typeof entry === "number" && Number.isFinite(entry)) {
          value[key] = Math.trunc(entry * scale);
          return;
        }
        scalePresetOperationCounts(entry, scale);
      });
      return value;
    }

    function clearPresetSelectionNote() {
      if (!refs.presetSelectionNote) {
        return;
      }
      refs.presetSelectionNote.replaceChildren();
      refs.presetSelectionNote.hidden = true;
    }

    function renderPresetSelectionNote(family, activePresetId) {
      if (!refs.presetSelectionNote) {
        return;
      }
      refs.presetSelectionNote.replaceChildren();
      if (typeof activePresetId !== "string" || activePresetId.trim() === "") {
        refs.presetSelectionNote.hidden = true;
        return;
      }

      const preset = presetCatalog.find(function findPreset(entry) {
        return entry && entry.id === activePresetId;
      });
      if (!preset) {
        refs.presetSelectionNote.hidden = true;
        return;
      }

      const description = document.createElement("div");
      description.className = "preset-note-description";
      description.textContent =
        typeof preset.description === "string" && preset.description.trim()
          ? preset.description.trim()
          : "No description available.";
      refs.presetSelectionNote.appendChild(description);

      const scale = getPresetScaleValue();
      if (scale && scale > 1) {
        const scaleNote = document.createElement("div");
        scaleNote.className = "preset-note-description";
        scaleNote.textContent = "Workload scale applied: x" + String(scale);
        refs.presetSelectionNote.appendChild(scaleNote);
      }

      refs.presetSelectionNote.hidden = false;
    }

    function clearLoadedPresetState() {
      setActivePresetJson(null);
      if (refs.presetFamilySelect) {
        refs.presetFamilySelect.value = "";
      }
      if (refs.presetFileSelect) {
        refs.presetFileSelect.innerHTML =
          '<option value="">Choose a file...</option>';
        refs.presetFileSelect.value = "";
        refs.presetFileSelect.disabled = true;
      }
      syncPresetScaleInputState();
      clearPresetSelectionNote();
    }

    function reapplyLoadedPresetWithScale() {
      const activePresetJson = getActivePresetJson();
      const presetId =
        refs.presetFileSelect && typeof refs.presetFileSelect.value === "string"
          ? refs.presetFileSelect.value
          : "";
      if (!activePresetJson || !presetId) {
        return;
      }
      const scale = normalizePresetScaleInput();
      if (scale === null) {
        if (
          refs.presetScaleInput &&
          typeof refs.presetScaleInput.reportValidity === "function"
        ) {
          refs.presetScaleInput.reportValidity();
        }
        setValidationStatus(SCALE_ERROR_MESSAGE, "invalid");
        return;
      }
      const preset = presetCatalog.find(function findPresetById(entry) {
        return entry && entry.id === presetId;
      });
      loadPresetIntoBuilder(
        scalePresetOperationCounts(cloneJsonValue(activePresetJson), scale),
      );
      clearWorkloadRuns();
      if (preset) {
        renderPresetSelectionNote(preset.family, preset.id);
      }
      syncLandingUi();
    }

    function syncLandingUi() {
      const showPreview = hasConfiguredWorkload();

      if (refs.appHeader) {
        refs.appHeader.hidden = false;
      }
      if (refs.appShell && refs.appShell.classList) {
        refs.appShell.classList.remove("landing");
      }
      if (refs.builderPanel) {
        refs.builderPanel.hidden = false;
      }
      if (refs.previewPanel) {
        refs.previewPanel.hidden = !showPreview;
      }
      if (refs.runsPanel) {
        refs.runsPanel.hidden = !showPreview;
      }
      if (refs.runWorkloadBtn) {
        refs.runWorkloadBtn.hidden = !showPreview;
      }
      if (refs.downloadJsonBtn) {
        refs.downloadJsonBtn.hidden = !showPreview;
      }
      if (refs.copyBtn) {
        refs.copyBtn.hidden = !showPreview;
      }
      if (refs.validationResult) {
        refs.validationResult.hidden = !showPreview;
      }
      if (refs.newWorkloadBtn) {
        refs.newWorkloadBtn.hidden = !showPreview;
      }
      if (refs.presetBrowserBtn) {
        refs.presetBrowserBtn.hidden = true;
      }
    }

    function enableCustomWorkloadMode() {
      setCustomWorkloadMode(true);
      ensureWorkloadStructureState();
      loadActiveStructureIntoForm();
      updateJsonFromForm();
      syncLandingUi();
      if (refs.assistantInput) {
        refs.assistantInput.focus();
      }
    }

    function enablePresetBrowserMode() {
      syncLandingUi();
      if (refs.presetFileSelect && !refs.presetFileSelect.disabled) {
        refs.presetFileSelect.focus();
        return;
      }
      if (refs.presetFamilySelect) {
        refs.presetFamilySelect.focus();
      }
    }

    function renderPresetFamilyOptions() {
      if (!refs.presetFamilySelect) {
        return;
      }
      const families = Array.from(
        new Set(
          presetCatalog
            .map(function mapPresetFamily(preset) {
              return typeof preset.family === "string" ? preset.family : "";
            })
            .filter(Boolean),
        ),
      ).sort();
      refs.presetFamilySelect.innerHTML = "";
      const defaultOption = document.createElement("option");
      defaultOption.value = "";
      defaultOption.textContent = "Choose a family...";
      refs.presetFamilySelect.appendChild(defaultOption);
      families.forEach(function appendFamilyOption(family) {
        const option = document.createElement("option");
        option.value = family;
        option.textContent = family;
        refs.presetFamilySelect.appendChild(option);
      });
    }

    function renderPresetFileOptions(family) {
      if (!refs.presetFileSelect) {
        return;
      }
      const normalizedFamily = typeof family === "string" ? family.trim() : "";
      const matchingPresets = presetCatalog.filter(function filterPresetFamily(
        preset,
      ) {
        return preset.family === normalizedFamily;
      });
      refs.presetFileSelect.innerHTML = "";
      const defaultOption = document.createElement("option");
      defaultOption.value = "";
      defaultOption.textContent = "Choose a file...";
      refs.presetFileSelect.appendChild(defaultOption);
      matchingPresets.forEach(function appendPresetOption(preset) {
        const option = document.createElement("option");
        option.value = preset.id;
        option.textContent = preset.label;
        refs.presetFileSelect.appendChild(option);
      });
      refs.presetFileSelect.value = "";
      refs.presetFileSelect.disabled = matchingPresets.length === 0;
      syncPresetScaleInputState();
    }

    async function loadPresetCatalog() {
      const response = await fetch(presetIndexPath, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load preset catalog.");
      }
      const data = await response.json();
      presetCatalog = Array.isArray(data)
        ? data.filter(function isValidPresetEntry(preset) {
            return !!(
              preset &&
              typeof preset === "object" &&
              typeof preset.id === "string" &&
              typeof preset.family === "string" &&
              typeof preset.label === "string" &&
              typeof preset.path === "string"
            );
          })
        : [];
      renderPresetFamilyOptions();
      renderPresetFileOptions("");
      syncPresetScaleInputState();
    }

    function handlePresetFamilyChange(event) {
      const family =
        event && event.target && typeof event.target.value === "string"
          ? event.target.value
          : "";
      setActivePresetJson(null);
      renderPresetFileOptions(family);
      clearPresetSelectionNote();
      syncPresetScaleInputState();
      syncLandingUi();
    }

    function handlePresetScaleChange() {
      reapplyLoadedPresetWithScale();
    }

    function handlePresetScaleInput() {
      if (!refs.presetScaleInput) {
        return;
      }
      const scale = getPresetScaleValue();
      refs.presetScaleInput.setCustomValidity(
        scale === null ? SCALE_ERROR_MESSAGE : "",
      );
      if (scale === null) {
        return;
      }
      reapplyLoadedPresetWithScale();
    }

    async function handlePresetFileChange(event) {
      const presetId =
        event && event.target && typeof event.target.value === "string"
          ? event.target.value
          : "";
      if (!presetId) {
        setActivePresetJson(null);
        renderPresetSelectionNote(
          refs.presetFamilySelect ? refs.presetFamilySelect.value : "",
          "",
        );
        syncPresetScaleInputState();
        syncLandingUi();
        return;
      }

      const preset = presetCatalog.find(function matchPreset(entry) {
        return entry.id === presetId;
      });
      if (!preset) {
        setActivePresetJson(null);
        clearPresetSelectionNote();
        syncPresetScaleInputState();
        syncLandingUi();
        return;
      }

      try {
        const scale = normalizePresetScaleInput();
        if (scale === null) {
          if (refs.presetScaleInput && typeof refs.presetScaleInput.reportValidity === "function") {
            refs.presetScaleInput.reportValidity();
          }
          setActivePresetJson(null);
          clearPresetSelectionNote();
          setValidationStatus(SCALE_ERROR_MESSAGE, "invalid");
          syncLandingUi();
          return;
        }
        const response = await fetch(preset.path, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Failed to load workload JSON.");
        }
        const loadedJson = await response.json();
        const scaledJson = scalePresetOperationCounts(cloneJsonValue(loadedJson), scale);
        if (refs.presetFamilySelect) {
          refs.presetFamilySelect.value = preset.family;
        }
        renderPresetFileOptions(preset.family);
        if (refs.presetFileSelect) {
          refs.presetFileSelect.value = preset.id;
          refs.presetFileSelect.disabled = false;
        }
        syncPresetScaleInputState();
        setCustomWorkloadMode(true);
        setActivePresetJson(cloneJsonValue(loadedJson));
        loadPresetIntoBuilder(scaledJson);
        clearWorkloadRuns();
        renderPresetSelectionNote(preset.family, preset.id);
        syncLandingUi();
      } catch (error) {
        setActivePresetJson(null);
        clearPresetSelectionNote();
        syncPresetScaleInputState();
        setValidationStatus(
          error && error.message ? error.message : "Failed to load workload JSON.",
          "invalid",
        );
        syncLandingUi();
      }
    }

    function bindEvents() {
      if (refs.presetFamilySelect) {
        refs.presetFamilySelect.addEventListener(
          "change",
          handlePresetFamilyChange,
        );
      }
      if (refs.presetFileSelect) {
        refs.presetFileSelect.addEventListener(
          "change",
          handlePresetFileChange,
        );
      }
      if (refs.presetScaleInput) {
        refs.presetScaleInput.addEventListener("input", handlePresetScaleInput);
        refs.presetScaleInput.addEventListener("change", handlePresetScaleChange);
      }
      if (refs.presetBrowserBtn) {
        refs.presetBrowserBtn.addEventListener(
          "click",
          enablePresetBrowserMode,
        );
      }
    }

    return {
      bindEvents: bindEvents,
      clearLoadedPresetState: clearLoadedPresetState,
      enableCustomWorkloadMode: enableCustomWorkloadMode,
      enablePresetBrowserMode: enablePresetBrowserMode,
      handlePresetFamilyChange: handlePresetFamilyChange,
      handlePresetFileChange: handlePresetFileChange,
      loadPresetCatalog: loadPresetCatalog,
      clearPresetSelectionNote: clearPresetSelectionNote,
      renderPresetSelectionNote: renderPresetSelectionNote,
      syncLandingUi: syncLandingUi,
    };
  }

  global.TectonicPresetFlow = {
    createController: createController,
  };
})(globalThis);
