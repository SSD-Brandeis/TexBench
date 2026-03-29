import assert from "node:assert/strict";
import test from "node:test";

class FakeClassList {
  constructor() {
    this.tokens = new Set();
  }

  add(...tokens) {
    tokens.forEach((token) => {
      if (token) {
        this.tokens.add(token);
      }
    });
  }

  remove(...tokens) {
    tokens.forEach((token) => {
      this.tokens.delete(token);
    });
  }

  toggle(token, force) {
    if (force === undefined) {
      if (this.tokens.has(token)) {
        this.tokens.delete(token);
        return false;
      }
      this.tokens.add(token);
      return true;
    }
    if (force) {
      this.tokens.add(token);
      return true;
    }
    this.tokens.delete(token);
    return false;
  }
}

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = String(tagName || "div").toUpperCase();
    this.hidden = false;
    this.disabled = false;
    this.value = "";
    this.textContent = "";
    this.children = [];
    this.focused = false;
    this.classList = new FakeClassList();
    this._innerHTML = "";
    this.validationMessage = "";
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  replaceChildren(...nextChildren) {
    this.children = nextChildren;
  }

  focus() {
    this.focused = true;
  }

  setCustomValidity(message) {
    this.validationMessage = String(message || "");
  }

  reportValidity() {
    return this.validationMessage === "";
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(value) {
    this._innerHTML = String(value || "");
    this.children = [];
  }
}

function createTestContext() {
  const refs = {
    appHeader: new FakeElement("header"),
    headerIntro: new FakeElement("div"),
    appShell: new FakeElement("div"),
    assistantInput: new FakeElement("textarea"),
    assistantPanel: new FakeElement("section"),
    assistantTitle: new FakeElement("span"),
    assistantComposerLabel: new FakeElement("label"),
    builderPresetPanel: new FakeElement("section"),
    builderPresetAssistantSlot: new FakeElement("div"),
    builderDescribePanel: new FakeElement("section"),
    builderScratchAssistantSlot: new FakeElement("div"),
    builderPanel: new FakeElement("section"),
    copyBtn: new FakeElement("button"),
    downloadJsonBtn: new FakeElement("button"),
    newWorkloadBtn: new FakeElement("button"),
    presetFamilySelect: new FakeElement("select"),
    presetFileSelect: new FakeElement("select"),
    presetScaleInput: new FakeElement("input"),
    presetSelectionNote: new FakeElement("p"),
    previewPanel: new FakeElement("section"),
    runWorkloadBtn: new FakeElement("button"),
    runsPanel: new FakeElement("section"),
    validationResult: new FakeElement("p"),
  };
  refs.presetScaleInput.value = "1";
  refs.builderScratchAssistantSlot.replaceChildren(refs.assistantPanel);

  let activePresetJson = null;
  let selectedBuilderRoute = null;
  let hasConfiguredWorkload = false;

  const fakeFetch = async (url) => {
    if (url === "/presets/index.json") {
      return {
        ok: true,
        async json() {
          return [
            {
              id: "scale-001m",
              family: "scale",
              label: "001m.spec.json",
              path: "/presets/scale/001m.spec.json",
            },
          ];
        },
      };
    }
    if (url === "/presets/scale/001m.spec.json") {
      return {
        ok: true,
        async json() {
          return { sections: [{ groups: [{ inserts: { op_count: 1000 } }] }] };
        },
      };
    }
    throw new Error("Unexpected fetch URL: " + url);
  };

  return {
    fakeFetch,
    refs,
    state: {
      getActivePresetJson() {
        return activePresetJson;
      },
      setActivePresetJson(value) {
        activePresetJson = value;
      },
      getSelectedBuilderRoute() {
        return selectedBuilderRoute;
      },
      setSelectedBuilderRoute(value) {
        selectedBuilderRoute = value;
      },
      getCustomWorkloadMode() {
        return false;
      },
      setCustomWorkloadMode() {},
      hasConfiguredWorkload() {
        return hasConfiguredWorkload;
      },
    },
    setHasConfiguredWorkload(value) {
      hasConfiguredWorkload = value === true;
    },
  };
}

