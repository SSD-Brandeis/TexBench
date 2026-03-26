(function initBuilderSessionModule(global) {
  "use strict";

  function normalizeRoute(value) {
    return value === "preset" || value === "scratch" ? value : null;
  }

  function createStore(initialState) {
    const seed =
      initialState && typeof initialState === "object" ? initialState : {};

    let activePresetJson =
      seed.activePresetJson && typeof seed.activePresetJson === "object"
        ? seed.activePresetJson
        : null;
    let customWorkloadMode = seed.customWorkloadMode === true;
    let selectedBuilderRoute = normalizeRoute(seed.selectedBuilderRoute);

    return {
      getActivePresetJson() {
        return activePresetJson;
      },
      setActivePresetJson(nextValue) {
        activePresetJson =
          nextValue && typeof nextValue === "object" ? nextValue : null;
      },
      getCustomWorkloadMode() {
        return customWorkloadMode;
      },
      setCustomWorkloadMode(nextValue) {
        customWorkloadMode = nextValue === true;
      },
      getSelectedBuilderRoute() {
        return selectedBuilderRoute;
      },
      setSelectedBuilderRoute(nextValue) {
        selectedBuilderRoute = normalizeRoute(nextValue);
      },
    };
  }

  global.TectonicBuilderSession = {
    createStore: createStore,
  };
})(globalThis);
