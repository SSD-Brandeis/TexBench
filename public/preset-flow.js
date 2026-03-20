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
    const getBuilderInputMode =
      typeof state.getBuilderInputMode === "function"
        ? state.getBuilderInputMode
        : function getBuilderInputModeFallback() {
            return "preset";
          };
    const setBuilderInputMode =
      typeof state.setBuilderInputMode === "function"
        ? state.setBuilderInputMode
        : function setBuilderInputModeFallback() {};
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
    const clearPersistedCustomBuilderState =
      typeof config.clearPersistedCustomBuilderState === "function"
        ? config.clearPersistedCustomBuilderState
        : function clearPersistedCustomBuilderStateFallback() {};
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

    function syncBuilderEntryModeUi() {
      if (refs.builderDescribePanel) {
        refs.builderDescribePanel.hidden = false;
      }
      if (refs.builderPresetPanel) {
        refs.builderPresetPanel.hidden = false;
      }
    }

    function syncLandingUi() {
      const showPreview = hasConfiguredWorkload();
      syncBuilderEntryModeUi();

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
      if (refs.welcomePanel) {
        refs.welcomePanel.hidden = true;
      }
    }

    function enableCustomWorkloadMode() {
      setCustomWorkloadMode(true);
      setBuilderInputMode("describe");
      ensureWorkloadStructureState();
      loadActiveStructureIntoForm();
      updateJsonFromForm();
      syncLandingUi();
      if (refs.assistantInput) {
        refs.assistantInput.focus();
      }
    }

    function enablePresetBrowserMode() {
      setBuilderInputMode("preset");
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
      setBuilderInputMode("preset");
      setActivePresetJson(null);
      renderPresetFileOptions(family);
      clearPresetSelectionNote();
      syncLandingUi();
    }

    async function handlePresetFileChange(event) {
      const presetId =
        event && event.target && typeof event.target.value === "string"
          ? event.target.value
          : "";
      setBuilderInputMode("preset");
      if (!presetId) {
        setActivePresetJson(null);
        renderPresetSelectionNote(
          refs.presetFamilySelect ? refs.presetFamilySelect.value : "",
          "",
        );
        syncLandingUi();
        return;
      }

      const preset = presetCatalog.find(function matchPreset(entry) {
        return entry.id === presetId;
      });
      if (!preset) {
        setActivePresetJson(null);
        clearPresetSelectionNote();
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
        setBuilderInputMode("describe");
        setActivePresetJson(null);
        loadPresetIntoBuilder(cloneJsonValue(loadedJson));
        clearWorkloadRuns();
        renderPresetSelectionNote(preset.family, preset.id);
        syncLandingUi();
      } catch (error) {
        setActivePresetJson(null);
        clearPresetSelectionNote();
        setBuilderInputMode("preset");
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
      if (refs.builderDescribeModeBtn) {
        refs.builderDescribeModeBtn.addEventListener(
          "click",
          enableCustomWorkloadMode,
        );
      }
      if (refs.builderPresetModeBtn) {
        refs.builderPresetModeBtn.addEventListener(
          "click",
          enablePresetBrowserMode,
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
