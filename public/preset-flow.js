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
    const resetFormInterface =
      typeof config.resetFormInterface === "function"
        ? config.resetFormInterface
        : function resetFormInterfaceFallback() {};
    const renderGeneratedJson =
      typeof config.renderGeneratedJson === "function"
        ? config.renderGeneratedJson
        : function renderGeneratedJsonFallback() {};
    const updateInteractiveStats =
      typeof config.updateInteractiveStats === "function"
        ? config.updateInteractiveStats
        : function updateInteractiveStatsFallback() {};
    const validateGeneratedJson =
      typeof config.validateGeneratedJson === "function"
        ? config.validateGeneratedJson
        : function validateGeneratedJsonFallback() {
            return Promise.resolve();
          };
    const setValidationStatus =
      typeof config.setValidationStatus === "function"
        ? config.setValidationStatus
        : function setValidationStatusFallback() {};

    const presetIndexPath =
      typeof config.presetIndexPath === "string" && config.presetIndexPath
        ? config.presetIndexPath
        : "/presets/index.json";

    let presetCatalog = [];

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
      clearPresetSelectionNote();
    }

    function syncLandingUi() {
      const hasPreset = !!getActivePresetJson();
      const showPreview = getCustomWorkloadMode() || hasPreset;

      if (refs.appHeader) {
        refs.appHeader.hidden = !getCustomWorkloadMode();
      }
      if (refs.appShell && refs.appShell.classList) {
        refs.appShell.classList.toggle("landing", !getCustomWorkloadMode());
      }
      if (refs.builderPanel) {
        refs.builderPanel.hidden = !getCustomWorkloadMode();
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
        refs.newWorkloadBtn.hidden = !getCustomWorkloadMode();
      }
      if (refs.presetBrowserBtn) {
        refs.presetBrowserBtn.hidden = !getCustomWorkloadMode();
      }
      if (refs.welcomePanel) {
        refs.welcomePanel.hidden = getCustomWorkloadMode();
      }
    }

    function enableCustomWorkloadMode() {
      setCustomWorkloadMode(true);
      clearLoadedPresetState();
      ensureWorkloadStructureState();
      loadActiveStructureIntoForm();
      updateJsonFromForm();
      syncLandingUi();
      if (refs.assistantInput) {
        refs.assistantInput.focus();
      }
    }

    function enablePresetBrowserMode() {
      setCustomWorkloadMode(false);
      clearLoadedPresetState();
      syncLandingUi();
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
    }

    function handlePresetFamilyChange(event) {
      const family =
        event && event.target && typeof event.target.value === "string"
          ? event.target.value
          : "";
      setCustomWorkloadMode(false);
      setActivePresetJson(null);
      clearPresetSelectionNote();
      renderPresetFileOptions(family);
      clearPresetSelectionNote();
      updateJsonFromForm();
      syncLandingUi();
    }

    async function handlePresetFileChange(event) {
      const presetId =
        event && event.target && typeof event.target.value === "string"
          ? event.target.value
          : "";
      setCustomWorkloadMode(false);
      if (!presetId) {
        setActivePresetJson(null);
        renderPresetSelectionNote(
          refs.presetFamilySelect ? refs.presetFamilySelect.value : "",
          "",
        );
        updateJsonFromForm();
        syncLandingUi();
        return;
      }

      const preset = presetCatalog.find(function matchPreset(entry) {
        return entry.id === presetId;
      });
      if (!preset) {
        setActivePresetJson(null);
        clearPresetSelectionNote();
        updateJsonFromForm();
        syncLandingUi();
        return;
      }

      try {
        const response = await fetch(preset.path, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Failed to load preset JSON.");
        }
        const loadedJson = await response.json();
        if (refs.presetFamilySelect) {
          refs.presetFamilySelect.value = preset.family;
        }
        renderPresetFileOptions(preset.family);
        if (refs.presetFileSelect) {
          refs.presetFileSelect.value = preset.id;
          refs.presetFileSelect.disabled = false;
        }
        setCustomWorkloadMode(true);
        setActivePresetJson(null);
        loadPresetIntoBuilder(cloneJsonValue(loadedJson));
        renderPresetSelectionNote(preset.family, preset.id);
        syncLandingUi();
      } catch (error) {
        setActivePresetJson(null);
        clearPresetSelectionNote();
        updateJsonFromForm();
        setValidationStatus(
          error && error.message ? error.message : "Failed to load preset JSON.",
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
      if (refs.customWorkloadBtn) {
        refs.customWorkloadBtn.addEventListener(
          "click",
          enableCustomWorkloadMode,
        );
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
