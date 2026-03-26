import assert from "node:assert/strict";
import test from "node:test";

class FakeClassList {
  constructor(owner) {
    this.owner = owner;
    this.tokens = new Set();
  }

  setFromString(value) {
    this.tokens = new Set(
      String(value || "")
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(Boolean),
    );
  }

  syncOwner() {
    this.owner._className = Array.from(this.tokens).join(" ");
  }

  add(...tokens) {
    tokens.forEach((token) => {
      if (token) {
        this.tokens.add(token);
      }
    });
    this.syncOwner();
  }

  remove(...tokens) {
    tokens.forEach((token) => {
      this.tokens.delete(token);
    });
    this.syncOwner();
  }

  toggle(token, force) {
    if (force === undefined) {
      if (this.tokens.has(token)) {
        this.tokens.delete(token);
        this.syncOwner();
        return false;
      }
      this.tokens.add(token);
      this.syncOwner();
      return true;
    }

    if (force) {
      this.tokens.add(token);
    } else {
      this.tokens.delete(token);
    }
    this.syncOwner();
    return force;
  }

  contains(token) {
    return this.tokens.has(token);
  }
}

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = String(tagName || "div").toUpperCase();
    this.hidden = false;
    this.disabled = false;
    this.focused = false;
    this.value = "";
    this.checked = false;
    this.dataset = {};
    this.attributes = new Map();
    this.children = [];
    this.listeners = new Map();
    this.scrollHeight = 0;
    this.scrollTop = 0;
    this._className = "";
    this._innerHTML = "";
    this._textContent = "";
    this.classList = new FakeClassList(this);
  }

  get className() {
    return this._className;
  }

  set className(value) {
    this._className = String(value || "");
    this.classList.setFromString(this._className);
  }

  get textContent() {
    return this._textContent;
  }

  set textContent(value) {
    this._textContent = String(value || "");
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(value) {
    this._innerHTML = String(value || "");
    this.children = [];
    this._textContent = "";
  }

  appendChild(child) {
    this.children.push(child);
    this.scrollHeight = this.children.length;
    return child;
  }

  addEventListener(type, handler) {
    this.listeners.set(type, handler);
  }

  setAttribute(name, value) {
    this.attributes.set(String(name), String(value));
  }

  focus() {
    this.focused = true;
  }
}

class FakeSelectElement extends FakeElement {
  constructor() {
    super("select");
    this.multiple = false;
    this.size = 0;
  }

  get options() {
    return this.children;
  }

  get selectedOptions() {
    return this.children.filter((child) => child.selected);
  }
}

class FakeOptionElement extends FakeElement {
  constructor() {
    super("option");
    this.selected = false;
  }
}

class FakeInputElement extends FakeElement {
  constructor(type = "text") {
    super("input");
    this.type = type;
    this.min = "";
    this.max = "";
    this.step = "";
  }
}

class FakeTextAreaElement extends FakeElement {
  constructor() {
    super("textarea");
  }
}

function createElement(tagName) {
  const lower = String(tagName || "div").toLowerCase();
  if (lower === "select") {
    return new FakeSelectElement();
  }
  if (lower === "option") {
    return new FakeOptionElement();
  }
  if (lower === "input") {
    return new FakeInputElement();
  }
  if (lower === "textarea") {
    return new FakeTextAreaElement();
  }
  return new FakeElement(lower);
}

