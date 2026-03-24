import assert from "node:assert/strict";

import workerEntrypoint, { __test } from "../src/index.js";
import { createCloudflareAiBindingFromEnv } from "../src/cloudflare-ai-binding.mjs";
import { createOpenAiCompatibleBindingFromEnv } from "../src/openai-ai-binding.mjs";
import { createOllamaAiBindingFromEnv } from "../src/ollama-ai-binding.mjs";

const { buildEffectiveState, normalizeFormState, normalizeSchemaHints } = __test;

export const OPERATION_ORDER = [
  "inserts",
  "updates",
  "merges",
  "point_queries",
  "range_queries",
  "point_deletes",
  "range_deletes",
  "empty_point_queries",
  "empty_point_deletes",
  "sorted",
];

const OPERATION_LABELS = {
  inserts: "inserts",
  updates: "updates",
  merges: "merges",
  point_queries: "point queries",
  range_queries: "range queries",
  point_deletes: "point deletes",
  range_deletes: "range deletes",
  empty_point_queries: "empty point queries",
  empty_point_deletes: "empty point deletes",
  sorted: "sorted",
};

const CAPABILITIES = {
  inserts: {
    has_op_count: true,
    has_key: true,
    has_val: true,
    has_selection: false,
    has_range: false,
    has_sorted: false,
    has_character_set: true,
  },
  updates: {
    has_op_count: true,
    has_key: false,
    has_val: true,
    has_selection: true,
    has_range: false,
    has_sorted: false,
    has_character_set: true,
  },
  merges: {
    has_op_count: true,
    has_key: false,
    has_val: true,
    has_selection: true,
    has_range: false,
    has_sorted: false,
    has_character_set: true,
  },
  point_queries: {
    has_op_count: true,
    has_key: false,
    has_val: false,
    has_selection: true,
    has_range: false,
    has_sorted: false,
    has_character_set: false,
  },
  range_queries: {
    has_op_count: true,
    has_key: false,
    has_val: false,
    has_selection: true,
    has_range: true,
    has_sorted: false,
    has_character_set: false,
  },
  point_deletes: {
    has_op_count: true,
    has_key: false,
    has_val: false,
    has_selection: true,
    has_range: false,
    has_sorted: false,
    has_character_set: false,
  },
  range_deletes: {
    has_op_count: true,
    has_key: false,
    has_val: false,
    has_selection: true,
    has_range: true,
    has_sorted: false,
    has_character_set: false,
  },
  empty_point_queries: {
    has_op_count: true,
    has_key: true,
    has_val: false,
    has_selection: false,
    has_range: false,
    has_sorted: false,
    has_character_set: true,
  },
  empty_point_deletes: {
    has_op_count: true,
    has_key: true,
    has_val: false,
    has_selection: false,
    has_range: false,
    has_sorted: false,
    has_character_set: true,
  },
  sorted: {
    has_op_count: true,
    has_key: false,
    has_val: false,
    has_selection: false,
    has_range: false,
    has_sorted: true,
    has_character_set: false,
  },
};

export const SCHEMA_HINTS = normalizeSchemaHints({
  operation_order: OPERATION_ORDER,
  operation_labels: OPERATION_LABELS,
  capabilities: CAPABILITIES,
});

export function createFormState(operationOverrides = {}) {
  return normalizeFormState(
    {
      character_set: "alphanumeric",
      sections_count: 1,
      groups_per_section: 1,
      skip_key_contains_check: true,
      operations: operationOverrides,
    },
    SCHEMA_HINTS,
  );
}

export function applyPatchToState(formState, patch) {
  return normalizeFormState(
    buildEffectiveState(patch, formState, SCHEMA_HINTS),
    SCHEMA_HINTS,
  );
}

export function configuredOperations(group) {
  return OPERATION_ORDER.filter((operationName) =>
    Object.prototype.hasOwnProperty.call(group || {}, operationName),
  ).sort();
}

export function getSelectedProviderName(envLike = process.env) {
  const rawProvider = String(envLike.AI_PROVIDER || "openai").toLowerCase();
  if (rawProvider === "cloudflare") {
    return "cloudflare";
  }
  if (rawProvider === "ollama") {
    return "ollama";
  }
  return "openai";
}

export function createLiveBinding(providerName, envLike = process.env) {
  if (providerName === "cloudflare") {
    return createCloudflareAiBindingFromEnv(envLike);
  }
  if (providerName === "ollama") {
    return createOllamaAiBindingFromEnv(envLike);
  }
  return createOpenAiCompatibleBindingFromEnv(envLike);
}

export function getSelectedProviderConfig(envLike = process.env) {
  const name = getSelectedProviderName(envLike);
  return {
    name,
    binding: createLiveBinding(name, envLike),
    env: buildProviderEnv(name, envLike),
  };
}

function buildProviderEnv(providerName, envLike = process.env) {
  if (providerName === "cloudflare") {
    return {
      AI_PROVIDER: "cloudflare",
      CLOUDFLARE_MODEL:
        envLike.CLOUDFLARE_MODEL ||
        "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    };
  }
  if (providerName === "ollama") {
    const out = {
      AI_PROVIDER: "ollama",
      OLLAMA_MODEL: envLike.OLLAMA_MODEL || "llama3.2:3b",
    };
    if (envLike.OLLAMA_BASE_URL) {
      out.OLLAMA_BASE_URL = envLike.OLLAMA_BASE_URL;
    }
    if (envLike.OLLAMA_API_ENDPOINT) {
      out.OLLAMA_API_ENDPOINT = envLike.OLLAMA_API_ENDPOINT;
    }
    if (envLike.OLLAMA_TIMEOUT_MS) {
      out.OLLAMA_TIMEOUT_MS = envLike.OLLAMA_TIMEOUT_MS;
    }
    return out;
  }
  return {
    AI_PROVIDER: "openai",
    OPENAI_MODEL: envLike.OPENAI_MODEL || "gpt-5.1",
  };
}

function createRequest({ prompt, formState, currentJson = null, conversation = [], answers = {} }) {
  return new Request("https://example.com/api/assist", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      form_state: formState,
      schema_hints: SCHEMA_HINTS,
      current_json: currentJson,
      conversation,
      answers,
    }),
  });
}

export async function requestLiveAssist({
  prompt,
  formState = createFormState({}),
  currentJson = null,
  conversation = [],
  answers = {},
  provider = getSelectedProviderConfig(),
}) {
  assert.ok(provider.binding, provider.name + " AI binding is not configured.");
  const response = await workerEntrypoint.fetch(
    createRequest({ prompt, formState, currentJson, conversation, answers }),
    {
      ...provider.env,
      AI: provider.binding,
      ASSETS: {
        fetch: async () => new Response("not found", { status: 404 }),
      },
    },
  );
  const rawText = await response.text();
  assert.equal(
    response.status,
    200,
    provider.name + " /api/assist failed: " + rawText,
  );
  return JSON.parse(rawText);
}
