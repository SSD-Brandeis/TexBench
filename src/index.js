import {
  DEFAULT_CLOUDFLARE_MODEL,
  getCloudflareModels,
  isCloudflareAssistProvider,
} from "./cloudflare-assist-provider.mjs";
import {
  DEFAULT_OPENAI_MODEL,
  getOpenAiModels,
  isOpenAiAssistProvider,
} from "./openai-assist-provider.mjs";
import {
  DEFAULT_OLLAMA_MODEL,
  getOllamaModels,
  isOllamaAssistProvider,
} from "./ollama-assist-provider.mjs";

const DEFAULT_MAX_TOKENS = 700;
const DEFAULT_RETRY_ATTEMPTS = 2;
const DEFAULT_AI_TIMEOUT_MS = 15000;
const DEFAULT_OLLAMA_MAX_TOKENS = 220;
const DEFAULT_OLLAMA_RETRY_ATTEMPTS = 1;
const DEFAULT_OLLAMA_AI_TIMEOUT_MS = 60000;

const FALLBACK_OPERATION_ORDER = [
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
const DEFAULT_SELECTION_DISTRIBUTIONS = [
  "uniform",
  "normal",
  "beta",
  "zipf",
  "exponential",
  "log_normal",
  "poisson",
  "weibull",
  "pareto",
];
const SELECTION_DISTRIBUTION_ALIASES = {
  uniform: ["uniform"],
  normal: ["normal", "gaussian"],
  beta: ["beta"],
  zipf: ["zipf", "zipfian"],
  exponential: ["exponential"],
  log_normal: ["log_normal", "log-normal", "log normal"],
  poisson: ["poisson"],
  weibull: ["weibull"],
  pareto: ["pareto"],
};
const SELECTION_DISTRIBUTION_TERMS = Array.from(
  new Set(Object.values(SELECTION_DISTRIBUTION_ALIASES).flat()),
);
const OPERATION_PROMPT_PATTERN_SOURCES = {
  inserts: "insert(?:s|ion)?",
  updates: "update(?:s)?",
  merges: "merge(?:s)?|read[- ]?modify[- ]?write|rmw",
  point_queries: "point\\s+quer(?:y|ie|ies)|point\\s+read(?:s)?",
  range_queries: "range\\s+quer(?:y|ie|ies)",
  point_deletes: "point\\s+delete(?:s)?",
  range_deletes: "range\\s+delete(?:s)?",
  empty_point_queries:
    "empty\\s+point\\s+quer(?:y|ie|ies)|empty\\s+point\\s+read(?:s)?|missing\\s+point\\s+quer(?:y|ie|ies)",
  empty_point_deletes:
    "empty\\s+point\\s+delete(?:s)?|missing\\s+point\\s+delete(?:s)?|non[- ]?existent\\s+point\\s+delete(?:s)?",
  sorted: "sorted",
};
const OPERATION_PROMPT_BLOCKED_PREFIXES = {
  point_queries: ["empty", "missing"],
  point_deletes: [
    "empty",
    "missing",
    "non existent",
    "non-existent",
    "nonexistent",
  ],
};
const OPERATION_DISABLE_INTENT_TERMS = [
  "remove",
  "disable",
  "exclude",
  "without",
  "no",
];
const OPERATION_COUNT_INTENT_TERMS = [
  "add",
  "include",
  "set",
  "make",
  "update",
  "change",
  "use",
  "with",
  "to",
  "increase",
  "decrease",
  "generate",
  "create",
];
const DISTRIBUTION_REQUIRED_KEYS = {
  uniform: ["min", "max"],
  normal: ["mean", "std_dev"],
  beta: ["alpha", "beta"],
  zipf: ["n", "s"],
  exponential: ["lambda"],
  log_normal: ["mean", "std_dev"],
  poisson: ["lambda"],
  weibull: ["scale", "shape"],
  pareto: ["scale", "shape"],
};
const SELECTION_DISTRIBUTION_PARAM_KEYS = {
  uniform: ["selection_min", "selection_max"],
  normal: ["selection_mean", "selection_std_dev"],
  beta: ["selection_alpha", "selection_beta"],
  zipf: ["selection_n", "selection_s"],
  exponential: ["selection_lambda"],
  log_normal: ["selection_mean", "selection_std_dev"],
  poisson: ["selection_lambda"],
  weibull: ["selection_scale", "selection_shape"],
  pareto: ["selection_scale", "selection_shape"],
};
const SELECTION_PARAM_DEFAULTS = {
  selection_min: 0,
  selection_max: 1,
  selection_mean: 0.5,
  selection_std_dev: 0.15,
  selection_alpha: 0.1,
  selection_beta: 5,
  selection_n: 1000000,
  selection_s: 1.5,
  selection_lambda: 1,
  selection_scale: 1,
  selection_shape: 2,
};
const SELECTION_PARAM_LABELS = {
  selection_min: "min",
  selection_max: "max",
  selection_mean: "mean",
  selection_std_dev: "standard deviation",
  selection_alpha: "alpha",
  selection_beta: "beta",
  selection_n: "n",
  selection_s: "s",
  selection_lambda: "lambda",
  selection_scale: "scale",
  selection_shape: "shape",
};
const STRING_PATTERN_VALUES = ["uniform", "weighted", "segmented", "hot_range"];
const STRING_PATTERN_DEFAULTS = {
  key_pattern: "uniform",
  val_pattern: "uniform",
  key_hot_len: 20,
  key_hot_amount: 100,
  key_hot_probability: 0.8,
  val_hot_len: 256,
  val_hot_amount: 100,
  val_hot_probability: 0.8,
};
const STRUCTURED_WORKLOAD_PATTERN =
  /\b(?:single[- ]shot|one[- ]phase|two[- ]phase|three[- ]phase|preload|interleave|interleaved|phase\s+[123]|(?:first|second|third|next|later)\s+phase|write[- ]heavy|write[- ]only)\b/i;
const RANGE_QUERY_SELECTIVITY_PROFILES = {
  short: 0.001,
  long: 0.1,
};
const WRITE_HEAVY_DEFAULT_SPLIT = {
  write: 80,
  read: 20,
};
const TOP_LEVEL_BINDING_FIELDS = new Set([
  "character_set",
  "sections_count",
  "groups_per_section",
]);
const OPERATION_BINDING_FIELDS = new Set([
  "enabled",
  "op_count",
  "selection",
  "character_set",
  "key",
  "val",
  "k",
  "l",
  "key_len",
  "val_len",
  "key_pattern",
  "val_pattern",
  "key_hot_len",
  "key_hot_amount",
  "key_hot_probability",
  "val_hot_len",
  "val_hot_amount",
  "val_hot_probability",
  "selection_distribution",
  "selection_min",
  "selection_max",
  "selection_mean",
  "selection_std_dev",
  "selection_alpha",
  "selection_beta",
  "selection_n",
  "selection_s",
  "selection_lambda",
  "selection_scale",
  "selection_shape",
  "selectivity",
  "range_format",
]);
TOP_LEVEL_BINDING_FIELDS.add("skip_key_contains_check");
const CLARIFICATION_INPUT_TYPES = new Set([
  "number",
  "enum",
  "multi_enum",
  "boolean",
  "text",
]);
const ASSIST_OPERATION_PATCH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "enabled",
    "character_set",
    "op_count",
    "key",
    "val",
    "key_len",
    "val_len",
    "key_pattern",
    "val_pattern",
    "key_hot_len",
    "key_hot_amount",
    "key_hot_probability",
    "val_hot_len",
    "val_hot_amount",
    "val_hot_probability",
    "selection_distribution",
    "selection_min",
    "selection_max",
    "selection_mean",
    "selection_std_dev",
    "selection_alpha",
    "selection_beta",
    "selection_n",
    "selection_s",
    "selection_lambda",
    "selection_scale",
    "selection_shape",
    "selectivity",
    "range_format",
    "k",
    "l",
  ],
  properties: {
    enabled: { type: ["boolean", "null"] },
    character_set: { type: ["string", "null"] },
    op_count: { type: ["number", "null"] },
    key: { type: ["string", "null"] },
    val: { type: ["string", "null"] },
    key_len: { type: ["number", "null"] },
    val_len: { type: ["number", "null"] },
    key_pattern: { type: ["string", "null"] },
    val_pattern: { type: ["string", "null"] },
    key_hot_len: { type: ["number", "null"] },
    key_hot_amount: { type: ["number", "null"] },
    key_hot_probability: { type: ["number", "null"] },
    val_hot_len: { type: ["number", "null"] },
    val_hot_amount: { type: ["number", "null"] },
    val_hot_probability: { type: ["number", "null"] },
    selection_distribution: { type: ["string", "null"] },
    selection_min: { type: ["number", "null"] },
    selection_max: { type: ["number", "null"] },
    selection_mean: { type: ["number", "null"] },
    selection_std_dev: { type: ["number", "null"] },
    selection_alpha: { type: ["number", "null"] },
    selection_beta: { type: ["number", "null"] },
    selection_n: { type: ["number", "null"] },
    selection_s: { type: ["number", "null"] },
    selection_lambda: { type: ["number", "null"] },
    selection_scale: { type: ["number", "null"] },
    selection_shape: { type: ["number", "null"] },
    selectivity: { type: ["number", "null"] },
    range_format: { type: ["string", "null"] },
    k: { type: ["number", "null"] },
    l: { type: ["number", "null"] },
  },
};
const ASSIST_GROUP_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["character_set", ...FALLBACK_OPERATION_ORDER],
  properties: {
    character_set: { type: ["string", "null"] },
  },
};
const ASSIST_OPERATIONS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [...FALLBACK_OPERATION_ORDER],
  properties: {},
};
FALLBACK_OPERATION_ORDER.forEach((operationName) => {
  const operationPropertySchema = {
    anyOf: [ASSIST_OPERATION_PATCH_SCHEMA, { type: "null" }],
  };
  ASSIST_GROUP_SCHEMA.properties[operationName] = operationPropertySchema;
  ASSIST_OPERATIONS_SCHEMA.properties[operationName] = operationPropertySchema;
});
const ASSIST_SECTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["character_set", "skip_key_contains_check", "groups"],
  properties: {
    character_set: { type: ["string", "null"] },
    skip_key_contains_check: { type: ["boolean", "null"] },
    groups: {
      type: "array",
      items: ASSIST_GROUP_SCHEMA,
    },
  },
};
const ASSIST_CLARIFICATION_BINDING_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["type", "field", "operation"],
  properties: {
    type: { type: ["string", "null"] },
    field: { type: ["string", "null"] },
    operation: { type: ["string", "null"] },
  },
};
const ASSIST_CLARIFICATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "text",
    "required",
    "binding",
    "input",
    "options",
    "default_behavior",
  ],
  properties: {
    id: { type: ["string", "null"] },
    text: { type: ["string", "null"] },
    required: { type: ["boolean", "null"] },
    binding: {
      anyOf: [ASSIST_CLARIFICATION_BINDING_SCHEMA, { type: "null" }],
    },
    input: { type: ["string", "null"] },
    options: {
      anyOf: [
        {
          type: "array",
          items: { type: "string" },
        },
        { type: "null" },
      ],
    },
    default_behavior: { type: ["string", "null"] },
  },
};
const ASSIST_ASSUMPTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["id", "text", "field_ref", "reason", "applied_value"],
  properties: {
    id: { type: ["string", "null"] },
    text: { type: ["string", "null"] },
    field_ref: { type: ["string", "null"] },
    reason: { type: ["string", "null"] },
    applied_value: {
      anyOf: [
        { type: "string" },
        { type: "number" },
        { type: "boolean" },
        { type: "null" },
      ],
    },
  },
};
const ASSIST_RESPONSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "patch",
    "clarifications",
    "assumptions",
    "questions",
    "assumption_texts",
  ],
  properties: {
    summary: { type: "string" },
    patch: {
      type: "object",
      additionalProperties: false,
      required: [
        "character_set",
        "sections_count",
        "groups_per_section",
        "sections",
        "skip_key_contains_check",
        "clear_operations",
        "operations",
      ],
      properties: {
        character_set: { type: ["string", "null"] },
        sections_count: { type: ["number", "null"] },
        groups_per_section: { type: ["number", "null"] },
        sections: {
          type: ["array", "null"],
          items: ASSIST_SECTION_SCHEMA,
        },
        skip_key_contains_check: { type: "boolean" },
        clear_operations: { type: "boolean" },
        operations: {
          anyOf: [ASSIST_OPERATIONS_SCHEMA, { type: "null" }],
        },
      },
    },
    clarifications: {
      type: "array",
      items: ASSIST_CLARIFICATION_SCHEMA,
    },
    assumptions: {
      type: "array",
      items: {
        anyOf: [
          { type: "string" },
          ASSIST_ASSUMPTION_SCHEMA,
        ],
      },
    },
    questions: {
      anyOf: [
        {
          type: "array",
          items: { type: "string" },
        },
        { type: "null" },
      ],
    },
    assumption_texts: {
      anyOf: [
        {
          type: "array",
          items: { type: "string" },
        },
        { type: "null" },
      ],
    },
  },
};
const OPENAI_ASSIST_OPERATION_FIELD_ENTRY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "field",
    "string_value",
    "number_value",
    "boolean_value",
    "json_value",
  ],
  properties: {
    field: { type: "string" },
    string_value: { type: ["string", "null"] },
    number_value: { type: ["number", "null"] },
    boolean_value: { type: ["boolean", "null"] },
    json_value: { type: ["string", "null"] },
  },
};
const OPENAI_ASSIST_OPERATION_ENTRY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["name", "fields"],
  properties: {
    name: { type: "string" },
    fields: {
      anyOf: [
        {
          type: "array",
          items: OPENAI_ASSIST_OPERATION_FIELD_ENTRY_SCHEMA,
        },
        { type: "null" },
      ],
    },
  },
};
const OPENAI_ASSIST_GROUP_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["character_set", "operations"],
  properties: {
    character_set: { type: ["string", "null"] },
    operations: {
      anyOf: [
        {
          type: "array",
          items: OPENAI_ASSIST_OPERATION_ENTRY_SCHEMA,
        },
        { type: "null" },
      ],
    },
  },
};
const OPENAI_ASSIST_SECTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["character_set", "skip_key_contains_check", "groups"],
  properties: {
    character_set: { type: ["string", "null"] },
    skip_key_contains_check: { type: ["boolean", "null"] },
    groups: {
      type: "array",
      items: OPENAI_ASSIST_GROUP_SCHEMA,
    },
  },
};
const ASSIST_TOP_FIELD_NAMES = [
  "character_set",
  "sections_count",
  "groups_per_section",
  "skip_key_contains_check",
];
const OPENAI_ASSIST_PROGRAM_COMMAND_SCHEMA = {
  anyOf: [
    {
      type: "object",
      additionalProperties: false,
      required: [
        "kind",
        "field",
        "string_value",
        "number_value",
        "boolean_value",
      ],
      properties: {
        kind: { type: "string", enum: ["set_top_field"] },
        field: { type: "string", enum: ASSIST_TOP_FIELD_NAMES },
        string_value: { type: ["string", "null"] },
        number_value: { type: ["number", "null"] },
        boolean_value: { type: ["boolean", "null"] },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["kind"],
      properties: {
        kind: { type: "string", enum: ["clear_operations"] },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "operation", "fields"],
      properties: {
        kind: { type: "string", enum: ["set_operation_fields"] },
        operation: { type: "string" },
        fields: {
          type: "array",
          items: OPENAI_ASSIST_OPERATION_FIELD_ENTRY_SCHEMA,
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "group"],
      properties: {
        kind: { type: "string", enum: ["append_group"] },
        section_index: { type: ["number", "null"] },
        after_group_index: { type: ["number", "null"] },
        group: OPENAI_ASSIST_GROUP_SCHEMA,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "group_index", "operation", "fields"],
      properties: {
        kind: { type: "string", enum: ["set_group_operation_fields"] },
        section_index: { type: ["number", "null"] },
        group_index: { type: ["number", "null"] },
        operation: { type: "string" },
        fields: {
          type: "array",
          items: OPENAI_ASSIST_OPERATION_FIELD_ENTRY_SCHEMA,
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "group_index", "from_operation", "to_operation"],
      properties: {
        kind: { type: "string", enum: ["rename_group_operation"] },
        section_index: { type: ["number", "null"] },
        group_index: { type: ["number", "null"] },
        from_operation: { type: "string" },
        to_operation: { type: "string" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "sections"],
      properties: {
        kind: { type: "string", enum: ["replace_sections"] },
        sections: {
          type: "array",
          items: OPENAI_ASSIST_SECTION_SCHEMA,
        },
      },
    },
  ],
};
const OPENAI_ASSIST_RESPONSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "program",
    "clarifications",
    "assumptions",
    "questions",
    "assumption_texts",
  ],
  properties: {
    summary: { type: "string" },
    program: {
      type: "array",
      items: OPENAI_ASSIST_PROGRAM_COMMAND_SCHEMA,
    },
    clarifications: {
      type: "array",
      items: ASSIST_CLARIFICATION_SCHEMA,
    },
    assumptions: {
      type: "array",
      items: {
        anyOf: [{ type: "string" }, ASSIST_ASSUMPTION_SCHEMA],
      },
    },
    questions: {
      anyOf: [
        {
          type: "array",
          items: { type: "string" },
        },
        { type: "null" },
      ],
    },
    assumption_texts: {
      anyOf: [
        {
          type: "array",
          items: { type: "string" },
        },
        { type: "null" },
      ],
    },
  },
};
const OPENAI_ASSIST_TOOL_NAME = "submit_workload_program";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/assist") {
      if (request.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405);
      }
      return handleAssistRequest(request, env);
    }

    if (url.pathname.startsWith("/api/workloads/")) {
      return handleLocalWorkloadProxy(request, env, url);
    }

    return env.ASSETS.fetch(request);
  },
};

export const __test = {
  normalizeSchemaHints,
  normalizeFormState,
  patchFromAssistProgram,
  interpretAssistProgram,
  normalizeAssistPayload,
  buildEffectiveState,
};

async function handleAssistRequest(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON request body." }, 400);
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return jsonResponse({ error: "Prompt is required." }, 400);
  }

  const schemaHints = normalizeSchemaHints(body.schema_hints);
  const formState = normalizeFormState(body.form_state, schemaHints);
  const currentJson = normalizeCurrentJson(body.current_json);
  const conversation = normalizeConversation(body.conversation);
  const answers = normalizeAssistantAnswers(body.answers);
  if (!env.AI || typeof env.AI.run !== "function") {
    const configError =
      typeof env.AI_CONFIG_ERROR === "string" && env.AI_CONFIG_ERROR.trim()
        ? env.AI_CONFIG_ERROR.trim()
        : "ai_binding_unavailable";
    const missingOpenAiToken = configError === "openai_token_missing";
    const missingCloudflareCredentials =
      configError === "cloudflare_ai_credentials_missing";
    const missingAnyCredentials = configError === "ai_credentials_missing";
    return jsonResponse(
      {
        error: missingOpenAiToken
          ? "OPENAI_API_KEY is missing. Set it before using /api/assist."
          : missingCloudflareCredentials
            ? "Cloudflare AI credentials are missing. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN."
            : missingAnyCredentials
              ? "No AI provider is configured. Set either Cloudflare AI credentials or OPENAI_API_KEY."
              : "AI provider is not configured for /api/assist.",
        code: configError,
      },
      503,
    );
  }

  const aiConfig = getAiRequestConfig(env);
  let outcome;
  try {
    outcome = await runAssistantWithRetries(
      env,
      prompt,
      schemaHints,
      formState,
      currentJson,
      conversation,
      answers,
      aiConfig,
    );
  } catch (error) {
    console.error("Assist AI call failed:", error);
    logAssistFailureAiOutput("assist-error.exception", error, null);
    return jsonResponse(
      {
        error: "AI request failed.",
        code: "ai_request_failed",
        details: sanitizeErrorForClient(error),
      },
      502,
    );
  }

  if (!outcome || !outcome.payload || typeof outcome.payload !== "object") {
    logAssistFailureAiOutput("assist-error.ai_invalid_output", null, outcome);
    return jsonResponse(
      {
        error: "AI response could not be normalized into an assist payload.",
        code: "ai_invalid_output",
        debug: buildAiDebugFromOutcome(aiConfig, outcome),
      },
      502,
    );
  }

  const normalized = normalizeAssistPayload(
    outcome.payload,
    schemaHints,
    formState,
    prompt,
    {
      allowDeterministicStructureFallback: false,
      answers,
    },
  );
  normalized.source = "ai";
  const aiOutput = normalizeAiOutput(outcome.ai_output);
  if (aiOutput) {
    normalized.ai_output = aiOutput;
  }
  const aiTiming = buildAiTimingFromOutcome(outcome);
  if (aiTiming) {
    normalized.ai_timing = aiTiming;
  }
  return jsonResponse(normalized, 200);
}

async function handleLocalWorkloadProxy(request, env, requestUrl) {
  const baseUrl = getLocalWorkloadRunnerBaseUrl(env);
  if (!baseUrl) {
    return jsonResponse(
      {
        error: "LOCAL_TECTONIC_RUNNER_URL is not configured.",
        code: "local_runner_url_missing",
      },
      503,
    );
  }

  let targetUrl;
  try {
    targetUrl = new URL(requestUrl.pathname + requestUrl.search, baseUrl);
  } catch {
    return jsonResponse(
      {
        error: "LOCAL_TECTONIC_RUNNER_URL is invalid.",
        code: "local_runner_url_invalid",
      },
      503,
    );
  }

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("content-length");
  headers.set("x-forwarded-by", "tectonic-json-worker");

  const init = {
    method: request.method,
    headers,
    redirect: "manual",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
  }

  let upstreamResponse;
  try {
    upstreamResponse = await fetch(targetUrl.toString(), init);
  } catch (error) {
    const runnerOrigin = targetUrl.origin;
    return jsonResponse(
      {
        error: "Local workload runner is unreachable at " + runnerOrigin + ".",
        code: "local_runner_unreachable",
        runner_url: runnerOrigin,
        hint: [
          "Start it with `node src/local-tectonic-runner.mjs` (or `npm run dev:runner`) in a separate terminal.",
          "If it runs on another host/port, set LOCAL_TECTONIC_RUNNER_URL and restart the local dev server.",
        ].join(" "),
        details: sanitizeErrorForClient(error),
      },
      502,
    );
  }

  const responseHeaders = new Headers(upstreamResponse.headers);
  responseHeaders.delete("transfer-encoding");
  responseHeaders.delete("connection");

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: responseHeaders,
  });
}

function getLocalWorkloadRunnerBaseUrl(env) {
  const configured =
    env && typeof env.LOCAL_TECTONIC_RUNNER_URL === "string"
      ? env.LOCAL_TECTONIC_RUNNER_URL.trim()
      : "";
  return configured || "http://127.0.0.1:8788";
}

async function runAssistantWithRetries(
  env,
  prompt,
  schemaHints,
  formState,
  currentJson,
  conversation,
  answers,
  aiConfig,
) {
  const attempts = [];
  let lastAiOutput = null;
  const models =
    Array.isArray(aiConfig.modelNames) && aiConfig.modelNames.length > 0
      ? aiConfig.modelNames
      : [aiConfig.modelName || DEFAULT_CLOUDFLARE_MODEL];
  const attemptsPerModel = Math.max(1, aiConfig.retryAttempts);
  const totalAttempts = models.length * attemptsPerModel;

  for (const modelName of models) {
    for (let retryIndex = 0; retryIndex < attemptsPerModel; retryIndex += 1) {
      const attemptNumber = attempts.length + 1;
      const attemptMaxTokens =
        retryIndex === 0
          ? aiConfig.maxTokens
          : Math.min(
              900,
              Math.max(
                aiConfig.maxTokens,
                Math.floor(aiConfig.maxTokens * 1.8),
              ),
            );
      try {
        const outcome = await runAssistantOnce(
          env,
          prompt,
          schemaHints,
          formState,
          currentJson,
          conversation,
          answers,
          aiConfig,
          modelName,
          attemptMaxTokens,
        );
        const attemptTiming = normalizeAssistAttemptTiming(
          outcome && outcome.timing ? outcome.timing : null,
        );
        if (outcome && outcome.payload && typeof outcome.payload === "object") {
          const attemptEntry = {
            attempt: attemptNumber,
            model: modelName,
            max_tokens: attemptMaxTokens,
            status: "succeeded",
            ...attemptTiming,
          };
          attempts.push(attemptEntry);
          logAssistAttemptTiming(modelName, attemptNumber, attemptEntry);
          return {
            payload: outcome.payload,
            ai_output: normalizeAiOutput(outcome.ai_output),
            retry_attempts: totalAttempts,
            attempts,
            model: modelName,
            models,
            last_ai_output: normalizeAiOutput(outcome.ai_output),
          };
        }
        const attemptEntry = {
          attempt: attemptNumber,
          model: modelName,
          max_tokens: attemptMaxTokens,
          status: "empty_payload",
          message: "Assistant returned an empty payload.",
          ...attemptTiming,
        };
        attempts.push(attemptEntry);
        logAssistAttemptTiming(modelName, attemptNumber, attemptEntry);
        const emptyPayloadOutput = normalizeAiOutput(
          outcome && outcome.ai_output ? outcome.ai_output : null,
        );
        if (emptyPayloadOutput) {
          logFullAiOutputToStdout(
            "attempt-failed:" +
              modelName +
              ":attempt=" +
              attemptNumber +
              ":empty_payload",
            emptyPayloadOutput,
          );
          lastAiOutput = emptyPayloadOutput;
        } else {
          console.log(
            "[assist-ai:attempt-failed:" +
              modelName +
              ":attempt=" +
              attemptNumber +
              "] no_ai_output_available",
          );
        }
      } catch (error) {
        const sanitized = sanitizeErrorForClient(error);
        const simpleReason = getSimpleAssistFailureReason(sanitized);
        const attemptTiming = normalizeAssistAttemptTiming(sanitized);
        const attemptEntry = {
          attempt: attemptNumber,
          model: modelName,
          max_tokens: attemptMaxTokens,
          status: "failed",
          simple_reason: simpleReason,
          message: sanitized.message || "Unknown error",
          name: sanitized.name || "Error",
          ...attemptTiming,
        };
        console.log(
          "[assist-ai:attempt-failed:" +
            modelName +
            ":attempt=" +
            attemptNumber +
            "] reason=" +
            simpleReason,
        );
        if (sanitized.ai_output) {
          attemptEntry.ai_output = sanitized.ai_output;
          lastAiOutput = sanitized.ai_output;
          logFullAiOutputToStdout(
            "attempt-failed:" + modelName + ":attempt=" + attemptNumber,
            sanitized.ai_output,
          );
        }
        attempts.push(attemptEntry);
        logAssistAttemptTiming(modelName, attemptNumber, attemptEntry);
      }
    }
  }
  return {
    payload: null,
    retry_attempts: totalAttempts,
    models,
    attempts,
    last_ai_output: lastAiOutput,
  };
}

