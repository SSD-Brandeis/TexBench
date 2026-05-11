import assert from "node:assert/strict";
import test from "node:test";

import { resolveOllamaTimeoutMs } from "../src/ollama-ai-binding.mjs";

test("Ollama binding defaults to a CPU-friendly timeout", () => {
  assert.equal(resolveOllamaTimeoutMs({}), 300000);
});

test("Ollama binding honors explicit timeout overrides within bounds", () => {
  assert.equal(resolveOllamaTimeoutMs({ OLLAMA_TIMEOUT_MS: "450000" }), 450000);
  assert.equal(resolveOllamaTimeoutMs({ OLLAMA_TIMEOUT_MS: "999999" }), 600000);
});
