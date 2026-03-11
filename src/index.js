const DEFAULT_MODEL = "@cf/meta/llama-3.1-8b-instruct";
const DEFAULT_MAX_TOKENS = 420;
const DEFAULT_RETRY_ATTEMPTS = 2;
const DEFAULT_AI_TIMEOUT_MS = 15000;

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
const ASSIST_RESPONSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "patch", "clarifications", "assumptions"],
  properties: {
    summary: { type: "string" },
    patch: {
      type: "object",
      additionalProperties: false,
      required: [
        "character_set",
        "sections_count",
        "groups_per_section",
        "clear_operations",
        "operations",
      ],
      properties: {
        character_set: { type: ["string", "null"] },
        sections_count: { type: ["number", "null"] },
        groups_per_section: { type: ["number", "null"] },
        skip_key_contains_check: { type: "boolean" },
        clear_operations: { type: "boolean" },
        operations: {
          type: "object",
          additionalProperties: {
            type: "object",
            additionalProperties: true,
          },
        },
      },
    },
    clarifications: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: true,
      },
    },
    assumptions: {
      type: "array",
      items: {
        anyOf: [
          { type: "string" },
          {
            type: "object",
            additionalProperties: true,
          },
        ],
      },
    },
    questions: {
      type: "array",
      items: { type: "string" },
    },
    assumption_texts: {
      type: "array",
      items: { type: "string" },
    },
  },
};

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
          "If it runs on another host/port, set LOCAL_TECTONIC_RUNNER_URL and restart `wrangler dev`.",
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
      : [aiConfig.modelName || DEFAULT_MODEL];
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
        const attemptTiming = normalizeAssistAttemptTiming(sanitized);
        const attemptEntry = {
          attempt: attemptNumber,
          model: modelName,
          max_tokens: attemptMaxTokens,
          status: "failed",
          message: sanitized.message || "Unknown error",
          name: sanitized.name || "Error",
          ...attemptTiming,
        };
        if (sanitized.ai_output) {
          attemptEntry.ai_output = sanitized.ai_output;
          lastAiOutput = sanitized.ai_output;
          logFullAiOutputToStdout(
            "attempt-failed:" + modelName + ":attempt=" + attemptNumber,
            sanitized.ai_output,
          );
        } else {
          console.log(
            "[assist-ai:attempt-failed:" +
              modelName +
              ":attempt=" +
              attemptNumber +
              "] no_ai_output_available",
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
) {
  const systemMessage = [
    "You are a form-patch generator for workload specs.",
    "Return one JSON object only.",
    "Never output code, markdown, prose, comments, or backticks.",
    'First character must be "{" and last character must be "}".',
    "Treat this as an update over current_generated_json/current_form_state.",
    "Do not reset fields unless user explicitly asks.",
    "Set clear_operations=true only for explicit replace/only requests.",
    "Patch must be sparse: include only fields you want to change.",
    "Never include null fields.",
    "Never set enabled=false unless the user explicitly asks to disable/remove an operation.",
    "For selection updates, set selection directly using a Distribution object; selection_distribution and matching params are also valid fallback fields.",
    "For key/value string expression updates, set key and val directly using scalar strings or StringExpr objects; fallback to key_pattern/val_pattern is also valid.",
    "For op_count/k/l/selectivity support NumberExpr: either scalar numbers or Distribution objects when allowed by schema.",
    "For operation-level character_set, set operation.character_set.",
    "Clarifications must ask for plain-language values only. Never ask the user to type JSON, object literals, or schema syntax.",
    "If user asks for a distribution but no selection-capable operation is active, ask which operations should use it.",
    "Output contract (sparse):",
    '{ "summary": "short sentence", "patch": { "character_set": "...", "sections_count": 1, "groups_per_section": 1, "skip_key_contains_check": true, "clear_operations": false, "operations": { "<operation_name>": { "enabled": true, "op_count": 100000, "character_set": "alphanumeric", "key": "id", "val": { "uniform": { "len": 16 } }, "selection": { "normal": { "mean": 0, "std_dev": 1 } }, "selection_distribution": "normal", "selection_mean": 0.5, "selection_std_dev": 0.15 } } }, "clarifications": [{ "id": "clarify.operations", "text": "Which operations should be enabled?", "required": true, "binding": { "type": "operations_set" }, "input": "multi_enum", "options": ["inserts", "updates"], "default_behavior": "wait_for_user" }], "assumptions": [{ "id": "assume.character_set", "text": "Using alphanumeric character set.", "field_ref": "character_set", "reason": "missing_input", "applied_value": "alphanumeric" }] }',
    "clarifications[].binding.type must be one of: top_field, operation_field, operations_set.",
    "For top_field binding include field from: character_set, sections_count, groups_per_section, skip_key_contains_check.",
    "For operation_field binding include operation + field.",
    "input must be one of: number, enum, multi_enum, boolean, text.",
    "If clarification asks for distribution parameters (mean/std_dev/alpha/beta/lambda/scale/shape/min/max/n/s), bind it to operation_field + numeric input, not operations_set.",
    "Allowed operation field names: enabled, character_set, op_count, key, val, selection, key_len, val_len, key_pattern, val_pattern, key_hot_len, key_hot_amount, key_hot_probability, val_hot_len, val_hot_amount, val_hot_probability, selection_distribution, selection_min, selection_max, selection_mean, selection_std_dev, selection_alpha, selection_beta, selection_n, selection_s, selection_lambda, selection_scale, selection_shape, selectivity, range_format, k, l.",
    "Allowed key/val patterns: uniform, weighted, segmented, hot_range.",
    "Rules:",
    "- Ask only for missing information.",
    "- Keep clarifications high-level and user-friendly.",
    "- Use safe defaults when missing; list them in assumptions.",
    "- Keep output compact. Do not emit untouched operations.",
    "- Convert units/counts: 1KB=1024, 100K=100000, 1M=1000000.",
    "- Use only operation names and enum values from schema_hints.",
    "- If unsure, return a conservative patch and clarifications.",
  ].join("\n");

  const userMessage = JSON.stringify(
    {
      request: prompt,
      conversation,
      answers,
      current_form_state: formState,
      current_generated_json: currentJson,
      schema_hints: schemaHints,
    },
    null,
    2,
  );

  return [
    { role: "system", content: systemMessage },
    { role: "user", content: userMessage },
  ];
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
    "Extract/repair into exactly one JSON object with keys: summary, patch, clarifications, assumptions.",
    "If the input contains code, ignore code and output the JSON object only.",
  ].join("\n");
  const repairUser = JSON.stringify({ raw_output: rawOutputText });

  const baseTokens =
    Number.isFinite(maxTokensHint) && maxTokensHint > 0
      ? maxTokensHint
      : aiConfig.maxTokens;
  const repairMaxTokens = clamp(Math.floor(baseTokens * 1.1), 180, 900);
  const repairTimeout = Math.max(3000, Math.min(aiConfig.timeoutMs, 12000));
  const selectedModel =
    typeof modelName === "string" && modelName.trim()
      ? modelName.trim()
      : aiConfig.modelName;
  const responseFormat = buildAssistResponseFormat(aiConfig);
  const repairPromise = env.AI.run(selectedModel, {
    messages: [
      { role: "system", content: repairSystem },
      { role: "user", content: repairUser },
    ],
    max_tokens: repairMaxTokens,
    temperature: 0,
    response_format: responseFormat,
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

  return {
    character_set: normalizeCharacterSetValue(input.character_set, schemaHints),
    sections_count: positiveIntegerOrNull(input.sections_count),
    groups_per_section: positiveIntegerOrNull(input.groups_per_section),
    skip_key_contains_check: input.skip_key_contains_check === true,
    operations,
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

function normalizeAssistPayload(rawPayload, schemaHints, formState, prompt) {
  const payload =
    rawPayload && typeof rawPayload === "object" ? rawPayload : {};
  const patch = normalizePatch(payload.patch, schemaHints);
  applyPromptOperationIntentFallback(patch, formState, prompt, schemaHints);
  applyDeleteOperationDisambiguation(patch, formState, prompt, schemaHints);
  applyPromptOperationFieldFallback(patch, formState, prompt, schemaHints);
  restrictPatchToMentionedOperations(patch, prompt, schemaHints);
  constrainPatchToCurrentOperationScope(patch, formState, prompt, schemaHints);
  suppressSelectionPatchForStringDistributionPrompts(
    patch,
    formState,
    prompt,
    schemaHints,
  );
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
  );
  suppressOperationPatchWhenSelectionIsAmbiguous(patch, filteredClarifications);
  const assumptions = normalizeAssumptionEntries(payload.assumptions);
  const summary =
    typeof payload.summary === "string" && payload.summary.trim()
      ? payload.summary.trim()
      : "Applied the AI response to the form.";

  return {
    summary,
    patch,
    clarifications: filteredClarifications,
    assumptions,
    questions: filteredClarifications.map((entry) => entry.text),
    assumption_texts: assumptions.map((entry) => entry.text),
  };
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
  const patchedEnabledOps = getEnabledOperationNames(
    buildEffectiveState(patch, formState || { operations: {} }, schemaHints),
    schemaHints,
  );

  const hasExplicitOperationSetInPatch = schemaHints.operation_order.some(
    (op) => {
      const opPatch =
        patch.operations && patch.operations[op] ? patch.operations[op] : null;
      return !!(opPatch && typeof opPatch.enabled === "boolean");
    },
  );
  if (
    hasExplicitOperationSetInPatch ||
    patchedEnabledOps.length > 0 ||
    mentionedOps.length === 0
  ) {
    if (mentionedOps.length === 0) {
      return;
    }
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
    patch.operations[op].enabled = true;
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
  if (!shouldSuppressOperationQuestion) {
    return clarifications;
  }
  return clarifications.filter((entry) => {
    if (!entry || !entry.binding || entry.binding.type !== "operations_set") {
      return true;
    }
    return false;
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
    promptLikelySetsOperationCount(lowerPrompt) &&
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

function extractPromptCountHint(prompt) {
  const text = String(prompt || "");
  if (!text) {
    return null;
  }
  const contextualMatch = text.match(
    /(\d[\d,]*(?:\.\d+)?\s*[kmb]?)(?=\s+(?:operations?|ops?|inserts?|updates?|merges?|deletes?|queries?|reads?))/i,
  );
  if (contextualMatch && contextualMatch[1]) {
    return parseHumanCountToken(contextualMatch[1]);
  }
  const genericMatch = text.match(/\b(\d[\d,]*(?:\.\d+)?\s*[kmb]?)\b/i);
  if (genericMatch && genericMatch[1]) {
    return parseHumanCountToken(genericMatch[1]);
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
  const normalized = {
    character_set: normalizeCharacterSetValue(patch.character_set, schemaHints),
    sections_count: positiveIntegerOrNull(patch.sections_count),
    groups_per_section: positiveIntegerOrNull(patch.groups_per_section),
    skip_key_contains_check: Object.prototype.hasOwnProperty.call(
      patch,
      "skip_key_contains_check",
    )
      ? patch.skip_key_contains_check === true
      : undefined,
    clear_operations: patch.clear_operations === true,
    operations: {},
  };

  const operationsPatch =
    patch.operations && typeof patch.operations === "object"
      ? patch.operations
      : {};

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

  return effective;
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
  const match = text.match(/^([0-9][0-9,]*(?:\.[0-9]+)?)\s*([kmb])?$/);
  if (!match) {
    return null;
  }
  const base = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(base)) {
    return null;
  }
  const suffix = match[2] || "";
  const multiplier =
    suffix === "k"
      ? 1_000
      : suffix === "m"
        ? 1_000_000
        : suffix === "b"
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
    return safeJsonParse(slice);
  }

  return null;
}

function isAssistPayloadShape(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  if (
    !value.patch ||
    typeof value.patch !== "object" ||
    Array.isArray(value.patch)
  ) {
    return false;
  }
  if (
    !value.patch.operations ||
    typeof value.patch.operations !== "object" ||
    Array.isArray(value.patch.operations)
  ) {
    return false;
  }
  if (value.questions !== undefined && !Array.isArray(value.questions)) {
    return false;
  }
  if (
    value.clarifications !== undefined &&
    !Array.isArray(value.clarifications)
  ) {
    return false;
  }
  if (value.assumptions !== undefined && !Array.isArray(value.assumptions)) {
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
  const modelNames = parseModelNames(env);
  const modelName = modelNames[0];
  const configuredMaxTokens = parseIntegerWithDefault(
    env.AI_MAX_TOKENS,
    DEFAULT_MAX_TOKENS,
  );
  const maxTokens = clamp(configuredMaxTokens, 120, 900);
  const temperature = parseFloatWithDefault(env.AI_TEMPERATURE, 0);
  const timeoutMs = parseIntegerWithDefault(
    env.AI_TIMEOUT_MS,
    DEFAULT_AI_TIMEOUT_MS,
  );
  const retryAttempts = parseIntegerWithDefault(
    env.AI_RETRY_ATTEMPTS,
    DEFAULT_RETRY_ATTEMPTS,
  );
  const provider =
    typeof env.AI_PROVIDER === "string"
      ? env.AI_PROVIDER.trim().toLowerCase()
      : "";
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

function buildAssistResponseFormat(aiConfig) {
  if (aiConfig && aiConfig.responseFormatMode === "json_schema") {
    const provider =
      typeof aiConfig.provider === "string"
        ? aiConfig.provider.toLowerCase()
        : "";
    if (provider === "cloudflare") {
      return {
        type: "json_schema",
        json_schema: ASSIST_RESPONSE_JSON_SCHEMA,
      };
    }
    return {
      type: "json_schema",
      json_schema: {
        name: "assist_response",
        strict: true,
        schema: ASSIST_RESPONSE_JSON_SCHEMA,
      },
    };
  }
  return {
    type: "json_object",
  };
}

function parseModelNames(env) {
  const explicitChain =
    typeof env.AI_MODELS === "string" && env.AI_MODELS.trim()
      ? env.AI_MODELS
      : "";
  const fromChain = explicitChain
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  if (fromChain.length > 0) {
    return uniqueStrings(fromChain);
  }

  const configured =
    typeof env.AI_NAME === "string" && env.AI_NAME.trim()
      ? env.AI_NAME.trim()
      : DEFAULT_MODEL;
  return uniqueStrings([configured]);
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