async function runAssistantOnce(
  env,
  prompt,
  schemaHints,
  formState,
  currentJson,
  conversation,
  answers,
  aiConfig,
  modelName,
  maxTokensOverride,
) {
  const attemptStartedAt = Date.now();
  const messages = buildAssistantMessages(
    prompt,
    schemaHints,
    formState,
    currentJson,
    conversation,
    answers,
    aiConfig,
  );
  const selectedModel =
    typeof modelName === "string" && modelName.trim()
      ? modelName.trim()
      : aiConfig.modelName;
  const selectedMaxTokens =
    Number.isFinite(maxTokensOverride) && maxTokensOverride > 0
      ? Math.floor(maxTokensOverride)
      : aiConfig.maxTokens;
  const responseFormat = buildAssistResponseFormat(aiConfig);
  const tools = buildAssistTools(aiConfig);
  const toolChoice = buildAssistToolChoice(aiConfig);
  const timing = {
    duration_ms: null,
    primary_response_ms: null,
    repair_response_ms: null,
    ai_response_count: 0,
  };
  const aiPromise = env.AI.run(selectedModel, {
    messages,
    max_tokens: selectedMaxTokens,
    temperature: aiConfig.temperature,
    response_format: responseFormat,
    tools,
    tool_choice: toolChoice,
  });
  let rawResult;
  const primaryStartedAt = Date.now();
  try {
    rawResult = await withTimeout(
      aiPromise,
      aiConfig.timeoutMs,
      "Workers AI timed out.",
    );
    timing.primary_response_ms = Date.now() - primaryStartedAt;
    timing.ai_response_count = 1;
  } catch (error) {
    timing.primary_response_ms = Date.now() - primaryStartedAt;
    timing.duration_ms = Date.now() - attemptStartedAt;
    if (error && typeof error === "object") {
      error.primary_response_ms = timing.primary_response_ms;
      error.duration_ms = timing.duration_ms;
      if (!Number.isFinite(error.ai_response_count)) {
        error.ai_response_count = 0;
      }
    }
    throw error;
  }

  const text = extractAiText(rawResult);
  if (!text) {
    const error = new Error("Workers AI returned no text.");
    error.ai_output = serializeForAiLog(rawResult);
    error.model_name = selectedModel;
    error.primary_response_ms = timing.primary_response_ms;
    error.ai_response_count = timing.ai_response_count;
    error.duration_ms = Date.now() - attemptStartedAt;
    throw error;
  }
  logFullAiOutputToStdout(
    "primary:" + selectedModel + ":max_tokens=" + selectedMaxTokens,
    text,
  );

  const parsed = parseJsonFromText(text);
  if (isAssistPayloadShape(parsed)) {
    timing.duration_ms = Date.now() - attemptStartedAt;
    return {
      payload: parsed,
      ai_output: text,
      timing,
    };
  }

  let repaired = null;
  const repairStartedAt = Date.now();
  try {
    repaired = await attemptJsonRepair(
      env,
      aiConfig,
      text,
      selectedModel,
      selectedMaxTokens,
    );
    timing.repair_response_ms = Date.now() - repairStartedAt;
    timing.ai_response_count = 2;
  } catch (error) {
    timing.repair_response_ms = Date.now() - repairStartedAt;
    timing.duration_ms = Date.now() - attemptStartedAt;
    if (error && typeof error === "object") {
      error.primary_response_ms = timing.primary_response_ms;
      error.repair_response_ms = timing.repair_response_ms;
      error.ai_response_count = timing.ai_response_count;
      error.duration_ms = timing.duration_ms;
      if (typeof error.model_name !== "string" || !error.model_name.trim()) {
        error.model_name = selectedModel;
      }
    }
    throw error;
  }
  if (repaired && repaired.payload && typeof repaired.payload === "object") {
    const stitched = [
      "[original-output]",
      text,
      "[repair-output]",
      repaired.ai_output || "",
    ].join("\n");
    timing.duration_ms = Date.now() - attemptStartedAt;
    return {
      payload: repaired.payload,
      ai_output: stitched,
      timing,
    };
  }

  const error = new Error("Workers AI did not return valid JSON.");
  error.ai_output = text;
  error.model_name = selectedModel;
  error.primary_response_ms = timing.primary_response_ms;
  error.repair_response_ms = timing.repair_response_ms;
  error.ai_response_count = timing.ai_response_count;
  error.duration_ms = Date.now() - attemptStartedAt;
  throw error;
}

function buildAssistantMessages(
  prompt,
  schemaHints,
  formState,
  currentJson,
  conversation,
  answers,
  aiConfig,
) {
  const systemLines = [
    "Generate one workload program JSON object only.",
    "No markdown or extra prose.",
    "The program must be sparse and conservative.",
    "This is a workload specification, not sample data.",
    "Do not generate example rows, record lists, query ids, or key/value samples.",
    "Interpret read-modify-write and rmw as merges.",
    "Interpret point reads as point_queries.",
    "Never add operations that are not explicitly requested or already enabled in current_form_state.",
    "Do not disable unrelated operations.",
    "Return keys: summary, program, clarifications, assumptions, questions, assumption_texts.",
    "Do not return patch.",
    "Program is an ordered array of commands.",
    "Use set_operation_fields for simple add/remove/edit prompts.",
    "Use set_group_operation_fields for edits scoped to one existing group.",
    "Use rename_group_operation when converting one operation in a group into another.",
    "Use append_group when the user asks for another/new/next/second/third group or a later phase group.",
    "Use replace_sections only when defining or rewriting the full layout.",
    "Tectonic semantics: same section shares valid keys; same group is interleaved; different groups in one section are phased.",
    "For phased prompts, prefer one section with multiple groups.",
    "Do not ask for sections_count/groups_per_section when the phase layout is clear.",
    "Group indexes and section indexes are 1-based.",
    "Allowed command kinds: set_top_field, clear_operations, set_operation_fields, append_group, set_group_operation_fields, rename_group_operation, replace_sections.",
    "set_operation_fields.operation must be one of the allowed operation names.",
    "set_group_operation_fields.operation must be one of the allowed operation names.",
    "set_operation_fields.fields is an array of { field, string_value, number_value, boolean_value, json_value }.",
    "set_group_operation_fields.fields is an array of { field, string_value, number_value, boolean_value, json_value }.",
    "append_group.group uses the compact structured layout with group.operations arrays or direct operation keys.",
    "replace_sections.sections uses the compact structured layout with section.groups[].operations arrays.",
    "Operation names must be exactly one of: inserts, updates, merges, point_queries, range_queries, point_deletes, range_deletes, empty_point_queries, empty_point_deletes, sorted.",
    "Field entries must use key field, not name.",
    "In set_operation_fields include only changed fields. Each field entry uses one of string_value, number_value, boolean_value, or json_value.",
    "Clarifications must ask for plain-language values only.",
    "clarifications[].binding.type must be one of: top_field, operation_field, operations_set.",
    "top_field.field must be one of: character_set, sections_count, groups_per_section, skip_key_contains_check.",
    "operation_field must include operation and field.",
    "input must be one of: number, enum, multi_enum, boolean, text.",
    "Allowed operation fields: enabled, character_set, op_count, key, val, selection, key_len, val_len, key_pattern, val_pattern, key_hot_len, key_hot_amount, key_hot_probability, val_hot_len, val_hot_amount, val_hot_probability, selection_distribution, selection_min, selection_max, selection_mean, selection_std_dev, selection_alpha, selection_beta, selection_n, selection_s, selection_lambda, selection_scale, selection_shape, selectivity, range_format, k, l.",
    "Allowed key/val patterns: uniform, weighted, segmented, hot_range.",
    "Use safe defaults when missing and list them in assumptions.",
    "Convert 1KB=1024, 100K=100000, 1M=1000000.",
  ];
  if (isOllamaAssistProvider(aiConfig && aiConfig.provider)) {
    systemLines.push(
      "For local models, prefer the smallest valid JSON response.",
      'A minimal valid response is: {"summary":"Updated the workload.","program":[],"clarifications":[],"assumptions":[],"questions":[],"assumption_texts":[]}.',
      "Do not invent placeholder field1/field2 names or sample datasets.",
      "If the prompt is clear, omit uncertain fields instead of guessing.",
    );
  }
  const systemMessage = systemLines.join("\n");

  const userMessage = JSON.stringify(
    buildCompactAssistContext(
      prompt,
      schemaHints,
      formState,
      currentJson,
      conversation,
      answers,
    ),
  );

  return [
    { role: "system", content: systemMessage },
    { role: "user", content: userMessage },
  ];
}

function buildCompactAssistContext(
  prompt,
  schemaHints,
  formState,
  currentJson,
  conversation,
  answers,
) {
  const interpretedRequest = canonicalizeAssistRequest(prompt);
  const payload = {
    request: prompt,
    current_form_state: compactAssistFormState(formState, schemaHints),
    schema_hints: compactAssistSchemaHints(schemaHints),
  };
  if (interpretedRequest !== prompt) {
    payload.interpreted_request = interpretedRequest;
  }
  const compactConversation = normalizeConversation(conversation);
  if (compactConversation.length > 0) {
    payload.conversation = compactConversation;
  }
  const compactAnswers = normalizeAssistantAnswers(answers);
  if (Object.keys(compactAnswers).length > 0) {
    payload.answers = compactAnswers;
  }
  const compactJson = compactAssistCurrentJson(currentJson);
  if (compactJson !== null) {
    payload.current_generated_json = compactJson;
  }
  return payload;
}

function canonicalizeAssistRequest(prompt) {
  const input = typeof prompt === "string" ? prompt : "";
  if (!input) {
    return "";
  }
  return input
    .replace(/\bread[- ]?modify[- ]?write\b/gi, "merges")
    .replace(/\brmw\b/gi, "merges")
    .replace(/\bpoint reads\b/gi, "point queries");
}

function compactAssistSchemaHints(schemaHints) {
  const compactCapabilities = {};
  (schemaHints.operation_order || []).forEach((operationName) => {
    const capabilities =
      schemaHints.capabilities && schemaHints.capabilities[operationName]
        ? schemaHints.capabilities[operationName]
        : {};
    compactCapabilities[operationName] = Object.keys(capabilities).filter(
      (key) => capabilities[key] === true,
    );
  });
  return {
    operation_order: schemaHints.operation_order || [],
    character_sets: schemaHints.character_sets || [],
    range_formats: schemaHints.range_formats || [],
    selection_distributions: schemaHints.selection_distributions || [],
    string_patterns: schemaHints.string_patterns || [],
    capabilities: compactCapabilities,
  };
}

function compactAssistFormState(formState, schemaHints) {
  const input = formState && typeof formState === "object" ? formState : {};
  const compact = {};
  if (typeof input.character_set === "string" && input.character_set.trim()) {
    compact.character_set = input.character_set;
  }
  if (Number.isFinite(input.sections_count)) {
    compact.sections_count = input.sections_count;
  }
  if (Number.isFinite(input.groups_per_section)) {
    compact.groups_per_section = input.groups_per_section;
  }
  if (input.skip_key_contains_check === true) {
    compact.skip_key_contains_check = true;
  }
  const compactOperations = {};
  (schemaHints.operation_order || []).forEach((operationName) => {
    const operation =
      input.operations && input.operations[operationName]
        ? input.operations[operationName]
        : null;
    if (!operation || operation.enabled !== true) {
      return;
    }
    const nextOperation = {
      enabled: true,
      ...stripNullFields(stripEnabledFromOperationPatch(operation)),
    };
    compactOperations[operationName] = nextOperation;
  });
  if (Object.keys(compactOperations).length > 0) {
    compact.operations = compactOperations;
  }
  if (Array.isArray(input.sections) && input.sections.length > 0) {
    const compactSections = compactAssistSections(input.sections);
    if (compactSections.length > 0) {
      compact.sections = compactSections;
    }
  }
  return compact;
}

function compactAssistSections(sections) {
  return sections
    .map((section) => {
      if (!section || !Array.isArray(section.groups)) {
        return null;
      }
      const nextSection = {
        groups: section.groups
          .map((group) => compactAssistGroup(group))
          .filter((group) => group && Object.keys(group).length > 0),
      };
      if (typeof section.character_set === "string" && section.character_set) {
        nextSection.character_set = section.character_set;
      }
      if (section.skip_key_contains_check === true) {
        nextSection.skip_key_contains_check = true;
      }
      return nextSection.groups.length > 0 ? nextSection : null;
    })
    .filter(Boolean);
}

function compactAssistGroup(group) {
  if (!group || typeof group !== "object") {
    return null;
  }
  const nextGroup = {};
  Object.entries(group).forEach(([operationName, operationSpec]) => {
    if (!operationSpec || typeof operationSpec !== "object") {
      return;
    }
    nextGroup[operationName] = stripNullFields(operationSpec);
  });
  return nextGroup;
}

function compactAssistCurrentJson(currentJson) {
  const normalized = normalizeCurrentJson(currentJson);
  if (!normalized || typeof normalized !== "object") {
    return null;
  }
  if (
    Array.isArray(normalized.sections) &&
    normalized.sections.length > 0 &&
    Object.keys(normalized).length <= 3
  ) {
    return {
      character_set: normalized.character_set || null,
      sections: compactAssistSections(normalized.sections),
    };
  }
  return null;
}

function stripNullFields(value) {
  const input = value && typeof value === "object" ? value : {};
  const next = {};
  Object.entries(input).forEach(([key, fieldValue]) => {
    if (fieldValue === null || fieldValue === undefined) {
      return;
    }
    next[key] = sanitizeSerializableValue(fieldValue);
  });
  return next;
}

async function attemptJsonRepair(
  env,
  aiConfig,
  rawOutputText,
  modelName,
  maxTokensHint,
) {
  const repairSystem = [
    "Convert the input into strict JSON only.",
    "Do not output markdown, code blocks, Python, comments, or explanations.",
    "Extract/repair into exactly one JSON object with keys: summary, program, clarifications, assumptions, questions, assumption_texts.",
    "If the input contains code, ignore code and output the JSON object only.",
  ].join("\n");
  const repairUser = JSON.stringify({ raw_output: rawOutputText });

  const baseTokens =
    Number.isFinite(maxTokensHint) && maxTokensHint > 0
      ? maxTokensHint
      : aiConfig.maxTokens;
  const repairMaxTokens = clamp(Math.floor(baseTokens * 1.1), 180, 900);
  const repairTimeout = isOllamaAssistProvider(aiConfig.provider)
    ? Math.max(5000, Math.min(aiConfig.timeoutMs, 30000))
    : Math.max(3000, Math.min(aiConfig.timeoutMs, 12000));
  const selectedModel =
    typeof modelName === "string" && modelName.trim()
      ? modelName.trim()
      : aiConfig.modelName;
  const responseFormat = buildAssistResponseFormat(aiConfig);
  const tools = buildAssistTools(aiConfig);
  const toolChoice = buildAssistToolChoice(aiConfig);
  const repairPromise = env.AI.run(selectedModel, {
    messages: [
      { role: "system", content: repairSystem },
      { role: "user", content: repairUser },
    ],
    max_tokens: repairMaxTokens,
    temperature: 0,
    response_format: responseFormat,
    tools,
    tool_choice: toolChoice,
  });
  const repairResult = await withTimeout(
    repairPromise,
    repairTimeout,
    "Workers AI repair pass timed out.",
  );
  const repairText = extractAiText(repairResult);
  if (!repairText) {
    return null;
  }
  logFullAiOutputToStdout(
    "repair:" + selectedModel + ":max_tokens=" + repairMaxTokens,
    repairText,
  );
  const parsed = parseJsonFromText(repairText);
  if (!isAssistPayloadShape(parsed)) {
    return null;
  }
  return {
    payload: parsed,
    ai_output: repairText,
  };
}

function normalizeSchemaHints(rawHints) {
  const hints = rawHints && typeof rawHints === "object" ? rawHints : {};
  const operationOrder = Array.isArray(hints.operation_order)
    ? hints.operation_order.filter(
        (value) => typeof value === "string" && value.trim() !== "",
      )
    : [];
  const operationLabels =
    hints.operation_labels && typeof hints.operation_labels === "object"
      ? hints.operation_labels
      : {};
  const characterSets = Array.isArray(hints.character_sets)
    ? hints.character_sets.filter(
        (value) => typeof value === "string" && value.trim() !== "",
      )
    : [];
  const rangeFormats = Array.isArray(hints.range_formats)
    ? hints.range_formats.filter(
        (value) => typeof value === "string" && value.trim() !== "",
      )
    : [];
  const selectionDistributions = Array.isArray(hints.selection_distributions)
    ? hints.selection_distributions.filter(
        (value) => typeof value === "string" && value.trim() !== "",
      )
    : [];
  const stringPatterns = Array.isArray(hints.string_patterns)
    ? hints.string_patterns.filter(
        (value) => typeof value === "string" && value.trim() !== "",
      )
    : [];
  const capabilities =
    hints.capabilities && typeof hints.capabilities === "object"
      ? hints.capabilities
      : {};

  return {
    operation_order:
      operationOrder.length > 0
        ? operationOrder
        : [...FALLBACK_OPERATION_ORDER],
    operation_labels: operationLabels,
    character_sets:
      characterSets.length > 0
        ? characterSets
        : ["alphanumeric", "alphabetic", "numeric"],
    range_formats:
      rangeFormats.length > 0 ? rangeFormats : ["StartCount", "StartEnd"],
    selection_distributions:
      selectionDistributions.length > 0
        ? selectionDistributions
        : [...DEFAULT_SELECTION_DISTRIBUTIONS],
    string_patterns:
      stringPatterns.length > 0 ? stringPatterns : [...STRING_PATTERN_VALUES],
    capabilities,
  };
}

function normalizeFormState(rawState, schemaHints) {
  const input = rawState && typeof rawState === "object" ? rawState : {};
  const operations = {};
  schemaHints.operation_order.forEach((op) => {
    const rawOperation =
      input.operations && typeof input.operations === "object"
        ? input.operations[op]
        : null;
    operations[op] = normalizeOperationPatch(rawOperation, op, schemaHints);
    operations[op].enabled = !!(rawOperation && rawOperation.enabled === true);
  });

  const characterSet = normalizeCharacterSetValue(
    input.character_set,
    schemaHints,
  );
  let sections = normalizeSectionsValue(input.sections, schemaHints);
  if (sections.length === 0) {
    sections = synthesizeSectionsFromFlatState(
      {
        character_set: characterSet,
        sections_count: positiveIntegerOrNull(input.sections_count),
        groups_per_section: positiveIntegerOrNull(input.groups_per_section),
        skip_key_contains_check: input.skip_key_contains_check === true,
        operations,
      },
      schemaHints,
    );
  }
  const aggregatedOperations = buildAggregateOperationsFromSections(
    sections,
    schemaHints,
    operations,
  );

  return {
    character_set: characterSet,
    sections_count:
      positiveIntegerOrNull(input.sections_count) ??
      (sections.length > 0 ? sections.length : null),
    groups_per_section:
      positiveIntegerOrNull(input.groups_per_section) ??
      maxGroupsPerSection(sections),
    skip_key_contains_check:
      input.skip_key_contains_check === true ||
      sections.some((section) => section.skip_key_contains_check === true),
    operations: aggregatedOperations,
    sections,
  };
}

function normalizeCurrentJson(rawJson) {
  if (!rawJson || typeof rawJson !== "object" || Array.isArray(rawJson)) {
    return null;
  }
  try {
    return JSON.parse(JSON.stringify(rawJson));
  } catch {
    return null;
  }
}

function normalizeConversation(rawConversation) {
  if (!Array.isArray(rawConversation)) {
    return [];
  }
  return rawConversation
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const role =
        entry.role === "assistant"
          ? "assistant"
          : entry.role === "user"
            ? "user"
            : null;
      const text = typeof entry.text === "string" ? entry.text.trim() : "";
      if (!role || !text) {
        return null;
      }
      return { role, text };
    })
    .filter(Boolean)
    .slice(-30);
}

function normalizeAssistantAnswers(rawAnswers) {
  if (
    !rawAnswers ||
    typeof rawAnswers !== "object" ||
    Array.isArray(rawAnswers)
  ) {
    return {};
  }
  const normalized = {};
  Object.entries(rawAnswers).forEach(([key, value]) => {
    if (typeof key !== "string" || !key.trim()) {
      return;
    }
    if (value === null || value === undefined) {
      return;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        normalized[key] = trimmed;
      }
      return;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      normalized[key] = value;
      return;
    }
    if (Array.isArray(value)) {
      normalized[key] = value
        .map((item) => String(item || "").trim())
        .filter((item) => item.length > 0)
        .slice(0, 32);
      return;
    }
    if (typeof value === "object") {
      try {
        normalized[key] = JSON.parse(JSON.stringify(value));
      } catch {
        // Ignore non-serializable answers.
      }
    }
  });
  return normalized;
}

function readTypedAssistFieldValue(fieldEntry) {
  if (!fieldEntry || typeof fieldEntry !== "object") {
    return undefined;
  }
  if (
    fieldEntry.boolean_value !== null &&
    fieldEntry.boolean_value !== undefined
  ) {
    return fieldEntry.boolean_value;
  }
  if (
    fieldEntry.number_value !== null &&
    fieldEntry.number_value !== undefined
  ) {
    return fieldEntry.number_value;
  }
  if (
    fieldEntry.string_value !== null &&
    fieldEntry.string_value !== undefined
  ) {
    return fieldEntry.string_value;
  }
  if (
    fieldEntry.json_value !== null &&
    fieldEntry.json_value !== undefined
  ) {
    if (typeof fieldEntry.json_value === "string") {
      const parsed = safeJsonParse(fieldEntry.json_value);
      return parsed === null ? fieldEntry.json_value : parsed;
    }
    return fieldEntry.json_value;
  }
  return null;
}

function buildOperationFieldPatchFromProgramFields(fields) {
  const patch = {};
  if (!Array.isArray(fields)) {
    return patch;
  }
  fields.forEach((fieldEntry) => {
    const fieldName =
      fieldEntry && typeof fieldEntry.field === "string"
        ? fieldEntry.field.trim()
        : "";
    if (!fieldName) {
      return;
    }
    const value = readTypedAssistFieldValue(fieldEntry);
    if (value === undefined) {
      return;
    }
    patch[fieldName] = value;
  });
  return patch;
}

function topFieldValueFromProgramCommand(command) {
  if (!command || typeof command !== "object") {
    return undefined;
  }
  if (
    command.boolean_value !== null &&
    command.boolean_value !== undefined
  ) {
    return command.boolean_value;
  }
  if (command.number_value !== null && command.number_value !== undefined) {
    return command.number_value;
  }
  if (command.string_value !== null && command.string_value !== undefined) {
    return command.string_value;
  }
  return undefined;
}

function canonicalizeAssistProgramCommand(command) {
  if (!command || typeof command !== "object" || Array.isArray(command)) {
    return null;
  }
  const normalizeAliases = (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return value;
    }
    const normalized = { ...value };
    if (
      !Array.isArray(normalized.fields) &&
      Array.isArray(normalized.operation_fields)
    ) {
      normalized.fields = normalized.operation_fields;
    }
    if (
      (normalized.group_index === null ||
        normalized.group_index === undefined) &&
      !isPlainObject(normalized.group)
    ) {
      const aliasedGroupIndex = positiveIntegerOrNull(normalized.group);
      if (aliasedGroupIndex) {
        normalized.group_index = aliasedGroupIndex;
      }
    }
    if (
      (normalized.section_index === null ||
        normalized.section_index === undefined) &&
      !isPlainObject(normalized.section)
    ) {
      const aliasedSectionIndex = positiveIntegerOrNull(normalized.section);
      if (aliasedSectionIndex) {
        normalized.section_index = aliasedSectionIndex;
      }
    }
    if (
      !normalized.from_operation &&
      typeof normalized.from === "string" &&
      normalized.from.trim()
    ) {
      normalized.from_operation = normalized.from.trim();
    }
    if (
      !normalized.from_operation &&
      typeof normalized.old_operation === "string" &&
      normalized.old_operation.trim()
    ) {
      normalized.from_operation = normalized.old_operation.trim();
    }
    if (
      !normalized.to_operation &&
      typeof normalized.to === "string" &&
      normalized.to.trim()
    ) {
      normalized.to_operation = normalized.to.trim();
    }
    if (
      !normalized.to_operation &&
      typeof normalized.new_operation === "string" &&
      normalized.new_operation.trim()
    ) {
      normalized.to_operation = normalized.new_operation.trim();
    }
    return normalized;
  };
  const directKind =
    typeof command.kind === "string" && command.kind.trim()
      ? command.kind.trim()
      : typeof command.command === "string" && command.command.trim()
        ? command.command.trim()
        : typeof command.operation === "string" &&
            [
              "set_top_field",
              "clear_operations",
              "set_operation_fields",
              "append_group",
              "set_group_operation_fields",
              "rename_group_operation",
              "replace_sections",
            ].includes(command.operation.trim())
          ? command.operation.trim()
        : "";
  if (directKind) {
    return normalizeAliases({
      ...command,
      kind: directKind,
    });
  }
  const knownKinds = [
    "set_top_field",
    "clear_operations",
    "set_operation_fields",
    "append_group",
    "set_group_operation_fields",
    "rename_group_operation",
    "replace_sections",
  ];
  const nestedKind = knownKinds.find((kind) =>
    Object.prototype.hasOwnProperty.call(command, kind),
  );
  if (!nestedKind) {
    const inferredKind =
      Array.isArray(command.sections)
        ? "replace_sections"
        : isPlainObject(command.group)
          ? "append_group"
          : (typeof command.from_operation === "string" ||
                typeof command.from === "string") &&
              (typeof command.to_operation === "string" ||
                typeof command.to === "string")
            ? "rename_group_operation"
            : Array.isArray(command.fields) ||
                Array.isArray(command.operation_fields)
              ? positiveIntegerOrNull(command.group_index ?? command.group)
                ? "set_group_operation_fields"
                : typeof command.operation === "string" && command.operation.trim()
                  ? "set_operation_fields"
                  : null
              : typeof command.field === "string" &&
                  (command.boolean_value !== undefined ||
                    command.number_value !== undefined ||
                    command.string_value !== undefined)
                ? "set_top_field"
                : null;
    if (!inferredKind) {
      return null;
    }
    return normalizeAliases({
      ...command,
      kind: inferredKind,
    });
  }
  const payload = command[nestedKind];
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return normalizeAliases({ kind: nestedKind });
  }
  return normalizeAliases({
    ...payload,
    kind: nestedKind,
  });
}

function ensureProgramStructuralSections(rawPatch, formState, schemaHints) {
  if (Array.isArray(rawPatch.sections)) {
    return rawPatch.sections;
  }
  const hasExistingOperations =
    getEnabledOperationNames(formState || { operations: {} }, schemaHints)
      .length > 0;
  const clonedSections =
    hasExistingOperations && Array.isArray(formState?.sections)
      ? normalizeSectionsValue(cloneJsonValue(formState.sections), schemaHints)
      : [];
  rawPatch.sections =
    clonedSections.length > 0 ? clonedSections : [{ groups: [] }];
  return rawPatch.sections;
}

function ensureProgramSection(rawPatch, formState, schemaHints, sectionIndex) {
  const safeSectionIndex = positiveIntegerOrNull(sectionIndex) || 1;
  const sections = ensureProgramStructuralSections(rawPatch, formState, schemaHints);
  while (sections.length < safeSectionIndex) {
    sections.push({ groups: [] });
  }
  const section = sections[safeSectionIndex - 1];
  if (!section || typeof section !== "object" || Array.isArray(section)) {
    sections[safeSectionIndex - 1] = { groups: [] };
  } else if (!Array.isArray(section.groups)) {
    section.groups = [];
  }
  return sections[safeSectionIndex - 1];
}

function ensureProgramGroup(
  rawPatch,
  formState,
  schemaHints,
  sectionIndex,
  groupIndex,
) {
  const safeGroupIndex = positiveIntegerOrNull(groupIndex) || 1;
  const section = ensureProgramSection(
    rawPatch,
    formState,
    schemaHints,
    sectionIndex,
  );
  while (section.groups.length < safeGroupIndex) {
    section.groups.push({});
  }
  const group = section.groups[safeGroupIndex - 1];
  if (!group || typeof group !== "object" || Array.isArray(group)) {
    section.groups[safeGroupIndex - 1] = {};
  }
  return section.groups[safeGroupIndex - 1];
}

function finalizeProgramStructuralPatch(rawPatch, schemaHints) {
  if (!Array.isArray(rawPatch.sections)) {
    return;
  }
  const normalizedSections = normalizeSectionsValue(rawPatch.sections, schemaHints);
  rawPatch.sections = normalizedSections;
  rawPatch.sections_count = normalizedSections.length;
  rawPatch.groups_per_section = maxGroupsPerSection(normalizedSections);
}

function resolveProgramGroupOperationName(group, operationName, schemaHints) {
  if (
    typeof operationName === "string" &&
    schemaHints.operation_order.includes(operationName.trim())
  ) {
    return operationName.trim();
  }
  const configuredOperations = schemaHints.operation_order.filter((op) =>
    Object.prototype.hasOwnProperty.call(group || {}, op),
  );
  return configuredOperations.length === 1 ? configuredOperations[0] : "";
}