test("preset scale stays disabled until both family and file are selected", async () => {
  globalThis.document = {
    createElement(tagName) {
      return new FakeElement(tagName);
    },
  };

  await import("../public/preset-flow.js");

  const ctx = createTestContext();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ctx.fakeFetch;

  try {
    const controller = globalThis.TectonicPresetFlow.createController({
      refs: ctx.refs,
      state: ctx.state,
      cloneJsonValue(value) {
        return JSON.parse(JSON.stringify(value));
      },
      ensureWorkloadStructureState() {},
      loadActiveStructureIntoForm() {},
      loadPresetIntoBuilder() {},
      updateJsonFromForm() {},
      clearWorkloadRuns() {},
      setValidationStatus() {},
    });

    await controller.loadPresetCatalog();

    assert.equal(ctx.refs.presetScaleInput.disabled, true);
    assert.equal(ctx.refs.headerIntro.hidden, false);

    ctx.refs.presetFamilySelect.value = "scale";
    controller.handlePresetFamilyChange({ target: { value: "scale" } });

    assert.equal(ctx.refs.presetFileSelect.disabled, false);
    assert.equal(ctx.refs.presetScaleInput.disabled, true);

    ctx.refs.presetFileSelect.value = "scale-001m";
    await controller.handlePresetFileChange({ target: { value: "scale-001m" } });

    assert.equal(ctx.refs.presetScaleInput.disabled, false);
    assert.equal(
      ctx.refs.appShell.classList.tokens.has("preset-loaded"),
      true,
    );
    assert.equal(ctx.refs.builderPresetPanel.hidden, false);
    assert.equal(ctx.refs.builderDescribePanel.hidden, true);
    assert.equal(ctx.refs.builderPresetAssistantSlot.hidden, false);
    assert.equal(ctx.refs.builderScratchAssistantSlot.hidden, true);
    assert.equal(ctx.refs.builderPresetAssistantSlot.children[0], ctx.refs.assistantPanel);
    assert.equal(ctx.refs.assistantTitle.textContent, "Add With Chat");
    assert.equal(ctx.refs.assistantComposerLabel.textContent, "Add to this workload");
    assert.equal(ctx.refs.headerIntro.hidden, true);

    ctx.refs.presetFileSelect.value = "";
    await controller.handlePresetFileChange({ target: { value: "" } });

    assert.equal(ctx.refs.presetScaleInput.disabled, true);
    assert.equal(
      ctx.refs.appShell.classList.tokens.has("preset-loaded"),
      false,
    );
    assert.equal(ctx.refs.builderPresetPanel.hidden, false);
    assert.equal(ctx.refs.builderDescribePanel.hidden, false);
    assert.equal(ctx.refs.builderPresetAssistantSlot.hidden, true);
    assert.equal(ctx.refs.builderScratchAssistantSlot.hidden, false);
    assert.equal(ctx.refs.builderScratchAssistantSlot.children[0], ctx.refs.assistantPanel);
    assert.equal(ctx.refs.assistantTitle.textContent, "Generate From Scratch");
    assert.equal(
      ctx.refs.assistantComposerLabel.textContent,
      "Describe your workload",
    );
    assert.equal(ctx.refs.headerIntro.hidden, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("scratch route hides the preset option after a workload is established", async () => {
  globalThis.document = {
    createElement(tagName) {
      return new FakeElement(tagName);
    },
  };

  await import("../public/preset-flow.js");

  const ctx = createTestContext();
  ctx.setHasConfiguredWorkload(true);

  const controller = globalThis.TectonicPresetFlow.createController({
    refs: ctx.refs,
    state: ctx.state,
    cloneJsonValue(value) {
      return JSON.parse(JSON.stringify(value));
    },
    ensureWorkloadStructureState() {},
    loadActiveStructureIntoForm() {},
    loadPresetIntoBuilder() {},
    updateJsonFromForm() {},
    clearWorkloadRuns() {},
    setValidationStatus() {},
  });

  ctx.state.setSelectedBuilderRoute("scratch");
  controller.syncLandingUi();

  assert.equal(
    ctx.refs.appShell.classList.tokens.has("scratch-selected"),
    true,
  );
  assert.equal(ctx.refs.builderPresetPanel.hidden, true);
  assert.equal(ctx.refs.builderDescribePanel.hidden, false);
  assert.equal(ctx.refs.builderPresetAssistantSlot.hidden, true);
  assert.equal(ctx.refs.builderScratchAssistantSlot.hidden, false);
  assert.equal(ctx.refs.builderScratchAssistantSlot.children[0], ctx.refs.assistantPanel);
  assert.equal(ctx.refs.headerIntro.hidden, true);
});

test("preset scale accepts fractional values and scales op counts down", async () => {
  globalThis.document = {
    createElement(tagName) {
      return new FakeElement(tagName);
    },
  };

  await import("../public/preset-flow.js");

  const ctx = createTestContext();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ctx.fakeFetch;
  let loadedJson = null;

  try {
    const controller = globalThis.TectonicPresetFlow.createController({
      refs: ctx.refs,
      state: ctx.state,
      cloneJsonValue(value) {
        return JSON.parse(JSON.stringify(value));
      },
      ensureWorkloadStructureState() {},
      loadActiveStructureIntoForm() {},
      loadPresetIntoBuilder(value) {
        loadedJson = value;
      },
      updateJsonFromForm() {},
      clearWorkloadRuns() {},
      setValidationStatus() {},
    });

    await controller.loadPresetCatalog();
    ctx.refs.presetFamilySelect.value = "scale";
    controller.handlePresetFamilyChange({ target: { value: "scale" } });
    ctx.refs.presetScaleInput.value = "0.01";
    ctx.refs.presetFileSelect.value = "scale-001m";

    await controller.handlePresetFileChange({ target: { value: "scale-001m" } });

    assert.equal(ctx.refs.presetScaleInput.validationMessage, "");
    assert.equal(
      loadedJson.sections[0].groups[0].inserts.op_count,
      10,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
