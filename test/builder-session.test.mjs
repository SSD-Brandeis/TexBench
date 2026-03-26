import assert from "node:assert/strict";
import test from "node:test";

await import("../public/builder-session.js");

test("builder session store normalizes route and workload state", () => {
  const store = globalThis.TectonicBuilderSession.createStore();

  assert.equal(store.getActivePresetJson(), null);
  assert.equal(store.getCustomWorkloadMode(), false);
  assert.equal(store.getSelectedBuilderRoute(), null);

  const preset = { sections: [] };
  store.setActivePresetJson(preset);
  store.setCustomWorkloadMode(true);
  store.setSelectedBuilderRoute("preset");

  assert.equal(store.getActivePresetJson(), preset);
  assert.equal(store.getCustomWorkloadMode(), true);
  assert.equal(store.getSelectedBuilderRoute(), "preset");

  store.setActivePresetJson("bad");
  store.setCustomWorkloadMode("yes");
  store.setSelectedBuilderRoute("invalid");

  assert.equal(store.getActivePresetJson(), null);
  assert.equal(store.getCustomWorkloadMode(), false);
  assert.equal(store.getSelectedBuilderRoute(), null);
});