function patchFromAssistProgram(rawProgram, schemaHints, formState = null) {
  if (!Array.isArray(rawProgram)) {
    return null;
  }
  const rawPatch = {
    clear_operations: false,
    operations: {},
  };
  let touchedStructure = false;
  rawProgram.forEach((command) => {
    const normalizedCommand = canonicalizeAssistProgramCommand(command);
    if (!normalizedCommand) {
      return;
    }
    const kind =
      typeof normalizedCommand.kind === "string"
        ? normalizedCommand.kind.trim()
        : "";
    if (kind === "clear_operations") {
      rawPatch.clear_operations = true;
      rawPatch.operations = {};
      return;
    }
    if (kind === "set_top_field") {
      const field =
        typeof normalizedCommand.field === "string"
          ? normalizedCommand.field.trim()
          : "";
      const value = topFieldValueFromProgramCommand(normalizedCommand);
      if (field === "character_set" && typeof value === "string") {
        rawPatch.character_set = value;
      } else if (
        (field === "sections_count" || field === "groups_per_section") &&
        (typeof value === "number" || typeof value === "string")
      ) {
        rawPatch[field] =
          typeof value === "number" ? value : parseHumanCountToken(value);
      } else if (
        field === "skip_key_contains_check" &&
        typeof value === "boolean"
      ) {
        rawPatch.skip_key_contains_check = value;
      }
      return;
    }
    if (kind === "set_operation_fields") {
      const operationName =
        typeof normalizedCommand.operation === "string"
          ? normalizedCommand.operation.trim()
          : "";
      if (!schemaHints.operation_order.includes(operationName)) {
        return;
      }
      const nextFields = buildOperationFieldPatchFromProgramFields(
        normalizedCommand.fields,
      );
      if (
        Object.keys(nextFields).length > 0 &&
        !Object.prototype.hasOwnProperty.call(nextFields, "enabled")
      ) {
        nextFields.enabled = true;
      }
      rawPatch.operations[operationName] = {
        ...(rawPatch.operations[operationName] || {}),
        ...nextFields,
      };
      return;
    }
    if (kind === "append_group") {
      const section = ensureProgramSection(
        rawPatch,
        formState,
        schemaHints,
        normalizedCommand.section_index,
      );
      const nextGroup = normalizeGroupValue(normalizedCommand.group, schemaHints);
      const afterGroupIndex = positiveIntegerOrNull(
        normalizedCommand.after_group_index,
      );
      const insertIndex = afterGroupIndex
        ? Math.min(afterGroupIndex, section.groups.length)
        : section.groups.length;
      section.groups.splice(insertIndex, 0, nextGroup);
      touchedStructure = true;
      return;
    }
    if (kind === "set_group_operation_fields") {
      const group = ensureProgramGroup(
        rawPatch,
        formState,
        schemaHints,
        normalizedCommand.section_index,
        normalizedCommand.group_index,
      );
      const operationName = resolveProgramGroupOperationName(
        group,
        normalizedCommand.operation,
        schemaHints,
      );
      if (!operationName) {
        return;
      }
      const nextFields = buildOperationFieldPatchFromProgramFields(
        normalizedCommand.fields,
      );
      if (
        Object.keys(nextFields).length > 0 &&
        !Object.prototype.hasOwnProperty.call(nextFields, "enabled")
      ) {
        nextFields.enabled = true;
      }
      const merged = normalizeOperationPatch(
        {
          ...(isPlainObject(group[operationName]) ? cloneJsonValue(group[operationName]) : {}),
          ...nextFields,
        },
        operationName,
        schemaHints,
      );
      if (
        merged.enabled === false ||
        !operationPatchHasConfiguredValues(merged)
      ) {
        delete group[operationName];
      } else {
        group[operationName] = stripEnabledFromOperationPatch(merged);
      }
      touchedStructure = true;
      return;
    }
    if (kind === "rename_group_operation") {
      const fromOperation =
        typeof normalizedCommand.from_operation === "string"
          ? normalizedCommand.from_operation.trim()
          : "";
      const toOperation =
        typeof normalizedCommand.to_operation === "string"
          ? normalizedCommand.to_operation.trim()
          : "";
      if (
        !schemaHints.operation_order.includes(fromOperation) ||
        !schemaHints.operation_order.includes(toOperation)
      ) {
        return;
      }
      const group = ensureProgramGroup(
        rawPatch,
        formState,
        schemaHints,
        normalizedCommand.section_index,
        normalizedCommand.group_index,
      );
      const sourceValue = isPlainObject(group[fromOperation])
        ? cloneJsonValue(group[fromOperation])
        : null;
      if (!sourceValue) {
        return;
      }
      const renamed = normalizeOperationPatch(
        {
          ...sourceValue,
          ...(isPlainObject(group[toOperation]) ? cloneJsonValue(group[toOperation]) : {}),
          enabled: true,
        },
        toOperation,
        schemaHints,
      );
      delete group[fromOperation];
      if (
        renamed.enabled === false ||
        !operationPatchHasConfiguredValues(renamed)
      ) {
        delete group[toOperation];
      } else {
        group[toOperation] = stripEnabledFromOperationPatch(renamed);
      }
      touchedStructure = true;
      return;
    }
    if (kind === "replace_sections") {
      rawPatch.sections = normalizeSectionsValue(
        Array.isArray(normalizedCommand.sections)
          ? normalizedCommand.sections
          : [],
        schemaHints,
      );
      touchedStructure = true;
    }
  });
  if (touchedStructure) {
    finalizeProgramStructuralPatch(rawPatch, schemaHints);
  }
  return rawPatch;
}

function interpretAssistProgram(rawProgram, schemaHints, formState = null) {
  return normalizePatch(
    patchFromAssistProgram(rawProgram, schemaHints, formState),
    schemaHints,
  );
}

function assistProgramHasStructuralCommands(rawProgram) {
  if (!Array.isArray(rawProgram)) {
    return false;
  }
  return rawProgram.some((entry) => {
    const normalized = canonicalizeAssistProgramCommand(entry);
    if (!normalized || typeof normalized.kind !== "string") {
      return false;
    }
    return [
      "append_group",
      "set_group_operation_fields",
      "rename_group_operation",
      "replace_sections",
    ].includes(normalized.kind);
  });
}

function configuredGroupOperationNames(group, schemaHints) {
  return (schemaHints.operation_order || []).filter((operationName) =>
    Object.prototype.hasOwnProperty.call(group || {}, operationName),
  );
}

function normalizeSectionsFromStateLike(value, schemaHints) {
  if (Array.isArray(value)) {
    return normalizeSectionsValue(value, schemaHints);
  }
  if (value && Array.isArray(value.sections)) {
    return normalizeSectionsValue(value.sections, schemaHints);
  }
  return [];
}

function normalizeCurrentSectionsForIntentChecks(value, schemaHints) {
  const explicitSections = normalizeSectionsFromStateLike(value, schemaHints);
  if (!value || typeof value !== "object") {
    return explicitSections;
  }
  const operations =
    value.operations && typeof value.operations === "object"
      ? value.operations
      : {};
  const hasEnabledOperations = schemaHints.operation_order.some(
    (operationName) =>
      operations[operationName] && operations[operationName].enabled === true,
  );
  if (
    explicitSections.length > 0 &&
    (!hasEnabledOperations ||
      !sectionsNeedSynthesisFromFlatOperations(
        explicitSections,
        operations,
        schemaHints,
      ))
  ) {
    return explicitSections;
  }
  if (!hasEnabledOperations) {
    return explicitSections;
  }
  return synthesizeSectionsFromFlatState(
    {
      character_set:
        typeof value.character_set === "string" ? value.character_set : null,
      sections_count: value.sections_count ?? null,
      groups_per_section: value.groups_per_section ?? null,
      skip_key_contains_check: value.skip_key_contains_check === true,
      operations,
    },
    schemaHints,
  );
}

function aiExpandedSectionsLayout(patch, formState, schemaHints) {
  const currentSections = normalizeCurrentSectionsForIntentChecks(
    formState,
    schemaHints,
  );
  const nextSections = normalizeSectionsFromStateLike(patch, schemaHints);
  const currentGroupCount =
    currentSections[0] && Array.isArray(currentSections[0].groups)
      ? currentSections[0].groups.length
      : 0;
  const nextGroupCount =
    nextSections[0] && Array.isArray(nextSections[0].groups)
      ? nextSections[0].groups.length
      : 0;
  return (
    nextSections.length > currentSections.length ||
    nextGroupCount > currentGroupCount
  );
}

function aiSatisfiedStructuredLayoutEditIntent(
  patch,
  formState,
  prompt,
  schemaHints,
) {
  if (!aiExpandedSectionsLayout(patch, formState, schemaHints)) {
    return false;
  }
  const currentSections = canonicalizeSectionsForStructuredEdit(
    normalizeCurrentSectionsForIntentChecks(formState, schemaHints),
    schemaHints,
  );
  const nextSections = canonicalizeSectionsForStructuredEdit(
    patch && Array.isArray(patch.sections) ? patch.sections : [],
    schemaHints,
  );
  const derivedSections = canonicalizeSectionsForStructuredEdit(
    deriveStructuredSectionsFromPrompt(prompt, schemaHints) || [],
    schemaHints,
  );
  if (
    currentSections.length === 0 ||
    nextSections.length === 0 ||
    derivedSections.length === 0 ||
    !Array.isArray(currentSections[0].groups) ||
    !Array.isArray(nextSections[0].groups) ||
    !Array.isArray(derivedSections[0].groups)
  ) {
    return false;
  }
  const currentGroups = currentSections[0].groups;
  const derivedGroups = derivedSections[0].groups;
  const appendedGroups = nextSections[0].groups.slice(currentGroups.length);
  if (appendedGroups.length < derivedGroups.length) {
    return false;
  }
  return derivedGroups.every((group, index) =>
    groupSemanticallyMatches(appendedGroups[index], group),
  );
}

function aiSatisfiedExplicitGroupAppendIntent(
  patch,
  formState,
  schemaHints,
  answers,
) {
  if (!aiExpandedSectionsLayout(patch, formState, schemaHints)) {
    return false;
  }
  const currentSections = normalizeCurrentSectionsForIntentChecks(
    formState,
    schemaHints,
  );
  const nextSections = normalizeSectionsFromStateLike(patch, schemaHints);
  const currentGroupCount =
    currentSections[0] && Array.isArray(currentSections[0].groups)
      ? currentSections[0].groups.length
      : 0;
  const appendedGroup =
    nextSections[0] &&
    Array.isArray(nextSections[0].groups) &&
    nextSections[0].groups.length > currentGroupCount
      ? nextSections[0].groups[currentGroupCount]
      : null;
  if (!appendedGroup) {
    return false;
  }
  const nextOps = new Set(configuredGroupOperationNames(appendedGroup, schemaHints));
  if (nextOps.size === 0) {
    return false;
  }
  const answeredOps = extractAnsweredOperationsSet(answers, schemaHints);
  if (answeredOps.length === 0) {
    return true;
  }
  return answeredOps.every((operationName) => nextOps.has(operationName));
}

function aiSatisfiedTargetedGroupEditIntent(
  patch,
  formState,
  prompt,
  schemaHints,
) {
  const target = extractExplicitGroupTarget(prompt, formState, schemaHints);
  if (!target) {
    return false;
  }
  const currentSections = normalizeCurrentSectionsForIntentChecks(
    formState,
    schemaHints,
  );
  const nextSections = normalizeSectionsFromStateLike(patch, schemaHints);
  const currentGroup =
    currentSections[target.sectionIndex] &&
    Array.isArray(currentSections[target.sectionIndex].groups)
      ? currentSections[target.sectionIndex].groups[target.groupIndex]
      : null;
  const nextGroup =
    nextSections[target.sectionIndex] &&
    Array.isArray(nextSections[target.sectionIndex].groups)
      ? nextSections[target.sectionIndex].groups[target.groupIndex]
      : null;
  if (!nextGroup) {
    return false;
  }
  if (currentSections.length !== nextSections.length) {
    return false;
  }
  for (let sectionIndex = 0; sectionIndex < currentSections.length; sectionIndex += 1) {
    const currentGroups =
      currentSections[sectionIndex] &&
      Array.isArray(currentSections[sectionIndex].groups)
        ? currentSections[sectionIndex].groups
        : [];
    const nextGroups =
      nextSections[sectionIndex] &&
      Array.isArray(nextSections[sectionIndex].groups)
        ? nextSections[sectionIndex].groups
        : [];
    if (currentGroups.length !== nextGroups.length) {
      return false;
    }
    for (let groupIndex = 0; groupIndex < currentGroups.length; groupIndex += 1) {
      if (
        sectionIndex === target.sectionIndex &&
        groupIndex === target.groupIndex
      ) {
        continue;
      }
      if (
        JSON.stringify(currentGroups[groupIndex]) !==
        JSON.stringify(nextGroups[groupIndex])
      ) {
        return false;
      }
    }
  }
  const replacement = extractPromptOperationReplacement(prompt, schemaHints);
  if (
    replacement &&
    replacement.sourceOperation &&
    replacement.targetOperation &&
    replacement.sourceOperation !== replacement.targetOperation
  ) {
    return (
      !Object.prototype.hasOwnProperty.call(
        nextGroup,
        replacement.sourceOperation,
      ) &&
      Object.prototype.hasOwnProperty.call(
        nextGroup,
        replacement.targetOperation,
      )
    );
  }
  const mentionedOperations = getMentionedOperationsFromPrompt(prompt, schemaHints);
  if (mentionedOperations.length > 0) {
    const nextOperations = configuredGroupOperationNames(nextGroup, schemaHints);
    if (
      !mentionedOperations.every((operationName) =>
        nextOperations.includes(operationName),
      )
    ) {
      return false;
    }
  }
  return JSON.stringify(currentGroup) !== JSON.stringify(nextGroup);
}

function normalizeAssistPayload(
  rawPayload,
  schemaHints,
  formState,
  prompt,
  options = {},
) {
  const payload =
    rawPayload && typeof rawPayload === "object" ? rawPayload : {};
  const programHasStructuralCommands = assistProgramHasStructuralCommands(
    payload.program,
  );
  const patch = normalizePatch(
    patchFromAssistProgram(payload.program, schemaHints, formState) ||
      payload.patch,
    schemaHints,
  );
  const structuredPrompt = isStructuredWorkloadPrompt(prompt);
  const structuredLayoutEditRequested =
    structuredPrompt &&
    !promptDefinesFreshStructuredWorkload(prompt, formState, schemaHints) &&
    promptRequestsStructuredLayoutEdit(prompt);
  const explicitGroupAppendRequested =
    !structuredPrompt && promptRequestsExplicitGroupAppend(prompt);
  const explicitGroupTarget = extractExplicitGroupTarget(
    prompt,
    formState,
    schemaHints,
  );
  const structuredPromptOwnsLayout =
    structuredPrompt &&
    promptDefinesFreshStructuredWorkload(prompt, formState, schemaHints);
  if (
    !structuredPrompt &&
    !structuredLayoutEditRequested &&
    !explicitGroupAppendRequested &&
    !explicitGroupTarget
  ) {
    collapseUnexpectedStructuredPatchToOperations(patch, schemaHints);
    if (!patch.operations || typeof patch.operations !== "object") {
      patch.operations = {};
    }
  }
  const structuredPatchApplied =
    structuredPromptOwnsLayout &&
    options.allowDeterministicStructureFallback === false
      ? false
      : structuredPromptOwnsLayout
        ? applyPromptStructuredWorkloadFallback(patch, prompt, schemaHints)
        : false;
  const structuredLayoutEditApplied =
    structuredLayoutEditRequested &&
    !aiSatisfiedStructuredLayoutEditIntent(
      patch,
      formState,
      prompt,
      schemaHints,
    )
    ? applyPromptStructuredLayoutEditFallback(
        patch,
        formState,
        prompt,
        schemaHints,
        options.answers,
      )
    : false;
  const explicitGroupAppendApplied =
    !structuredPatchApplied &&
    !structuredLayoutEditApplied &&
    explicitGroupAppendRequested &&
    !aiSatisfiedExplicitGroupAppendIntent(
      patch,
      formState,
      schemaHints,
      options.answers,
    )
      ? applyPromptStructuredLayoutEditFallback(
          patch,
          formState,
          prompt,
          schemaHints,
          options.answers,
        )
      : false;
  if (structuredPromptOwnsLayout) {
    reconcileStructuredPromptPatch(patch, prompt, schemaHints);
  } else if (
    !structuredLayoutEditApplied &&
    !explicitGroupAppendApplied &&
    structuredPrompt
  ) {
    applyPromptStructuredOperationMergeFallback(patch, prompt, schemaHints);
  }
  const targetedGroupEditApplied =
    !structuredPatchApplied &&
    !structuredLayoutEditApplied &&
    !explicitGroupAppendApplied &&
    !aiSatisfiedTargetedGroupEditIntent(
      patch,
      formState,
      prompt,
      schemaHints,
    )
      ? applyPromptTargetedGroupEditFallback(
          patch,
          formState,
          prompt,
          schemaHints,
        )
      : false;
  if (
    !structuredPatchApplied &&
    !structuredLayoutEditApplied &&
    !explicitGroupAppendApplied &&
    !targetedGroupEditApplied
  ) {
    applyPromptOperationIntentFallback(patch, formState, prompt, schemaHints);
    applyDeleteOperationDisambiguation(patch, formState, prompt, schemaHints);
    applyPromptOperationFieldFallback(patch, formState, prompt, schemaHints);
    restrictPatchToMentionedOperations(patch, prompt, schemaHints);
    constrainPatchToCurrentOperationScope(
      patch,
      formState,
      prompt,
      schemaHints,
    );
    suppressSelectionPatchForStringDistributionPrompts(
      patch,
      formState,
      prompt,
      schemaHints,
    );
  }
  if (
    structuredLayoutEditRequested &&
    !aiExpandedSectionsLayout(patch, formState, schemaHints)
  ) {
    applyPromptStructuredLayoutEditFallback(
      patch,
      formState,
      prompt,
      schemaHints,
      options.answers,
    );
  }
  if (
    explicitGroupAppendRequested &&
    !aiExpandedSectionsLayout(patch, formState, schemaHints)
  ) {
    applyPromptStructuredLayoutEditFallback(
      patch,
      formState,
      prompt,
      schemaHints,
      options.answers,
    );
  }
  canonicalizePhasedSectionsLayout(patch, prompt, schemaHints);
  applyPromptRangeProfileFallback(patch, prompt);
  const clarificationContext = {
    patch,
    formState,
    prompt,
  };
  const clarifications = normalizeClarifications(
    payload.clarifications,
    payload.questions,
    schemaHints,
    clarificationContext,
  );
  const filteredClarifications = suppressRedundantOperationClarifications(
    clarifications,
    prompt,
    schemaHints,
    patch,
    formState,
  );
  const answeredOperationsSet = extractAnsweredOperationsSet(
    options.answers,
    schemaHints,
  );
  const ambiguityClarification =
    answeredOperationsSet.length > 0
      ? null
      : buildAmbiguousOperationClarification(prompt);
  const effectiveClarifications = ambiguityClarification
    ? [ambiguityClarification]
    : (structuredPromptOwnsLayout || structuredLayoutEditApplied) &&
        deriveStructuredSectionsFromPrompt(prompt, schemaHints)
      ? []
      : filteredClarifications;
  if (ambiguityClarification) {
    patch.clear_operations = false;
    patch.operations = {};
    patch.sections = null;
    patch.sections_count = null;
    patch.groups_per_section = null;
  }
  suppressOperationPatchWhenSelectionIsAmbiguous(patch, effectiveClarifications);
  const assumptions = mergeAssumptionsAiFirst(
    normalizeAssumptionEntries(payload.assumptions),
    deriveDeterministicAssumptions(patch, formState, prompt, schemaHints),
  );
  const summary =
    typeof payload.summary === "string" && payload.summary.trim()
      ? payload.summary.trim()
      : "Applied the AI response to the form.";

  return {
    summary,
    patch,
    clarifications: effectiveClarifications,
    assumptions,
    questions: effectiveClarifications.map((entry) => entry.text),
    assumption_texts: assumptions.map((entry) => entry.text),
  };
}

function operationPatchHasConfiguredValues(value) {
  if (!value || typeof value !== "object") {
    return false;
  }
  return Object.entries(value).some(([key, fieldValue]) => {
    return key !== "enabled" && fieldValue !== null && fieldValue !== undefined;
  });
}

function stripEnabledFromOperationPatch(value) {
  const stripped = {};
  if (!value || typeof value !== "object") {
    return stripped;
  }
  Object.entries(value).forEach(([key, fieldValue]) => {
    if (key === "enabled" || fieldValue === null || fieldValue === undefined) {
      return;
    }
    stripped[key] = cloneJsonValue(fieldValue);
  });
  return stripped;
}

function normalizeGroupValue(rawGroup, schemaHints) {
  const input =
    rawGroup && typeof rawGroup === "object" && !Array.isArray(rawGroup)
      ? rawGroup
      : {};
  const group = {};
  const operationsInput = normalizeOperationEntriesValue(
    Array.isArray(input.operations) ? input.operations : input,
    schemaHints,
  );
  schemaHints.operation_order.forEach((op) => {
    if (!Object.prototype.hasOwnProperty.call(operationsInput, op)) {
      return;
    }
    const normalized = normalizeOperationPatch(
      operationsInput[op],
      op,
      schemaHints,
    );
    if (normalized.enabled === false) {
      return;
    }
    if (!operationPatchHasConfiguredValues(normalized)) {
      group[op] = {};
      return;
    }
    group[op] = stripEnabledFromOperationPatch(normalized);
  });
  return group;
}

function normalizeSectionsValue(rawSections, schemaHints) {
  if (!Array.isArray(rawSections)) {
    return [];
  }
  return rawSections.map((rawSection) => {
    const sectionInput =
      rawSection && typeof rawSection === "object" && !Array.isArray(rawSection)
        ? rawSection
        : {};
    const groupsInput =
      Array.isArray(sectionInput.groups) && sectionInput.groups.length > 0
        ? sectionInput.groups
        : [{}];
    const section = {
      groups: groupsInput.map((group) =>
        normalizeGroupValue(group, schemaHints),
      ),
    };
    const characterSet = normalizeCharacterSetValue(
      sectionInput.character_set,
      schemaHints,
    );
    if (characterSet) {
      section.character_set = characterSet;
    }
    if (sectionInput.skip_key_contains_check === true) {
      section.skip_key_contains_check = true;
    }
    return section;
  });
}

function isStructuredWorkloadPrompt(prompt) {
  const text = typeof prompt === "string" ? prompt.trim() : "";
  return !!text && STRUCTURED_WORKLOAD_PATTERN.test(text);
}

function promptDefinesFreshStructuredWorkload(prompt, formState, schemaHints) {
  const hasExistingOperations =
    getEnabledOperationNames(formState || { operations: {} }, schemaHints)
      .length > 0;
  return !hasExistingOperations;
}

function promptRequestsStructuredLayoutEdit(prompt) {
  const lowerPrompt = String(prompt || "").toLowerCase();
  if (!lowerPrompt) {
    return false;
  }
  return (
    /\b(?:then|next|after(?: that|wards)?|later|finally)\b/.test(lowerPrompt) ||
    /\b(?:add|append|make|turn|convert|split)\b[\s\S]{0,36}\bphase\b/.test(
      lowerPrompt,
    ) ||
    /\b(?:second|third|later|next)\s+phase\b/.test(lowerPrompt) ||
    /\b(?:add|append|create|make)\b[\s\S]{0,36}\b(?:another|new|next|second|third)\s+group\b/.test(
      lowerPrompt,
    ) ||
    /\b(?:another|new|next|second|third)\s+group\b/.test(lowerPrompt)
  );
}

function buildAmbiguousOperationClarification(prompt) {
  const lowerPrompt = String(prompt || "").toLowerCase();
  if (!lowerPrompt) {
    return null;
  }
  const mentionsAnyOperation =
    /\binsert(?:s|ion)?\b|\bupdate(?:s)?\b|\bmerge(?:s)?\b|\bread[- ]?modify[- ]?write\b|\brmw\b|\bpoint\s+quer(?:y|ie|ies)\b|\bpoint\s+read(?:s)?\b|\brange\s+quer(?:y|ie|ies)\b|\bpoint\s+delete(?:s)?\b|\brange\s+delete(?:s)?\b|\bempty\s+point\s+(?:quer(?:y|ie|ies)|read(?:s)?|delete(?:s)?)\b|\bsorted\b/.test(
      lowerPrompt,
    );
  if (
    /\b(?:generate|create|make)\b[\s\S]{0,24}\bworkload\b/.test(lowerPrompt) &&
    !mentionsAnyOperation
  ) {
    return {
      id: "clarify.operations.workload",
      text: "Which operations should this workload include?",
      required: true,
      binding: { type: "operations_set" },
      input: "multi_enum",
      options: null,
      default_behavior: "wait_for_user",
    };
  }
  const mentionsSpecificQueryOperation =
    /\bpoint\s+quer(?:y|ie|ies)\b|\brange\s+quer(?:y|ie|ies)\b|\bempty\s+point\s+quer(?:y|ie|ies)\b|\bpoint\s+reads?\b/.test(
      lowerPrompt,
    );
  if (
    /\bqueries\b|\bquery\b/.test(lowerPrompt) &&
    !mentionsSpecificQueryOperation
  ) {
    return {
      id: "clarify.operations.queries",
      text: "Which queries should be added?",
      required: true,
      binding: { type: "operations_set" },
      input: "multi_enum",
      options: ["point_queries", "range_queries"],
      default_behavior: "wait_for_user",
    };
  }
  const mentionsSpecificDeleteOperation =
    /\bpoint\s+deletes?\b|\brange\s+deletes?\b|\bempty\s+point\s+deletes?\b/.test(
      lowerPrompt,
    );
  if (
    /\bdeletes?\b/.test(lowerPrompt) &&
    !mentionsSpecificDeleteOperation
  ) {
    return {
      id: "clarify.operations.deletes",
      text: "Which deletes should be added or removed?",
      required: true,
      binding: { type: "operations_set" },
      input: "multi_enum",
      options: ["point_deletes", "range_deletes", "empty_point_deletes"],
      default_behavior: "wait_for_user",
    };
  }
  return null;
}

function canonicalizePhasedSectionsLayout(patch, prompt, schemaHints) {
  if (
    !patch ||
    typeof patch !== "object" ||
    !Array.isArray(patch.sections) ||
    patch.sections.length <= 1
  ) {
    return;
  }
  const text = typeof prompt === "string" ? prompt.trim() : "";
  if (!text || !STRUCTURED_WORKLOAD_PATTERN.test(text)) {
    return;
  }
  const normalizedSections = normalizeSectionsValue(patch.sections, schemaHints);
  if (
    normalizedSections.length <= 1 ||
    normalizedSections.some(
      (section) =>
        !section ||
        !Array.isArray(section.groups) ||
        section.groups.length !== 1,
    )
  ) {
    return;
  }

  const mergedSection = {
    groups: normalizedSections.map((section) => cloneJsonValue(section.groups[0])),
  };
  const sharedCharacterSet = getSharedSectionCharacterSet(normalizedSections);
  if (sharedCharacterSet) {
    mergedSection.character_set = sharedCharacterSet;
  }
  if (
    normalizedSections.some(
      (section) => section && section.skip_key_contains_check === true,
    )
  ) {
    mergedSection.skip_key_contains_check = true;
  }

  patch.sections = [mergedSection];
  patch.sections_count = 1;
  patch.groups_per_section = mergedSection.groups.length;
}

function getSharedSectionCharacterSet(sections) {
  let shared = null;
  for (const section of sections) {
    const characterSet =
      section && typeof section.character_set === "string"
        ? section.character_set
        : null;
    if (!characterSet) {
      continue;
    }
    if (shared === null) {
      shared = characterSet;
      continue;
    }
    if (shared !== characterSet) {
      return null;
    }
  }
  return shared;
}

function collapseUnexpectedStructuredPatchToOperations(patch, schemaHints) {
  if (
    !patch ||
    typeof patch !== "object" ||
    !Array.isArray(patch.sections) ||
    patch.sections.length === 0
  ) {
    return false;
  }
  const normalizedSections = normalizeSectionsValue(patch.sections, schemaHints);
  const aggregated = buildAggregateOperationsFromSections(
    normalizedSections,
    schemaHints,
    patch.operations,
  );
  const nextOperations = {};
  schemaHints.operation_order.forEach((operationName) => {
    const operationPatch = aggregated[operationName];
    if (!operationPatch || operationPatch.enabled !== true) {
      return;
    }
    nextOperations[operationName] = operationPatch;
  });
  patch.operations = nextOperations;
  patch.sections = null;
  patch.sections_count = null;
  patch.groups_per_section = null;
  return true;
}

function reconcileStructuredPromptPatch(patch, prompt, schemaHints) {
  if (!patch || typeof patch !== "object") {
    return;
  }
  const expectedSections = deriveStructuredSectionsFromPrompt(prompt, schemaHints);
  if (!expectedSections) {
    return;
  }
  const normalizedExpected = normalizeSectionsValue(expectedSections, schemaHints);
  if (
    !Array.isArray(patch.sections) ||
    patch.sections.length === 0 ||
    !structuredSectionsSemanticallyMatch(
      normalizeSectionsValue(patch.sections, schemaHints),
      normalizedExpected,
    )
  ) {
    patch.sections = normalizedExpected;
    patch.sections_count = normalizedExpected.length;
    patch.groups_per_section = maxGroupsPerSection(normalizedExpected);
    patch.clear_operations = false;
    patch.operations = {};
  }
}

function structuredSectionsSemanticallyMatch(actualSections, expectedSections) {
  const actualCanonical = canonicalizePhasedSectionsForComparison(actualSections);
  const expectedCanonical =
    canonicalizePhasedSectionsForComparison(expectedSections);
  if (
    actualCanonical.length !== expectedCanonical.length ||
    actualCanonical.some(
      (section, index) =>
        !section ||
        !expectedCanonical[index] ||
        section.groups.length !== expectedCanonical[index].groups.length,
    )
  ) {
    return false;
  }
  for (let sectionIndex = 0; sectionIndex < expectedCanonical.length; sectionIndex += 1) {
    const actualGroups = actualCanonical[sectionIndex].groups;
    const expectedGroups = expectedCanonical[sectionIndex].groups;
    for (let groupIndex = 0; groupIndex < expectedGroups.length; groupIndex += 1) {
      if (
        !groupSemanticallyMatches(
          actualGroups[groupIndex],
          expectedGroups[groupIndex],
        )
      ) {
        return false;
      }
    }
  }
  return true;
}