function flattenText(node) {
  if (!node) {
    return "";
  }
  const ownText = typeof node.textContent === "string" ? node.textContent : "";
  return [ownText, ...node.children.map((child) => flattenText(child))]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function createRefs() {
  return {
    assistantApplyBtn: new FakeElement("button"),
    assistantClearBtn: new FakeElement("button"),
    assistantComposerHint: new FakeElement("p"),
    assistantInput: new FakeTextAreaElement(),
    assistantStatus: new FakeElement("span"),
    assistantTimeline: new FakeElement("div"),
  };
}

test("assistant panel renders a natural assistant reply with assumptions and form guidance", async () => {
  globalThis.document = { createElement };
  globalThis.HTMLSelectElement = FakeSelectElement;
  globalThis.window = {
    sessionStorage: {
      store: new Map(),
      getItem(key) {
        return this.store.has(key) ? this.store.get(key) : null;
      },
      setItem(key, value) {
        this.store.set(key, String(value));
      },
    },
  };

  await import("../public/assistant-panel.js");

  const refs = createRefs();
  const applyCalls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return {
        patch: { operations: { inserts: { enabled: true, op_count: 100000 } } },
        summary: "Created an insert-only workload with 100K operations.",
        clarifications: [],
        assumptions: [
          { text: "Used the default alphanumeric character set." },
          { text: "Used default 20-byte keys for inserts." },
        ],
      };
    },
  });

  try {
    const controller = globalThis.TectonicAssistantPanel.createController({
      refs,
      applyAssistantPatch(patch) {
        applyCalls.push(patch);
      },
      getActivePresetJson() {
        return null;
      },
      getCurrentFormState() {
        return {};
      },
      getCurrentWorkloadJson() {
        return {};
      },
      getSchemaHintsForAssist() {
        return {};
      },
      getSelectedOperations() {
        return [];
      },
      updateJsonFromForm() {},
    });

    refs.assistantInput.value = "Generate an insert-only workload with 100K operations.";
    await controller.handleApply();

    assert.equal(applyCalls.length, 1);
    assert.equal(refs.assistantTimeline.children.length, 2);
    assert.equal(refs.assistantStatus.textContent, "Applied");

    const assistantTurn = refs.assistantTimeline.children[1];
    const renderedText = flattenText(assistantTurn);

    assert.match(assistantTurn.className, /\bassistant\b/);
    assert.match(renderedText, /Created an insert-only workload with 100K operations\./);
    assert.match(renderedText, /Assumptions I used:/);
    assert.match(renderedText, /Used the default alphanumeric character set\./);
    assert.match(renderedText, /Used default 20-byte keys for inserts\./);
    assert.match(
      renderedText,
      /You can fine-tune anything in the form if you want to adjust the generated workload\./,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("assistant panel rewrites a first-turn generic summary into a specific generated summary", async () => {
  globalThis.document = { createElement };
  globalThis.HTMLSelectElement = FakeSelectElement;
  globalThis.window = {
    sessionStorage: {
      store: new Map(),
      getItem(key) {
        return this.store.has(key) ? this.store.get(key) : null;
      },
      setItem(key, value) {
        this.store.set(key, String(value));
      },
    },
  };

  await import("../public/assistant-panel.js");

  const refs = createRefs();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return {
        patch: { operations: { inserts: { enabled: true, op_count: 1000000 } } },
        summary: "Updated the workload.",
        clarifications: [],
        assumptions: [],
      };
    },
  });

  try {
    const controller = globalThis.TectonicAssistantPanel.createController({
      refs,
      applyAssistantPatch() {},
      getActivePresetJson() {
        return null;
      },
      getCurrentFormState() {
        return {};
      },
      getCurrentWorkloadJson() {
        return {};
      },
      getSchemaHintsForAssist() {
        return {};
      },
      getSelectedOperations() {
        return [];
      },
      updateJsonFromForm() {},
    });

    refs.assistantInput.value = "Generate a workload with 1M inserts";
    await controller.handleApply();

    const assistantTurn = refs.assistantTimeline.children[1];
    const renderedText = flattenText(assistantTurn);

    assert.match(renderedText, /Generated the workload with 1M inserts\./);
    assert.doesNotMatch(renderedText, /Updated the workload\./);
    assert.match(
      renderedText,
      /No extra assistant-side assumptions were added\./,
    );
    assert.doesNotMatch(
      renderedText,
      /No extra assumptions were needed beyond what you asked for\./,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("assistant panel describes follow-up operation adds as added", async () => {
  globalThis.document = { createElement };
  globalThis.HTMLSelectElement = FakeSelectElement;
  globalThis.window = {
    sessionStorage: {
      store: new Map(),
      getItem(key) {
        return this.store.has(key) ? this.store.get(key) : null;
      },
      setItem(key, value) {
        this.store.set(key, String(value));
      },
    },
  };

  await import("../public/assistant-panel.js");

  const refs = createRefs();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return {
        patch: { operations: { point_queries: { enabled: true, op_count: 50000 } } },
        summary: "Updated the workload.",
        clarifications: [],
        assumptions: [],
      };
    },
  });

  try {
    const controller = globalThis.TectonicAssistantPanel.createController({
      refs,
      applyAssistantPatch() {},
      getActivePresetJson() {
        return null;
      },
      getCurrentFormState() {
        return {
          operations: {
            inserts: {
              enabled: true,
              op_count: 1000000,
            },
          },
        };
      },
      getCurrentWorkloadJson() {
        return {};
      },
      getSchemaHintsForAssist() {
        return {};
      },
      getSelectedOperations() {
        return ["inserts"];
      },
      updateJsonFromForm() {},
    });

    refs.assistantInput.value = "Add 50K point queries";
    await controller.handleApply();

    const assistantTurn = refs.assistantTimeline.children[1];
    const renderedText = flattenText(assistantTurn);

    assert.match(renderedText, /Added 50K point queries to the workload\./);
    assert.doesNotMatch(renderedText, /Generated the workload\./);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("assistant panel applies chat edits on a loaded preset", async () => {
  globalThis.document = { createElement };
  globalThis.HTMLSelectElement = FakeSelectElement;
  globalThis.window = {
    sessionStorage: {
      store: new Map(),
      getItem(key) {
        return this.store.has(key) ? this.store.get(key) : null;
      },
      setItem(key, value) {
        this.store.set(key, String(value));
      },
    },
  };

  await import("../public/assistant-panel.js");

  const refs = createRefs();
  const applyCalls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return {
        patch: { operations: { point_queries: { enabled: true, op_count: 5000 } } },
        summary: "Added 5K point queries to the workload.",
        clarifications: [],
        assumptions: [],
      };
    },
  });

  try {
    const controller = globalThis.TectonicAssistantPanel.createController({
      refs,
      applyAssistantPatch(patch) {
        applyCalls.push(patch);
      },
      getActivePresetJson() {
        return { sections: [{ groups: [{ inserts: { op_count: 100000 } }] }] };
      },
      getCurrentFormState() {
        return {
          operations: {
            inserts: {
              enabled: true,
              op_count: 100000,
            },
          },
        };
      },
      getCurrentWorkloadJson() {
        return {};
      },
      getSchemaHintsForAssist() {
        return {};
      },
      getSelectedOperations() {
        return ["inserts"];
      },
      updateJsonFromForm() {},
    });

    refs.assistantInput.value = "Add 5k point queries";
    await controller.handleApply();

    assert.equal(applyCalls.length, 1);
    assert.equal(refs.assistantStatus.textContent, "Applied");
    const assistantTurn = refs.assistantTimeline.children[1];
    assert.match(flattenText(assistantTurn), /Added 5K point queries to the workload\./);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("assistant panel renders single-choice delete clarification as checkboxes", async () => {
  globalThis.document = { createElement };
  globalThis.HTMLSelectElement = FakeSelectElement;
  globalThis.window = {
    sessionStorage: {
      store: new Map(),
      getItem(key) {
        return this.store.has(key) ? this.store.get(key) : null;
      },
      setItem(key, value) {
        this.store.set(key, String(value));
      },
    },
  };

  await import("../public/assistant-panel.js");

  const refs = createRefs();
  const appliedAnswers = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return {
        patch: {},
        summary: "Updated the workload.",
        assumptions: [],
        clarifications: [
          {
            id: "clarify.operations.deletes",
            text: "Which deletes should be added or removed?",
            required: true,
            binding: { type: "operations_set" },
            input: "multi_enum",
            options: ["point_deletes", "range_deletes", "empty_point_deletes"],
            validation: { min_items: 1, max_items: 1 },
          },
        ],
      };
    },
  });

  try {
    const controller = globalThis.TectonicAssistantPanel.createController({
      refs,
      applyAssistantPatch() {},
      applyClarificationAnswerToForm(clarification, value) {
        appliedAnswers.push({ clarification, value });
      },
      getActivePresetJson() {
        return null;
      },
      getCurrentFormState() {
        return {
          operations: {
            inserts: {
              enabled: true,
              op_count: 1000000,
            },
          },
        };
      },
      getCurrentWorkloadJson() {
        return {};
      },
      getSchemaHintsForAssist() {
        return {};
      },
      getSelectedOperations() {
        return ["inserts"];
      },
      updateJsonFromForm() {},
    });

    refs.assistantInput.value = "Add 1k deletes";
    await controller.handleApply();

    const clarificationsWrap = refs.assistantTimeline.children[2];
    const clarificationBlock = clarificationsWrap.children[0];
    const checkboxGroup = clarificationBlock.children[1];

    assert.equal(Array.isArray(checkboxGroup._checkboxOptions), true);
    assert.equal(checkboxGroup._checkboxOptions.length, 3);
    assert.match(
      flattenText(clarificationBlock),
      /Select one operation here to continue\./,
    );

    const firstOption = checkboxGroup._checkboxOptions[0].checkbox;
    const secondOption = checkboxGroup._checkboxOptions[1].checkbox;

    firstOption.checked = true;
    firstOption.listeners.get("change")();
    assert.deepEqual(appliedAnswers.at(-1).value, ["point_deletes"]);

    secondOption.checked = true;
    secondOption.listeners.get("change")();
    assert.equal(firstOption.checked, false);
    assert.equal(secondOption.checked, true);
    assert.deepEqual(appliedAnswers.at(-1).value, ["range_deletes"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
