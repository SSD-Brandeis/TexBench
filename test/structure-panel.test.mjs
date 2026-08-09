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
}

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = String(tagName || "div").toUpperCase();
    this.children = [];
    this.textContent = "";
    this.className = "";
    this.type = "";
    this.disabled = false;
    this.classList = new FakeClassList();
    this.listeners = new Map();
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  addEventListener(type, handler) {
    this.listeners.set(type, handler);
  }

  set innerHTML(value) {
    this.children = [];
    this.textContent = String(value || "");
  }
}

function flattenText(node) {
  if (!node) {
    return "";
  }
  return [node.textContent || ""]
    .concat((node.children || []).map((child) => flattenText(child)))
    .join(" ");
}

test("structure panel shows sorted as a modifier, not an operation", async () => {
  globalThis.document = {
    createElement(tagName) {
      return new FakeElement(tagName);
    },
  };

  await import("../public/structure-panel.js");

  const container = new FakeElement("div");
  const selectionLabel = new FakeElement("p");
  const renderer = globalThis.TectonicStructurePanel.createRenderer({
    container,
    selectionLabel,
    countConfiguredGroupOperations(group) {
      return Object.keys(group || {}).filter((name) => name !== "sorted").length;
    },
    onSelectSection() {},
    onAddGroup() {},
    onRemoveSection() {},
    onSelectGroup() {},
    onRemoveGroup() {},
  });

  renderer.render({
    sections: [
      {
        groups: [{ inserts: { op_count: 1000 }, sorted: { k: 100, l: 1 } }],
      },
    ],
    activeSectionIndex: 0,
    activeGroupIndex: 0,
  });

  assert.equal(selectionLabel.textContent, "Editing Section 1 / Phase 1");
  const renderedText = flattenText(container);
  assert.match(renderedText, /Phase 1:[\s\S]*inserts • near-sorted/);
  assert.doesNotMatch(renderedText, /Phase 1 • inserts, sorted/);
});