function canonicalizePhasedSectionsForComparison(sections) {
  if (!Array.isArray(sections)) {
    return [];
  }
  if (
    sections.length > 1 &&
    sections.every(
      (section) =>
        section && Array.isArray(section.groups) && section.groups.length === 1,
    )
  ) {
    return [
      {
        groups: sections.map((section) => cloneJsonValue(section.groups[0])),
      },
    ];
  }
  return sections;
}

function groupSemanticallyMatches(actualGroup, expectedGroup) {
  const actual = actualGroup && typeof actualGroup === "object" ? actualGroup : {};
  const expected =
    expectedGroup && typeof expectedGroup === "object" ? expectedGroup : {};
  const actualOperations = Object.keys(actual).sort();
  const expectedOperations = Object.keys(expected).sort();
  if (actualOperations.length !== expectedOperations.length) {
    return false;
  }
  for (let index = 0; index < expectedOperations.length; index += 1) {
    if (actualOperations[index] !== expectedOperations[index]) {
      return false;
    }
  }
  for (const operationName of expectedOperations) {
    const actualSpec =
      actual[operationName] && typeof actual[operationName] === "object"
        ? actual[operationName]
        : {};
    const expectedSpec =
      expected[operationName] && typeof expected[operationName] === "object"
        ? expected[operationName]
        : {};
    if (
      Number.isFinite(expectedSpec.op_count) &&
      actualSpec.op_count !== expectedSpec.op_count
    ) {
      return false;
    }
    if (
      expectedSpec.selectivity !== null &&
      expectedSpec.selectivity !== undefined &&
      actualSpec.selectivity !== expectedSpec.selectivity
    ) {
      return false;
    }
    if (
      expectedSpec.range_format !== null &&
      expectedSpec.range_format !== undefined &&
      actualSpec.range_format !== expectedSpec.range_format
    ) {
      return false;
    }
  }
  return true;
}

function buildEnabledOperationGroup(operations, schemaHints) {
  const group = {};
  schemaHints.operation_order.forEach((op) => {
    const entry =
      operations && operations[op] && operations[op].enabled
        ? operations[op]
        : null;
    if (!entry) {
      return;
    }
    group[op] = stripEnabledFromOperationPatch(entry);
  });
  return group;
}

function synthesizeSectionsFromFlatState(baseState, schemaHints) {
  const sectionCount = Math.max(1, baseState.sections_count || 1);
  const groupsPerSection = Math.max(1, baseState.groups_per_section || 1);
  const seedGroup = buildEnabledOperationGroup(
    baseState.operations,
    schemaHints,
  );
  return Array.from({ length: sectionCount }, (_, sectionIndex) => {
    const section = {
      groups: Array.from({ length: groupsPerSection }, (_, groupIndex) => {
        if (sectionIndex === 0 && groupIndex === 0) {
          return cloneJsonValue(seedGroup);
        }
        return {};
      }),
    };
    if (baseState.character_set) {
      section.character_set = baseState.character_set;
    }
    if (baseState.skip_key_contains_check === true) {
      section.skip_key_contains_check = true;
    }
    return section;
  });
}

function buildAggregateOperationsFromSections(
  sections,
  schemaHints,
  fallbackOperations,
) {
  const operations = {};
  schemaHints.operation_order.forEach((op) => {
    const fallback =
      fallbackOperations && fallbackOperations[op]
        ? cloneJsonValue(fallbackOperations[op])
        : normalizeOperationPatch(null, op, schemaHints);
    operations[op] = fallback;
    operations[op].enabled = !!operations[op].enabled;
  });

  sections.forEach((section) => {
    const groups = Array.isArray(section && section.groups)
      ? section.groups
      : [];
    groups.forEach((group) => {
      schemaHints.operation_order.forEach((op) => {
        if (!Object.prototype.hasOwnProperty.call(group || {}, op)) {
          return;
        }
        const normalized = normalizeOperationPatch(group[op], op, schemaHints);
        const configuredFields = stripNullFields(
          stripEnabledFromOperationPatch(normalized),
        );
        operations[op] = {
          ...operations[op],
          ...configuredFields,
          enabled: true,
        };
      });
    });
  });

  return operations;
}

function maxGroupsPerSection(sections) {
  const maxGroups = sections.reduce((currentMax, section) => {
    const groupCount = Array.isArray(section && section.groups)
      ? section.groups.length
      : 0;
    return Math.max(currentMax, groupCount);
  }, 0);
  return maxGroups > 0 ? maxGroups : null;
}

function applyPromptOperationIntentFallback(
  patch,
  formState,
  prompt,
  schemaHints,
) {
  if (!patch || typeof patch !== "object") {
    return;
  }
  const lowerPrompt = String(prompt || "").toLowerCase();
  if (!lowerPrompt) {
    return;
  }

  const mentionedOps = getMentionedOperationsFromPrompt(
    lowerPrompt,
    schemaHints,
  );
  const currentEnabledOps = getEnabledOperationNames(
    formState || { operations: {} },
    schemaHints,
  );
  if (mentionedOps.length === 0) {
    return;
  }

  let targetOps = mentionedOps;
  const exclusiveOp = schemaHints.operation_order.find((op) =>
    promptExplicitlyRestrictsToOperation(lowerPrompt, op),
  );
  if (exclusiveOp) {
    patch.clear_operations = true;
    targetOps = [exclusiveOp];
  }

  targetOps.forEach((op) => {
    if (!patch.operations[op] || typeof patch.operations[op] !== "object") {
      patch.operations[op] = {};
    }
    if (promptExplicitlyDisablesOperation(lowerPrompt, op, schemaHints)) {
      patch.operations[op].enabled = false;
      return;
    }
    if (patch.operations[op].enabled !== true) {
      patch.operations[op].enabled = true;
    }
  });

  if (exclusiveOp && currentEnabledOps.length > 0) {
    currentEnabledOps.forEach((op) => {
      if (op === exclusiveOp) {
        return;
      }
      if (!patch.operations[op] || typeof patch.operations[op] !== "object") {
        patch.operations[op] = {};
      }
      patch.operations[op].enabled = false;
    });
  }
}

function applyPromptStructuredWorkloadFallback(patch, prompt, schemaHints) {
  if (!patch || typeof patch !== "object") {
    return false;
  }
  if (Array.isArray(patch.sections) && patch.sections.length > 0) {
    return true;
  }
  const sections = deriveStructuredSectionsFromPrompt(prompt, schemaHints);
  if (!sections) {
    return false;
  }
  patch.sections = normalizeSectionsValue(sections, schemaHints);
  patch.sections_count = patch.sections.length;
  patch.groups_per_section = maxGroupsPerSection(patch.sections);
  patch.clear_operations = false;
  patch.operations = {};
  return true;
}

function applyPromptStructuredOperationMergeFallback(
  patch,
  prompt,
  schemaHints,
) {
  if (!patch || typeof patch !== "object") {
    return false;
  }
  const sections = deriveStructuredSectionsFromPrompt(prompt, schemaHints);
  if (!sections) {
    return false;
  }
  const normalizedSections = normalizeSectionsValue(sections, schemaHints);
  const derivedOperations = buildAggregateOperationsFromSections(
    normalizedSections,
    schemaHints,
    null,
  );
  const existingOperations =
    patch.operations && typeof patch.operations === "object"
      ? patch.operations
      : {};
  const nextOperations = {};
  schemaHints.operation_order.forEach((operationName) => {
    const derivedPatch = derivedOperations[operationName];
    if (!derivedPatch || derivedPatch.enabled !== true) {
      return;
    }
    const currentPatch =
      existingOperations[operationName] &&
      typeof existingOperations[operationName] === "object"
        ? existingOperations[operationName]
        : {};
    nextOperations[operationName] = {
      ...currentPatch,
      ...derivedPatch,
      enabled: true,
      op_count: derivedPatch.op_count ?? currentPatch.op_count ?? null,
      selectivity:
        derivedPatch.selectivity ?? currentPatch.selectivity ?? null,
      range_format:
        derivedPatch.range_format ?? currentPatch.range_format ?? null,
    };
  });
  patch.operations = nextOperations;
  patch.sections = null;
  patch.sections_count = null;
  patch.groups_per_section = null;
  patch.clear_operations = false;
  return true;
}

function canonicalizeSectionsForStructuredEdit(rawSections, schemaHints) {
  const normalized = normalizeSectionsValue(rawSections, schemaHints);
  if (
    normalized.length > 1 &&
    normalized.every(
      (section) =>
        section && Array.isArray(section.groups) && section.groups.length === 1,
    )
  ) {
    return [
      {
        groups: normalized.map((section) => cloneJsonValue(section.groups[0])),
      },
    ];
  }
  return normalized;
}

function applyPromptStructuredLayoutEditFallback(
  patch,
  formState,
  prompt,
  schemaHints,
  answers,
) {
  if (!patch || typeof patch !== "object") {
    return false;
  }
  const derivedSections = deriveStructuredSectionsFromPrompt(prompt, schemaHints);
  const currentSections = canonicalizeSectionsForStructuredEdit(
    normalizeCurrentSectionsForIntentChecks(formState, schemaHints),
    schemaHints,
  );
  if (
    currentSections.length === 0 ||
    !Array.isArray(currentSections[0].groups)
  ) {
    return false;
  }

  const currentGroups = currentSections[0].groups.map((group) =>
    cloneJsonValue(group),
  );
  const nextSections = derivedSections
    ? canonicalizeSectionsForStructuredEdit(derivedSections, schemaHints)
    : [];
  const derivedGroups =
    nextSections.length > 0 && Array.isArray(nextSections[0].groups)
      ? nextSections[0].groups.map((group) => cloneJsonValue(group))
      : [];

  if (derivedGroups.length === 0) {
    const fallbackGroup = buildAnsweredStructuredGroupFallback(
      patch,
      formState,
      prompt,
      schemaHints,
      answers,
    );
    if (!fallbackGroup) {
      return false;
    }
    const mergedSection = {
      groups: [...currentGroups, fallbackGroup],
    };
    const characterSet = currentSections[0].character_set || null;
    if (characterSet) {
      mergedSection.character_set = characterSet;
    }
    if (currentSections[0].skip_key_contains_check === true) {
      mergedSection.skip_key_contains_check = true;
    }

    patch.sections = [mergedSection];
    patch.sections_count = 1;
    patch.groups_per_section = mergedSection.groups.length;
    patch.operations = {};
    patch.clear_operations = false;
    return true;
  }

  let prefixLength = 0;
  while (
    prefixLength < currentGroups.length &&
    prefixLength < derivedGroups.length &&
    groupSemanticallyMatches(
      currentGroups[prefixLength],
      derivedGroups[prefixLength],
    )
  ) {
    prefixLength += 1;
  }

  const groupsToAppend = derivedGroups.slice(prefixLength);
  if (groupsToAppend.length === 0) {
    return false;
  }

  const mergedSection = {
    groups: [...currentGroups, ...groupsToAppend],
  };
  const characterSet =
    currentSections[0].character_set || nextSections[0].character_set || null;
  if (characterSet) {
    mergedSection.character_set = characterSet;
  }
  if (
    currentSections[0].skip_key_contains_check === true ||
    nextSections[0].skip_key_contains_check === true
  ) {
    mergedSection.skip_key_contains_check = true;
  }

  patch.sections = [mergedSection];
  patch.sections_count = 1;
  patch.groups_per_section = mergedSection.groups.length;
  patch.operations = {};
  patch.clear_operations = false;
  return true;
}

function buildAnsweredStructuredGroupFallback(
  patch,
  formState,
  prompt,
  schemaHints,
  answers,
) {
  if (
    !promptRequestsExplicitGroupAppend(prompt) &&
    !promptRequestsStructuredLayoutEdit(prompt)
  ) {
    return null;
  }
  const answeredOps = extractAnsweredOperationsSet(answers, schemaHints);
  const promptOps = getMentionedOperationsFromPrompt(
    String(prompt || "").toLowerCase(),
    schemaHints,
  );
  const selectedOps = uniqueStrings([...answeredOps, ...promptOps]);
  const operationsPatch =
    patch && patch.operations && typeof patch.operations === "object"
      ? patch.operations
      : {};
  const nextGroup = {};
  const promptCount = extractPromptCountHint(prompt);

  selectedOps.forEach((operationName) => {
    const currentPatch =
      operationsPatch[operationName] &&
      typeof operationsPatch[operationName] === "object"
        ? operationsPatch[operationName]
        : {};
    const seededPatch = seedGroupAppendOperationPatch(
      operationName,
      currentPatch,
      formState,
      promptCount,
      schemaHints,
    );
    const configured = stripEnabledFromOperationPatch(seededPatch);
    nextGroup[operationName] = configured;
  });

  return Object.keys(nextGroup).length > 0 ? nextGroup : null;
}

function seedGroupAppendOperationPatch(
  operationName,
  currentPatch,
  formState,
  promptCount,
  schemaHints,
) {
  const caps =
    schemaHints.capabilities && schemaHints.capabilities[operationName]
      ? schemaHints.capabilities[operationName]
      : {};
  const insertState =
    formState &&
    formState.operations &&
    formState.operations.inserts &&
    typeof formState.operations.inserts === "object"
      ? formState.operations.inserts
      : {};
  const basePatch = {
    enabled: true,
    ...(promptCount !== null &&
    (caps.has_op_count === undefined ? true : !!caps.has_op_count)
      ? { op_count: promptCount }
      : {}),
    ...currentPatch,
  };

  if (!operationPatchHasConfiguredValues(basePatch)) {
    if (caps.has_selection && !basePatch.selection_distribution) {
      basePatch.selection_distribution = "uniform";
    }
    if (caps.has_range) {
      if (basePatch.selectivity === null || basePatch.selectivity === undefined) {
        basePatch.selectivity = 0.01;
      }
      if (!basePatch.range_format) {
        basePatch.range_format = "StartCount";
      }
    }
    if (caps.has_key && !basePatch.key) {
      basePatch.key = insertState.key || "id";
    }
    if (caps.has_val && !basePatch.val) {
      basePatch.val =
        insertState.val && typeof insertState.val === "object"
          ? cloneJsonValue(insertState.val)
          : { uniform: { len: 16 } };
    }
  }

  return normalizeOperationPatch(basePatch, operationName, schemaHints);
}

function extractAnsweredOperationsSet(answers, schemaHints) {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    return [];
  }
  const supported = new Set(schemaHints.operation_order || []);
  const selected = new Set();
  Object.values(answers).forEach((value) => {
    const candidates = Array.isArray(value)
      ? value
      : typeof value === "string"
        ? value.split(/[,\s]+/)
        : [];
    candidates.forEach((candidate) => {
      const normalized = String(candidate || "").trim();
      if (supported.has(normalized)) {
        selected.add(normalized);
      }
    });
  });
  return [...selected];
}

function promptRequestsExplicitGroupAppend(prompt) {
  const lowerPrompt = String(prompt || "").toLowerCase();
  if (!lowerPrompt) {
    return false;
  }
  if (
    /\b(?:change|replace|turn|convert|edit|modify)\b/.test(lowerPrompt) &&
    /\bgroup\b/.test(lowerPrompt)
  ) {
    return false;
  }
  return (
    /\b(?:add|append|create|make)\b[\s\S]{0,36}\b(?:an?\s+)?(?:another|new|next|second|third|2nd|3rd)\s+group\b/.test(
      lowerPrompt,
    ) ||
    /\b(?:put|place|move)\b[\s\S]{0,80}\b(?:into|to|as)\s+(?:an?\s+)?(?:second|third|2nd|3rd)\s+group\b/.test(
      lowerPrompt,
    ) ||
    /\b(?:an?\s+)?(?:another|new|next)\s+group\b/.test(
      lowerPrompt,
    )
  );
}

function parsePromptOrdinalIndex(token) {
  const normalized = String(token || "")
    .toLowerCase()
    .trim()
    .replace(/['’]s$/, "");
  if (!normalized) {
    return null;
  }
  if (/^\d+$/.test(normalized)) {
    const parsed = Number.parseInt(normalized, 10) - 1;
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
  }
  const namedOrdinals = {
    first: 0,
    "1st": 0,
    second: 1,
    "2nd": 1,
    third: 2,
    "3rd": 2,
    fourth: 3,
    "4th": 3,
  };
  return Object.prototype.hasOwnProperty.call(namedOrdinals, normalized)
    ? namedOrdinals[normalized]
    : null;
}

function extractExplicitGroupTarget(prompt, formState, schemaHints) {
  const text = String(prompt || "").toLowerCase();
  if (!text) {
    return null;
  }
  const directMatch = text.match(
    /\b(?:(?:in|for)\s+)?(?:section\s+(\d+|1st|first|2nd|second|3rd|third|4th|fourth)\s+)?group\s+(\d+|1st|first|2nd|second|3rd|third|4th|fourth)\b/,
  );
  const possessiveMatch = directMatch
    ? null
    : text.match(
        /\b(?:the\s+)?(\d+|1st|first|2nd|second|3rd|third|4th|fourth)\s+group(?:['’]s)?\b/,
      );
  if (!directMatch && !possessiveMatch) {
    return null;
  }
  const sectionIndex = directMatch
    ? parsePromptOrdinalIndex(directMatch[1])
    : null;
  const groupIndex = directMatch
    ? parsePromptOrdinalIndex(directMatch[2])
    : parsePromptOrdinalIndex(possessiveMatch[1]);
  if (!Number.isInteger(groupIndex) || groupIndex < 0) {
    return null;
  }
  const normalizedSections = normalizeCurrentSectionsForIntentChecks(
    formState,
    normalizeSchemaHints(schemaHints),
  );
  const resolvedSectionIndex = Number.isInteger(sectionIndex) && sectionIndex >= 0
    ? sectionIndex
    : normalizedSections.length === 1
      ? 0
      : null;
  if (
    !Number.isInteger(resolvedSectionIndex) ||
    resolvedSectionIndex < 0 ||
    resolvedSectionIndex >= normalizedSections.length
  ) {
    return null;
  }
  const groups = Array.isArray(normalizedSections[resolvedSectionIndex].groups)
    ? normalizedSections[resolvedSectionIndex].groups
    : [];
  if (groupIndex >= groups.length) {
    return null;
  }
  return {
    sectionIndex: resolvedSectionIndex,
    groupIndex,
  };
}

function extractPromptOperationReplacement(prompt, schemaHints) {
  const text = String(prompt || "").toLowerCase();
  if (!text) {
    return null;
  }
  const groupRefSource =
    "(?:(?:section\\s+(?:\\d+|1st|first|2nd|second|3rd|third|4th|fourth)\\s+)?group\\s+(?:\\d+|1st|first|2nd|second|3rd|third|4th|fourth)|(?:the\\s+)?(?:\\d+|1st|first|2nd|second|3rd|third|4th|fourth)\\s+group(?:['’]s)?)";
  const patterns = [
    new RegExp(
      `\\b(?:change|replace|turn|convert)\\s+(.+?)\\s+in\\s+${groupRefSource}\\s+(?:to|with|into)\\s+(.+?)(?:$|[.?!,])`,
    ),
    new RegExp(
      `\\b(?:change|replace|turn|convert)\\s+(.+?)\\s+(?:to|with|into)\\s+(.+?)\\s+in\\s+${groupRefSource}\\b`,
    ),
    new RegExp(
      `\\bin\\s+${groupRefSource}\\s*,?\\s*(?:change|replace|turn|convert)\\s+(.+?)\\s+(?:to|with|into)\\s+(.+?)(?:$|[.?!,])`,
    ),
    new RegExp(
      `\\b(?:change|replace|turn|convert)\\s+${groupRefSource}\\s+(.+?)\\s+(?:to|with|into)\\s+(.+?)(?:$|[.?!,])`,
    ),
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) {
      continue;
    }
    const sourceOps = getMentionedOperationsFromPrompt(match[1], schemaHints);
    const targetOps = getMentionedOperationsFromPrompt(match[2], schemaHints);
    if (sourceOps.length === 1 && targetOps.length === 1) {
      return {
        sourceOperation: sourceOps[0],
        targetOperation: targetOps[0],
      };
    }
  }
  return null;
}

function buildReplacementOperationSeed(sourceSpec, targetOperation, schemaHints) {
  const source =
    sourceSpec && typeof sourceSpec === "object" ? sourceSpec : {};
  const caps =
    schemaHints.capabilities && schemaHints.capabilities[targetOperation]
      ? schemaHints.capabilities[targetOperation]
      : {};
  const next = {};
  if (caps.has_op_count && source.op_count !== null && source.op_count !== undefined) {
    next.op_count = cloneJsonValue(source.op_count);
  }
  if (
    caps.has_character_set &&
    typeof source.character_set === "string" &&
    source.character_set
  ) {
    next.character_set = source.character_set;
  }
  if (caps.has_key && source.key !== null && source.key !== undefined) {
    next.key = cloneJsonValue(source.key);
  }
  if (caps.has_val && source.val !== null && source.val !== undefined) {
    next.val = cloneJsonValue(source.val);
  }
  if (
    caps.has_selection &&
    source.selection !== null &&
    source.selection !== undefined
  ) {
    next.selection = cloneJsonValue(source.selection);
  }
  if (caps.has_sorted && source.k !== null && source.k !== undefined) {
    next.k = cloneJsonValue(source.k);
  }
  if (caps.has_sorted && source.l !== null && source.l !== undefined) {
    next.l = cloneJsonValue(source.l);
  }
  if (
    caps.has_range &&
    source.selectivity !== null &&
    source.selectivity !== undefined
  ) {
    next.selectivity = cloneJsonValue(source.selectivity);
  }
  if (
    caps.has_range &&
    source.range_format !== null &&
    source.range_format !== undefined
  ) {
    next.range_format = cloneJsonValue(source.range_format);
  }
  return next;
}

function applyOperationPatchToStructuredGroup(group, operationName, operationPatch, schemaHints) {
  if (
    !group ||
    typeof group !== "object" ||
    !operationName ||
    !operationPatch ||
    typeof operationPatch !== "object"
  ) {
    return;
  }
  if (operationPatch.enabled === false) {
    delete group[operationName];
    return;
  }
  const configuredFields = stripNullFields(
    stripEnabledFromOperationPatch(
      normalizeOperationPatch(operationPatch, operationName, schemaHints),
    ),
  );
  const existing =
    group[operationName] && typeof group[operationName] === "object"
      ? cloneJsonValue(group[operationName])
      : {};
  group[operationName] = {
    ...existing,
    ...configuredFields,
  };
}

function applyPromptTargetedGroupEditFallback(
  patch,
  formState,
  prompt,
  schemaHints,
) {
  if (!patch || typeof patch !== "object") {
    return false;
  }
  const target = extractExplicitGroupTarget(prompt, formState, schemaHints);
  if (!target) {
    return false;
  }
  const currentSections = normalizeCurrentSectionsForIntentChecks(
    formState,
    schemaHints,
  );
  if (
    currentSections.length === 0 ||
    !currentSections[target.sectionIndex] ||
    !Array.isArray(currentSections[target.sectionIndex].groups) ||
    !currentSections[target.sectionIndex].groups[target.groupIndex]
  ) {
    return false;
  }
  const nextSections = cloneJsonValue(currentSections);
  const nextGroup = nextSections[target.sectionIndex].groups[target.groupIndex];
  const replacement = extractPromptOperationReplacement(prompt, schemaHints);
  const mentionedOperations = getMentionedOperationsFromPrompt(prompt, schemaHints);
  const allowedOperations = new Set(
    replacement &&
    replacement.sourceOperation &&
    replacement.targetOperation &&
    replacement.sourceOperation !== replacement.targetOperation
      ? [replacement.sourceOperation, replacement.targetOperation]
      : mentionedOperations,
  );
  const operationsPatch =
    patch.operations && typeof patch.operations === "object"
      ? patch.operations
      : {};
  const hasOperationPatch = Object.keys(operationsPatch).length > 0;

  if (!hasOperationPatch && !replacement && allowedOperations.size === 0) {
    return false;
  }

  let appliedOperationPatch = false;
  Object.entries(operationsPatch).forEach(([operationName, operationPatch]) => {
    if (!schemaHints.operation_order.includes(operationName)) {
      return;
    }
    if (allowedOperations.size > 0 && !allowedOperations.has(operationName)) {
      return;
    }
    applyOperationPatchToStructuredGroup(
      nextGroup,
      operationName,
      operationPatch,
      schemaHints,
    );
    appliedOperationPatch = true;
  });

  if (!replacement && allowedOperations.size > 0 && !appliedOperationPatch) {
    allowedOperations.forEach((operationName) => {
      if (!schemaHints.operation_order.includes(operationName)) {
        return;
      }
      applyOperationPatchToStructuredGroup(
        nextGroup,
        operationName,
        { enabled: true },
        schemaHints,
      );
    });
  }

  if (
    replacement &&
    replacement.sourceOperation &&
    replacement.targetOperation &&
    replacement.sourceOperation !== replacement.targetOperation
  ) {
    const sourceSpec =
      nextGroup[replacement.sourceOperation] &&
      typeof nextGroup[replacement.sourceOperation] === "object"
        ? cloneJsonValue(nextGroup[replacement.sourceOperation])
        : null;
    if (
      !Object.prototype.hasOwnProperty.call(nextGroup, replacement.targetOperation) &&
      sourceSpec
    ) {
      nextGroup[replacement.targetOperation] = buildReplacementOperationSeed(
        sourceSpec,
        replacement.targetOperation,
        schemaHints,
      );
    }
    delete nextGroup[replacement.sourceOperation];
  }

  patch.sections = nextSections;
  patch.sections_count = nextSections.length;
  patch.groups_per_section = maxGroupsPerSection(nextSections);
  patch.operations = {};
  patch.clear_operations = false;
  return true;
}

function restrictPatchToMentionedOperations(patch, prompt, schemaHints) {
  if (
    !patch ||
    typeof patch !== "object" ||
    !patch.operations ||
    typeof patch.operations !== "object"
  ) {
    return;
  }
  const lowerPrompt = String(prompt || "").toLowerCase();
  const mentionedOps = getMentionedOperationsFromPrompt(
    lowerPrompt,
    schemaHints,
  );
  if (mentionedOps.length === 0) {
    return;
  }
  const exclusiveOps = schemaHints.operation_order.filter((op) =>
    promptExplicitlyRestrictsToOperation(lowerPrompt, op),
  );
  const isExclusive = exclusiveOps.length > 0;
  const allowedOps = new Set(isExclusive ? exclusiveOps : mentionedOps);

  if (isExclusive) {
    patch.clear_operations = true;
    schemaHints.operation_order.forEach((op) => {
      if (allowedOps.has(op)) {
        const opPatch =
          patch.operations[op] && typeof patch.operations[op] === "object"
            ? patch.operations[op]
            : {};
        if (opPatch.enabled !== false) {
          opPatch.enabled = true;
        }
        patch.operations[op] = opPatch;
        return;
      }
      patch.operations[op] = { enabled: false };
    });
    return;
  }

  patch.clear_operations = false;
  Object.keys(patch.operations).forEach((op) => {
    if (!allowedOps.has(op)) {
      delete patch.operations[op];
    }
  });
}

function suppressRedundantOperationClarifications(
  clarifications,
  prompt,
  schemaHints,
  patch,
  formState,
) {
  if (!Array.isArray(clarifications) || clarifications.length === 0) {
    return [];
  }
  const lowerPrompt = String(prompt || "").toLowerCase();
  const mentionedOps = getMentionedOperationsFromPrompt(
    lowerPrompt,
    schemaHints,
  );
  const shouldSuppressOperationQuestion = mentionedOps.length > 0;
  const hasResolvedSections =
    (Array.isArray(patch && patch.sections) && patch.sections.length > 0) ||
    Number.isFinite(patch && patch.sections_count);
  const hasResolvedGroups =
    (Array.isArray(patch && patch.sections) &&
      patch.sections.some(
        (section) =>
          section && Array.isArray(section.groups) && section.groups.length > 0,
      )) ||
    Number.isFinite(patch && patch.groups_per_section);
  const promptRequestsStructure =
    /\bphase\b|\binterleave\b|\bpreload\b|\bsection(?:s)?\b|\bgroup(?:s)?\b/.test(
      lowerPrompt,
    );
  const hasKnownSectionsInState = Number.isFinite(
    formState && formState.sections_count,
  );
  const hasKnownGroupsInState = Number.isFinite(
    formState && formState.groups_per_section,
  );
  if (
    !shouldSuppressOperationQuestion &&
    !hasResolvedSections &&
    !hasResolvedGroups &&
    !(
      !promptRequestsStructure &&
      hasKnownSectionsInState &&
      hasKnownGroupsInState
    )
  ) {
    return clarifications;
  }
  return clarifications.filter((entry) => {
    if (!entry || !entry.binding) {
      return true;
    }
    if (
      shouldSuppressOperationQuestion &&
      entry.binding.type === "operations_set"
    ) {
      return false;
    }
    if (
      (hasResolvedSections ||
        (!promptRequestsStructure && hasKnownSectionsInState)) &&
      entry.binding.type === "top_field" &&
      entry.binding.field === "sections_count"
    ) {
      return false;
    }
    if (
      (hasResolvedGroups ||
        (!promptRequestsStructure && hasKnownGroupsInState)) &&
      entry.binding.type === "top_field" &&
      entry.binding.field === "groups_per_section"
    ) {
      return false;
    }
    if (
      shouldSuppressRangeProfileClarification(lowerPrompt, entry, patch)
    ) {
      return false;
    }
    return true;
  });
}

function applyPromptRangeProfileFallback(patch, prompt) {
  if (!patch || typeof patch !== "object") {
    return;
  }
  const lowerPrompt = String(prompt || "").toLowerCase();
  const rangeProfile = detectRangeQueryProfile(lowerPrompt);
  if (!rangeProfile) {
    return;
  }
  const defaultSelectivity = RANGE_QUERY_SELECTIVITY_PROFILES[rangeProfile];
  if (!Number.isFinite(defaultSelectivity)) {
    return;
  }

  if (patch.operations && typeof patch.operations === "object") {
    applyRangeProfileToOperationPatch(
      patch.operations.range_queries,
      defaultSelectivity,
    );
    applyRangeProfileToOperationPatch(
      patch.operations.range_deletes,
      defaultSelectivity,
    );
  }

  if (!Array.isArray(patch.sections)) {
    return;
  }
  patch.sections.forEach((section) => {
    if (!section || !Array.isArray(section.groups)) {
      return;
    }
    section.groups.forEach((group) => {
      if (!group || typeof group !== "object") {
        return;
      }
      applyRangeProfileToOperationPatch(group.range_queries, defaultSelectivity);
      applyRangeProfileToOperationPatch(group.range_deletes, defaultSelectivity);
    });
  });
}

function applyRangeProfileToOperationPatch(operationPatch, selectivity) {
  if (!operationPatch || typeof operationPatch !== "object") {
    return;
  }
  if (operationPatch.selectivity === null || operationPatch.selectivity === undefined) {
    operationPatch.selectivity = selectivity;
  }
  if (
    operationPatch.range_format === null ||
    operationPatch.range_format === undefined
  ) {
    operationPatch.range_format = "StartCount";
  }
}

function shouldSuppressRangeProfileClarification(lowerPrompt, entry, patch) {
  const rangeProfile = detectRangeQueryProfile(lowerPrompt);
  if (!rangeProfile || !entry || !entry.binding) {
    return false;
  }
  const binding = entry.binding;
  const questionText = typeof entry.text === "string" ? entry.text.toLowerCase() : "";
  if (
    binding.type !== "operation_field" ||
    binding.operation !== "range_queries"
  ) {
    return false;
  }
  if (
    binding.field === "selection_mean" ||
    binding.field === "selectivity" ||
    /\brange\b/.test(questionText)
  ) {
    return true;
  }
  return hasResolvedRangeProfileInPatch(patch);
}

function hasResolvedRangeProfileInPatch(patch) {
  if (!patch || typeof patch !== "object") {
    return false;
  }
  if (
    patch.operations &&
    patch.operations.range_queries &&
    typeof patch.operations.range_queries === "object" &&
    patch.operations.range_queries.selectivity !== null &&
    patch.operations.range_queries.selectivity !== undefined
  ) {
    return true;
  }
  if (!Array.isArray(patch.sections)) {
    return false;
  }
  return patch.sections.some((section) => {
    if (!section || !Array.isArray(section.groups)) {
      return false;
    }
    return section.groups.some((group) => {
      return !!(
        group &&
        group.range_queries &&
        typeof group.range_queries === "object" &&
        group.range_queries.selectivity !== null &&
        group.range_queries.selectivity !== undefined
      );
    });
  });
}

function suppressOperationPatchWhenSelectionIsAmbiguous(patch, clarifications) {
  if (!patch || typeof patch !== "object") {
    return;
  }
  const requiresOperationSelection =
    Array.isArray(clarifications) &&
    clarifications.some((entry) => {
      return !!(
        entry &&
        entry.required === true &&
        entry.binding &&
        entry.binding.type === "operations_set"
      );
    });
  if (!requiresOperationSelection) {
    return;
  }
  patch.clear_operations = false;
  patch.operations = {};
}

function applyDeleteOperationDisambiguation(
  patch,
  formState,
  prompt,
  schemaHints,
) {
  if (
    !patch ||
    typeof patch !== "object" ||
    !patch.operations ||
    typeof patch.operations !== "object"
  ) {
    return;
  }
  const lowerPrompt = String(prompt || "").toLowerCase();
  if (!/\bdelete(?:s)?\b/.test(lowerPrompt)) {
    return;
  }
  if (
    /\bempty\b|\bmissing\b|\bnon[-\s]?existent\b|\bnot\s+found\b/.test(
      lowerPrompt,
    ) ||
    promptMentionsOperation(lowerPrompt, "empty_point_deletes") ||
    promptMentionsOperation(lowerPrompt, "point_deletes") ||
    promptMentionsOperation(lowerPrompt, "range_deletes")
  ) {
    return;
  }

  const promptCount = extractPromptCountHint(prompt);
  const effectiveBeforeRewrite = buildEffectiveState(
    patch,
    formState,
    schemaHints,
  );
  const hasKnownKeys = !!(
    effectiveBeforeRewrite.operations &&
    effectiveBeforeRewrite.operations.inserts &&
    effectiveBeforeRewrite.operations.inserts.enabled
  );
  if (!hasKnownKeys) {
    return;
  }

  const hasAnyDeletePatch = [
    "empty_point_deletes",
    "point_deletes",
    "range_deletes",
  ].some((op) => {
    const opPatch = patch.operations[op];
    return !!(
      opPatch &&
      typeof opPatch === "object" &&
      Object.keys(opPatch).length > 0
    );
  });

  if (!hasAnyDeletePatch) {
    const inferredPointDeletes =
      patch.operations.point_deletes &&
      typeof patch.operations.point_deletes === "object"
        ? patch.operations.point_deletes
        : {};
    if (typeof inferredPointDeletes.enabled !== "boolean") {
      inferredPointDeletes.enabled = true;
    }
    if (
      inferredPointDeletes.op_count === null ||
      inferredPointDeletes.op_count === undefined
    ) {
      inferredPointDeletes.op_count = promptCount;
    }
    patch.operations.point_deletes = inferredPointDeletes;
    return;
  }

  const emptyDeletePatch = patch.operations.empty_point_deletes;
  if (!emptyDeletePatch || typeof emptyDeletePatch !== "object") {
    return;
  }

  const nextPointDeletes =
    patch.operations.point_deletes &&
    typeof patch.operations.point_deletes === "object"
      ? patch.operations.point_deletes
      : {};
  if (
    nextPointDeletes.op_count === null ||
    nextPointDeletes.op_count === undefined
  ) {
    nextPointDeletes.op_count =
      emptyDeletePatch.op_count ??
      nextPointDeletes.op_count ??
      promptCount ??
      null;
  }
  if (nextPointDeletes.enabled !== true) {
    nextPointDeletes.enabled = true;
  }
  patch.operations.point_deletes = nextPointDeletes;

  patch.operations.empty_point_deletes = {
    enabled: false,
  };
}

function promptLikelySetsOperationCount(lowerPrompt) {
  const text = String(lowerPrompt || "").toLowerCase();
  if (!text) {
    return false;
  }
  if (
    new RegExp(`\\b(?:${OPERATION_DISABLE_INTENT_TERMS.join("|")})\\b`).test(
      text,
    )
  ) {
    return false;
  }
  return new RegExp(`\\b(?:${OPERATION_COUNT_INTENT_TERMS.join("|")})\\b`).test(
    text,
  );
}

function promptMentionsDistributionChange(lowerPrompt) {
  const text = String(lowerPrompt || "").toLowerCase();
  if (!text) {
    return false;
  }
  return (
    /\bdistribution\b/.test(text) ||
    new RegExp(
      `\\b(?:${SELECTION_DISTRIBUTION_TERMS.map((term) => escapeRegExp(term)).join("|")})\\b`,
    ).test(text)
  );
}

function getOperationCapabilities(schemaHints, operationName) {
  return schemaHints &&
    schemaHints.capabilities &&
    schemaHints.capabilities[operationName]
    ? schemaHints.capabilities[operationName]
    : {};
}

function getCurrentOperationState(formState, operationName) {
  return formState &&
    formState.operations &&
    formState.operations[operationName]
    ? formState.operations[operationName]
    : {};
}

function ensureOperationPatchObject(patch, operationName) {
  if (!patch.operations || typeof patch.operations !== "object") {
    patch.operations = {};
  }
  if (
    !patch.operations[operationName] ||
    typeof patch.operations[operationName] !== "object"
  ) {
    patch.operations[operationName] = {};
  }
  return patch.operations[operationName];
}

function getSingleMentionedOperationContext(
  patch,
  formState,
  lowerPrompt,
  schemaHints,
) {
  const mentionedOps = getMentionedOperationsFromPrompt(
    lowerPrompt,
    schemaHints,
  );
  if (mentionedOps.length !== 1) {
    return null;
  }

  const operationName = mentionedOps[0];
  return {
    operationName,
    capabilities: getOperationCapabilities(schemaHints, operationName),
    currentState: getCurrentOperationState(formState, operationName),
    opPatch: ensureOperationPatchObject(patch, operationName),
  };
}

function applyPromptOperationFieldFallback(
  patch,
  formState,
  prompt,
  schemaHints,
) {
  if (!patch || typeof patch !== "object") {
    return;
  }

  const lowerPrompt = String(prompt || "").toLowerCase();
  if (!lowerPrompt) {
    return;
  }

  const operationContext = getSingleMentionedOperationContext(
    patch,
    formState,
    lowerPrompt,
    schemaHints,
  );
  if (!operationContext) {
    return;
  }

  const { operationName, capabilities, currentState, opPatch } =
    operationContext;
  let changed = false;

  const promptCount = extractPromptCountHint(prompt);
  if (
    capabilities.has_op_count !== false &&
    promptCount !== null &&
    (promptLikelySetsOperationCount(lowerPrompt) ||
      opPatch.op_count === null ||
      opPatch.op_count === undefined) &&
    opPatch.enabled !== false
  ) {
    opPatch.op_count = promptCount;
    changed = true;
  }

  const detectedDistribution = detectSelectionDistribution(
    lowerPrompt,
    schemaHints.selection_distributions,
  );
  if (
    capabilities.has_selection &&
    detectedDistribution &&
    promptMentionsDistributionChange(lowerPrompt) &&
    !shouldTreatPromptAsStringDistribution(lowerPrompt, schemaHints) &&
    opPatch.enabled !== false
  ) {
    opPatch.selection = null;
    opPatch.selection_distribution = detectedDistribution;
    const requiredParams =
      SELECTION_DISTRIBUTION_PARAM_KEYS[detectedDistribution] || [];
    requiredParams.forEach((fieldName) => {
      const currentValue = currentState[fieldName];
      if (currentValue !== null && currentValue !== undefined) {
        opPatch[fieldName] = currentValue;
        return;
      }
      if (
        Object.prototype.hasOwnProperty.call(
          SELECTION_PARAM_DEFAULTS,
          fieldName,
        )
      ) {
        opPatch[fieldName] = SELECTION_PARAM_DEFAULTS[fieldName];
      }
    });
    changed = true;
  }

  if (changed) {
    patch.operations[operationName] = opPatch;
  }
}

function deriveStructuredSectionsFromPrompt(prompt, schemaHints) {
  const text = typeof prompt === "string" ? prompt.trim() : "";
  if (!text || !STRUCTURED_WORKLOAD_PATTERN.test(text)) {
    return null;
  }

  const lowerPrompt = text.toLowerCase();
  const clauses = splitPromptIntoPhaseClauses(text);
  const groups = clauses
    .map((clause) => deriveStructuredGroupFromClause(clause, schemaHints))
    .filter(
      (group) =>
        group &&
        Object.keys(group).length > 0 &&
        Object.values(group).some((spec) =>
          operationPatchHasConfiguredValues(spec),
        ),
    );
  if (groups.length === 0) {
    return null;
  }

  const declaredPhaseCount = /\bthree[- ]phase\b/.test(lowerPrompt)
    ? 3
    : /\btwo[- ]phase\b/.test(lowerPrompt)
      ? 2
      : /\bsingle[- ]shot\b|\bone[- ]phase\b/.test(lowerPrompt)
        ? 1
        : null;
  if (declaredPhaseCount !== null && groups.length < declaredPhaseCount) {
    return null;
  }
  if (groups.length === 1 && declaredPhaseCount === null) {
    const singleGroup = groups[0] && typeof groups[0] === "object" ? groups[0] : {};
    const operationNames = Object.keys(singleGroup);
    const isExplicitSingleGroupInterleave =
      /\binterleave(?:d)?\b/.test(lowerPrompt) && operationNames.length > 1;
    const isExplicitSingleGroupPhaseLayout =
      operationNames.length > 0 &&
      /\b(?:phase|then|next|after(?: that|wards)?|later|finally|group)\b/.test(
        lowerPrompt,
      );
    if (!isExplicitSingleGroupInterleave && !isExplicitSingleGroupPhaseLayout) {
      return null;
    }
  }

  return [{ groups }];
}

function splitPromptIntoPhaseClauses(prompt) {
  const groupAppendMarker =
    "(?:an?\\s+)?(?:another|new|next|second|third|2nd|3rd)\\s+group";
  const normalized = String(prompt || "")
    .replace(/\bphase\s+(?:1|2|3|one|two|three)\b\s*:?\s*/gi, " || ")
    .replace(
      new RegExp(
        `(?:\\r?\\n)+\\s*(?=(?:preload|interleave|interleaved|phase\\s+(?:1|2|3|one|two|three)|write[- ]heavy|write[- ]only|${groupAppendMarker}|add\\s+${groupAppendMarker})\\b)`,
        "gi",
      ),
      " || ",
    )
    .replace(
      new RegExp(
        `[.!?]\\s*(?=(?:preload|interleave|interleaved|phase\\s+(?:1|2|3|one|two|three)|write[- ]heavy|write[- ]only|${groupAppendMarker}|add\\s+${groupAppendMarker})\\b)`,
        "gi",
      ),
      " || ",
    )
    .replace(
      /\b(?:then|followed by|after that|afterwards|next|finally)\b/gi,
      " || ",
    )
    .replace(
      new RegExp(
        `,\\s*(?=(?:preload|interleave|interleaved|phase\\s+(?:1|2|3|one|two|three)|write[- ]heavy|write[- ]only|${groupAppendMarker}|add\\s+${groupAppendMarker})\\b)`,
        "gi",
      ),
      " || ",
    );
  return normalized
    .split("||")
    .map((part) => part.trim())
    .filter(Boolean);
}

function extractOperationAmountHints(text, operations) {
  const lowerText = String(text || "").toLowerCase();
  const hints = {};
  operations.forEach((operationName) => {
    const patternSource = getOperationPromptPatternSource(operationName);
    if (!patternSource) {
      return;
    }
    const amountPatternSource =
      operationName === "range_queries" || operationName === "range_deletes"
        ? `(?:short\\s+|long\\s+)?(?:${patternSource})`
        : patternSource;
    const patterns = [
      new RegExp(
        `\\b(\\d[\\d,]*(?:\\.\\d+)?\\s*[kmb]?|\\d+(?:\\.\\d+)?)\\s*(%)?\\s+(?:of\\s+)?(?:the\\s+)?${amountPatternSource}\\b`,
        "i",
      ),
      new RegExp(
        `\\b${amountPatternSource}\\b\\s+(?:at|with)\\s+(\\d[\\d,]*(?:\\.\\d+)?\\s*[kmb]?|\\d+(?:\\.\\d+)?)\\s*(%)?\\b`,
        "i",
      ),
    ];
    for (const pattern of patterns) {
      const match = lowerText.match(pattern);
      if (!match || !match[1]) {
        continue;
      }
      if (match[2] === "%") {
        const percent = numberOrNull(match[1]);
        if (percent !== null) {
          hints[operationName] = { type: "percent", value: percent };
        }
        break;
      }
      const count = parseHumanCountToken(match[1]);
      if (count !== null) {
        hints[operationName] = { type: "count", value: count };
      }
      break;
    }
  });
  return hints;
}

function detectRangeQueryProfile(lowerPrompt) {
  const text = String(lowerPrompt || "");
  if (/\bshort\s+range\s+quer(?:y|ie|ies)\b/.test(text)) {
    return "short";
  }
  if (/\blong\s+range\s+quer(?:y|ie|ies)\b/.test(text)) {
    return "long";
  }
  return null;
}

function deriveStructuredGroupFromClause(clause, schemaHints) {
  const text = String(clause || "").trim();
  if (!text) {
    return null;
  }
  const lowerClause = text.toLowerCase();
  let operations = getMentionedOperationsFromPrompt(lowerClause, schemaHints);
  const isPreload =
    /\bpreload\b|\bseed\b|\bprime\b|\bload\s+the\s+db\b|\bload\s+the\s+database\b|\bload\s+database\b/.test(
      lowerClause,
    );
  const isWriteOnly = /\bwrite[- ]only\b/.test(lowerClause);
  const isWriteHeavy = /\bwrite[- ]heavy\b/.test(lowerClause);

  if (isPreload && !operations.includes("inserts")) {
    operations.unshift("inserts");
  }
  if (
    /\b(?:short|long)\s+range\s+quer(?:y|ie|ies)\b/.test(lowerClause) &&
    !operations.includes("range_queries")
  ) {
    operations.push("range_queries");
  }

  let defaultPercents = null;
  if (isWriteOnly) {
    operations = uniqueStrings(["updates", ...operations]);
    defaultPercents = { updates: 100 };
  } else if (isWriteHeavy) {
    const readOperation = operations.includes("range_queries")
      ? "range_queries"
      : operations.includes("point_queries")
        ? "point_queries"
        : "point_queries";
    operations = uniqueStrings(["updates", ...operations, readOperation]);
    defaultPercents = {
      updates: WRITE_HEAVY_DEFAULT_SPLIT.write,
      [readOperation]: WRITE_HEAVY_DEFAULT_SPLIT.read,
    };
  }

  if (operations.length === 0) {
    return null;
  }

  const totalCount = extractPromptCountHint(text);
  const amountHints = extractOperationAmountHints(text, operations);
  const group = {};

  operations.forEach((operationName) => {
    const amountHint = amountHints[operationName] || null;
    let opCount = null;
    if (amountHint && amountHint.type === "count") {
      opCount = amountHint.value;
    } else if (
      amountHint &&
      amountHint.type === "percent" &&
      totalCount !== null
    ) {
      opCount = Math.round((totalCount * amountHint.value) / 100);
    } else if (
      defaultPercents &&
      Object.prototype.hasOwnProperty.call(defaultPercents, operationName) &&
      totalCount !== null
    ) {
      opCount = Math.round((totalCount * defaultPercents[operationName]) / 100);
    } else if (operations.length === 1 && totalCount !== null) {
      opCount = totalCount;
    }

    const spec = {};
    if (opCount !== null) {
      spec.op_count = opCount;
    }
    if (
      operationName === "range_queries" ||
      operationName === "range_deletes"
    ) {
      const rangeProfile = detectRangeQueryProfile(lowerClause);
      if (rangeProfile) {
        spec.selectivity = RANGE_QUERY_SELECTIVITY_PROFILES[rangeProfile];
        spec.range_format = "StartCount";
      } else {
        spec.selectivity = 0.01;
        spec.range_format = "StartCount";
      }
    }
    group[operationName] = spec;
  });

  return group;
}

function extractPromptCountHint(prompt) {
  const text = String(prompt || "");
  if (!text) {
    return null;
  }
  const contextualMatches = [
    ...text.matchAll(
      /(\d[\d,]*(?:\.\d+)?(?:\s*(?:k|m|b|thousand|million|billion))?)(?!\s*%)(?=\s+(?:operations?|ops?|entries?|inserts?|updates?|merges?|deletes?|queries?|reads?))/gi,
    ),
  ];
  if (contextualMatches.length > 0) {
    return parseHumanCountToken(
      contextualMatches[contextualMatches.length - 1][1],
    );
  }
  const genericMatches = [
    ...text.matchAll(
      /\b(\d[\d,]*(?:\.\d+)?(?:\s*(?:k|m|b|thousand|million|billion))?)\b(?!\s*%)/gi,
    ),
  ];
  if (genericMatches.length > 0) {
    return parseHumanCountToken(genericMatches[genericMatches.length - 1][1]);
  }
  return null;
}

function constrainPatchToCurrentOperationScope(
  mergedPatch,
  formState,
  prompt,
  schemaHints,
) {
  if (
    !mergedPatch ||
    typeof mergedPatch !== "object" ||
    !mergedPatch.operations ||
    typeof mergedPatch.operations !== "object"
  ) {
    return;
  }

  const currentEnabled = schemaHints.operation_order.filter((op) => {
    const current =
      formState.operations && formState.operations[op]
        ? formState.operations[op]
        : null;
    return !!(current && current.enabled);
  });
  if (currentEnabled.length !== 1) {
    return;
  }

  const scopeOp = currentEnabled[0];
  const lowerPrompt = String(prompt || "").toLowerCase();
  const hasAnyExplicitOperationMention = schemaHints.operation_order.some(
    (op) => promptMentionsOperation(lowerPrompt, op),
  );
  const hasExplicitBroadeningIntent =
    /\b(add|include|also|plus|enable|operation mix|change operations|operations)\b/.test(
      lowerPrompt,
    );

  // If prompt does not explicitly change operation mix, keep changes scoped to currently enabled op.
  if (!hasAnyExplicitOperationMention && !hasExplicitBroadeningIntent) {
    schemaHints.operation_order.forEach((op) => {
      const opPatch = mergedPatch.operations[op];
      if (!opPatch || typeof opPatch !== "object") {
        return;
      }
      if (op === scopeOp) {
        if (
          opPatch.enabled === false &&
          !promptExplicitlyDisablesOperation(prompt, op, schemaHints)
        ) {
          opPatch.enabled = true;
        }
        return;
      }
      if (opPatch.enabled === true) {
        opPatch.enabled = false;
      }
    });
  }
}

function suppressSelectionPatchForStringDistributionPrompts(
  mergedPatch,
  formState,
  prompt,
  schemaHints,
) {
  if (
    !mergedPatch ||
    typeof mergedPatch !== "object" ||
    !mergedPatch.operations ||
    typeof mergedPatch.operations !== "object"
  ) {
    return;
  }
  const lowerPrompt = String(prompt || "").toLowerCase();
  if (!shouldTreatPromptAsStringDistribution(lowerPrompt, schemaHints)) {
    return;
  }

  schemaHints.operation_order.forEach((op) => {
    const caps =
      schemaHints.capabilities && schemaHints.capabilities[op]
        ? schemaHints.capabilities[op]
        : {};
    if (!caps.has_selection) {
      return;
    }
    if (promptMentionsOperation(lowerPrompt, op)) {
      return;
    }
    const opPatch = mergedPatch.operations[op];
    if (!opPatch || typeof opPatch !== "object") {
      return;
    }
    const current =
      formState.operations && formState.operations[op]
        ? formState.operations[op]
        : {};
    opPatch.enabled = !!current.enabled;
    opPatch.selection_distribution = current.selection_distribution || null;
    opPatch.selection_min = current.selection_min ?? null;
    opPatch.selection_max = current.selection_max ?? null;
    opPatch.selection_mean = current.selection_mean ?? null;
    opPatch.selection_std_dev = current.selection_std_dev ?? null;
    opPatch.selection_alpha = current.selection_alpha ?? null;
    opPatch.selection_beta = current.selection_beta ?? null;
    opPatch.selection_n = current.selection_n ?? null;
    opPatch.selection_s = current.selection_s ?? null;
    opPatch.selection_lambda = current.selection_lambda ?? null;
    opPatch.selection_scale = current.selection_scale ?? null;
    opPatch.selection_shape = current.selection_shape ?? null;
  });
}

function promptExplicitlyDisablesOperation(prompt, operationName, schemaHints) {
  const text = String(prompt || "").toLowerCase();
  if (!text) {
    return false;
  }

  if (/\bclear operations\b/.test(text)) {
    return true;
  }

  const label = humanizeOperation(operationName, schemaHints);
  const escapedName = escapeRegExp(String(operationName).replace(/_/g, " "));
  const escapedLabel = escapeRegExp(label);
  const disablePattern = new RegExp(
    "(?:\\bdisable\\b|\\bremove\\b|\\bexclude\\b|\\bwithout\\b|\\bno\\b)\\s+(?:" +
      escapedName +
      "|" +
      escapedLabel +
      ")",
    "i",
  );
  return disablePattern.test(text);
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function cloneJsonValue(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

function normalizeCharacterSetValue(value, schemaHints) {
  if (typeof value !== "string") {
    return null;
  }
  const cleaned = value.trim();
  return schemaHints.character_sets.includes(cleaned) ? cleaned : null;
}

function normalizeDistributionValue(value, allowedDistributions) {
  if (!isPlainObject(value)) {
    return null;
  }
  const keys = Object.keys(value);
  if (keys.length !== 1) {
    return null;
  }
  const name = String(keys[0] || "").trim();
  if (!allowedDistributions.includes(name)) {
    return null;
  }
  const inner = value[name];
  if (!isPlainObject(inner)) {
    return null;
  }
  const requiredKeys = DISTRIBUTION_REQUIRED_KEYS[name] || [];
  const normalizedInner = {};
  for (const key of requiredKeys) {
    const rawParam = inner[key];
    if (!Number.isFinite(Number(rawParam))) {
      return null;
    }
    if (key === "n") {
      const normalizedInteger = nonNegativeIntegerOrNull(rawParam);
      if (normalizedInteger === null) {
        return null;
      }
      normalizedInner[key] = normalizedInteger;
      continue;
    }
    normalizedInner[key] = Number(rawParam);
  }
  return { [name]: normalizedInner };
}

function normalizeNumberExprValue(value, allowedDistributions, mode) {
  const policy = mode || "positive";
  if (isPlainObject(value)) {
    return normalizeDistributionValue(value, allowedDistributions);
  }
  let numeric = null;
  if (typeof value === "string") {
    numeric = parseHumanCountToken(value);
    if (numeric === null) {
      numeric = numberOrNull(value);
    }
  } else {
    numeric = numberOrNull(value);
  }
  if (numeric === null) {
    return null;
  }
  if (policy === "non_negative") {
    return numeric >= 0 ? numeric : null;
  }
  if (policy === "integer_non_negative") {
    const parsedInteger = nonNegativeIntegerOrNull(numeric);
    return parsedInteger;
  }
  return numeric > 0 ? numeric : null;
}

function normalizeStringExprValue(value, schemaHints) {
  if (typeof value === "string") {
    return value;
  }
  if (!isPlainObject(value)) {
    return null;
  }
  const keys = Object.keys(value);
  if (keys.length !== 1) {
    return null;
  }
  const variant = String(keys[0] || "").trim();
  const inner = value[variant];
  if (variant === "uniform") {
    if (!isPlainObject(inner)) {
      return null;
    }
    const len = normalizeNumberExprValue(
      inner.len,
      schemaHints.selection_distributions,
      "non_negative",
    );
    if (len === null) {
      return null;
    }
    const normalizedUniform = { len };
    const characterSet = normalizeCharacterSetValue(
      inner.character_set,
      schemaHints,
    );
    if (characterSet) {
      normalizedUniform.character_set = characterSet;
    }
    return { uniform: normalizedUniform };
  }
  if (variant === "weighted") {
    if (!Array.isArray(inner) || inner.length === 0) {
      return null;
    }
    const weighted = [];
    for (const entry of inner) {
      if (!isPlainObject(entry) || !Number.isFinite(Number(entry.weight))) {
        return null;
      }
      const normalizedValue = normalizeStringExprValue(
        entry.value,
        schemaHints,
      );
      if (normalizedValue === null) {
        return null;
      }
      weighted.push({
        weight: Number(entry.weight),
        value: normalizedValue,
      });
    }
    return { weighted };
  }
  if (variant === "segmented") {
    if (
      !isPlainObject(inner) ||
      typeof inner.separator !== "string" ||
      !Array.isArray(inner.segments) ||
      inner.segments.length === 0
    ) {
      return null;
    }
    const segments = inner.segments
      .map((entry) => normalizeStringExprValue(entry, schemaHints))
      .filter((entry) => entry !== null);
    if (segments.length !== inner.segments.length) {
      return null;
    }
    return {
      segmented: {
        separator: inner.separator,
        segments,
      },
    };
  }
  if (variant === "hot_range") {
    if (!isPlainObject(inner)) {
      return null;
    }
    const len = nonNegativeIntegerOrNull(inner.len);
    const amount = nonNegativeIntegerOrNull(inner.amount);
    const probability = numberOrNull(inner.probability);
    if (len === null || amount === null || probability === null) {
      return null;
    }
    return {
      hot_range: {
        len,
        amount,
        probability,
      },
    };
  }
  return null;
}

function distributionNameFromValue(value) {
  if (!isPlainObject(value)) {
    return null;
  }
  const keys = Object.keys(value);
  return keys.length === 1 ? keys[0] : null;
}

function normalizePatch(rawPatch, schemaHints) {
  const patch = rawPatch && typeof rawPatch === "object" ? rawPatch : {};
  const normalizedSections = Object.prototype.hasOwnProperty.call(
    patch,
    "sections",
  )
    ? patch.sections === null
      ? null
      : normalizeSectionsValue(patch.sections, schemaHints)
    : undefined;
  const normalized = {
    character_set: normalizeCharacterSetValue(patch.character_set, schemaHints),
    sections_count: positiveIntegerOrNull(patch.sections_count),
    groups_per_section: positiveIntegerOrNull(patch.groups_per_section),
    sections: normalizedSections,
    skip_key_contains_check: Object.prototype.hasOwnProperty.call(
      patch,
      "skip_key_contains_check",
    )
      ? patch.skip_key_contains_check === true
      : undefined,
    clear_operations: patch.clear_operations === true,
    operations: {},
  };

  const operationsPatch = normalizeOperationEntriesValue(patch.operations, schemaHints);

  schemaHints.operation_order.forEach((op) => {
    if (!Object.prototype.hasOwnProperty.call(operationsPatch, op)) {
      return;
    }
    normalized.operations[op] = normalizeOperationPatch(
      operationsPatch[op],
      op,
      schemaHints,
    );
  });

  return normalized;
}

function normalizeOperationPatch(rawPatch, op, schemaHints) {
  const patch = rawPatch && typeof rawPatch === "object" ? rawPatch : {};
  const hasExplicitFields = Object.keys(patch).length > 0;
  const rangeFormats = Array.isArray(schemaHints.range_formats)
    ? schemaHints.range_formats
    : [];
  const selectionDistributions = Array.isArray(
    schemaHints.selection_distributions,
  )
    ? schemaHints.selection_distributions
    : [];
  const stringPatterns =
    Array.isArray(schemaHints.string_patterns) &&
    schemaHints.string_patterns.length > 0
      ? schemaHints.string_patterns
      : STRING_PATTERN_VALUES;
  const caps =
    schemaHints.capabilities && schemaHints.capabilities[op]
      ? schemaHints.capabilities[op]
      : {};

  const normalized = {
    enabled: typeof patch.enabled === "boolean" ? patch.enabled : undefined,
    character_set: normalizeCharacterSetValue(patch.character_set, schemaHints),
    op_count: normalizeNumberExprValue(
      patch.op_count,
      selectionDistributions,
      "positive",
    ),
    key: normalizeStringExprValue(patch.key, schemaHints),
    val: normalizeStringExprValue(patch.val, schemaHints),
    selection: normalizeDistributionValue(
      patch.selection,
      selectionDistributions,
    ),
    k: normalizeNumberExprValue(patch.k, selectionDistributions, "positive"),
    l: normalizeNumberExprValue(patch.l, selectionDistributions, "positive"),
    key_len: positiveIntegerOrNull(patch.key_len),
    val_len: positiveIntegerOrNull(patch.val_len),
    key_pattern: normalizeStringPatternName(patch.key_pattern, stringPatterns),
    val_pattern: normalizeStringPatternName(patch.val_pattern, stringPatterns),
    key_hot_len: positiveIntegerOrNull(patch.key_hot_len),
    key_hot_amount: nonNegativeIntegerOrNull(patch.key_hot_amount),
    key_hot_probability: probabilityOrNull(patch.key_hot_probability),
    val_hot_len: positiveIntegerOrNull(patch.val_hot_len),
    val_hot_amount: nonNegativeIntegerOrNull(patch.val_hot_amount),
    val_hot_probability: probabilityOrNull(patch.val_hot_probability),
    selection_distribution:
      typeof patch.selection_distribution === "string" &&
      selectionDistributions.includes(patch.selection_distribution)
        ? patch.selection_distribution
        : null,
    selection_min: numberOrNull(patch.selection_min),
    selection_max: numberOrNull(patch.selection_max),
    selection_mean: numberOrNull(patch.selection_mean),
    selection_std_dev: nonNegativeNumberOrNull(patch.selection_std_dev),
    selection_alpha: nonNegativeNumberOrNull(patch.selection_alpha),
    selection_beta: nonNegativeNumberOrNull(patch.selection_beta),
    selection_n: positiveIntegerOrNull(patch.selection_n),
    selection_s: nonNegativeNumberOrNull(patch.selection_s),
    selection_lambda: nonNegativeNumberOrNull(patch.selection_lambda),
    selection_scale: nonNegativeNumberOrNull(patch.selection_scale),
    selection_shape: nonNegativeNumberOrNull(patch.selection_shape),
    selectivity: normalizeNumberExprValue(
      patch.selectivity,
      selectionDistributions,
      "non_negative",
    ),
    range_format:
      typeof patch.range_format === "string" &&
      rangeFormats.includes(patch.range_format)
        ? patch.range_format
        : null,
  };

  if (
    !normalized.selection_distribution &&
    typeof patch.selection_distribution === "string"
  ) {
    const cleaned = patch.selection_distribution.trim().toLowerCase();
    if (selectionDistributions.includes(cleaned)) {
      normalized.selection_distribution = cleaned;
    }
  }
  if (
    normalized.selection_n === null &&
    typeof patch.selection_n === "string"
  ) {
    normalized.selection_n = positiveIntegerOrNull(
      parseHumanCountToken(patch.selection_n),
    );
  }
  if (
    normalized.key_hot_amount === null &&
    typeof patch.key_hot_amount === "string"
  ) {
    normalized.key_hot_amount = nonNegativeIntegerOrNull(
      parseHumanCountToken(patch.key_hot_amount),
    );
  }
  if (
    normalized.val_hot_amount === null &&
    typeof patch.val_hot_amount === "string"
  ) {
    normalized.val_hot_amount = nonNegativeIntegerOrNull(
      parseHumanCountToken(patch.val_hot_amount),
    );
  }
  if (
    !normalized.selection &&
    patch.selection &&
    typeof patch.selection === "object"
  ) {
    normalized.selection = normalizeDistributionValue(
      patch.selection,
      selectionDistributions,
    );
  }
  if (!normalized.selection_distribution && normalized.selection) {
    normalized.selection_distribution = distributionNameFromValue(
      normalized.selection,
    );
  }

  if (normalized.enabled === undefined && hasExplicitFields) {
    normalized.enabled = inferOperationEnabledFromPatch(
      normalized,
      op,
      schemaHints,
    );
  }

  // Enforce schema capabilities so AI cannot set invalid fields for an operation.
  const supportsOpCount =
    caps.has_op_count === undefined ? true : !!caps.has_op_count;
  if (!supportsOpCount) {
    normalized.op_count = null;
  }
  if (!(caps.has_character_set === true)) {
    normalized.character_set = null;
  }
  if (!caps.has_key) {
    normalized.key = null;
    normalized.key_len = null;
    normalized.key_pattern = null;
    normalized.key_hot_len = null;
    normalized.key_hot_amount = null;
    normalized.key_hot_probability = null;
  }
  if (!caps.has_val) {
    normalized.val = null;
    normalized.val_len = null;
    normalized.val_pattern = null;
    normalized.val_hot_len = null;
    normalized.val_hot_amount = null;
    normalized.val_hot_probability = null;
  }
  if (!caps.has_selection) {
    normalized.selection = null;
    normalized.selection_distribution = null;
    normalized.selection_min = null;
    normalized.selection_max = null;
    normalized.selection_mean = null;
    normalized.selection_std_dev = null;
    normalized.selection_alpha = null;
    normalized.selection_beta = null;
    normalized.selection_n = null;
    normalized.selection_s = null;
    normalized.selection_lambda = null;
    normalized.selection_scale = null;
    normalized.selection_shape = null;
  }
  if (!caps.has_range) {
    normalized.selectivity = null;
    normalized.range_format = null;
  }
  if (!caps.has_sorted) {
    normalized.k = null;
    normalized.l = null;
  }

  return normalized;
}

function normalizeOperationEntriesValue(rawValue, schemaHints) {
  if (Array.isArray(rawValue)) {
    const mapped = {};
    rawValue.forEach((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return;
      }
      const name =
        typeof entry.name === "string" && entry.name.trim()
          ? entry.name.trim()
          : typeof entry.operation === "string" && entry.operation.trim()
            ? entry.operation.trim()
            : typeof entry.kind === "string" && entry.kind.trim()
              ? entry.kind.trim()
          : "";
      if (!name || !schemaHints.operation_order.includes(name)) {
        return;
      }
      const nextEntry = Array.isArray(entry.fields)
        ? normalizeOperationFieldEntries(entry.fields)
        : Array.isArray(entry.operation_fields)
          ? normalizeOperationFieldEntries(entry.operation_fields)
        : { ...entry };
      delete nextEntry.name;
      delete nextEntry.operation;
      delete nextEntry.fields;
      delete nextEntry.operation_fields;
      delete nextEntry.kind;
      delete nextEntry.command;
      mapped[name] = nextEntry;
    });
    return mapped;
  }
  return rawValue && typeof rawValue === "object" && !Array.isArray(rawValue)
    ? rawValue
    : {};
}

function normalizeOperationFieldEntries(rawFields) {
  if (!Array.isArray(rawFields)) {
    return {};
  }
  const mapped = {};
  rawFields.forEach((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return;
    }
    const field =
      typeof entry.field === "string" && entry.field.trim()
        ? entry.field.trim()
        : "";
    if (!field) {
      return;
    }
    if (typeof entry.boolean_value === "boolean") {
      mapped[field] = entry.boolean_value;
      return;
    }
    if (Number.isFinite(Number(entry.number_value))) {
      mapped[field] = Number(entry.number_value);
      return;
    }
    if (typeof entry.string_value === "string") {
      mapped[field] = entry.string_value;
      return;
    }
    if (typeof entry.json_value === "string" && entry.json_value.trim()) {
      const parsedJson = safeJsonParse(entry.json_value);
      mapped[field] = parsedJson === null ? entry.json_value : parsedJson;
    }
  });
  return mapped;
}

function inferOperationEnabledFromPatch(operationPatch, op, schemaHints) {
  if (!operationPatch || typeof operationPatch !== "object") {
    return false;
  }
  if (
    operationPatch.op_count !== null &&
    (schemaHints.capabilities && schemaHints.capabilities[op]
      ? schemaHints.capabilities[op].has_op_count !== false
      : true)
  ) {
    return true;
  }
  const caps =
    schemaHints.capabilities && schemaHints.capabilities[op]
      ? schemaHints.capabilities[op]
      : {};
  if (
    caps.has_key &&
    (operationPatch.key !== null ||
      operationPatch.character_set !== null ||
      operationPatch.key_len !== null ||
      operationPatch.key_pattern !== null ||
      operationPatch.key_hot_len !== null ||
      operationPatch.key_hot_amount !== null ||
      operationPatch.key_hot_probability !== null)
  ) {
    return true;
  }
  if (
    caps.has_val &&
    (operationPatch.val !== null ||
      operationPatch.character_set !== null ||
      operationPatch.val_len !== null ||
      operationPatch.val_pattern !== null ||
      operationPatch.val_hot_len !== null ||
      operationPatch.val_hot_amount !== null ||
      operationPatch.val_hot_probability !== null)
  ) {
    return true;
  }
  if (
    caps.has_selection &&
    (operationPatch.selection !== null ||
      operationPatch.selection_distribution !== null ||
      operationPatch.selection_min !== null ||
      operationPatch.selection_max !== null ||
      operationPatch.selection_mean !== null ||
      operationPatch.selection_std_dev !== null ||
      operationPatch.selection_alpha !== null ||
      operationPatch.selection_beta !== null ||
      operationPatch.selection_n !== null ||
      operationPatch.selection_s !== null ||
      operationPatch.selection_lambda !== null ||
      operationPatch.selection_scale !== null ||
      operationPatch.selection_shape !== null)
  ) {
    return true;
  }
  if (
    caps.has_range &&
    (operationPatch.selectivity !== null ||
      operationPatch.range_format !== null)
  ) {
    return true;
  }
  if (
    caps.has_sorted &&
    (operationPatch.k !== null || operationPatch.l !== null)
  ) {
    return true;
  }
  if (caps.has_character_set && operationPatch.character_set !== null) {
    return true;
  }
  return false;
}

function detectSelectionDistribution(lowerPrompt, allowedDistributions) {
  const candidates =
    Array.isArray(allowedDistributions) && allowedDistributions.length > 0
      ? allowedDistributions
      : DEFAULT_SELECTION_DISTRIBUTIONS;

  for (const candidate of candidates) {
    const aliases = SELECTION_DISTRIBUTION_ALIASES[candidate] || [candidate];
    const matched = aliases.some((alias) => {
      const escaped = escapeRegExp(alias);
      const regex = new RegExp("\\b" + escaped + "\\b", "i");
      return regex.test(lowerPrompt);
    });
    if (matched) {
      return candidate;
    }
  }

  return null;
}

function getOperationPromptPatternSource(operationName) {
  return OPERATION_PROMPT_PATTERN_SOURCES[operationName] || null;
}

function getOperationPromptBlockedPrefixes(operationName) {
  return OPERATION_PROMPT_BLOCKED_PREFIXES[operationName] || [];
}

function operationPatternMatchesWithPrefixGuards(text, regex, blockedPrefixes) {
  if (!regex) {
    return false;
  }
  const disallowedPrefixes = Array.isArray(blockedPrefixes)
    ? blockedPrefixes
    : [];
  regex.lastIndex = 0;
  if (disallowedPrefixes.length === 0) {
    return regex.test(text);
  }
  let match = null;
  while ((match = regex.exec(text)) !== null) {
    const prefix = text.slice(0, match.index).trimEnd();
    const isBlocked = disallowedPrefixes.some((blockedPrefix) =>
      prefix.endsWith(blockedPrefix),
    );
    if (!isBlocked) {
      return true;
    }
  }
  return false;
}

function promptExplicitlyRestrictsToOperation(prompt, operationName) {
  const lowerPrompt = String(prompt || "").toLowerCase();
  const patternSource = getOperationPromptPatternSource(operationName);
  if (!lowerPrompt || !patternSource) {
    return false;
  }
  const blockedPrefixes = getOperationPromptBlockedPrefixes(operationName);
  const patterns = [
    new RegExp(`\\bonly\\s+(?:${patternSource})\\b`, "g"),
    new RegExp(`\\b(?:${patternSource})(?:\\s+workload)?[-\\s]?only\\b`, "g"),
    new RegExp(`\\b(?:${patternSource})\\s+only\\b`, "g"),
  ];
  return patterns.some((pattern) =>
    operationPatternMatchesWithPrefixGuards(
      lowerPrompt,
      pattern,
      blockedPrefixes,
    ),
  );
}

function promptMentionsOperation(lowerPrompt, operationName) {
  const escapedOperationName = escapeRegExp(operationName.toLowerCase());
  if (new RegExp(`\\b${escapedOperationName}\\b`).test(lowerPrompt)) {
    return true;
  }
  const patternSource = getOperationPromptPatternSource(operationName);
  if (
    patternSource &&
    operationPatternMatchesWithPrefixGuards(
      lowerPrompt,
      new RegExp(`\\b(?:${patternSource})\\b`, "g"),
      getOperationPromptBlockedPrefixes(operationName),
    )
  ) {
    return true;
  }
  return false;
}

function buildEffectiveState(patch, formState, schemaHints) {
  const effective = {
    character_set: patch.character_set ?? formState.character_set ?? null,
    sections_count: patch.sections_count ?? formState.sections_count ?? null,
    groups_per_section:
      patch.groups_per_section ?? formState.groups_per_section ?? null,
    skip_key_contains_check:
      typeof patch.skip_key_contains_check === "boolean"
        ? patch.skip_key_contains_check
        : !!formState.skip_key_contains_check,
    operations: {},
  };
  const patchHasStructuredSections =
    Array.isArray(patch.sections) && patch.sections.length > 0;

  const clear = patch.clear_operations === true;
  schemaHints.operation_order.forEach((op) => {
    const current =
      formState.operations && formState.operations[op]
        ? formState.operations[op]
        : {};
    const next =
      patch.operations && patch.operations[op] ? patch.operations[op] : {};
    effective.operations[op] = {
      enabled:
        typeof next.enabled === "boolean"
          ? next.enabled
          : clear
            ? false
            : !!current.enabled,
      character_set: next.character_set ?? current.character_set ?? null,
      op_count: next.op_count ?? current.op_count ?? null,
      key: next.key ?? current.key ?? null,
      val: next.val ?? current.val ?? null,
      selection: next.selection ?? current.selection ?? null,
      k: next.k ?? current.k ?? null,
      l: next.l ?? current.l ?? null,
      key_len: next.key_len ?? current.key_len ?? null,
      val_len: next.val_len ?? current.val_len ?? null,
      key_pattern: next.key_pattern || current.key_pattern || null,
      val_pattern: next.val_pattern || current.val_pattern || null,
      key_hot_len: next.key_hot_len ?? current.key_hot_len ?? null,
      key_hot_amount: next.key_hot_amount ?? current.key_hot_amount ?? null,
      key_hot_probability:
        next.key_hot_probability ?? current.key_hot_probability ?? null,
      val_hot_len: next.val_hot_len ?? current.val_hot_len ?? null,
      val_hot_amount: next.val_hot_amount ?? current.val_hot_amount ?? null,
      val_hot_probability:
        next.val_hot_probability ?? current.val_hot_probability ?? null,
      selection_distribution:
        next.selection_distribution || current.selection_distribution || null,
      selection_min: next.selection_min ?? current.selection_min ?? null,
      selection_max: next.selection_max ?? current.selection_max ?? null,
      selection_mean: next.selection_mean ?? current.selection_mean ?? null,
      selection_std_dev:
        next.selection_std_dev ?? current.selection_std_dev ?? null,
      selection_alpha: next.selection_alpha ?? current.selection_alpha ?? null,
      selection_beta: next.selection_beta ?? current.selection_beta ?? null,
      selection_n: next.selection_n ?? current.selection_n ?? null,
      selection_s: next.selection_s ?? current.selection_s ?? null,
      selection_lambda:
        next.selection_lambda ?? current.selection_lambda ?? null,
      selection_scale: next.selection_scale ?? current.selection_scale ?? null,
      selection_shape: next.selection_shape ?? current.selection_shape ?? null,
      selectivity: next.selectivity ?? current.selectivity ?? null,
      range_format: next.range_format || current.range_format || null,
    };
  });

  let normalizedSections = patchHasStructuredSections
    ? normalizeSectionsValue(patch.sections, schemaHints)
    : clear
      ? synthesizeSectionsFromFlatState(effective, schemaHints)
    : Array.isArray(formState.sections) && formState.sections.length > 0
      ? normalizeSectionsValue(formState.sections, schemaHints)
      : synthesizeSectionsFromFlatState(effective, schemaHints);
  effective.sections_count =
    normalizedSections.length > 0
      ? normalizedSections.length
      : effective.sections_count;
  effective.groups_per_section =
    maxGroupsPerSection(normalizedSections) ?? effective.groups_per_section;
  effective.skip_key_contains_check =
    effective.skip_key_contains_check ||
    normalizedSections.some(
      (section) => section.skip_key_contains_check === true,
    );
  effective.operations = buildAggregateOperationsFromSections(
    normalizedSections,
    schemaHints,
    patchHasStructuredSections ? null : effective.operations,
  );
  if (
    !patchHasStructuredSections &&
    sectionsNeedSynthesisFromFlatOperations(
      normalizedSections,
      effective.operations,
      schemaHints,
    )
  ) {
    normalizedSections = synthesizeSectionsFromFlatState(effective, schemaHints);
    effective.sections_count =
      normalizedSections.length > 0
        ? normalizedSections.length
        : effective.sections_count;
    effective.groups_per_section =
      maxGroupsPerSection(normalizedSections) ?? effective.groups_per_section;
    effective.skip_key_contains_check =
      effective.skip_key_contains_check ||
      normalizedSections.some(
        (section) => section.skip_key_contains_check === true,
      );
    effective.operations = buildAggregateOperationsFromSections(
      normalizedSections,
      schemaHints,
      effective.operations,
    );
  } else if (!patchHasStructuredSections) {
    const projectedSections = projectFlatOperationsIntoUniqueGroups(
      normalizedSections,
      effective.operations,
      schemaHints,
    );
    if (projectedSections !== normalizedSections) {
      normalizedSections = projectedSections;
      effective.sections_count =
        normalizedSections.length > 0
          ? normalizedSections.length
          : effective.sections_count;
      effective.groups_per_section =
        maxGroupsPerSection(normalizedSections) ?? effective.groups_per_section;
      effective.skip_key_contains_check =
        effective.skip_key_contains_check ||
        normalizedSections.some(
          (section) => section.skip_key_contains_check === true,
        );
      effective.operations = buildAggregateOperationsFromSections(
        normalizedSections,
        schemaHints,
        effective.operations,
      );
    }
  }
  effective.sections = normalizedSections;

  return effective;
}

function sectionsNeedSynthesisFromFlatOperations(
  sections,
  operations,
  schemaHints,
) {
  if (!Array.isArray(sections) || sections.length === 0) {
    return true;
  }
  const sectionOperations = buildAggregateOperationsFromSections(
    sections,
    schemaHints,
    null,
  );
  return schemaHints.operation_order.some((operationName) => {
    const flatState =
      operations && operations[operationName] ? operations[operationName] : null;
    const sectionState =
      sectionOperations && sectionOperations[operationName]
        ? sectionOperations[operationName]
        : null;
    return !!(
      flatState &&
      flatState.enabled === true &&
      (!sectionState || sectionState.enabled !== true)
    );
  });
}

function projectFlatOperationsIntoUniqueGroups(
  sections,
  operations,
  schemaHints,
) {
  if (!Array.isArray(sections) || sections.length === 0) {
    return sections;
  }
  let mutated = false;
  const nextSections = cloneJsonValue(sections);
  schemaHints.operation_order.forEach((operationName) => {
    const flatState =
      operations && operations[operationName] ? operations[operationName] : null;
    if (!flatState || flatState.enabled !== true) {
      return;
    }
    const matches = [];
    nextSections.forEach((section, sectionIndex) => {
      const groups = Array.isArray(section && section.groups) ? section.groups : [];
      groups.forEach((group, groupIndex) => {
        if (group && Object.prototype.hasOwnProperty.call(group, operationName)) {
          matches.push({ sectionIndex, groupIndex });
        }
      });
    });
    if (matches.length !== 1) {
      return;
    }
    const { sectionIndex, groupIndex } = matches[0];
    const group =
      nextSections[sectionIndex] &&
      Array.isArray(nextSections[sectionIndex].groups) &&
      nextSections[sectionIndex].groups[groupIndex] &&
      typeof nextSections[sectionIndex].groups[groupIndex] === "object"
        ? nextSections[sectionIndex].groups[groupIndex]
        : null;
    if (!group) {
      return;
    }
    const groupState = normalizeOperationPatch(
      group[operationName],
      operationName,
      schemaHints,
    );
    const needsProjection = configuredOperationFieldNames(flatState).some((fieldName) => {
      const flatValue = flatState[fieldName];
      if (flatValue === null || flatValue === undefined) {
        return false;
      }
      return (
        JSON.stringify(flatValue) !== JSON.stringify(groupState[fieldName])
      );
    });
    if (!needsProjection) {
      return;
    }
    group[operationName] = stripEnabledFromOperationPatch(
      normalizeOperationPatch(
        {
          ...groupState,
          ...flatState,
          enabled: true,
        },
        operationName,
        schemaHints,
      ),
    );
    mutated = true;
  });
  return mutated ? nextSections : sections;
}

function getEnabledOperationNames(state, schemaHints) {
  return schemaHints.operation_order.filter((op) => {
    const entry =
      state.operations && state.operations[op] ? state.operations[op] : null;
    return !!(entry && entry.enabled);
  });
}

function keyValueDistributionIntent(lowerPrompt) {
  const text = String(lowerPrompt || "");
  const keyValMentions =
    /\b(key|keys|value|values|val|vals|key\/value|kv)\b/.test(text);
  const distributionMentions =
    /\bdistribution\b|\bnormal\b|\buniform\b|\bzipf(?:ian)?\b|\bbeta\b|\bexponential\b|\blog[- ]?normal\b|\bpoisson\b|\bweibull\b|\bpareto\b/.test(
      text,
    );
  if (!keyValMentions || !distributionMentions) {
    return false;
  }
  return (
    /\b(key|keys|value|values|val|vals|key\/value|kv)\b[\s\S]{0,36}\bdistribution\b|\bdistribution\b[\s\S]{0,36}\b(key|keys|value|values|val|vals|key\/value|kv)\b/.test(
      text,
    ) ||
    /(?:change|set|make|update).{0,40}(?:key|keys|value|values|val|vals|key\/value|kv).{0,40}(?:normal|uniform|zipf|beta|exponential|log[- ]?normal|poisson|weibull|pareto)/.test(
      text,
    )
  );
}

function getMentionedOperationsFromPrompt(lowerPrompt, schemaHints) {
  const text = String(lowerPrompt || "");
  if (!text) {
    return [];
  }
  return schemaHints.operation_order.filter((op) =>
    promptMentionsOperation(text, op),
  );
}

function shouldTreatPromptAsStringDistribution(lowerPrompt, schemaHints) {
  const text = String(lowerPrompt || "");
  if (!keyValueDistributionIntent(text)) {
    return false;
  }

  const mentionsKeyOrValue =
    /\b(key|keys|value|values|val|vals|key\/value|kv)\b/.test(text);
  if (!mentionsKeyOrValue) {
    return false;
  }

  const mentionedOps = getMentionedOperationsFromPrompt(text, schemaHints);
  if (mentionedOps.length === 0) {
    return true;
  }

  const hasMentionedSelectionOp = mentionedOps.some((op) => {
    const caps =
      schemaHints.capabilities && schemaHints.capabilities[op]
        ? schemaHints.capabilities[op]
        : {};
    return !!caps.has_selection;
  });
  const hasMentionedStringOp = mentionedOps.some((op) => {
    const caps =
      schemaHints.capabilities && schemaHints.capabilities[op]
        ? schemaHints.capabilities[op]
        : {};
    return !!(caps.has_key || caps.has_val);
  });
  return hasMentionedStringOp && !hasMentionedSelectionOp;
}

function humanizeOperation(op, schemaHints) {
  const label =
    schemaHints.operation_labels && schemaHints.operation_labels[op]
      ? schemaHints.operation_labels[op]
      : op;
  return String(label).replace(/_/g, " ").toLowerCase();
}

function parseHumanCountToken(token) {
  if (token === null || token === undefined) {
    return null;
  }
  if (typeof token === "number") {
    return token > 0 ? Math.round(token) : null;
  }
  const text = String(token).trim().toLowerCase();
  const match = text.match(
    /^([0-9][0-9,]*(?:\.[0-9]+)?)\s*(k|m|b|thousand|million|billion)?$/,
  );
  if (!match) {
    return null;
  }
  const base = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(base)) {
    return null;
  }
  const suffix = match[2] || "";
  const multiplier =
    suffix === "k" || suffix === "thousand"
      ? 1_000
      : suffix === "m" || suffix === "million"
        ? 1_000_000
        : suffix === "b" || suffix === "billion"
          ? 1_000_000_000
          : 1;
  const value = Math.round(base * multiplier);
  return value > 0 ? value : null;
}

function addAssumptionEntry(target, text, fieldRef, reason, appliedValue) {
  if (!Array.isArray(target)) {
    return;
  }
  const cleanedText = typeof text === "string" ? text.trim() : "";
  if (!cleanedText) {
    return;
  }
  const normalizedFieldRef =
    typeof fieldRef === "string" && fieldRef.trim() ? fieldRef.trim() : null;
  const normalizedReason =
    typeof reason === "string" && reason.trim()
      ? reason.trim()
      : "default_applied";
  target.push({
    id: buildStableId(
      "assume",
      normalizedFieldRef || cleanedText,
      normalizedReason,
    ),
    text: cleanedText,
    field_ref: normalizedFieldRef,
    reason: normalizedReason,
    applied_value: sanitizeSerializableValue(appliedValue),
  });
}

function normalizeAssumptionEntries(rawAssumptions) {
  if (!Array.isArray(rawAssumptions)) {
    return [];
  }
  const normalized = [];
  rawAssumptions.forEach((entry) => {
    if (typeof entry === "string") {
      addAssumptionEntry(normalized, entry, null, "default_applied", null);
      return;
    }
    if (!entry || typeof entry !== "object") {
      return;
    }
    const text = typeof entry.text === "string" ? entry.text.trim() : "";
    if (!text) {
      return;
    }
    const fieldRef =
      typeof entry.field_ref === "string" && entry.field_ref.trim()
        ? entry.field_ref.trim()
        : null;
    const reason =
      typeof entry.reason === "string" && entry.reason.trim()
        ? entry.reason.trim()
        : "default_applied";
    const normalizedEntry = {
      id:
        typeof entry.id === "string" && entry.id.trim()
          ? entry.id.trim()
          : buildStableId("assume", fieldRef || text, reason),
      text,
      field_ref: fieldRef,
      reason,
      applied_value: sanitizeSerializableValue(entry.applied_value),
    };
    normalized.push(normalizedEntry);
  });
  return dedupeByKey(
    normalized,
    (entry) =>
      (entry.id || "") + "|" + entry.text + "|" + (entry.field_ref || ""),
  );
}

function deriveDeterministicAssumptions(patch, formState, prompt, schemaHints) {
  const assumptions = [];
  appendDistributionParameterAssumptions(
    assumptions,
    patch,
    formState,
    prompt,
    schemaHints,
  );
  appendPreservedOperationStateAssumptions(
    assumptions,
    patch,
    formState,
    schemaHints,
  );
  return assumptions;
}

function mergeAssumptionsAiFirst(aiAssumptions, derivedAssumptions) {
  const primary = Array.isArray(aiAssumptions) ? aiAssumptions : [];
  const derived = Array.isArray(derivedAssumptions) ? derivedAssumptions : [];
  const merged = [...primary];
  derived.forEach((entry) => {
    if (
      primary.some((existing) =>
        assumptionsOverlap(existing, entry),
      )
    ) {
      return;
    }
    merged.push(entry);
  });
  return dedupeByKey(
    merged,
    (entry) =>
      (entry.id || "") + "|" + entry.text + "|" + (entry.field_ref || ""),
  );
}

function assumptionsOverlap(left, right) {
  if (!left || !right) {
    return false;
  }
  if (left.text && right.text && left.text === right.text) {
    return true;
  }
  if (!left.field_ref || !right.field_ref) {
    return false;
  }
  return (
    left.field_ref === right.field_ref ||
    left.field_ref.startsWith(right.field_ref + ".") ||
    right.field_ref.startsWith(left.field_ref + ".")
  );
}

function appendDistributionParameterAssumptions(
  assumptions,
  patch,
  formState,
  prompt,
  schemaHints,
) {
  if (!patch || typeof patch !== "object") {
    return;
  }
  const lowerPrompt = String(prompt || "").toLowerCase();
  const operations =
    patch.operations && typeof patch.operations === "object"
      ? patch.operations
      : {};

  schemaHints.operation_order.forEach((operationName) => {
    const opPatch = operations[operationName];
    if (!opPatch || typeof opPatch !== "object") {
      return;
    }
    const distribution =
      typeof opPatch.selection_distribution === "string" &&
      opPatch.selection_distribution.trim()
        ? opPatch.selection_distribution.trim()
        : null;
    if (!distribution) {
      return;
    }
    const requiredFields = SELECTION_DISTRIBUTION_PARAM_KEYS[distribution] || [];
    if (requiredFields.length === 0) {
      return;
    }

    const currentState =
      formState &&
      formState.operations &&
      formState.operations[operationName] &&
      typeof formState.operations[operationName] === "object"
        ? formState.operations[operationName]
        : {};
    const unspecifiedFields = requiredFields.filter(
      (fieldName) => !promptMentionsSelectionParameter(lowerPrompt, fieldName),
    );
    if (unspecifiedFields.length === 0) {
      return;
    }

    const details = [];
    let usedDefault = false;
    let reusedExisting = false;
    unspecifiedFields.forEach((fieldName) => {
      let value = opPatch[fieldName];
      let source = "patch";
      if (value === null || value === undefined) {
        if (currentState[fieldName] !== null && currentState[fieldName] !== undefined) {
          value = currentState[fieldName];
          source = "current";
        } else if (Object.prototype.hasOwnProperty.call(SELECTION_PARAM_DEFAULTS, fieldName)) {
          value = SELECTION_PARAM_DEFAULTS[fieldName];
          source = "default";
        } else {
          return;
        }
      } else if (
        currentState[fieldName] !== null &&
        currentState[fieldName] !== undefined &&
        currentState[fieldName] === value
      ) {
        source = "current";
      } else if (
        Object.prototype.hasOwnProperty.call(SELECTION_PARAM_DEFAULTS, fieldName) &&
        SELECTION_PARAM_DEFAULTS[fieldName] === value
      ) {
        source = "default";
      }
      if (source === "default") {
        usedDefault = true;
      }
      if (source === "current") {
        reusedExisting = true;
      }
      details.push(
        selectionParameterLabel(fieldName) + " " + formatAssumptionValue(value),
      );
    });

    if (details.length === 0) {
      return;
    }

    let reasonText = "because they were not specified.";
    if (usedDefault && reusedExisting) {
      reasonText =
        "using existing values where available and defaults for the rest because they were not specified.";
    } else if (usedDefault) {
      reasonText = "because they were not specified.";
    } else if (reusedExisting) {
      reasonText = "keeping the existing values because they were not specified.";
    }

    addAssumptionEntry(
      assumptions,
      "For " +
        humanizeOperation(operationName, schemaHints) +
        ", using " +
        distribution +
        " selection parameters " +
        details.join(", ") +
        " " +
        reasonText,
      operationName + ".selection_distribution",
      usedDefault ? "default_applied" : "preserved_existing",
      {
        distribution,
        parameters: unspecifiedFields.reduce((accumulator, fieldName) => {
          if (opPatch[fieldName] !== null && opPatch[fieldName] !== undefined) {
            accumulator[fieldName] = opPatch[fieldName];
          } else if (
            currentState[fieldName] !== null &&
            currentState[fieldName] !== undefined
          ) {
            accumulator[fieldName] = currentState[fieldName];
          } else if (
            Object.prototype.hasOwnProperty.call(SELECTION_PARAM_DEFAULTS, fieldName)
          ) {
            accumulator[fieldName] = SELECTION_PARAM_DEFAULTS[fieldName];
          }
          return accumulator;
        }, {}),
      },
    );
  });
}

function selectionParameterLabel(fieldName) {
  return SELECTION_PARAM_LABELS[fieldName] || fieldName;
}

function formatAssumptionValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number.isInteger(value) ? String(value) : String(value);
  }
  return String(value);
}

function appendPreservedOperationStateAssumptions(
  assumptions,
  patch,
  formState,
  schemaHints,
) {
  if (!patch || typeof patch !== "object") {
    return;
  }
  const operations =
    patch.operations && typeof patch.operations === "object"
      ? patch.operations
      : {};
  schemaHints.operation_order.forEach((operationName) => {
    const opPatch = operations[operationName];
    if (!opPatch || typeof opPatch !== "object") {
      return;
    }
    const currentState =
      formState &&
      formState.operations &&
      formState.operations[operationName] &&
      typeof formState.operations[operationName] === "object"
        ? formState.operations[operationName]
        : null;
    if (!currentState || currentState.enabled !== true) {
      return;
    }
    const changedFields = configuredOperationFieldNames(opPatch);
    if (changedFields.length === 0) {
      return;
    }
    const preservedFields = configuredOperationFieldNames(currentState).filter(
      (fieldName) => !changedFields.includes(fieldName),
    );
    if (preservedFields.length === 0) {
      return;
    }
    const summaryFields = preservedFields
      .slice(0, 3)
      .map((fieldName) => operationFieldLabel(fieldName));
    const moreCount = preservedFields.length - summaryFields.length;
    const suffix =
      moreCount > 0
        ? ", and " + moreCount + " other setting" + (moreCount > 1 ? "s" : "")
        : "";
    addAssumptionEntry(
      assumptions,
      "For " +
        humanizeOperation(operationName, schemaHints) +
        ", kept the existing " +
        summaryFields.join(", ") +
        suffix +
        " because they were not changed.",
      operationName,
      "preserved_existing",
      {
        kept_fields: preservedFields,
      },
    );
  });
}

function configuredOperationFieldNames(operationPatch) {
  if (!operationPatch || typeof operationPatch !== "object") {
    return [];
  }
  return Array.from(OPERATION_BINDING_FIELDS).filter((fieldName) => {
    if (fieldName === "enabled") {
      return false;
    }
    const value = operationPatch[fieldName];
    return value !== null && value !== undefined;
  });
}

function operationFieldLabel(fieldName) {
  if (SELECTION_PARAM_LABELS[fieldName]) {
    return selectionParameterLabel(fieldName);
  }
  const labels = {
    op_count: "operation count",
    character_set: "character set",
    key: "key generator",
    val: "value generator",
    selection: "selection",
    selection_distribution: "selection distribution",
    selectivity: "selectivity",
    range_format: "range format",
    key_len: "key length",
    val_len: "value length",
    key_pattern: "key pattern",
    val_pattern: "value pattern",
    key_hot_len: "key hot length",
    key_hot_amount: "key hot amount",
    key_hot_probability: "key hot probability",
    val_hot_len: "value hot length",
    val_hot_amount: "value hot amount",
    val_hot_probability: "value hot probability",
    k: "k",
    l: "l",
  };
  return labels[fieldName] || String(fieldName).replace(/_/g, " ");
}

function promptMentionsSelectionParameter(lowerPrompt, fieldName) {
  const text = String(lowerPrompt || "");
  if (!text) {
    return false;
  }
  const patterns = {
    selection_min: /\bmin(?:imum)?\b/,
    selection_max: /\bmax(?:imum)?\b/,
    selection_mean: /\bmean\b/,
    selection_std_dev:
      /\bstandard deviation\b|\bstd(?:\.?\s*dev|_?dev|_?deviation)?\b/,
    selection_alpha: /\balpha\b/,
    selection_beta: /\bbeta\b/,
    selection_n: /\bparameter\s+n\b|\bzipf\s+n\b/,
    selection_s: /\bparameter\s+s\b|\bzipf\s+s\b/,
    selection_lambda: /\blambda\b/,
    selection_scale: /\bscale\b/,
    selection_shape: /\bshape\b/,
  };
  const pattern = patterns[fieldName];
  return !!(pattern && pattern.test(text));
}

function normalizeClarifications(
  rawClarifications,
  rawQuestions,
  schemaHints,
  context = null,
) {
  const clarifications = [];
  const rawList = Array.isArray(rawClarifications) ? rawClarifications : [];
  rawList.forEach((entry) => {
    const normalized = normalizeClarificationEntry(entry, schemaHints, context);
    if (normalized) {
      clarifications.push(normalized);
    }
  });

  const questionList = Array.isArray(rawQuestions) ? rawQuestions : [];
  questionList.forEach((questionText) => {
    const inferred = inferClarificationFromQuestionText(
      questionText,
      schemaHints,
      context,
    );
    if (inferred) {
      clarifications.push(inferred);
    }
  });

  return dedupeByKey(clarifications, (entry) => entry.id + "|" + entry.text);
}

function normalizeClarificationEntry(rawEntry, schemaHints, context = null) {
  if (!rawEntry || typeof rawEntry !== "object") {
    return null;
  }
  const text = typeof rawEntry.text === "string" ? rawEntry.text.trim() : "";
  if (!text) {
    return null;
  }

  const inferred = inferClarificationFromQuestionText(
    text,
    schemaHints,
    context,
  );
  const sanitizedBinding = sanitizeClarificationBinding(
    rawEntry.binding,
    schemaHints,
  );
  const distributionParamQuestion =
    clarificationMentionsDistributionParams(text);
  const contextPromptLower =
    context && typeof context.prompt === "string"
      ? context.prompt.toLowerCase()
      : "";
  if (
    distributionParamQuestion &&
    shouldTreatPromptAsStringDistribution(contextPromptLower, schemaHints)
  ) {
    return null;
  }
  let binding = sanitizedBinding || (inferred ? inferred.binding : null);
  if (
    distributionParamQuestion &&
    inferred &&
    inferred.binding &&
    inferred.binding.type === "operation_field" &&
    binding &&
    binding.type === "operations_set"
  ) {
    // Prefer deterministic inferred parameter binding when model metadata is too broad.
    binding = inferred.binding;
  }
  if (
    distributionParamQuestion &&
    binding &&
    binding.type === "operation_field" &&
    typeof binding.field === "string" &&
    binding.field.startsWith("selection_")
  ) {
    const preferredOp = choosePreferredOperationForSelectionParam(
      schemaHints,
      context,
      binding.field,
      text,
    );
    if (preferredOp && preferredOp !== binding.operation) {
      binding = {
        ...binding,
        operation: preferredOp,
      };
    }
  }
  if (!binding) {
    return null;
  }

  let input =
    typeof rawEntry.input === "string" &&
    CLARIFICATION_INPUT_TYPES.has(rawEntry.input)
      ? rawEntry.input
      : null;
  if (!input && inferred && typeof inferred.input === "string") {
    input = inferred.input;
  }
  if (
    distributionParamQuestion &&
    inferred &&
    inferred.binding &&
    inferred.binding.type === "operation_field" &&
    (input === "multi_enum" || input === "enum" || input === "boolean")
  ) {
    input = "number";
  }
  if (!input) {
    input = suggestedInputForBinding(binding);
  }

  let options = normalizeOptionStrings(rawEntry.options);
  if (options.length === 0 && inferred && Array.isArray(inferred.options)) {
    options = normalizeOptionStrings(inferred.options);
  }
  if ((input === "enum" || input === "multi_enum") && options.length === 0) {
    options = defaultOptionsForBinding(binding, schemaHints);
  }

  const validation = sanitizeClarificationValidation(
    rawEntry.validation,
    input,
  );
  const required =
    rawEntry.required === true || (inferred && inferred.required === true);
  const id =
    typeof rawEntry.id === "string" && rawEntry.id.trim()
      ? rawEntry.id.trim()
      : buildStableId("clarify", text, JSON.stringify(binding));

  const normalized = {
    id,
    text,
    required: required === true,
    binding,
    input,
    default_behavior:
      typeof rawEntry.default_behavior === "string" &&
      rawEntry.default_behavior.trim()
        ? rawEntry.default_behavior.trim()
        : inferred && inferred.default_behavior
          ? inferred.default_behavior
          : "use_default",
  };
  if (options.length > 0 && (input === "enum" || input === "multi_enum")) {
    normalized.options = options;
  }
  if (validation) {
    normalized.validation = validation;
  }
  return normalized;
}

function inferClarificationFromQuestionText(
  questionText,
  schemaHints,
  context = null,
) {
  const text = typeof questionText === "string" ? questionText.trim() : "";
  if (!text) {
    return null;
  }
  const lower = text.toLowerCase();
  const promptLower =
    context && typeof context.prompt === "string"
      ? context.prompt.toLowerCase()
      : "";
  const op =
    detectOperationMention(lower, schemaHints) ||
    detectOperationMention(promptLower, schemaHints);
  const hasDistributionParamCue = clarificationMentionsDistributionParams(text);

  if (
    /\bwhich operations?\b|\boperations?\s+do you want\b|\boperation mix\b/.test(
      lower,
    )
  ) {
    return {
      id: buildStableId("clarify", "operations_set", text),
      text,
      required: true,
      binding: { type: "operations_set" },
      input: "multi_enum",
      options: [...schemaHints.operation_order],
      default_behavior: "wait_for_user",
    };
  }

  if (/\bphase\b|\bsections?\b/.test(lower)) {
    return {
      id: buildStableId("clarify", "sections_count", text),
      text,
      required: false,
      binding: { type: "top_field", field: "sections_count" },
      input: "number",
      validation: { min: 1, integer: true },
      default_behavior: "use_default",
    };
  }

  if (/\bgroups?\s*(?:per|\/)\s*section\b/.test(lower)) {
    return {
      id: buildStableId("clarify", "groups_per_section", text),
      text,
      required: false,
      binding: { type: "top_field", field: "groups_per_section" },
      input: "number",
      validation: { min: 1, integer: true },
      default_behavior: "use_default",
    };
  }

  if (
    /\bskip\b.*\bkey\b.*\bcontains?\b|\bskip_key_contains_check\b/.test(lower)
  ) {
    return {
      id: buildStableId("clarify", "skip_key_contains_check", text),
      text,
      required: false,
      binding: { type: "top_field", field: "skip_key_contains_check" },
      input: "boolean",
      default_behavior: "use_default",
    };
  }

  if (/\bcharacter\s*set\b/.test(lower)) {
    if (op && operationSupportsField(op, "character_set", schemaHints)) {
      return {
        id: buildStableId("clarify", op + ".character_set", text),
        text,
        required: false,
        binding: {
          type: "operation_field",
          operation: op,
          field: "character_set",
        },
        input: "enum",
        options: [...schemaHints.character_sets],
        default_behavior: "use_default",
      };
    }
    return {
      id: buildStableId("clarify", "character_set", text),
      text,
      required: false,
      binding: { type: "top_field", field: "character_set" },
      input: "enum",
      options: [...schemaHints.character_sets],
      default_behavior: "use_default",
    };
  }

  if (/\bhow many\b|\bnumber of\b|\bop[_\s-]?count\b/.test(lower) && op) {
    return {
      id: buildStableId("clarify", op + ".op_count", text),
      text,
      required: true,
      binding: { type: "operation_field", operation: op, field: "op_count" },
      input: "number",
      validation: { min: 1, integer: true },
      default_behavior: "wait_for_user",
    };
  }

  if (/\bkey\b.*\b(size|length|len)\b/.test(lower) && op) {
    return {
      id: buildStableId("clarify", op + ".key_len", text),
      text,
      required: false,
      binding: { type: "operation_field", operation: op, field: "key_len" },
      input: "number",
      validation: { min: 1, integer: true },
      default_behavior: "use_default",
    };
  }

  if (
    /\bvalue\b.*\b(size|length|len)\b|\bval\b.*\b(size|length|len)\b/.test(
      lower,
    ) &&
    op
  ) {
    return {
      id: buildStableId("clarify", op + ".val_len", text),
      text,
      required: false,
      binding: { type: "operation_field", operation: op, field: "val_len" },
      input: "number",
      validation: { min: 1, integer: true },
      default_behavior: "use_default",
    };
  }

  if (
    /\bstring pattern\b|\bpatterned distribution\b|\bsimple uniform random keys\/values\b|\bwhich value pattern should i use\b|\bwhich string pattern should i use\b/.test(
      lower,
    )
  ) {
    const asksKey = /\bkey(?:s)?\b/.test(lower);
    const asksValue = /\bvalue(?:s)?\b|\bval(?:s)?\b/.test(lower);
    let targetField = null;
    if (asksKey && !asksValue) {
      targetField = "key_pattern";
    } else if (asksValue && !asksKey) {
      targetField = "val_pattern";
    }
    if (!targetField && op) {
      const caps =
        schemaHints.capabilities && schemaHints.capabilities[op]
          ? schemaHints.capabilities[op]
          : {};
      if (caps.has_key) {
        targetField = "key_pattern";
      } else if (caps.has_val) {
        targetField = "val_pattern";
      }
    }
    if (!targetField) {
      targetField = asksValue ? "val_pattern" : "key_pattern";
    }

    const targetOp =
      op ||
      choosePreferredOperationForStringPattern(
        schemaHints,
        context,
        targetField,
        text,
      ) ||
      firstOperationByCapability(
        schemaHints,
        targetField === "key_pattern" ? "key" : "value",
      );
    if (!targetOp) {
      return {
        id: buildStableId("clarify", "operations_set.string_pattern", text),
        text,
        required: false,
        binding: {
          type: "operations_set",
          capability: targetField === "key_pattern" ? "key" : "value",
        },
        input: "multi_enum",
        options: defaultOptionsForBinding(
          {
            type: "operations_set",
            capability: targetField === "key_pattern" ? "key" : "value",
          },
          schemaHints,
        ),
        default_behavior: "use_default",
      };
    }
    return {
      id: buildStableId("clarify", targetOp + "." + targetField, text),
      text,
      required: false,
      binding: {
        type: "operation_field",
        operation: targetOp,
        field: targetField,
      },
      input: "enum",
      options: defaultOptionsForBinding(
        { type: "operation_field", operation: targetOp, field: targetField },
        schemaHints,
      ),
      default_behavior: "use_default",
    };
  }

  if (
    /\bselection\s+distribution\b|\bkey selection distribution\b/.test(lower) &&
    !hasDistributionParamCue
  ) {
    if (op) {
      return {
        id: buildStableId("clarify", op + ".selection_distribution", text),
        text,
        required: false,
        binding: {
          type: "operation_field",
          operation: op,
          field: "selection_distribution",
        },
        input: "enum",
        options: [...schemaHints.selection_distributions],
        default_behavior: "use_default",
      };
    }
    return {
      id: buildStableId("clarify", "operations_set.selection", text),
      text,
      required: true,
      binding: { type: "operations_set", capability: "selection" },
      input: "multi_enum",
      options: defaultOptionsForBinding(
        { type: "operations_set", capability: "selection" },
        schemaHints,
      ),
      default_behavior: "wait_for_user",
    };
  }

  const distributionParamMap = [
    { matcher: /\bmean\b/, field: "selection_mean" },
    {
      matcher:
        /\bstandard\s+deviation\b|\bstd(?:\.?\s*dev|_?dev|_?deviation)?\b/,
      field: "selection_std_dev",
    },
    { matcher: /\balpha\b/, field: "selection_alpha" },
    { matcher: /\bbeta\b/, field: "selection_beta" },
    { matcher: /\blambda\b/, field: "selection_lambda" },
    { matcher: /\bscale\b/, field: "selection_scale" },
    { matcher: /\bshape\b/, field: "selection_shape" },
    { matcher: /\bmin(?:imum)?\b/, field: "selection_min" },
    { matcher: /\bmax(?:imum)?\b/, field: "selection_max" },
    { matcher: /\bparameter\s+n\b|\bn\b/, field: "selection_n" },
    { matcher: /\bparameter\s+s\b|\bs\b/, field: "selection_s" },
  ];
  const paramEntry = distributionParamMap.find((entry) =>
    entry.matcher.test(lower),
  );
  if (paramEntry) {
    const targetOp =
      op ||
      choosePreferredOperationForSelectionParam(
        schemaHints,
        context,
        paramEntry.field,
        text,
      ) ||
      firstOperationByCapability(schemaHints, "selection");
    if (!targetOp) {
      return {
        id: buildStableId("clarify", "operations_set.selection", text),
        text,
        required: true,
        binding: { type: "operations_set", capability: "selection" },
        input: "multi_enum",
        options: defaultOptionsForBinding(
          { type: "operations_set", capability: "selection" },
          schemaHints,
        ),
        default_behavior: "wait_for_user",
      };
    }
    return {
      id: buildStableId("clarify", targetOp + "." + paramEntry.field, text),
      text,
      required: true,
      binding: {
        type: "operation_field",
        operation: targetOp,
        field: paramEntry.field,
      },
      input: "number",
      default_behavior: "wait_for_user",
    };
  }

  // Safe downgrade for malformed/unsupported question metadata.
  return {
    id: buildStableId("clarify", "operations_set.generic", text),
    text,
    required: false,
    binding: { type: "operations_set" },
    input: "multi_enum",
    options: [...schemaHints.operation_order],
    default_behavior: "use_default",
  };
}

function sanitizeClarificationBinding(rawBinding, schemaHints) {
  if (!rawBinding || typeof rawBinding !== "object") {
    return null;
  }
  const type =
    typeof rawBinding.type === "string" ? rawBinding.type.trim() : "";
  if (type === "top_field") {
    const field =
      typeof rawBinding.field === "string" ? rawBinding.field.trim() : "";
    if (!TOP_LEVEL_BINDING_FIELDS.has(field)) {
      return null;
    }
    return { type: "top_field", field };
  }
  if (type === "operation_field") {
    const operation =
      typeof rawBinding.operation === "string"
        ? rawBinding.operation.trim()
        : "";
    const field =
      typeof rawBinding.field === "string" ? rawBinding.field.trim() : "";
    if (!schemaHints.operation_order.includes(operation)) {
      return null;
    }
    if (!OPERATION_BINDING_FIELDS.has(field)) {
      return null;
    }
    if (!operationSupportsField(operation, field, schemaHints)) {
      return null;
    }
    return { type: "operation_field", operation, field };
  }
  if (type === "operations_set") {
    const capability =
      typeof rawBinding.capability === "string"
        ? rawBinding.capability.trim()
        : "";
    if (!capability) {
      return { type: "operations_set" };
    }
    if (["selection", "range", "key", "value", "all"].includes(capability)) {
      return { type: "operations_set", capability };
    }
    return { type: "operations_set" };
  }
  return null;
}

function sanitizeClarificationValidation(rawValidation, inputType) {
  if (!rawValidation || typeof rawValidation !== "object") {
    return null;
  }
  const validation = {};
  if (inputType === "number") {
    if (Number.isFinite(rawValidation.min)) {
      validation.min = rawValidation.min;
    }
    if (Number.isFinite(rawValidation.max)) {
      validation.max = rawValidation.max;
    }
    if (rawValidation.integer === true) {
      validation.integer = true;
    }
  } else if (inputType === "multi_enum") {
    if (
      Number.isFinite(rawValidation.min_items) &&
      rawValidation.min_items >= 0
    ) {
      validation.min_items = Math.floor(rawValidation.min_items);
    }
    if (
      Number.isFinite(rawValidation.max_items) &&
      rawValidation.max_items >= 0
    ) {
      validation.max_items = Math.floor(rawValidation.max_items);
    }
  } else if (inputType === "text") {
    if (
      Number.isFinite(rawValidation.min_length) &&
      rawValidation.min_length >= 0
    ) {
      validation.min_length = Math.floor(rawValidation.min_length);
    }
    if (
      Number.isFinite(rawValidation.max_length) &&
      rawValidation.max_length >= 0
    ) {
      validation.max_length = Math.floor(rawValidation.max_length);
    }
  }
  return Object.keys(validation).length > 0 ? validation : null;
}

function normalizeOptionStrings(rawOptions) {
  if (!Array.isArray(rawOptions)) {
    return [];
  }
  return uniqueStrings(
    rawOptions
      .map((value) => String(value || "").trim())
      .filter((value) => value.length > 0),
  );
}

function suggestedInputForBinding(binding) {
  if (!binding || typeof binding !== "object") {
    return "text";
  }
  if (binding.type === "operations_set") {
    return "multi_enum";
  }
  if (binding.type === "top_field") {
    if (binding.field === "character_set") {
      return "enum";
    }
    if (binding.field === "skip_key_contains_check") {
      return "boolean";
    }
    return "number";
  }
  if (binding.type === "operation_field") {
    if (binding.field === "enabled") {
      return "boolean";
    }
    if (
      binding.field === "character_set" ||
      binding.field === "selection_distribution" ||
      binding.field === "range_format" ||
      binding.field === "key_pattern" ||
      binding.field === "val_pattern"
    ) {
      return "enum";
    }
    if (
      binding.field === "key" ||
      binding.field === "val" ||
      binding.field === "selection"
    ) {
      return "text";
    }
    return "number";
  }
  return "text";
}

function defaultOptionsForBinding(binding, schemaHints) {
  if (!binding || typeof binding !== "object") {
    return [];
  }
  if (binding.type === "top_field" && binding.field === "character_set") {
    return [...schemaHints.character_sets];
  }
  if (binding.type === "operation_field" && binding.field === "character_set") {
    return [...schemaHints.character_sets];
  }
  if (
    binding.type === "operation_field" &&
    binding.field === "selection_distribution"
  ) {
    return [...schemaHints.selection_distributions];
  }
  if (
    binding.type === "operation_field" &&
    (binding.field === "key_pattern" || binding.field === "val_pattern")
  ) {
    return Array.isArray(schemaHints.string_patterns) &&
      schemaHints.string_patterns.length > 0
      ? [...schemaHints.string_patterns]
      : [...STRING_PATTERN_VALUES];
  }
  if (binding.type === "operation_field" && binding.field === "range_format") {
    return [...schemaHints.range_formats];
  }
  if (binding.type === "operations_set") {
    const capability = binding.capability || "all";
    if (capability === "all") {
      return [...schemaHints.operation_order];
    }
    return schemaHints.operation_order.filter((op) => {
      const caps =
        schemaHints.capabilities && schemaHints.capabilities[op]
          ? schemaHints.capabilities[op]
          : {};
      if (capability === "selection") {
        return !!caps.has_selection;
      }
      if (capability === "range") {
        return !!caps.has_range;
      }
      if (capability === "key") {
        return !!caps.has_key;
      }
      if (capability === "value") {
        return !!caps.has_val;
      }
      return true;
    });
  }
  return [];
}

function firstOperationByCapability(schemaHints, capabilityName) {
  const operations = Array.isArray(schemaHints && schemaHints.operation_order)
    ? schemaHints.operation_order
    : [];
  return (
    operations.find((op) => {
      const caps =
        schemaHints.capabilities && schemaHints.capabilities[op]
          ? schemaHints.capabilities[op]
          : {};
      if (capabilityName === "selection") {
        return !!caps.has_selection;
      }
      if (capabilityName === "range") {
        return !!caps.has_range;
      }
      if (capabilityName === "key") {
        return !!caps.has_key;
      }
      if (capabilityName === "value") {
        return !!caps.has_val;
      }
      return true;
    }) || null
  );
}

function choosePreferredOperationForSelectionParam(
  schemaHints,
  context,
  fieldName,
  questionText,
) {
  if (typeof fieldName !== "string" || !fieldName.startsWith("selection_")) {
    return null;
  }

  const safeContext = context && typeof context === "object" ? context : {};
  const safeFormState =
    safeContext.formState && typeof safeContext.formState === "object"
      ? safeContext.formState
      : {
          character_set: null,
          sections_count: null,
          groups_per_section: null,
          operations: {},
        };
  const safePatch =
    safeContext.patch && typeof safeContext.patch === "object"
      ? safeContext.patch
      : {
          character_set: null,
          sections_count: null,
          groups_per_section: null,
          clear_operations: false,
          operations: {},
        };

  const effective = buildEffectiveState(safePatch, safeFormState, schemaHints);
  const enabledSelectionOps = getEnabledOperationNames(
    effective,
    schemaHints,
  ).filter((op) => {
    return operationSupportsField(op, fieldName, schemaHints);
  });

  if (enabledSelectionOps.length === 1) {
    return enabledSelectionOps[0];
  }

  let narrowed = enabledSelectionOps;
  const distributionHint = detectSelectionDistribution(
    String(questionText || "").toLowerCase(),
    schemaHints.selection_distributions,
  );
  if (distributionHint) {
    const byDistribution = enabledSelectionOps.filter((op) => {
      const state =
        effective.operations && effective.operations[op]
          ? effective.operations[op]
          : {};
      return state.selection_distribution === distributionHint;
    });
    if (byDistribution.length === 1) {
      return byDistribution[0];
    }
    if (byDistribution.length > 0) {
      narrowed = byDistribution;
    }
  }

  const promptLower =
    typeof safeContext.prompt === "string"
      ? safeContext.prompt.toLowerCase()
      : "";
  if (promptLower) {
    const mentionedNarrowed = narrowed.filter((op) =>
      promptMentionsOperation(promptLower, op),
    );
    if (mentionedNarrowed.length === 1) {
      return mentionedNarrowed[0];
    }
    const mentionedEnabled = enabledSelectionOps.filter((op) =>
      promptMentionsOperation(promptLower, op),
    );
    if (mentionedEnabled.length === 1) {
      return mentionedEnabled[0];
    }
  }

  return null;
}

function choosePreferredOperationForStringPattern(
  schemaHints,
  context,
  fieldName,
  questionText,
) {
  if (fieldName !== "key_pattern" && fieldName !== "val_pattern") {
    return null;
  }

  const safeContext = context && typeof context === "object" ? context : {};
  const safeFormState =
    safeContext.formState && typeof safeContext.formState === "object"
      ? safeContext.formState
      : {
          character_set: null,
          sections_count: null,
          groups_per_section: null,
          operations: {},
        };
  const safePatch =
    safeContext.patch && typeof safeContext.patch === "object"
      ? safeContext.patch
      : {
          character_set: null,
          sections_count: null,
          groups_per_section: null,
          clear_operations: false,
          operations: {},
        };

  const effective = buildEffectiveState(safePatch, safeFormState, schemaHints);
  const enabledOps = getEnabledOperationNames(effective, schemaHints).filter(
    (op) => {
      return operationSupportsField(op, fieldName, schemaHints);
    },
  );
  if (enabledOps.length === 1) {
    return enabledOps[0];
  }

  const hintText = String(questionText || "").toLowerCase();
  if (hintText) {
    const hinted = enabledOps.filter((op) =>
      promptMentionsOperation(hintText, op),
    );
    if (hinted.length === 1) {
      return hinted[0];
    }
  }

  const promptLower =
    typeof safeContext.prompt === "string"
      ? safeContext.prompt.toLowerCase()
      : "";
  if (promptLower) {
    const mentioned = enabledOps.filter((op) =>
      promptMentionsOperation(promptLower, op),
    );
    if (mentioned.length === 1) {
      return mentioned[0];
    }
  }

  return null;
}

function detectOperationMention(lowerText, schemaHints) {
  const text = String(lowerText || "");
  for (const op of schemaHints.operation_order) {
    if (promptMentionsOperation(text, op)) {
      return op;
    }
  }
  return null;
}

function clarificationMentionsDistributionParams(textValue) {
  const text = String(textValue || "").toLowerCase();
  if (!text) {
    return false;
  }
  return /\bmean\b|\bstandard\s+deviation\b|\bstd(?:\.?\s*dev|_?dev|_?deviation)?\b|\balpha\b|\bbeta\b|\blambda\b|\bscale\b|\bshape\b|\bmin(?:imum)?\b|\bmax(?:imum)?\b|\bparameter\s+n\b|\bparameter\s+s\b/.test(
    text,
  );
}

function operationSupportsField(operation, fieldName, schemaHints) {
  if (!operation || !fieldName) {
    return false;
  }
  const caps =
    schemaHints.capabilities && schemaHints.capabilities[operation]
      ? schemaHints.capabilities[operation]
      : {};
  if (fieldName === "character_set") {
    return !!caps.has_character_set;
  }
  if (fieldName === "enabled") {
    return (
      (caps.has_op_count === undefined ? true : !!caps.has_op_count) ||
      !!caps.has_sorted
    );
  }
  if (fieldName === "op_count") {
    return caps.has_op_count === undefined ? true : !!caps.has_op_count;
  }
  if (fieldName === "k" || fieldName === "l") {
    return !!caps.has_sorted;
  }
  if (fieldName === "key" || fieldName === "key_len") {
    return !!caps.has_key;
  }
  if (
    fieldName === "key_pattern" ||
    fieldName === "key_hot_len" ||
    fieldName === "key_hot_amount" ||
    fieldName === "key_hot_probability"
  ) {
    return !!caps.has_key;
  }
  if (fieldName === "val" || fieldName === "val_len") {
    return !!caps.has_val;
  }
  if (
    fieldName === "val_pattern" ||
    fieldName === "val_hot_len" ||
    fieldName === "val_hot_amount" ||
    fieldName === "val_hot_probability"
  ) {
    return !!caps.has_val;
  }
  if (fieldName === "selection") {
    return !!caps.has_selection;
  }
  if (
    [
      "selection_distribution",
      "selection_min",
      "selection_max",
      "selection_mean",
      "selection_std_dev",
      "selection_alpha",
      "selection_beta",
      "selection_n",
      "selection_s",
      "selection_lambda",
      "selection_scale",
      "selection_shape",
    ].includes(fieldName)
  ) {
    return !!caps.has_selection;
  }
  if (fieldName === "selectivity" || fieldName === "range_format") {
    return !!caps.has_range;
  }
  return false;
}

function buildStableId(prefix, ...parts) {
  const joined = parts
    .map((part) => String(part || "").trim())
    .filter((part) => part.length > 0)
    .join("|");
  return prefix + "_" + hashString(joined || prefix);
}

function hashString(value) {
  const text = String(value || "");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function sanitizeSerializableValue(value) {
  if (value === undefined) {
    return null;
  }
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeSerializableValue(item));
  }
  if (typeof value === "object") {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function dedupeByKey(values, keyFn) {
  const out = [];
  const seen = new Set();
  (Array.isArray(values) ? values : []).forEach((entry) => {
    if (!entry) {
      return;
    }
    const key = typeof keyFn === "function" ? keyFn(entry) : String(entry);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    out.push(entry);
  });
  return out;
}

function uniqueStrings(values) {
  return [...new Set(values)];
}

function parseJsonFromText(text) {
  const direct = safeJsonParse(text);
  if (direct) {
    return direct;
  }

  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch && fenceMatch[1]) {
    const fenced = safeJsonParse(fenceMatch[1].trim());
    if (fenced) {
      return fenced;
    }
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const slice = text.slice(firstBrace, lastBrace + 1);
    const sliced = safeJsonParse(slice);
    if (sliced) {
      return sliced;
    }
  }

  const recovered = recoverTruncatedJsonObject(text);
  if (recovered) {
    return recovered;
  }

  return null;
}

function recoverTruncatedJsonObject(text) {
  if (typeof text !== "string" || !text.trim()) {
    return null;
  }
  const firstBrace = text.indexOf("{");
  if (firstBrace === -1) {
    return null;
  }
  const candidate = text.slice(firstBrace);
  let inString = false;
  let escaping = false;
  const stack = [];
  let lastRecoverableIndex = -1;
  let lastRecoverableStack = null;

  for (let index = 0; index < candidate.length; index += 1) {
    const ch = candidate[index];
    if (inString) {
      if (escaping) {
        escaping = false;
        continue;
      }
      if (ch === "\\") {
        escaping = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") {
      stack.push("{");
      continue;
    }
    if (ch === "[") {
      stack.push("[");
      continue;
    }
    if (ch === "}" || ch === "]") {
      const opener = stack[stack.length - 1];
      if (
        (ch === "}" && opener === "{") ||
        (ch === "]" && opener === "[")
      ) {
        stack.pop();
        lastRecoverableIndex = index;
        lastRecoverableStack = [...stack];
        if (stack.length === 0) {
          const complete = safeJsonParse(candidate.slice(0, index + 1));
          if (complete) {
            return complete;
          }
        }
      }
    }
  }

  if (lastRecoverableIndex === -1 || !Array.isArray(lastRecoverableStack)) {
    return null;
  }
  const prefix = candidate.slice(0, lastRecoverableIndex + 1).replace(/,\s*$/, "");
  const closing = lastRecoverableStack
    .slice()
    .reverse()
    .map((entry) => (entry === "{" ? "}" : "]"))
    .join("");
  return safeJsonParse(prefix + closing);
}

function isAssistPayloadShape(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const hasProgram = Array.isArray(value.program);
  const hasPatch =
    value.patch &&
    typeof value.patch === "object" &&
    !Array.isArray(value.patch);
  if (!hasProgram && !hasPatch) {
    return false;
  }
  if (
    hasPatch &&
    value.patch.operations !== undefined &&
    value.patch.operations !== null &&
    (!value.patch.operations || typeof value.patch.operations !== "object")
  ) {
    return false;
  }
  if (
    value.questions !== undefined &&
    value.questions !== null &&
    !Array.isArray(value.questions)
  ) {
    return false;
  }
  if (
    value.clarifications !== undefined &&
    value.clarifications !== null &&
    !Array.isArray(value.clarifications)
  ) {
    return false;
  }
  if (
    value.assumptions !== undefined &&
    value.assumptions !== null &&
    !Array.isArray(value.assumptions)
  ) {
    return false;
  }
  if (
    value.assumption_texts !== undefined &&
    value.assumption_texts !== null &&
    !Array.isArray(value.assumption_texts)
  ) {
    return false;
  }
  return true;
}

function safeJsonParse(input) {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function extractAiText(result) {
  if (typeof result === "string") {
    return result;
  }
  if (!result || typeof result !== "object") {
    return "";
  }
  if (typeof result.response === "string") {
    return result.response;
  }
  if (result.response && typeof result.response === "object") {
    try {
      return JSON.stringify(result.response);
    } catch {
      return String(result.response);
    }
  }
  if (typeof result.output_text === "string") {
    return result.output_text;
  }
  if (Array.isArray(result.response)) {
    return result.response
      .map((item) => (typeof item === "string" ? item : ""))
      .join("\n");
  }
  if (Array.isArray(result.output)) {
    return result.output
      .map((item) => {
        if (!item || typeof item !== "object") {
          return "";
        }
        if (typeof item.text === "string") {
          return item.text;
        }
        if (Array.isArray(item.content)) {
          return item.content
            .map((part) =>
              part && typeof part.text === "string" ? part.text : "",
            )
            .join("\n");
        }
        return "";
      })
      .join("\n");
  }
  if (result.result) {
    return extractAiText(result.result);
  }
  return "";
}

function normalizeStringOrNull(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function getSimpleAssistFailureReason(errorLike) {
  const error =
    errorLike && typeof errorLike === "object" ? errorLike : Object.create(null);
  const outputReason = extractSimpleAssistFailureReasonFromOutput(error.ai_output);
  if (outputReason) {
    return outputReason;
  }
  const message =
    typeof error.message === "string" && error.message.trim()
      ? error.message.trim()
      : "";
  if (!message) {
    return "Assist request failed.";
  }
  return simplifyAssistFailureMessage(message);
}

function extractSimpleAssistFailureReasonFromOutput(aiOutput) {
  if (typeof aiOutput !== "string" || !aiOutput.trim()) {
    return "";
  }
  const parsed = safeJsonParse(aiOutput);
  if (!parsed || typeof parsed !== "object") {
    if (looksLikeTruncatedJson(aiOutput)) {
      return "Model output was truncated before the JSON completed.";
    }
    return "";
  }
  if (
    parsed.error &&
    typeof parsed.error === "object" &&
    typeof parsed.error.message === "string" &&
    parsed.error.message.trim()
  ) {
    return simplifyAssistFailureMessage(parsed.error.message.trim());
  }
  const outputText =
    typeof parsed.output_text === "string" ? parsed.output_text.trim() : "";
  const reasoningTokens =
    parsed.usage &&
    typeof parsed.usage === "object" &&
    parsed.usage.output_tokens_details &&
    typeof parsed.usage.output_tokens_details === "object"
      ? Number(parsed.usage.output_tokens_details.reasoning_tokens)
      : NaN;
  if (!outputText && Number.isFinite(reasoningTokens) && reasoningTokens > 0) {
    return "Model returned no JSON output; it used the output budget for reasoning.";
  }
  return "";
}

function simplifyAssistFailureMessage(message) {
  if (typeof message !== "string" || !message.trim()) {
    return "Assist request failed.";
  }
  const normalized = message.trim();
  if (normalized.includes("Invalid schema for response_format")) {
    return "OpenAI rejected the structured-output schema.";
  }
  if (normalized.includes("Unsupported parameter: 'temperature'")) {
    return "The selected OpenAI model does not support temperature.";
  }
  if (
    normalized.includes("returned no assistant text") ||
    normalized.includes("returned no text")
  ) {
    return "Model returned no JSON output.";
  }
  if (normalized.toLowerCase().includes("timed out")) {
    return "AI request timed out.";
  }
  return normalized;
}

function looksLikeTruncatedJson(textValue) {
  const text = typeof textValue === "string" ? textValue.trim() : "";
  if (!text) {
    return false;
  }
  if (!text.startsWith("{") && !text.startsWith("[")) {
    return false;
  }
  const lastChar = text[text.length - 1];
  return lastChar !== "}" && lastChar !== "]";
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function positiveNumberOrNull(value) {
  const parsed = numberOrNull(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function nonNegativeNumberOrNull(value) {
  const parsed = numberOrNull(value);
  return parsed !== null && parsed >= 0 ? parsed : null;
}

function nonNegativeIntegerOrNull(value) {
  const parsed = nonNegativeNumberOrNull(value);
  if (parsed === null) {
    return null;
  }
  return Math.floor(parsed);
}

function probabilityOrNull(value) {
  const parsed = numberOrNull(value);
  if (parsed === null) {
    return null;
  }
  if (parsed < 0 || parsed > 1) {
    return null;
  }
  return parsed;
}

function normalizeStringPatternName(value, allowedPatterns) {
  if (typeof value !== "string") {
    return null;
  }
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const candidates =
    Array.isArray(allowedPatterns) && allowedPatterns.length > 0
      ? allowedPatterns
      : STRING_PATTERN_VALUES;
  return candidates.includes(cleaned) ? cleaned : null;
}

function positiveIntegerOrNull(value) {
  const parsed = positiveNumberOrNull(value);
  if (parsed === null) {
    return null;
  }
  return Math.max(1, Math.floor(parsed));
}

function parseIntegerWithDefault(value, fallbackValue) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackValue;
}

function parseFloatWithDefault(value, fallbackValue) {
  const parsed = Number.parseFloat(String(value || ""));
  return Number.isFinite(parsed) ? parsed : fallbackValue;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

function withTimeout(promise, timeoutMs, message) {
  const ms = Math.max(250, Number(timeoutMs) || DEFAULT_AI_TIMEOUT_MS);
  let timer = null;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(message || "Operation timed out."));
      }, ms);
    }),
  ]).finally(() => {
    if (timer) {
      clearTimeout(timer);
    }
  });
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function jsonResponse(payload, status) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function getAiRequestConfig(env) {
  const provider = readAssistProvider(env);
  const defaultMaxTokens = isOllamaAssistProvider(provider)
    ? DEFAULT_OLLAMA_MAX_TOKENS
    : DEFAULT_MAX_TOKENS;
  const modelNames = parseModelNames(env);
  const modelName = modelNames[0];
  const configuredMaxTokens = parseIntegerWithDefault(
    env.AI_MAX_TOKENS,
    defaultMaxTokens,
  );
  const maxTokens = clamp(configuredMaxTokens, 120, 900);
  const temperature = parseFloatWithDefault(env.AI_TEMPERATURE, 0);
  const defaultTimeoutMs = isOllamaAssistProvider(provider)
    ? DEFAULT_OLLAMA_AI_TIMEOUT_MS
    : DEFAULT_AI_TIMEOUT_MS;
  const timeoutMs = parseIntegerWithDefault(
    env.AI_TIMEOUT_MS,
    defaultTimeoutMs,
  );
  const defaultRetryAttempts = isOllamaAssistProvider(provider)
    ? DEFAULT_OLLAMA_RETRY_ATTEMPTS
    : DEFAULT_RETRY_ATTEMPTS;
  const retryAttempts = parseIntegerWithDefault(
    env.AI_RETRY_ATTEMPTS,
    defaultRetryAttempts,
  );
  const responseFormatOverride =
    typeof env.AI_RESPONSE_FORMAT_MODE === "string"
      ? env.AI_RESPONSE_FORMAT_MODE.trim().toLowerCase()
      : "";
  const responseFormatMode =
    responseFormatOverride === "json_object" ? "json_object" : "json_schema";

  return {
    modelName,
    modelNames,
    maxTokens,
    temperature,
    timeoutMs,
    retryAttempts,
    responseFormatMode,
    provider,
  };
}

function readAssistProvider(env) {
  if (
    env &&
    typeof env === "object" &&
    typeof env.AI_PROVIDER === "string" &&
    env.AI_PROVIDER.trim()
  ) {
    return env.AI_PROVIDER.trim().toLowerCase();
  }
  return "";
}

function buildAssistResponseFormat(aiConfig) {
  if (aiConfig && aiConfig.responseFormatMode === "json_schema") {
    if (!isOpenAiAssistProvider(aiConfig.provider)) {
      return {
        type: "json_object",
      };
    }
    return null;
  }
  return {
    type: "json_object",
  };
}

function buildAssistTools(aiConfig) {
  if (!aiConfig || !isOpenAiAssistProvider(aiConfig.provider)) {
    return null;
  }
  return [
    {
      type: "function",
      name: OPENAI_ASSIST_TOOL_NAME,
      description:
        "Return the workload program, clarifications, and assumptions as structured arguments only.",
      parameters: OPENAI_ASSIST_RESPONSE_JSON_SCHEMA,
      strict: true,
    },
  ];
}

function buildAssistToolChoice(aiConfig) {
  if (!aiConfig || !isOpenAiAssistProvider(aiConfig.provider)) {
    return null;
  }
  return {
    type: "function",
    name: OPENAI_ASSIST_TOOL_NAME,
  };
}


function parseModelNames(env) {
  const provider = readAssistProvider(env);
  if (isOpenAiAssistProvider(provider)) {
    return uniqueStrings(getOpenAiModels(env));
  }
  if (isOllamaAssistProvider(provider)) {
    return uniqueStrings(getOllamaModels(env));
  }
  return uniqueStrings(getCloudflareModels(env));
}

function buildAiDebugFromOutcome(aiConfig, outcome) {
  const attempts =
    outcome && Array.isArray(outcome.attempts) ? outcome.attempts : [];
  const retryAttempts =
    outcome && Number.isFinite(outcome.retry_attempts)
      ? outcome.retry_attempts
      : aiConfig.retryAttempts;
  const lastAiOutput =
    outcome && outcome.last_ai_output
      ? normalizeAiOutput(outcome.last_ai_output)
      : null;
  const totalDurationMs = attempts.reduce((sum, attempt) => {
    const value =
      attempt && Number.isFinite(attempt.duration_ms) ? attempt.duration_ms : 0;
    return sum + value;
  }, 0);
  return {
    reason: "Workers AI did not return a usable patch response.",
    binding_present: true,
    model:
      outcome && typeof outcome.model === "string"
        ? outcome.model
        : aiConfig.modelName,
    models: Array.isArray(outcome && outcome.models)
      ? outcome.models
      : aiConfig.modelNames,
    max_tokens: aiConfig.maxTokens,
    temperature: aiConfig.temperature,
    timeout_ms: aiConfig.timeoutMs,
    response_format_mode: aiConfig.responseFormatMode,
    retry_attempts: retryAttempts,
    attempts,
    total_duration_ms: totalDurationMs,
    last_ai_output: lastAiOutput,
  };
}

function buildAiTimingFromOutcome(outcome) {
  if (!outcome || typeof outcome !== "object") {
    return null;
  }
  const attempts = Array.isArray(outcome.attempts)
    ? outcome.attempts
        .map((entry) => {
          const base = entry && typeof entry === "object" ? entry : {};
          return {
            attempt: Number.isFinite(base.attempt) ? base.attempt : null,
            model: typeof base.model === "string" ? base.model : null,
            status: typeof base.status === "string" ? base.status : null,
            ...normalizeAssistAttemptTiming(base),
          };
        })
        .filter((entry) => Number.isFinite(entry.attempt))
    : [];
  if (attempts.length === 0) {
    return null;
  }
  const totalDurationMs = attempts.reduce((sum, entry) => {
    const value = Number.isFinite(entry.duration_ms) ? entry.duration_ms : 0;
    return sum + value;
  }, 0);
  return {
    attempts,
    total_duration_ms: totalDurationMs,
  };
}

function sanitizeErrorForClient(errorLike) {
  const error = errorLike && typeof errorLike === "object" ? errorLike : {};
  const message =
    typeof error.message === "string" && error.message.trim()
      ? error.message.trim()
      : String(errorLike || "Unknown error");
  const name =
    typeof error.name === "string" && error.name.trim()
      ? error.name.trim()
      : "Error";

  const sanitized = { name, message };
  if (
    error.cause &&
    typeof error.cause === "object" &&
    typeof error.cause.message === "string"
  ) {
    sanitized.cause = String(error.cause.message);
  }
  if (typeof error.ai_output === "string") {
    sanitized.ai_output = normalizeAiOutput(error.ai_output);
  }
  if (typeof error.model_name === "string" && error.model_name.trim()) {
    sanitized.model = error.model_name.trim();
  }
  if (Number.isFinite(error.duration_ms)) {
    sanitized.duration_ms = Math.max(0, Math.round(error.duration_ms));
  }
  if (Number.isFinite(error.primary_response_ms)) {
    sanitized.primary_response_ms = Math.max(
      0,
      Math.round(error.primary_response_ms),
    );
  }
  if (Number.isFinite(error.repair_response_ms)) {
    sanitized.repair_response_ms = Math.max(
      0,
      Math.round(error.repair_response_ms),
    );
  }
  if (Number.isFinite(error.ai_response_count)) {
    sanitized.ai_response_count = Math.max(
      0,
      Math.round(error.ai_response_count),
    );
  }
  return sanitized;
}

function normalizeAssistAttemptTiming(source) {
  if (!source || typeof source !== "object") {
    return {};
  }
  const normalized = {};

  const durationMs = Number.isFinite(source.duration_ms)
    ? source.duration_ms
    : Number.isFinite(source.total_duration_ms)
      ? source.total_duration_ms
      : null;
  if (Number.isFinite(durationMs)) {
    normalized.duration_ms = Math.max(0, Math.round(durationMs));
  }

  const primaryMs = Number.isFinite(source.primary_response_ms)
    ? source.primary_response_ms
    : null;
  if (Number.isFinite(primaryMs)) {
    normalized.primary_response_ms = Math.max(0, Math.round(primaryMs));
  }

  const repairMs = Number.isFinite(source.repair_response_ms)
    ? source.repair_response_ms
    : null;
  if (Number.isFinite(repairMs)) {
    normalized.repair_response_ms = Math.max(0, Math.round(repairMs));
  }

  const responseCount = Number.isFinite(source.ai_response_count)
    ? source.ai_response_count
    : null;
  if (Number.isFinite(responseCount)) {
    normalized.ai_response_count = Math.max(0, Math.round(responseCount));
  }

  return normalized;
}

function logAssistAttemptTiming(modelName, attemptNumber, attemptEntry) {
  const timing = normalizeAssistAttemptTiming(attemptEntry);
  console.log(
    "[assist-ai:attempt-timing:" +
      modelName +
      ":attempt=" +
      attemptNumber +
      "]" +
      " status=" +
      (attemptEntry && attemptEntry.status ? attemptEntry.status : "unknown") +
      " total_ms=" +
      (Number.isFinite(timing.duration_ms) ? timing.duration_ms : "n/a") +
      " primary_ms=" +
      (Number.isFinite(timing.primary_response_ms)
        ? timing.primary_response_ms
        : "n/a") +
      " repair_ms=" +
      (Number.isFinite(timing.repair_response_ms)
        ? timing.repair_response_ms
        : "n/a") +
      " responses=" +
      (Number.isFinite(timing.ai_response_count)
        ? timing.ai_response_count
        : "n/a"),
  );
}

function normalizeAiOutput(text) {
  if (typeof text !== "string") {
    return null;
  }
  if (!text.trim()) {
    return null;
  }
  return text;
}

function serializeForAiLog(value) {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function logFullAiOutputToStdout(label, text) {
  if (typeof text !== "string" || !text) {
    console.log("[assist-ai:" + label + "] (empty)");
    return;
  }

  // Keep chunks modest so logs are not truncated at a single-line boundary.
  const chunkSize = 3000;
  const totalChunks = Math.max(1, Math.ceil(text.length / chunkSize));
  console.log(
    "[assist-ai:" +
      label +
      "] BEGIN length=" +
      text.length +
      " chunks=" +
      totalChunks,
  );
  for (let index = 0; index < totalChunks; index += 1) {
    const start = index * chunkSize;
    const end = start + chunkSize;
    const chunk = text.slice(start, end);
    console.log(
      "[assist-ai:" +
        label +
        "] chunk " +
        (index + 1) +
        "/" +
        totalChunks +
        "\n" +
        chunk,
    );
  }
  console.log("[assist-ai:" + label + "] END");
}

function logAssistFailureAiOutput(label, errorLike, outcomeLike) {
  const loggedOutputs = new Set();

  const maybeLog = (suffix, rawText) => {
    const normalized = normalizeAiOutput(rawText);
    if (!normalized) {
      return false;
    }
    if (loggedOutputs.has(normalized)) {
      return false;
    }
    loggedOutputs.add(normalized);
    logFullAiOutputToStdout(label + ":" + suffix, normalized);
    return true;
  };

  let loggedAny = false;
  if (errorLike && typeof errorLike === "object") {
    loggedAny = maybeLog("error", errorLike.ai_output) || loggedAny;
  }

  if (outcomeLike && typeof outcomeLike === "object") {
    loggedAny = maybeLog("last", outcomeLike.last_ai_output) || loggedAny;
    const attempts = Array.isArray(outcomeLike.attempts)
      ? outcomeLike.attempts
      : [];
    attempts.forEach((attempt, index) => {
      const attemptNumber =
        attempt && Number.isFinite(attempt.attempt)
          ? attempt.attempt
          : index + 1;
      if (maybeLog("attempt_" + attemptNumber, attempt && attempt.ai_output)) {
        loggedAny = true;
      }
    });
  }

  if (!loggedAny) {
    console.log("[assist-ai:" + label + "] no_ai_output_available");
  }
}
