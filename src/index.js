const DEFAULT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const DEFAULT_FALLBACK_MODELS = ['@cf/meta/llama-3.1-8b-instruct'];
const DEFAULT_MAX_TOKENS = 420;
const DEFAULT_RETRY_ATTEMPTS = 2;
const DEFAULT_AI_TIMEOUT_MS = 15000;

const FALLBACK_OPERATION_ORDER = [
  'inserts',
  'updates',
  'merges',
  'point_queries',
  'range_queries',
  'point_deletes',
  'range_deletes',
  'empty_point_queries',
  'empty_point_deletes'
];
const DEFAULT_SELECTION_DISTRIBUTIONS = [
  'uniform',
  'normal',
  'beta',
  'zipf',
  'exponential',
  'log_normal',
  'poisson',
  'weibull',
  'pareto'
];
const SELECTION_DISTRIBUTION_PARAM_KEYS = {
  uniform: ['selection_min', 'selection_max'],
  normal: ['selection_mean', 'selection_std_dev'],
  beta: ['selection_alpha', 'selection_beta'],
  zipf: ['selection_n', 'selection_s'],
  exponential: ['selection_lambda'],
  log_normal: ['selection_mean', 'selection_std_dev'],
  poisson: ['selection_lambda'],
  weibull: ['selection_scale', 'selection_shape'],
  pareto: ['selection_scale', 'selection_shape']
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
  selection_shape: 2
};
const STRING_PATTERN_VALUES = ['uniform', 'weighted', 'segmented', 'hot_range'];
const STRING_PATTERN_DEFAULTS = {
  key_pattern: 'uniform',
  val_pattern: 'uniform',
  key_hot_len: 20,
  key_hot_amount: 100,
  key_hot_probability: 0.8,
  val_hot_len: 256,
  val_hot_amount: 100,
  val_hot_probability: 0.8
};
const TOP_LEVEL_BINDING_FIELDS = new Set(['character_set', 'sections_count', 'groups_per_section']);
const OPERATION_BINDING_FIELDS = new Set([
  'enabled',
  'op_count',
  'key_len',
  'val_len',
  'key_pattern',
  'val_pattern',
  'key_hot_len',
  'key_hot_amount',
  'key_hot_probability',
  'val_hot_len',
  'val_hot_amount',
  'val_hot_probability',
  'selection_distribution',
  'selection_min',
  'selection_max',
  'selection_mean',
  'selection_std_dev',
  'selection_alpha',
  'selection_beta',
  'selection_n',
  'selection_s',
  'selection_lambda',
  'selection_scale',
  'selection_shape',
  'selectivity',
  'range_format'
]);
const CLARIFICATION_INPUT_TYPES = new Set(['number', 'enum', 'multi_enum', 'boolean', 'text']);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/assist') {
      if (request.method !== 'POST') {
        return jsonResponse({ error: 'Method not allowed' }, 405);
      }
      return handleAssistRequest(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};

async function handleAssistRequest(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON request body.' }, 400);
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) {
    return jsonResponse({ error: 'Prompt is required.' }, 400);
  }

  const schemaHints = normalizeSchemaHints(body.schema_hints);
  const formState = normalizeFormState(body.form_state, schemaHints);
  const currentJson = normalizeCurrentJson(body.current_json);
  const conversation = normalizeConversation(body.conversation);
  const answers = normalizeAssistantAnswers(body.answers);
  const fallbackAssistPayload = buildFallbackAssistPayload(prompt, schemaHints, formState);
  const warnings = [];

  if (shouldForceFallbackForStringDistributionRequest(prompt, schemaHints, formState)) {
    const normalizedForced = normalizeAssistPayload(fallbackAssistPayload, schemaHints, formState, prompt);
    normalizedForced.source = 'fallback_forced';
    normalizedForced.warnings = ['Used deterministic parser for key/value distribution request to preserve operation scope.'];
    return jsonResponse(normalizedForced, 200);
  }

  if (shouldUseFastFallback(prompt, fallbackAssistPayload, formState)) {
    const normalizedFast = normalizeAssistPayload(fallbackAssistPayload, schemaHints, formState, prompt);
    normalizedFast.source = 'fallback_fast';
    return jsonResponse(normalizedFast, 200);
  }

  let source = 'fallback';
  let assistPayload = null;
  let debug = null;
  let aiOutput = null;

  try {
    if (env.AI && typeof env.AI.run === 'function') {
      const aiConfig = getAiRequestConfig(env);
      const outcome = await runAssistantWithRetries(
        env,
        prompt,
        schemaHints,
        formState,
        currentJson,
        conversation,
        answers,
        aiConfig
      );
      if (outcome && outcome.payload) {
        assistPayload = outcome.payload;
        source = 'ai';
        aiOutput = normalizeAiOutput(outcome.ai_output);
      } else {
        debug = buildAiDebugFromOutcome(aiConfig, outcome);
        warnings.push('AI request failed. Used deterministic fallback parser.');
        aiOutput = normalizeAiOutput(outcome && outcome.last_ai_output ? outcome.last_ai_output : null);
      }
    } else {
      warnings.push('AI binding unavailable. Used deterministic fallback parser.');
      debug = {
        reason: 'AI binding unavailable in Worker runtime.',
        binding_present: false
      };
    }
  } catch (error) {
    console.error('Assist AI call failed:', error);
    warnings.push('AI request failed. Used deterministic fallback parser.');
    debug = {
      reason: 'Unexpected exception while calling Workers AI.',
      error: sanitizeErrorForClient(error)
    };
  }

  if (!assistPayload) {
    assistPayload = fallbackAssistPayload;
  }

  const normalized = normalizeAssistPayload(assistPayload, schemaHints, formState, prompt);
  normalized.source = source;
  if (warnings.length > 0) {
    normalized.warnings = warnings;
  }
  if (debug) {
    normalized.debug = debug;
  }
  if (aiOutput) {
    normalized.ai_output = aiOutput;
  }

  return jsonResponse(normalized, 200);
}

async function runAssistantWithRetries(env, prompt, schemaHints, formState, currentJson, conversation, answers, aiConfig) {
  const attempts = [];
  let lastAiOutput = null;
  const models = Array.isArray(aiConfig.modelNames) && aiConfig.modelNames.length > 0
    ? aiConfig.modelNames
    : [aiConfig.modelName || DEFAULT_MODEL];
  const attemptsPerModel = Math.max(1, aiConfig.retryAttempts);
  const totalAttempts = models.length * attemptsPerModel;

  for (const modelName of models) {
    for (let retryIndex = 0; retryIndex < attemptsPerModel; retryIndex += 1) {
      const attemptNumber = attempts.length + 1;
      const attemptMaxTokens = retryIndex === 0
        ? aiConfig.maxTokens
        : Math.min(900, Math.max(aiConfig.maxTokens, Math.floor(aiConfig.maxTokens * 1.8)));
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
          attemptMaxTokens
        );
        if (outcome && outcome.payload && typeof outcome.payload === 'object') {
          return {
            payload: outcome.payload,
            ai_output: normalizeAiOutput(outcome.ai_output),
            retry_attempts: totalAttempts,
            attempts,
            model: modelName,
            models,
            last_ai_output: normalizeAiOutput(outcome.ai_output)
          };
        }
        attempts.push({
          attempt: attemptNumber,
          model: modelName,
          max_tokens: attemptMaxTokens,
          message: 'Assistant returned an empty payload.'
        });
      } catch (error) {
        const sanitized = sanitizeErrorForClient(error);
        const attemptEntry = {
          attempt: attemptNumber,
          model: modelName,
          max_tokens: attemptMaxTokens,
          message: sanitized.message || 'Unknown error',
          name: sanitized.name || 'Error'
        };
        if (sanitized.ai_output) {
          attemptEntry.ai_output = sanitized.ai_output;
          lastAiOutput = sanitized.ai_output;
        }
        attempts.push(attemptEntry);
      }
    }
  }
  return {
    payload: null,
    retry_attempts: totalAttempts,
    models,
    attempts,
    last_ai_output: lastAiOutput
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
  maxTokensOverride
) {
  const messages = buildAssistantMessages(prompt, schemaHints, formState, currentJson, conversation, answers);
  const selectedModel = typeof modelName === 'string' && modelName.trim() ? modelName.trim() : aiConfig.modelName;
  const selectedMaxTokens = Number.isFinite(maxTokensOverride) && maxTokensOverride > 0
    ? Math.floor(maxTokensOverride)
    : aiConfig.maxTokens;
  const aiPromise = env.AI.run(selectedModel, {
    messages,
    max_tokens: selectedMaxTokens,
    temperature: aiConfig.temperature
  });
  const rawResult = await withTimeout(aiPromise, aiConfig.timeoutMs, 'Workers AI timed out.');

  const text = extractAiText(rawResult);
  if (!text) {
    const error = new Error('Workers AI returned no text.');
    error.ai_output = '';
    error.model_name = selectedModel;
    throw error;
  }
  logFullAiOutputToStdout('primary:' + selectedModel + ':max_tokens=' + selectedMaxTokens, text);

  const parsed = parseJsonFromText(text);
  if (isAssistPayloadShape(parsed)) {
    return {
      payload: parsed,
      ai_output: text
    };
  }

  const repaired = await attemptJsonRepair(env, aiConfig, text, selectedModel, selectedMaxTokens);
  if (repaired && repaired.payload && typeof repaired.payload === 'object') {
    const stitched = [
      '[original-output]',
      text,
      '[repair-output]',
      repaired.ai_output || ''
    ].join('\n');
    return {
      payload: repaired.payload,
      ai_output: stitched
    };
  }

  const error = new Error('Workers AI did not return valid JSON.');
  error.ai_output = text;
  error.model_name = selectedModel;
  throw error;
}

function buildAssistantMessages(prompt, schemaHints, formState, currentJson, conversation, answers) {
  const systemMessage = [
    'You are a form-patch generator for workload specs.',
    'Return one JSON object only.',
    'Never output code, markdown, prose, comments, or backticks.',
    'First character must be "{" and last character must be "}".',
    'Treat this as an update over current_generated_json/current_form_state.',
    'Do not reset fields unless user explicitly asks.',
    'Set clear_operations=true only for explicit replace/only requests.',
    'Patch must be sparse: include only fields you want to change.',
    'Never include null fields.',
    'Never set enabled=false unless the user explicitly asks to disable/remove an operation.',
    'For selection updates, set selection_distribution and matching params.',
    'For key/value string expression updates, set key_pattern/val_pattern and matching params.',
    'If user asks for a distribution but no selection-capable operation is active, ask which operations should use it.',
    'Output contract (sparse):',
    '{ "summary": "short sentence", "patch": { "character_set": "...", "sections_count": 1, "groups_per_section": 1, "clear_operations": false, "operations": { "<operation_name>": { "enabled": true, "op_count": 100000, "key_pattern": "uniform", "val_pattern": "uniform", "selection_distribution": "normal", "selection_mean": 0.5, "selection_std_dev": 0.15 } } }, "clarifications": [{ "id": "clarify.operations", "text": "Which operations should be enabled?", "required": true, "binding": { "type": "operations_set" }, "input": "multi_enum", "options": ["inserts", "updates"], "default_behavior": "wait_for_user" }], "assumptions": [{ "id": "assume.character_set", "text": "Using alphanumeric character set.", "field_ref": "character_set", "reason": "missing_input", "applied_value": "alphanumeric" }] }',
    'clarifications[].binding.type must be one of: top_field, operation_field, operations_set.',
    'For top_field binding include field from: character_set, sections_count, groups_per_section.',
    'For operation_field binding include operation + field.',
    'input must be one of: number, enum, multi_enum, boolean, text.',
    'If clarification asks for distribution parameters (mean/std_dev/alpha/beta/lambda/scale/shape/min/max/n/s), bind it to operation_field + numeric input, not operations_set.',
    'Allowed operation field names: enabled, op_count, key_len, val_len, key_pattern, val_pattern, key_hot_len, key_hot_amount, key_hot_probability, val_hot_len, val_hot_amount, val_hot_probability, selection_distribution, selection_min, selection_max, selection_mean, selection_std_dev, selection_alpha, selection_beta, selection_n, selection_s, selection_lambda, selection_scale, selection_shape, selectivity, range_format.',
    'Allowed key/val patterns: uniform, weighted, segmented, hot_range.',
    'Rules:',
    '- Ask only for missing information.',
    '- Keep clarifications high-level and user-friendly.',
    '- Use safe defaults when missing; list them in assumptions.',
    '- Keep output compact. Do not emit untouched operations.',
    '- Convert units/counts: 1KB=1024, 100K=100000, 1M=1000000.',
    '- Use only operation names and enum values from schema_hints.',
    '- If unsure, return a conservative patch and clarifications.'
  ].join('\n');

  const userMessage = JSON.stringify(
    {
      request: prompt,
      conversation,
      answers,
      current_form_state: formState,
      current_generated_json: currentJson,
      schema_hints: schemaHints
    },
    null,
    2
  );

  return [
    { role: 'system', content: systemMessage },
    { role: 'user', content: userMessage }
  ];
}

async function attemptJsonRepair(env, aiConfig, rawOutputText, modelName, maxTokensHint) {
  const repairSystem = [
    'Convert the input into strict JSON only.',
    'Do not output markdown, code blocks, Python, comments, or explanations.',
    'Extract/repair into exactly one JSON object with keys: summary, patch, clarifications, assumptions.',
    'If the input contains code, ignore code and output the JSON object only.'
  ].join('\n');
  const repairUser = JSON.stringify({ raw_output: rawOutputText });

  const baseTokens = Number.isFinite(maxTokensHint) && maxTokensHint > 0 ? maxTokensHint : aiConfig.maxTokens;
  const repairMaxTokens = clamp(Math.floor(baseTokens * 1.1), 180, 900);
  const repairTimeout = Math.max(3000, Math.min(aiConfig.timeoutMs, 12000));
  const selectedModel = typeof modelName === 'string' && modelName.trim() ? modelName.trim() : aiConfig.modelName;
  const repairPromise = env.AI.run(selectedModel, {
    messages: [
      { role: 'system', content: repairSystem },
      { role: 'user', content: repairUser }
    ],
    max_tokens: repairMaxTokens,
    temperature: 0
  });
  const repairResult = await withTimeout(repairPromise, repairTimeout, 'Workers AI repair pass timed out.');
  const repairText = extractAiText(repairResult);
  if (!repairText) {
    return null;
  }
  logFullAiOutputToStdout('repair:' + selectedModel + ':max_tokens=' + repairMaxTokens, repairText);
  const parsed = parseJsonFromText(repairText);
  if (!isAssistPayloadShape(parsed)) {
    return null;
  }
  return {
    payload: parsed,
    ai_output: repairText
  };
}

function normalizeSchemaHints(rawHints) {
  const hints = rawHints && typeof rawHints === 'object' ? rawHints : {};
  const operationOrder = Array.isArray(hints.operation_order)
    ? hints.operation_order.filter((value) => typeof value === 'string' && value.trim() !== '')
    : [];
  const operationLabels = hints.operation_labels && typeof hints.operation_labels === 'object'
    ? hints.operation_labels
    : {};
  const characterSets = Array.isArray(hints.character_sets)
    ? hints.character_sets.filter((value) => typeof value === 'string' && value.trim() !== '')
    : [];
  const rangeFormats = Array.isArray(hints.range_formats)
    ? hints.range_formats.filter((value) => typeof value === 'string' && value.trim() !== '')
    : [];
  const selectionDistributions = Array.isArray(hints.selection_distributions)
    ? hints.selection_distributions.filter((value) => typeof value === 'string' && value.trim() !== '')
    : [];
  const stringPatterns = Array.isArray(hints.string_patterns)
    ? hints.string_patterns.filter((value) => typeof value === 'string' && value.trim() !== '')
    : [];
  const capabilities = hints.capabilities && typeof hints.capabilities === 'object'
    ? hints.capabilities
    : {};

  return {
    operation_order: operationOrder.length > 0 ? operationOrder : [...FALLBACK_OPERATION_ORDER],
    operation_labels: operationLabels,
    character_sets: characterSets.length > 0 ? characterSets : ['alphanumeric', 'alphabetic', 'numeric'],
    range_formats: rangeFormats.length > 0 ? rangeFormats : ['StartCount', 'StartEnd'],
    selection_distributions: selectionDistributions.length > 0 ? selectionDistributions : [...DEFAULT_SELECTION_DISTRIBUTIONS],
    string_patterns: stringPatterns.length > 0 ? stringPatterns : [...STRING_PATTERN_VALUES],
    capabilities
  };
}

function normalizeFormState(rawState, schemaHints) {
  const input = rawState && typeof rawState === 'object' ? rawState : {};
  const operations = {};
  schemaHints.operation_order.forEach((op) => {
    const rawOperation = input.operations && typeof input.operations === 'object' ? input.operations[op] : null;
    operations[op] = normalizeOperationPatch(rawOperation, op, schemaHints);
    operations[op].enabled = !!(rawOperation && rawOperation.enabled === true);
  });

  return {
    character_set: typeof input.character_set === 'string' ? input.character_set : null,
    sections_count: positiveIntegerOrNull(input.sections_count),
    groups_per_section: positiveIntegerOrNull(input.groups_per_section),
    operations
  };
}

function normalizeCurrentJson(rawJson) {
  if (!rawJson || typeof rawJson !== 'object' || Array.isArray(rawJson)) {
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
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const role = entry.role === 'assistant' ? 'assistant' : (entry.role === 'user' ? 'user' : null);
      const text = typeof entry.text === 'string' ? entry.text.trim() : '';
      if (!role || !text) {
        return null;
      }
      return { role, text };
    })
    .filter(Boolean)
    .slice(-30);
}

function normalizeAssistantAnswers(rawAnswers) {
  if (!rawAnswers || typeof rawAnswers !== 'object' || Array.isArray(rawAnswers)) {
    return {};
  }
  const normalized = {};
  Object.entries(rawAnswers).forEach(([key, value]) => {
    if (typeof key !== 'string' || !key.trim()) {
      return;
    }
    if (value === null || value === undefined) {
      return;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        normalized[key] = trimmed;
      }
      return;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      normalized[key] = value;
      return;
    }
    if (Array.isArray(value)) {
      normalized[key] = value
        .map((item) => String(item || '').trim())
        .filter((item) => item.length > 0)
        .slice(0, 32);
      return;
    }
    if (typeof value === 'object') {
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
  const payload = rawPayload && typeof rawPayload === 'object' ? rawPayload : {};
  const patch = normalizePatch(payload.patch, schemaHints);
  const fallback = buildFallbackAssistPayload(prompt, schemaHints, formState);

  const mergedPatch = mergePatchWithFallback(patch, fallback.patch, formState, prompt, schemaHints);
  constrainPatchToCurrentOperationScope(mergedPatch, formState, prompt, schemaHints);
  suppressSelectionPatchForStringDistributionPrompts(mergedPatch, formState, prompt, schemaHints);
  const clarificationContext = {
    patch: mergedPatch,
    formState,
    prompt
  };
  const payloadClarifications = normalizeClarifications(
    payload.clarifications,
    payload.questions,
    schemaHints,
    clarificationContext
  );
  const fallbackClarifications = normalizeClarifications(
    fallback.clarifications,
    fallback.questions,
    schemaHints,
    clarificationContext
  );
  const clarifications = mergeClarifications(payloadClarifications, fallbackClarifications);
  const payloadAssumptions = normalizeAssumptionEntries(payload.assumptions);
  const fallbackAssumptions = normalizeAssumptionEntries(fallback.assumptions);
  const assumptions = mergeAssumptions(payloadAssumptions, fallbackAssumptions);
  const summary = buildSummary(payload.summary, assumptions);

  return {
    summary,
    patch: mergedPatch,
    clarifications,
    assumptions,
    questions: clarifications.map((entry) => entry.text),
    assumption_texts: assumptions.map((entry) => entry.text)
  };
}

function constrainPatchToCurrentOperationScope(mergedPatch, formState, prompt, schemaHints) {
  if (!mergedPatch || typeof mergedPatch !== 'object' || !mergedPatch.operations || typeof mergedPatch.operations !== 'object') {
    return;
  }

  const currentEnabled = schemaHints.operation_order.filter((op) => {
    const current = formState.operations && formState.operations[op] ? formState.operations[op] : null;
    return !!(current && current.enabled);
  });
  if (currentEnabled.length !== 1) {
    return;
  }

  const scopeOp = currentEnabled[0];
  const lowerPrompt = String(prompt || '').toLowerCase();
  const hasAnyExplicitOperationMention = schemaHints.operation_order.some((op) => promptMentionsOperation(lowerPrompt, op, schemaHints));
  const hasExplicitBroadeningIntent = /\b(add|include|also|plus|enable|operation mix|change operations|operations)\b/.test(lowerPrompt);

  // If prompt does not explicitly change operation mix, keep changes scoped to currently enabled op.
  if (!hasAnyExplicitOperationMention && !hasExplicitBroadeningIntent) {
    schemaHints.operation_order.forEach((op) => {
      const opPatch = mergedPatch.operations[op];
      if (!opPatch || typeof opPatch !== 'object') {
        return;
      }
      if (op === scopeOp) {
        if (opPatch.enabled === false && !promptExplicitlyDisablesOperation(prompt, op, schemaHints)) {
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

function suppressSelectionPatchForStringDistributionPrompts(mergedPatch, formState, prompt, schemaHints) {
  if (!mergedPatch || typeof mergedPatch !== 'object' || !mergedPatch.operations || typeof mergedPatch.operations !== 'object') {
    return;
  }
  const lowerPrompt = String(prompt || '').toLowerCase();
  if (!shouldTreatPromptAsStringDistribution(lowerPrompt, schemaHints)) {
    return;
  }

  schemaHints.operation_order.forEach((op) => {
    const caps = schemaHints.capabilities && schemaHints.capabilities[op] ? schemaHints.capabilities[op] : {};
    if (!caps.has_selection) {
      return;
    }
    if (promptMentionsOperation(lowerPrompt, op, schemaHints)) {
      return;
    }
    const opPatch = mergedPatch.operations[op];
    if (!opPatch || typeof opPatch !== 'object') {
      return;
    }
    const current = formState.operations && formState.operations[op] ? formState.operations[op] : {};
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

function mergePatchWithFallback(primaryPatch, fallbackPatch, formState, prompt, schemaHints) {
  const clearOperations = primaryPatch.clear_operations === true || fallbackPatch.clear_operations === true;
  const allowOperationSetChanges = clearOperations || promptHasOperationIntent(prompt, schemaHints);
  const merged = {
    character_set: primaryPatch.character_set || fallbackPatch.character_set || null,
    sections_count: primaryPatch.sections_count || fallbackPatch.sections_count || null,
    groups_per_section: primaryPatch.groups_per_section || fallbackPatch.groups_per_section || null,
    clear_operations: clearOperations,
    operations: {}
  };

  const operationNames = new Set([
    ...Object.keys(primaryPatch.operations || {}),
    ...Object.keys(fallbackPatch.operations || {}),
    ...Object.keys(formState.operations || {})
  ]);

  operationNames.forEach((op) => {
    const primary = primaryPatch.operations && primaryPatch.operations[op]
      ? primaryPatch.operations[op]
      : {};
    const fallback = fallbackPatch.operations && fallbackPatch.operations[op]
      ? fallbackPatch.operations[op]
      : {};
    const current = formState.operations && formState.operations[op]
      ? formState.operations[op]
      : {};

    const primaryHasSignal = operationPatchHasSignal(primary);
    const primaryDisableRequested = primary.enabled === false
      && (clearOperations || primaryHasSignal || promptExplicitlyDisablesOperation(prompt, op, schemaHints));
    const mergedEnabled = allowOperationSetChanges
      ? (primary.enabled === true
          ? true
          : (primaryDisableRequested
              ? false
              : (typeof fallback.enabled === 'boolean'
                  ? fallback.enabled
                  : (clearOperations ? false : !!current.enabled))))
      : !!current.enabled;

    merged.operations[op] = {
      enabled: mergedEnabled,
      op_count: primary.op_count ?? fallback.op_count ?? current.op_count,
      key_len: primary.key_len ?? fallback.key_len ?? current.key_len,
      val_len: primary.val_len ?? fallback.val_len ?? current.val_len,
      key_pattern: primary.key_pattern || fallback.key_pattern || current.key_pattern,
      val_pattern: primary.val_pattern || fallback.val_pattern || current.val_pattern,
      key_hot_len: primary.key_hot_len ?? fallback.key_hot_len ?? current.key_hot_len,
      key_hot_amount: primary.key_hot_amount ?? fallback.key_hot_amount ?? current.key_hot_amount,
      key_hot_probability: primary.key_hot_probability ?? fallback.key_hot_probability ?? current.key_hot_probability,
      val_hot_len: primary.val_hot_len ?? fallback.val_hot_len ?? current.val_hot_len,
      val_hot_amount: primary.val_hot_amount ?? fallback.val_hot_amount ?? current.val_hot_amount,
      val_hot_probability: primary.val_hot_probability ?? fallback.val_hot_probability ?? current.val_hot_probability,
      selection_distribution: primary.selection_distribution || fallback.selection_distribution || current.selection_distribution,
      selection_min: primary.selection_min ?? fallback.selection_min ?? current.selection_min,
      selection_max: primary.selection_max ?? fallback.selection_max ?? current.selection_max,
      selection_mean: primary.selection_mean ?? fallback.selection_mean ?? current.selection_mean,
      selection_std_dev: primary.selection_std_dev ?? fallback.selection_std_dev ?? current.selection_std_dev,
      selection_alpha: primary.selection_alpha ?? fallback.selection_alpha ?? current.selection_alpha,
      selection_beta: primary.selection_beta ?? fallback.selection_beta ?? current.selection_beta,
      selection_n: primary.selection_n ?? fallback.selection_n ?? current.selection_n,
      selection_s: primary.selection_s ?? fallback.selection_s ?? current.selection_s,
      selection_lambda: primary.selection_lambda ?? fallback.selection_lambda ?? current.selection_lambda,
      selection_scale: primary.selection_scale ?? fallback.selection_scale ?? current.selection_scale,
      selection_shape: primary.selection_shape ?? fallback.selection_shape ?? current.selection_shape,
      selectivity: primary.selectivity ?? fallback.selectivity ?? current.selectivity,
      range_format: primary.range_format || fallback.range_format || current.range_format
    };
  });

  return merged;
}

function promptHasOperationIntent(prompt, schemaHints) {
  const text = String(prompt || '').toLowerCase();
  if (!text) {
    return false;
  }

  if (/\boperation(?:s)?\b|\boperation\s*mix\b|\bonly\b|\binclude\b|\badd\b|\benable\b|\bdisable\b|\bremove\b|\bexclude\b|\bwithout\b/.test(text)) {
    return true;
  }

  return schemaHints.operation_order.some((op) => promptMentionsOperation(text, op, schemaHints));
}

function operationPatchHasSignal(operationPatch) {
  if (!operationPatch || typeof operationPatch !== 'object') {
    return false;
  }
  const signalFields = [
    'op_count',
    'key_len',
    'val_len',
    'key_pattern',
    'val_pattern',
    'key_hot_len',
    'key_hot_amount',
    'key_hot_probability',
    'val_hot_len',
    'val_hot_amount',
    'val_hot_probability',
    'selection_distribution',
    'selection_min',
    'selection_max',
    'selection_mean',
    'selection_std_dev',
    'selection_alpha',
    'selection_beta',
    'selection_n',
    'selection_s',
    'selection_lambda',
    'selection_scale',
    'selection_shape',
    'selectivity',
    'range_format'
  ];
  return signalFields.some((fieldName) => operationPatch[fieldName] !== undefined && operationPatch[fieldName] !== null);
}

function promptExplicitlyDisablesOperation(prompt, operationName, schemaHints) {
  const text = String(prompt || '').toLowerCase();
  if (!text) {
    return false;
  }

  if (/\bclear operations\b/.test(text)) {
    return true;
  }

  const label = humanizeOperation(operationName, schemaHints);
  const escapedName = escapeRegExp(String(operationName).replace(/_/g, ' '));
  const escapedLabel = escapeRegExp(label);
  const disablePattern = new RegExp(
    '(?:\\bdisable\\b|\\bremove\\b|\\bexclude\\b|\\bwithout\\b|\\bno\\b)\\s+(?:' + escapedName + '|' + escapedLabel + ')',
    'i'
  );
  return disablePattern.test(text);
}

function normalizePatch(rawPatch, schemaHints) {
  const patch = rawPatch && typeof rawPatch === 'object' ? rawPatch : {};
  const normalized = {
    character_set: normalizeStringOrNull(patch.character_set),
    sections_count: positiveIntegerOrNull(patch.sections_count),
    groups_per_section: positiveIntegerOrNull(patch.groups_per_section),
    clear_operations: patch.clear_operations === true,
    operations: {}
  };

  const operationsPatch = patch.operations && typeof patch.operations === 'object'
    ? patch.operations
    : {};

  schemaHints.operation_order.forEach((op) => {
    if (!Object.prototype.hasOwnProperty.call(operationsPatch, op)) {
      return;
    }
    normalized.operations[op] = normalizeOperationPatch(operationsPatch[op], op, schemaHints);
  });

  return normalized;
}

function normalizeOperationPatch(rawPatch, op, schemaHints) {
  const patch = rawPatch && typeof rawPatch === 'object' ? rawPatch : {};
  const hasExplicitFields = Object.keys(patch).length > 0;
  const rangeFormats = Array.isArray(schemaHints.range_formats) ? schemaHints.range_formats : [];
  const selectionDistributions = Array.isArray(schemaHints.selection_distributions) ? schemaHints.selection_distributions : [];
  const stringPatterns = Array.isArray(schemaHints.string_patterns) && schemaHints.string_patterns.length > 0
    ? schemaHints.string_patterns
    : STRING_PATTERN_VALUES;
  const caps = schemaHints.capabilities && schemaHints.capabilities[op] ? schemaHints.capabilities[op] : {};

  const normalized = {
    enabled: typeof patch.enabled === 'boolean' ? patch.enabled : undefined,
    op_count: positiveNumberOrNull(patch.op_count),
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
    selection_distribution: typeof patch.selection_distribution === 'string' && selectionDistributions.includes(patch.selection_distribution)
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
    selectivity: nonNegativeNumberOrNull(patch.selectivity),
    range_format: typeof patch.range_format === 'string' && rangeFormats.includes(patch.range_format)
      ? patch.range_format
      : null
  };

  if (normalized.op_count === null && typeof patch.op_count === 'string') {
    normalized.op_count = parseHumanCountToken(patch.op_count);
  }
  if (!normalized.selection_distribution && typeof patch.selection_distribution === 'string') {
    const cleaned = patch.selection_distribution.trim().toLowerCase();
    if (selectionDistributions.includes(cleaned)) {
      normalized.selection_distribution = cleaned;
    }
  }
  if (normalized.selection_n === null && typeof patch.selection_n === 'string') {
    normalized.selection_n = positiveIntegerOrNull(parseHumanCountToken(patch.selection_n));
  }
  if (normalized.key_hot_amount === null && typeof patch.key_hot_amount === 'string') {
    normalized.key_hot_amount = nonNegativeIntegerOrNull(parseHumanCountToken(patch.key_hot_amount));
  }
  if (normalized.val_hot_amount === null && typeof patch.val_hot_amount === 'string') {
    normalized.val_hot_amount = nonNegativeIntegerOrNull(parseHumanCountToken(patch.val_hot_amount));
  }

  if (normalized.enabled === undefined && hasExplicitFields) {
    normalized.enabled = inferOperationEnabledFromPatch(normalized, op, schemaHints);
  }

  // Enforce schema capabilities so AI cannot set invalid fields for an operation.
  if (!caps.has_key) {
    normalized.key_len = null;
    normalized.key_pattern = null;
    normalized.key_hot_len = null;
    normalized.key_hot_amount = null;
    normalized.key_hot_probability = null;
  }
  if (!caps.has_val) {
    normalized.val_len = null;
    normalized.val_pattern = null;
    normalized.val_hot_len = null;
    normalized.val_hot_amount = null;
    normalized.val_hot_probability = null;
  }
  if (!caps.has_selection) {
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

  return normalized;
}

function inferOperationEnabledFromPatch(operationPatch, op, schemaHints) {
  if (!operationPatch || typeof operationPatch !== 'object') {
    return false;
  }
  if (operationPatch.op_count !== null) {
    return true;
  }
  const caps = schemaHints.capabilities && schemaHints.capabilities[op] ? schemaHints.capabilities[op] : {};
  if (
    caps.has_key
    && (
      operationPatch.key_len !== null
      || operationPatch.key_pattern !== null
      || operationPatch.key_hot_len !== null
      || operationPatch.key_hot_amount !== null
      || operationPatch.key_hot_probability !== null
    )
  ) {
    return true;
  }
  if (
    caps.has_val
    && (
      operationPatch.val_len !== null
      || operationPatch.val_pattern !== null
      || operationPatch.val_hot_len !== null
      || operationPatch.val_hot_amount !== null
      || operationPatch.val_hot_probability !== null
    )
  ) {
    return true;
  }
  if (
    caps.has_selection &&
    (
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
      operationPatch.selection_shape !== null
    )
  ) {
    return true;
  }
  if (caps.has_range && (operationPatch.selectivity !== null || operationPatch.range_format !== null)) {
    return true;
  }
  return false;
}

function buildFallbackAssistPayload(prompt, schemaHints, formState) {
  const lowerPrompt = prompt.toLowerCase();
  const patch = {
    character_set: null,
    sections_count: null,
    groups_per_section: null,
    clear_operations: false,
    operations: {}
  };
  const assumptions = [];

  schemaHints.operation_order.forEach((op) => {
    patch.operations[op] = {};
  });

  applyCharacterSetFromPrompt(lowerPrompt, patch, schemaHints);
  applySectionAndGroupCountsFromPrompt(prompt, patch);
  applyOperationSelectionFromPrompt(lowerPrompt, patch, schemaHints);
  applySelectionDistributionFromPrompt(prompt, lowerPrompt, patch, schemaHints, formState);
  applyOperationCountsFromPrompt(prompt, patch, schemaHints);
  applyStringSizesFromPrompt(prompt, patch, schemaHints);
  applyStringPatternsFromPrompt(prompt, lowerPrompt, patch, schemaHints, formState, assumptions);
  applyRangeSettingsDefaults(patch, schemaHints);
  const questions = buildHighLevelMissingQuestions(prompt, patch, schemaHints, formState);
  const clarifications = normalizeClarifications(null, questions, schemaHints, {
    patch,
    formState,
    prompt
  });
  applyMissingDefaults(patch, schemaHints, formState, assumptions);

  return {
    summary: 'Applied what I could from your message and filled safe defaults for missing values.',
    patch,
    assumptions,
    questions,
    clarifications
  };
}

function shouldUseFastFallback(prompt, fallbackAssistPayload, formState) {
  const normalizedPrompt = String(prompt || '').trim();
  if (!normalizedPrompt) {
    return true;
  }

  const lowerPrompt = normalizedPrompt.toLowerCase();
  const hasComplexWords = /\b(explain|optimi[sz]e|best|recommend|tradeoff|compare|model|strategy|simulate|real[- ]?world|dynamic)\b/.test(lowerPrompt);
  if (hasComplexWords) {
    return false;
  }

  // Prefer fast path for short operational prompts and follow-up edits.
  const isShortPrompt = normalizedPrompt.length <= 260;
  const hasParsedChanges = fallbackPatchHasSubstantialChanges(fallbackAssistPayload, formState);
  const noOutstandingRequiredClarifications = !Array.isArray(fallbackAssistPayload.clarifications)
    || fallbackAssistPayload.clarifications.every((entry) => !entry || entry.required !== true);

  if (!hasParsedChanges) {
    return !noOutstandingRequiredClarifications;
  }
  if (noOutstandingRequiredClarifications) {
    return true;
  }
  return isShortPrompt;
}

function fallbackPatchHasSubstantialChanges(fallbackAssistPayload, formState) {
  if (!fallbackAssistPayload || !fallbackAssistPayload.patch) {
    return false;
  }
  const patch = fallbackAssistPayload.patch;
  if (patch.clear_operations === true) {
    return true;
  }
  if (patch.character_set && patch.character_set !== formState.character_set) {
    return true;
  }
  if (patch.sections_count && patch.sections_count !== formState.sections_count) {
    return true;
  }
  if (patch.groups_per_section && patch.groups_per_section !== formState.groups_per_section) {
    return true;
  }

  const operations = patch.operations && typeof patch.operations === 'object' ? patch.operations : {};
  return Object.entries(operations).some(([op, opPatch]) => {
    if (!opPatch || typeof opPatch !== 'object') {
      return false;
    }
    const current = formState.operations && formState.operations[op] ? formState.operations[op] : {};
    if (typeof opPatch.enabled === 'boolean' && opPatch.enabled !== !!current.enabled) {
      return true;
    }
    if (opPatch.key_pattern && opPatch.key_pattern !== current.key_pattern) {
      return true;
    }
    if (opPatch.val_pattern && opPatch.val_pattern !== current.val_pattern) {
      return true;
    }
    if (opPatch.selection_distribution && opPatch.selection_distribution !== current.selection_distribution) {
      return true;
    }
    const numericFields = [
      'op_count',
      'key_len',
      'val_len',
      'key_hot_len',
      'key_hot_amount',
      'key_hot_probability',
      'val_hot_len',
      'val_hot_amount',
      'val_hot_probability',
      'selection_min',
      'selection_max',
      'selection_mean',
      'selection_std_dev',
      'selection_alpha',
      'selection_beta',
      'selection_n',
      'selection_s',
      'selection_lambda',
      'selection_scale',
      'selection_shape',
      'selectivity'
    ];
    for (const field of numericFields) {
      if (opPatch[field] !== undefined && opPatch[field] !== current[field]) {
        return true;
      }
    }
    if (opPatch.range_format && opPatch.range_format !== current.range_format) {
      return true;
    }
    return false;
  });
}

function applyCharacterSetFromPrompt(lowerPrompt, patch, schemaHints) {
  const candidates = Array.isArray(schemaHints.character_sets) ? schemaHints.character_sets : [];
  const matched = candidates.find((candidate) => lowerPrompt.includes(candidate.toLowerCase()));
  if (matched) {
    patch.character_set = matched;
  }
}

function applySectionAndGroupCountsFromPrompt(prompt, patch) {
  const sectionsMatch = prompt.match(/(\d+)\s*(?:sections?|phases?)/i);
  if (sectionsMatch) {
    patch.sections_count = positiveIntegerOrNull(sectionsMatch[1]);
  }

  const groupsMatch = prompt.match(/(\d+)\s*(?:groups?)(?:\s*(?:per|\/)\s*section)?/i);
  if (groupsMatch) {
    patch.groups_per_section = positiveIntegerOrNull(groupsMatch[1]);
  }
}

function applyOperationSelectionFromPrompt(lowerPrompt, patch, schemaHints) {
  const operationRegexMap = {
    inserts: /\binsert(?:s)?\b/,
    updates: /\bupdate(?:s)?\b/,
    merges: /\bmerge(?:s)?\b|\bread[- ]?modify[- ]?write\b|\brmw\b/,
    point_queries: /\bpoint\s+quer(?:y|ies)\b|\bpoint\s+read(?:s)?\b/,
    range_queries: /\brange\s+quer(?:y|ies)\b/,
    point_deletes: /\bpoint\s+delete(?:s)?\b/,
    range_deletes: /\brange\s+delete(?:s)?\b/,
    empty_point_queries: /\bempty\s+point\s+quer(?:y|ies)\b/,
    empty_point_deletes: /\bempty\s+point\s+delete(?:s)?\b/
  };

  const explicitOnly = /\bonly\b/.test(lowerPrompt);
  const insertOnly = /\binsert[-\s]*only\b/.test(lowerPrompt);
  if (insertOnly) {
    patch.clear_operations = true;
    patch.operations.inserts.enabled = true;
    return;
  }

  let mentionedOps = [];
  schemaHints.operation_order.forEach((op) => {
    const regex = operationRegexMap[op];
    if (!regex) {
      if (lowerPrompt.includes(op.toLowerCase())) {
        patch.operations[op].enabled = true;
        mentionedOps.push(op);
      }
      return;
    }
    if (regex.test(lowerPrompt) || lowerPrompt.includes(op.toLowerCase())) {
      patch.operations[op].enabled = true;
      mentionedOps.push(op);
    }
  });

  if (explicitOnly && mentionedOps.length > 0) {
    patch.clear_operations = true;
  }

  if (/\bdelete(?:s)?\b/.test(lowerPrompt) && mentionedOps.length === 0) {
    if (patch.operations.point_deletes) {
      patch.operations.point_deletes.enabled = true;
      mentionedOps.push('point_deletes');
    }
  }
}

function applySelectionDistributionFromPrompt(prompt, lowerPrompt, patch, schemaHints, formState) {
  if (shouldTreatPromptAsStringDistribution(lowerPrompt, schemaHints)) {
    return;
  }

  const distributionName = detectSelectionDistribution(lowerPrompt, schemaHints.selection_distributions);
  if (!distributionName) {
    return;
  }

  const targetOperations = new Set();
  schemaHints.operation_order.forEach((op) => {
    const caps = schemaHints.capabilities && schemaHints.capabilities[op] ? schemaHints.capabilities[op] : {};
    if (!caps.has_selection) {
      return;
    }
    if (promptMentionsOperation(lowerPrompt, op, schemaHints)) {
      targetOperations.add(op);
    }
  });

  if (targetOperations.size === 0) {
    schemaHints.operation_order.forEach((op) => {
      const caps = schemaHints.capabilities && schemaHints.capabilities[op] ? schemaHints.capabilities[op] : {};
      if (!caps.has_selection) {
        return;
      }
      const currentOp = formState.operations && formState.operations[op] ? formState.operations[op] : null;
      if (currentOp && currentOp.enabled) {
        targetOperations.add(op);
      }
    });
  }

  if (targetOperations.size === 0) {
    schemaHints.operation_order.forEach((op) => {
      const caps = schemaHints.capabilities && schemaHints.capabilities[op] ? schemaHints.capabilities[op] : {};
      if (caps.has_selection && patch.operations[op] && patch.operations[op].enabled === true) {
        targetOperations.add(op);
      }
    });
  }

  targetOperations.forEach((op) => {
    patch.operations[op].enabled = true;
    patch.operations[op].selection_distribution = distributionName;
    applyDistributionParamDefaults(distributionName, patch.operations[op]);
    applyDistributionParamsFromPrompt(prompt, distributionName, patch.operations[op]);
  });
}

function detectSelectionDistribution(lowerPrompt, allowedDistributions) {
  const candidates = Array.isArray(allowedDistributions) && allowedDistributions.length > 0
    ? allowedDistributions
    : DEFAULT_SELECTION_DISTRIBUTIONS;

  const aliasMap = {
    uniform: ['uniform'],
    normal: ['normal', 'gaussian'],
    beta: ['beta'],
    zipf: ['zipf', 'zipfian'],
    exponential: ['exponential'],
    log_normal: ['log_normal', 'log-normal', 'log normal'],
    poisson: ['poisson'],
    weibull: ['weibull'],
    pareto: ['pareto']
  };

  for (const candidate of candidates) {
    const aliases = aliasMap[candidate] || [candidate];
    const matched = aliases.some((alias) => {
      const escaped = escapeRegExp(alias);
      const regex = new RegExp('\\b' + escaped + '\\b', 'i');
      return regex.test(lowerPrompt);
    });
    if (matched) {
      return candidate;
    }
  }

  return null;
}

function promptMentionsOperation(lowerPrompt, operationName, schemaHints) {
  const label = humanizeOperation(operationName, schemaHints);
  const compact = label.replace(/\s+/g, ' ');
  if (lowerPrompt.includes(operationName.toLowerCase())) {
    return true;
  }
  if (lowerPrompt.includes(compact)) {
    return true;
  }
  if (operationName === 'point_queries' && /\bpoint\s+quer(?:y|ies)\b/.test(lowerPrompt)) {
    return true;
  }
  if (operationName === 'range_queries' && /\brange\s+quer(?:y|ies)\b/.test(lowerPrompt)) {
    return true;
  }
  if (operationName === 'point_deletes' && /\bpoint\s+delete(?:s)?\b/.test(lowerPrompt)) {
    return true;
  }
  if (operationName === 'range_deletes' && /\brange\s+delete(?:s)?\b/.test(lowerPrompt)) {
    return true;
  }
  return false;
}

function applyDistributionParamDefaults(distributionName, operationPatch) {
  const paramKeys = SELECTION_DISTRIBUTION_PARAM_KEYS[distributionName] || SELECTION_DISTRIBUTION_PARAM_KEYS.uniform;
  paramKeys.forEach((fieldName) => {
    if (operationPatch[fieldName] === undefined) {
      operationPatch[fieldName] = SELECTION_PARAM_DEFAULTS[fieldName];
    }
  });
}

function applyDistributionParamsFromPrompt(prompt, distributionName, operationPatch) {
  const paramMap = {
    uniform: ['min', 'max'],
    normal: ['mean', 'std_dev'],
    beta: ['alpha', 'beta'],
    zipf: ['n', 's'],
    exponential: ['lambda'],
    log_normal: ['mean', 'std_dev'],
    poisson: ['lambda'],
    weibull: ['scale', 'shape'],
    pareto: ['scale', 'shape']
  };
  const params = paramMap[distributionName] || [];
  params.forEach((paramName) => {
    const regex = new RegExp('\\b' + escapeRegExp(paramName) + '\\s*(?:=|:)?\\s*(-?[0-9]+(?:\\.[0-9]+)?)', 'i');
    const match = prompt.match(regex);
    if (!match || !match[1]) {
      return;
    }
    const numeric = Number(match[1]);
    if (!Number.isFinite(numeric)) {
      return;
    }
    const fieldKey = 'selection_' + paramName;
    if (fieldKey === 'selection_n') {
      operationPatch[fieldKey] = Math.max(1, Math.floor(numeric));
      return;
    }
    operationPatch[fieldKey] = numeric;
  });
}

function applyOperationCountsFromPrompt(prompt, patch, schemaHints) {
  const operationPhrases = {
    inserts: ['insert', 'inserts'],
    updates: ['update', 'updates'],
    merges: ['merge', 'merges', 'read-modify-write', 'rmw'],
    point_queries: ['point query', 'point queries', 'point_queries'],
    range_queries: ['range query', 'range queries', 'range_queries'],
    point_deletes: ['point delete', 'point deletes', 'point_deletes'],
    range_deletes: ['range delete', 'range deletes', 'range_deletes'],
    empty_point_queries: ['empty point query', 'empty point queries', 'empty_point_queries'],
    empty_point_deletes: ['empty point delete', 'empty point deletes', 'empty_point_deletes']
  };

  schemaHints.operation_order.forEach((op) => {
    const phrases = operationPhrases[op] || [];
    const parsed = extractCountForPhrases(prompt, phrases);
    if (parsed !== null) {
      patch.operations[op].enabled = true;
      patch.operations[op].op_count = parsed;
    }
  });
}

function applyStringSizesFromPrompt(prompt, patch, schemaHints) {
  const bothMatch = prompt.match(/(\d+(?:\.\d+)?)\s*(bytes?|b|kb|kib|mb|mib)\s*(?:key\s*[-/]?\s*value|key\s+value)(?:\s+size)?/i);
  const keyMatch = prompt.match(/(\d+(?:\.\d+)?)\s*(bytes?|b|kb|kib|mb|mib)\s*key(?:s)?(?:\s+size)?/i);
  const valueMatch = prompt.match(/(\d+(?:\.\d+)?)\s*(bytes?|b|kb|kib|mb|mib)\s*(?:value|val)(?:s)?(?:\s+size)?/i);

  const bothBytes = bothMatch ? parseSizeToBytes(bothMatch[1], bothMatch[2]) : null;
  const keyBytes = keyMatch ? parseSizeToBytes(keyMatch[1], keyMatch[2]) : bothBytes;
  const valueBytes = valueMatch ? parseSizeToBytes(valueMatch[1], valueMatch[2]) : bothBytes;

  schemaHints.operation_order.forEach((op) => {
    const caps = schemaHints.capabilities && schemaHints.capabilities[op] ? schemaHints.capabilities[op] : {};
    const operationPatch = patch.operations[op];
    if (!operationPatch || operationPatch.enabled !== true) {
      return;
    }

    if (caps.has_key && keyBytes !== null) {
      operationPatch.key_len = keyBytes;
    }
    if (caps.has_val && valueBytes !== null) {
      operationPatch.val_len = valueBytes;
    }
  });
}

function applyStringPatternsFromPrompt(prompt, lowerPrompt, patch, schemaHints, formState, assumptions) {
  const hasKeyValueIntent = keyValueDistributionIntent(lowerPrompt) || mentionsStringPatternStyle(lowerPrompt);
  if (!hasKeyValueIntent) {
    return;
  }

  const allowedPatterns = Array.isArray(schemaHints.string_patterns) && schemaHints.string_patterns.length > 0
    ? schemaHints.string_patterns
    : STRING_PATTERN_VALUES;

  let requestedPattern = detectStringPattern(lowerPrompt, allowedPatterns);
  let mappedZipfToHotRange = false;
  if (!requestedPattern && /\bzipf(?:ian)?\b/.test(lowerPrompt)) {
    requestedPattern = 'hot_range';
    mappedZipfToHotRange = true;
  }
  if (!requestedPattern) {
    return;
  }

  const target = detectStringPatternTarget(lowerPrompt);
  const targetOperations = getStringPatternTargetOperations(lowerPrompt, patch, schemaHints, formState, target);
  if (targetOperations.length === 0) {
    return;
  }

  targetOperations.forEach((op) => {
    const caps = schemaHints.capabilities && schemaHints.capabilities[op] ? schemaHints.capabilities[op] : {};
    const opPatch = patch.operations[op];
    if (!opPatch || typeof opPatch !== 'object') {
      return;
    }
    opPatch.enabled = true;
    if (target.key && caps.has_key) {
      opPatch.key_pattern = requestedPattern;
      applyStringPatternParamDefaults(opPatch, 'key', requestedPattern);
      if (mappedZipfToHotRange) {
        addAssumptionEntry(
          assumptions,
          'Zipf is not available for key/value string patterns; using hot_range for ' + humanizeOperation(op, schemaHints) + ' keys.',
          op + '.key_pattern',
          'unsupported_enum',
          'hot_range'
        );
      }
    }
    if (target.value && caps.has_val) {
      opPatch.val_pattern = requestedPattern;
      applyStringPatternParamDefaults(opPatch, 'val', requestedPattern);
      if (mappedZipfToHotRange) {
        addAssumptionEntry(
          assumptions,
          'Zipf is not available for key/value string patterns; using hot_range for ' + humanizeOperation(op, schemaHints) + ' values.',
          op + '.val_pattern',
          'unsupported_enum',
          'hot_range'
        );
      }
    }
  });
}

function detectStringPatternTarget(lowerPrompt) {
  const hasKey = /\bkey(?:s)?\b/.test(lowerPrompt);
  const hasValue = /\bvalue(?:s)?\b|\bval(?:s)?\b/.test(lowerPrompt);
  if (hasKey && hasValue) {
    return { key: true, value: true };
  }
  if (hasKey) {
    return { key: true, value: false };
  }
  if (hasValue) {
    return { key: false, value: true };
  }
  return { key: true, value: true };
}

function getStringPatternTargetOperations(lowerPrompt, patch, schemaHints, formState, target) {
  const matchesTarget = (op) => {
    const caps = schemaHints.capabilities && schemaHints.capabilities[op] ? schemaHints.capabilities[op] : {};
    return (target.key && caps.has_key) || (target.value && caps.has_val);
  };

  const explicit = schemaHints.operation_order.filter((op) => {
    return matchesTarget(op) && promptMentionsOperation(lowerPrompt, op, schemaHints);
  });
  if (explicit.length > 0) {
    return explicit;
  }

  const enabledFromState = schemaHints.operation_order.filter((op) => {
    if (!matchesTarget(op)) {
      return false;
    }
    const current = formState.operations && formState.operations[op] ? formState.operations[op] : null;
    return !!(current && current.enabled);
  });
  if (enabledFromState.length > 0) {
    return enabledFromState;
  }

  return schemaHints.operation_order.filter((op) => {
    if (!matchesTarget(op)) {
      return false;
    }
    const opPatch = patch.operations && patch.operations[op] ? patch.operations[op] : null;
    return !!(opPatch && opPatch.enabled === true);
  });
}

function detectStringPattern(lowerPrompt, allowedPatterns) {
  const patterns = Array.isArray(allowedPatterns) && allowedPatterns.length > 0
    ? allowedPatterns
    : STRING_PATTERN_VALUES;
  const aliasMap = {
    uniform: ['uniform'],
    weighted: ['weighted'],
    segmented: ['segmented', 'segment'],
    hot_range: ['hot_range', 'hot range']
  };

  for (const candidate of patterns) {
    const aliases = aliasMap[candidate] || [candidate];
    const matched = aliases.some((alias) => {
      const escaped = escapeRegExp(alias);
      const regex = new RegExp('\\b' + escaped + '\\b', 'i');
      return regex.test(lowerPrompt);
    });
    if (matched) {
      return candidate;
    }
  }
  return null;
}

function applyStringPatternParamDefaults(operationPatch, target, pattern) {
  if (!operationPatch || typeof operationPatch !== 'object') {
    return;
  }
  if (target === 'key') {
    if (operationPatch.key_pattern === undefined) {
      operationPatch.key_pattern = STRING_PATTERN_DEFAULTS.key_pattern;
    }
    if (pattern === 'hot_range') {
      if (operationPatch.key_hot_len === undefined) {
        operationPatch.key_hot_len = STRING_PATTERN_DEFAULTS.key_hot_len;
      }
      if (operationPatch.key_hot_amount === undefined) {
        operationPatch.key_hot_amount = STRING_PATTERN_DEFAULTS.key_hot_amount;
      }
      if (operationPatch.key_hot_probability === undefined) {
        operationPatch.key_hot_probability = STRING_PATTERN_DEFAULTS.key_hot_probability;
      }
    }
    return;
  }
  if (target === 'val') {
    if (operationPatch.val_pattern === undefined) {
      operationPatch.val_pattern = STRING_PATTERN_DEFAULTS.val_pattern;
    }
    if (pattern === 'hot_range') {
      if (operationPatch.val_hot_len === undefined) {
        operationPatch.val_hot_len = STRING_PATTERN_DEFAULTS.val_hot_len;
      }
      if (operationPatch.val_hot_amount === undefined) {
        operationPatch.val_hot_amount = STRING_PATTERN_DEFAULTS.val_hot_amount;
      }
      if (operationPatch.val_hot_probability === undefined) {
        operationPatch.val_hot_probability = STRING_PATTERN_DEFAULTS.val_hot_probability;
      }
    }
  }
}

function applyRangeSettingsDefaults(patch, schemaHints) {
  const defaultRangeFormat = Array.isArray(schemaHints.range_formats) && schemaHints.range_formats.length > 0
    ? schemaHints.range_formats[0]
    : 'StartCount';
  const defaultSelectionDistribution = Array.isArray(schemaHints.selection_distributions) && schemaHints.selection_distributions.length > 0
    ? schemaHints.selection_distributions[0]
    : 'uniform';

  Object.entries(patch.operations || {}).forEach(([op, operationPatch]) => {
    if (!operationPatch || operationPatch.enabled !== true) {
      return;
    }
    const caps = schemaHints.capabilities && schemaHints.capabilities[op] ? schemaHints.capabilities[op] : {};
    if (caps.has_selection) {
      if (!operationPatch.selection_distribution) {
        operationPatch.selection_distribution = defaultSelectionDistribution;
      }
      applyDistributionParamDefaults(operationPatch.selection_distribution, operationPatch);
    }
    if (caps.has_range) {
      if (operationPatch.selectivity === undefined) {
        operationPatch.selectivity = 0.01;
      }
      if (!operationPatch.range_format) {
        operationPatch.range_format = defaultRangeFormat;
      }
    }
  });
}

function applyMissingDefaults(patch, schemaHints, formState, assumptions) {
  if (!patch.character_set && !formState.character_set) {
    const fallbackCharacterSet = Array.isArray(schemaHints.character_sets) && schemaHints.character_sets.length > 0
      ? schemaHints.character_sets[0]
      : 'alphanumeric';
    patch.character_set = fallbackCharacterSet;
    addAssumptionEntry(
      assumptions,
      'Using ' + fallbackCharacterSet + ' character set.',
      'character_set',
      'missing_input',
      fallbackCharacterSet
    );
  }

  if (!patch.sections_count && !formState.sections_count) {
    patch.sections_count = 1;
    addAssumptionEntry(
      assumptions,
      'Using one workload section.',
      'sections_count',
      'missing_input',
      1
    );
  }

  if (!patch.groups_per_section && !formState.groups_per_section) {
    patch.groups_per_section = 1;
    addAssumptionEntry(
      assumptions,
      'Using one group per section.',
      'groups_per_section',
      'missing_input',
      1
    );
  }

  const defaultRangeFormat = Array.isArray(schemaHints.range_formats) && schemaHints.range_formats.length > 0
    ? schemaHints.range_formats[0]
    : 'StartCount';
  const defaultSelectionDistribution = Array.isArray(schemaHints.selection_distributions) && schemaHints.selection_distributions.length > 0
    ? schemaHints.selection_distributions[0]
    : 'uniform';

  Object.entries(patch.operations || {}).forEach(([op, opPatch]) => {
    if (!opPatch || opPatch.enabled !== true) {
      return;
    }
    const currentOp = formState.operations && formState.operations[op] ? formState.operations[op] : {};
    const caps = schemaHints.capabilities && schemaHints.capabilities[op] ? schemaHints.capabilities[op] : {};

    if (opPatch.op_count === undefined && currentOp.op_count == null) {
      opPatch.op_count = 500000;
      addAssumptionEntry(
        assumptions,
        'Using default operation count (500000) for ' + humanizeOperation(op, schemaHints) + '.',
        op + '.op_count',
        'missing_input',
        500000
      );
    }

    if (caps.has_key && opPatch.key_len === undefined && currentOp.key_len == null) {
      opPatch.key_len = 20;
      addAssumptionEntry(
        assumptions,
        'Using default key length (20) for ' + humanizeOperation(op, schemaHints) + '.',
        op + '.key_len',
        'missing_input',
        20
      );
    }
    if (caps.has_key && !opPatch.key_pattern && !currentOp.key_pattern) {
      opPatch.key_pattern = STRING_PATTERN_DEFAULTS.key_pattern;
      addAssumptionEntry(
        assumptions,
        'Using uniform key pattern for ' + humanizeOperation(op, schemaHints) + '.',
        op + '.key_pattern',
        'missing_input',
        STRING_PATTERN_DEFAULTS.key_pattern
      );
    }
    if ((opPatch.key_pattern || currentOp.key_pattern) === 'hot_range') {
      if (opPatch.key_hot_len === undefined && currentOp.key_hot_len == null) {
        opPatch.key_hot_len = STRING_PATTERN_DEFAULTS.key_hot_len;
      }
      if (opPatch.key_hot_amount === undefined && currentOp.key_hot_amount == null) {
        opPatch.key_hot_amount = STRING_PATTERN_DEFAULTS.key_hot_amount;
      }
      if (opPatch.key_hot_probability === undefined && currentOp.key_hot_probability == null) {
        opPatch.key_hot_probability = STRING_PATTERN_DEFAULTS.key_hot_probability;
      }
    }

    if (caps.has_val && opPatch.val_len === undefined && currentOp.val_len == null) {
      opPatch.val_len = 256;
      addAssumptionEntry(
        assumptions,
        'Using default value length (256) for ' + humanizeOperation(op, schemaHints) + '.',
        op + '.val_len',
        'missing_input',
        256
      );
    }
    if (caps.has_val && !opPatch.val_pattern && !currentOp.val_pattern) {
      opPatch.val_pattern = STRING_PATTERN_DEFAULTS.val_pattern;
      addAssumptionEntry(
        assumptions,
        'Using uniform value pattern for ' + humanizeOperation(op, schemaHints) + '.',
        op + '.val_pattern',
        'missing_input',
        STRING_PATTERN_DEFAULTS.val_pattern
      );
    }
    if ((opPatch.val_pattern || currentOp.val_pattern) === 'hot_range') {
      if (opPatch.val_hot_len === undefined && currentOp.val_hot_len == null) {
        opPatch.val_hot_len = STRING_PATTERN_DEFAULTS.val_hot_len;
      }
      if (opPatch.val_hot_amount === undefined && currentOp.val_hot_amount == null) {
        opPatch.val_hot_amount = STRING_PATTERN_DEFAULTS.val_hot_amount;
      }
      if (opPatch.val_hot_probability === undefined && currentOp.val_hot_probability == null) {
        opPatch.val_hot_probability = STRING_PATTERN_DEFAULTS.val_hot_probability;
      }
    }

    if (caps.has_selection) {
      if (!opPatch.selection_distribution && !currentOp.selection_distribution) {
        opPatch.selection_distribution = defaultSelectionDistribution;
      }
      const effectiveDistribution = opPatch.selection_distribution || currentOp.selection_distribution || defaultSelectionDistribution;
      const requiredKeys = SELECTION_DISTRIBUTION_PARAM_KEYS[effectiveDistribution] || SELECTION_DISTRIBUTION_PARAM_KEYS.uniform;
      requiredKeys.forEach((fieldName) => {
        if (opPatch[fieldName] === undefined && currentOp[fieldName] == null) {
          opPatch[fieldName] = SELECTION_PARAM_DEFAULTS[fieldName];
        }
      });
      if (!currentOp.selection_distribution && opPatch.selection_distribution) {
        addAssumptionEntry(
          assumptions,
          'Using ' + opPatch.selection_distribution + ' selection distribution for ' + humanizeOperation(op, schemaHints) + '.',
          op + '.selection_distribution',
          'missing_input',
          opPatch.selection_distribution
        );
      }
    }

    if (caps.has_range) {
      if (opPatch.selectivity === undefined && currentOp.selectivity == null) {
        opPatch.selectivity = 0.01;
      }
      if (!opPatch.range_format && !currentOp.range_format) {
        opPatch.range_format = defaultRangeFormat;
      }
    }
  });
}

function buildHighLevelMissingQuestions(prompt, patch, schemaHints, formState) {
  const questions = [];
  const lowerPrompt = prompt.toLowerCase();
  const effective = buildEffectiveState(patch, formState, schemaHints);
  const selectedOps = getEnabledOperationNames(effective, schemaHints);
  const requestedSelectionDistribution = detectSelectionDistribution(lowerPrompt, schemaHints.selection_distributions);
  const treatAsStringDistribution = shouldTreatPromptAsStringDistribution(lowerPrompt, schemaHints);

  if (selectedOps.length === 0) {
    questions.push('Which operations do you want in this workload (for example inserts, point queries, range queries, updates, deletes)?');
  }

  if (!effective.sections_count) {
    questions.push('Do you want one phase or multiple phases in this workload?');
  }

  selectedOps.forEach((op) => {
    const caps = schemaHints.capabilities && schemaHints.capabilities[op] ? schemaHints.capabilities[op] : {};
    const opState = effective.operations && effective.operations[op] ? effective.operations[op] : {};
    const opLabel = humanizeOperation(op, schemaHints);

    if (opState.op_count == null) {
      questions.push('How many ' + opLabel + ' should be generated?');
    }
    if (caps.has_key && opState.key_len == null) {
      questions.push('What key size should ' + opLabel + ' use?');
    }
    if (caps.has_val && opState.val_len == null) {
      questions.push('What value size should ' + opLabel + ' use?');
    }
    if (caps.has_selection && !opState.selection_distribution) {
      questions.push('For ' + opLabel + ', what key selection distribution should be used (for example uniform, normal, zipf, beta)?');
    }
  });

  const hasStringOperations = selectedOps.some((op) => {
    const caps = schemaHints.capabilities && schemaHints.capabilities[op] ? schemaHints.capabilities[op] : {};
    return !!(caps.has_key || caps.has_val);
  });
  const asksForKeyValueDistribution = keyValueDistributionIntent(lowerPrompt);
  const requestedStringPattern = detectStringPattern(
    lowerPrompt,
    Array.isArray(schemaHints.string_patterns) && schemaHints.string_patterns.length > 0
      ? schemaHints.string_patterns
      : STRING_PATTERN_VALUES
  );
  const mentionsValues = /\bvalue(?:s)?\b|\bval(?:s)?\b|\bkey\/value\b|\bkv\b/.test(lowerPrompt);

  if (hasStringOperations && asksForKeyValueDistribution && !requestedStringPattern) {
    const stringTarget = detectStringPatternTarget(lowerPrompt);
    const targetOps = getStringPatternTargetOperations(lowerPrompt, patch, schemaHints, formState, stringTarget);
    targetOps.forEach((op) => {
      const opLabel = humanizeOperation(op, schemaHints);
      const opState = effective.operations && effective.operations[op] ? effective.operations[op] : {};
      const caps = schemaHints.capabilities && schemaHints.capabilities[op] ? schemaHints.capabilities[op] : {};
      const mappedZipfKey = /\bzipf(?:ian)?\b/.test(lowerPrompt) && opState.key_pattern === 'hot_range';
      const mappedZipfValue = /\bzipf(?:ian)?\b/.test(lowerPrompt) && opState.val_pattern === 'hot_range';
      if (stringTarget.key && caps.has_key) {
        if (!mappedZipfKey) {
          questions.push('For ' + opLabel + ' keys, which string pattern should I use (uniform, weighted, segmented, or hot_range)?');
        }
      }
      if (stringTarget.value && caps.has_val) {
        if (!mappedZipfValue) {
          questions.push('For ' + opLabel + ' values, which string pattern should I use (uniform, weighted, segmented, or hot_range)?');
        }
      }
    });

    if (targetOps.length === 0) {
      questions.push('For keys/values, which string pattern should I use (uniform, weighted, segmented, or hot_range)?');
    }
  }

  const selectedSelectionOps = selectedOps.filter((op) => {
    const caps = schemaHints.capabilities && schemaHints.capabilities[op] ? schemaHints.capabilities[op] : {};
    return !!caps.has_selection;
  });
  const selectedValueOps = selectedOps.filter((op) => {
    const caps = schemaHints.capabilities && schemaHints.capabilities[op] ? schemaHints.capabilities[op] : {};
    return !!caps.has_val;
  });

  if (requestedSelectionDistribution && !treatAsStringDistribution && selectedSelectionOps.length === 0) {
    if (mentionsValues && selectedValueOps.length > 0) {
      const valueOpsLabel = selectedValueOps.map((op) => humanizeOperation(op, schemaHints)).join(', ');
      questions.push(
        'You asked for "' + requestedSelectionDistribution + '" on values. For ' + valueOpsLabel
          + ', values use string patterns (uniform, weighted, segmented, hot_range). Which value pattern should I use?'
      );
    } else {
      const selectionCapable = schemaHints.operation_order.filter((op) => {
        const caps = schemaHints.capabilities && schemaHints.capabilities[op] ? schemaHints.capabilities[op] : {};
        return !!caps.has_selection;
      });
      const operationList = selectionCapable.map((op) => humanizeOperation(op, schemaHints)).join(', ');
      questions.push(
        'Which operations should use ' + requestedSelectionDistribution + ' key selection distribution? Available: ' + operationList + '.'
      );
    }
  }

  if (requestedSelectionDistribution && !treatAsStringDistribution) {
    const missingParams = getMissingDistributionParamsFromPrompt(lowerPrompt, requestedSelectionDistribution);
    if (missingParams.length > 0) {
      const paramLabel = missingParams.join(' and ');
      questions.push(
        'For ' + requestedSelectionDistribution + ' selection distribution, what ' + paramLabel + ' should I use?'
      );
    }
  }

  return uniqueStrings(questions);
}

function buildEffectiveState(patch, formState, schemaHints) {
  const effective = {
    character_set: patch.character_set || formState.character_set || null,
    sections_count: patch.sections_count || formState.sections_count || null,
    groups_per_section: patch.groups_per_section || formState.groups_per_section || null,
    operations: {}
  };

  const clear = patch.clear_operations === true;
  schemaHints.operation_order.forEach((op) => {
    const current = formState.operations && formState.operations[op] ? formState.operations[op] : {};
    const next = patch.operations && patch.operations[op] ? patch.operations[op] : {};
    effective.operations[op] = {
      enabled: typeof next.enabled === 'boolean'
        ? next.enabled
        : (clear ? false : !!current.enabled),
      op_count: next.op_count ?? current.op_count ?? null,
      key_len: next.key_len ?? current.key_len ?? null,
      val_len: next.val_len ?? current.val_len ?? null,
      key_pattern: next.key_pattern || current.key_pattern || null,
      val_pattern: next.val_pattern || current.val_pattern || null,
      key_hot_len: next.key_hot_len ?? current.key_hot_len ?? null,
      key_hot_amount: next.key_hot_amount ?? current.key_hot_amount ?? null,
      key_hot_probability: next.key_hot_probability ?? current.key_hot_probability ?? null,
      val_hot_len: next.val_hot_len ?? current.val_hot_len ?? null,
      val_hot_amount: next.val_hot_amount ?? current.val_hot_amount ?? null,
      val_hot_probability: next.val_hot_probability ?? current.val_hot_probability ?? null,
      selection_distribution: next.selection_distribution || current.selection_distribution || null,
      selection_min: next.selection_min ?? current.selection_min ?? null,
      selection_max: next.selection_max ?? current.selection_max ?? null,
      selection_mean: next.selection_mean ?? current.selection_mean ?? null,
      selection_std_dev: next.selection_std_dev ?? current.selection_std_dev ?? null,
      selection_alpha: next.selection_alpha ?? current.selection_alpha ?? null,
      selection_beta: next.selection_beta ?? current.selection_beta ?? null,
      selection_n: next.selection_n ?? current.selection_n ?? null,
      selection_s: next.selection_s ?? current.selection_s ?? null,
      selection_lambda: next.selection_lambda ?? current.selection_lambda ?? null,
      selection_scale: next.selection_scale ?? current.selection_scale ?? null,
      selection_shape: next.selection_shape ?? current.selection_shape ?? null,
      selectivity: next.selectivity ?? current.selectivity ?? null,
      range_format: next.range_format || current.range_format || null
    };
  });

  return effective;
}

function getEnabledOperationNames(state, schemaHints) {
  return schemaHints.operation_order.filter((op) => {
    const entry = state.operations && state.operations[op] ? state.operations[op] : null;
    return !!(entry && entry.enabled);
  });
}

function mentionsStringPatternStyle(lowerPrompt) {
  return /\b(uniform|weighted|segment(?:ed)?|hot[_ -]?range|literal|zipf(?:ian)?)\b/.test(lowerPrompt);
}

function keyValueDistributionIntent(lowerPrompt) {
  const text = String(lowerPrompt || '');
  const keyValMentions = /\b(key|keys|value|values|val|vals|key\/value|kv)\b/.test(text);
  const distributionMentions = /\bdistribution\b|\bnormal\b|\buniform\b|\bzipf(?:ian)?\b|\bbeta\b|\bexponential\b|\blog[- ]?normal\b|\bpoisson\b|\bweibull\b|\bpareto\b/.test(text);
  if (!keyValMentions || !distributionMentions) {
    return false;
  }
  return /\b(key|keys|value|values|val|vals|key\/value|kv)\b[\s\S]{0,36}\bdistribution\b|\bdistribution\b[\s\S]{0,36}\b(key|keys|value|values|val|vals|key\/value|kv)\b/.test(text)
    || /(?:change|set|make|update).{0,40}(?:key|keys|value|values|val|vals|key\/value|kv).{0,40}(?:normal|uniform|zipf|beta|exponential|log[- ]?normal|poisson|weibull|pareto)/.test(text);
}

function getMentionedOperationsFromPrompt(lowerPrompt, schemaHints) {
  const text = String(lowerPrompt || '');
  if (!text) {
    return [];
  }
  return schemaHints.operation_order.filter((op) => promptMentionsOperation(text, op, schemaHints));
}

function shouldTreatPromptAsStringDistribution(lowerPrompt, schemaHints) {
  const text = String(lowerPrompt || '');
  if (!keyValueDistributionIntent(text)) {
    return false;
  }

  const mentionsKeyOrValue = /\b(key|keys|value|values|val|vals|key\/value|kv)\b/.test(text);
  if (!mentionsKeyOrValue) {
    return false;
  }

  const mentionedOps = getMentionedOperationsFromPrompt(text, schemaHints);
  if (mentionedOps.length === 0) {
    return true;
  }

  const hasMentionedSelectionOp = mentionedOps.some((op) => {
    const caps = schemaHints.capabilities && schemaHints.capabilities[op] ? schemaHints.capabilities[op] : {};
    return !!caps.has_selection;
  });
  const hasMentionedStringOp = mentionedOps.some((op) => {
    const caps = schemaHints.capabilities && schemaHints.capabilities[op] ? schemaHints.capabilities[op] : {};
    return !!(caps.has_key || caps.has_val);
  });
  return hasMentionedStringOp && !hasMentionedSelectionOp;
}

function shouldForceFallbackForStringDistributionRequest(prompt, schemaHints, formState) {
  const lowerPrompt = String(prompt || '').toLowerCase();
  if (!keyValueDistributionIntent(lowerPrompt)) {
    return false;
  }

  const enabledOps = schemaHints.operation_order.filter((op) => {
    const current = formState.operations && formState.operations[op] ? formState.operations[op] : null;
    return !!(current && current.enabled);
  });
  if (enabledOps.length === 0) {
    return false;
  }

  const hasSelectionEnabled = enabledOps.some((op) => {
    const caps = schemaHints.capabilities && schemaHints.capabilities[op] ? schemaHints.capabilities[op] : {};
    return !!caps.has_selection;
  });
  if (hasSelectionEnabled) {
    return false;
  }

  const hasStringEnabled = enabledOps.some((op) => {
    const caps = schemaHints.capabilities && schemaHints.capabilities[op] ? schemaHints.capabilities[op] : {};
    return !!(caps.has_key || caps.has_val);
  });
  return hasStringEnabled;
}

function getMissingDistributionParamsFromPrompt(lowerPrompt, distributionName) {
  const promptText = String(lowerPrompt || '');
  const paramsByDistribution = {
    uniform: ['min', 'max'],
    normal: ['mean', 'standard deviation'],
    beta: ['alpha', 'beta'],
    zipf: ['n', 's'],
    exponential: ['lambda'],
    log_normal: ['mean', 'standard deviation'],
    poisson: ['lambda'],
    weibull: ['scale', 'shape'],
    pareto: ['scale', 'shape']
  };

  const checksByDistribution = {
    uniform: [
      { label: 'min', regex: /\bmin(?:imum)?\b/ },
      { label: 'max', regex: /\bmax(?:imum)?\b/ }
    ],
    normal: [
      { label: 'mean', regex: /\bmean\b/ },
      { label: 'standard deviation', regex: /\bstd(?:\.?\s*dev|_?dev|_?deviation)?\b|\bstandard\s+deviation\b/ }
    ],
    beta: [
      { label: 'alpha', regex: /\balpha\b/ },
      { label: 'beta', regex: /\bbeta\b/ }
    ],
    zipf: [
      { label: 'n', regex: /\b(?:n|parameter\s*n)\b/ },
      { label: 's', regex: /\b(?:s|parameter\s*s)\b/ }
    ],
    exponential: [
      { label: 'lambda', regex: /\blambda\b/ }
    ],
    log_normal: [
      { label: 'mean', regex: /\bmean\b/ },
      { label: 'standard deviation', regex: /\bstd(?:\.?\s*dev|_?dev|_?deviation)?\b|\bstandard\s+deviation\b/ }
    ],
    poisson: [
      { label: 'lambda', regex: /\blambda\b/ }
    ],
    weibull: [
      { label: 'scale', regex: /\bscale\b/ },
      { label: 'shape', regex: /\bshape\b/ }
    ],
    pareto: [
      { label: 'scale', regex: /\bscale\b/ },
      { label: 'shape', regex: /\bshape\b/ }
    ]
  };

  const checks = checksByDistribution[distributionName] || [];
  if (checks.length === 0) {
    return [];
  }

  const missing = checks
    .filter((entry) => !entry.regex.test(promptText))
    .map((entry) => entry.label);

  if (missing.length > 0) {
    return missing;
  }

  const defaults = paramsByDistribution[distributionName] || [];
  return defaults.filter((label) => !promptText.includes(label));
}

function humanizeOperation(op, schemaHints) {
  const label = schemaHints.operation_labels && schemaHints.operation_labels[op]
    ? schemaHints.operation_labels[op]
    : op;
  return String(label).replace(/_/g, ' ').toLowerCase();
}

function extractCountForPhrases(prompt, phrases) {
  for (const phrase of phrases) {
    const escaped = escapeRegExp(phrase);
    const patternA = new RegExp('(?:number\\s+of\\s+)?' + escaped + '\\s*(?:is|=|:)?\\s*([0-9][0-9,]*(?:\\.[0-9]+)?\\s*[kmb]?)', 'i');
    const patternB = new RegExp('([0-9][0-9,]*(?:\\.[0-9]+)?\\s*[kmb]?)\\s*' + escaped, 'i');
    const matchA = prompt.match(patternA);
    if (matchA && matchA[1]) {
      const parsedA = parseHumanCountToken(matchA[1]);
      if (parsedA !== null) {
        return parsedA;
      }
    }
    const matchB = prompt.match(patternB);
    if (matchB && matchB[1]) {
      const parsedB = parseHumanCountToken(matchB[1]);
      if (parsedB !== null) {
        return parsedB;
      }
    }
  }
  return null;
}

function parseHumanCountToken(token) {
  if (token === null || token === undefined) {
    return null;
  }
  if (typeof token === 'number') {
    return token > 0 ? Math.round(token) : null;
  }
  const text = String(token).trim().toLowerCase();
  const match = text.match(/^([0-9][0-9,]*(?:\.[0-9]+)?)\s*([kmb])?$/);
  if (!match) {
    return null;
  }
  const base = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(base)) {
    return null;
  }
  const suffix = match[2] || '';
  const multiplier = suffix === 'k' ? 1_000 : suffix === 'm' ? 1_000_000 : suffix === 'b' ? 1_000_000_000 : 1;
  const value = Math.round(base * multiplier);
  return value > 0 ? value : null;
}

function parseSizeToBytes(rawValue, rawUnit) {
  const numeric = Number(rawValue);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  const unit = String(rawUnit || 'b').toLowerCase();
  const multiplier = unit.startsWith('kb') || unit === 'kib'
    ? 1024
    : (unit.startsWith('mb') || unit === 'mib' ? 1024 * 1024 : 1);
  return Math.max(1, Math.round(numeric * multiplier));
}

function buildSummary(rawSummary, assumptions) {
  const summary = typeof rawSummary === 'string' && rawSummary.trim()
    ? rawSummary.trim()
    : 'Applied the request to the form.';
  if (!Array.isArray(assumptions) || assumptions.length === 0) {
    return summary;
  }
  const assumptionText = assumptions
    .map((entry) => (entry && typeof entry.text === 'string' ? entry.text.trim() : ''))
    .filter(Boolean);
  if (assumptionText.length === 0) {
    return summary;
  }
  return summary + ' Assumptions: ' + assumptionText.join(' ');
}

function addAssumptionEntry(target, text, fieldRef, reason, appliedValue) {
  if (!Array.isArray(target)) {
    return;
  }
  const cleanedText = typeof text === 'string' ? text.trim() : '';
  if (!cleanedText) {
    return;
  }
  const normalizedFieldRef = typeof fieldRef === 'string' && fieldRef.trim() ? fieldRef.trim() : null;
  const normalizedReason = typeof reason === 'string' && reason.trim() ? reason.trim() : 'default_applied';
  target.push({
    id: buildStableId('assume', normalizedFieldRef || cleanedText, normalizedReason),
    text: cleanedText,
    field_ref: normalizedFieldRef,
    reason: normalizedReason,
    applied_value: sanitizeSerializableValue(appliedValue)
  });
}

function normalizeAssumptionEntries(rawAssumptions) {
  if (!Array.isArray(rawAssumptions)) {
    return [];
  }
  const normalized = [];
  rawAssumptions.forEach((entry) => {
    if (typeof entry === 'string') {
      addAssumptionEntry(normalized, entry, null, 'default_applied', null);
      return;
    }
    if (!entry || typeof entry !== 'object') {
      return;
    }
    const text = typeof entry.text === 'string' ? entry.text.trim() : '';
    if (!text) {
      return;
    }
    const fieldRef = typeof entry.field_ref === 'string' && entry.field_ref.trim()
      ? entry.field_ref.trim()
      : null;
    const reason = typeof entry.reason === 'string' && entry.reason.trim()
      ? entry.reason.trim()
      : 'default_applied';
    const normalizedEntry = {
      id: typeof entry.id === 'string' && entry.id.trim()
        ? entry.id.trim()
        : buildStableId('assume', fieldRef || text, reason),
      text,
      field_ref: fieldRef,
      reason,
      applied_value: sanitizeSerializableValue(entry.applied_value)
    };
    normalized.push(normalizedEntry);
  });
  return dedupeByKey(normalized, (entry) => (entry.id || '') + '|' + entry.text + '|' + (entry.field_ref || ''));
}

function mergeAssumptions(primary, fallback) {
  return dedupeByKey(
    [...(Array.isArray(primary) ? primary : []), ...(Array.isArray(fallback) ? fallback : [])],
    (entry) => (entry && entry.id ? entry.id : '') + '|' + (entry && entry.text ? entry.text : '')
  );
}

function normalizeClarifications(rawClarifications, rawQuestions, schemaHints, context = null) {
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
    const inferred = inferClarificationFromQuestionText(questionText, schemaHints, context);
    if (inferred) {
      clarifications.push(inferred);
    }
  });

  return dedupeByKey(clarifications, (entry) => entry.id + '|' + entry.text);
}

function mergeClarifications(primary, fallback) {
  return dedupeByKey(
    [...(Array.isArray(primary) ? primary : []), ...(Array.isArray(fallback) ? fallback : [])],
    (entry) => (entry && entry.id ? entry.id : '') + '|' + (entry && entry.text ? entry.text : '')
  );
}

function normalizeClarificationEntry(rawEntry, schemaHints, context = null) {
  if (!rawEntry || typeof rawEntry !== 'object') {
    return null;
  }
  const text = typeof rawEntry.text === 'string' ? rawEntry.text.trim() : '';
  if (!text) {
    return null;
  }

  const inferred = inferClarificationFromQuestionText(text, schemaHints, context);
  const sanitizedBinding = sanitizeClarificationBinding(rawEntry.binding, schemaHints);
  const distributionParamQuestion = clarificationMentionsDistributionParams(text);
  const contextPromptLower = context && typeof context.prompt === 'string'
    ? context.prompt.toLowerCase()
    : '';
  if (distributionParamQuestion && shouldTreatPromptAsStringDistribution(contextPromptLower, schemaHints)) {
    return null;
  }
  let binding = sanitizedBinding || (inferred ? inferred.binding : null);
  if (
    distributionParamQuestion
    && inferred
    && inferred.binding
    && inferred.binding.type === 'operation_field'
    && binding
    && binding.type === 'operations_set'
  ) {
    // Prefer deterministic inferred parameter binding when model metadata is too broad.
    binding = inferred.binding;
  }
  if (
    distributionParamQuestion
    && binding
    && binding.type === 'operation_field'
    && typeof binding.field === 'string'
    && binding.field.startsWith('selection_')
  ) {
    const preferredOp = choosePreferredOperationForSelectionParam(schemaHints, context, binding.field, text);
    if (preferredOp && preferredOp !== binding.operation) {
      binding = {
        ...binding,
        operation: preferredOp
      };
    }
  }
  if (!binding) {
    return null;
  }

  let input = typeof rawEntry.input === 'string' && CLARIFICATION_INPUT_TYPES.has(rawEntry.input)
    ? rawEntry.input
    : null;
  if (!input && inferred && typeof inferred.input === 'string') {
    input = inferred.input;
  }
  if (
    distributionParamQuestion
    && inferred
    && inferred.binding
    && inferred.binding.type === 'operation_field'
    && (input === 'multi_enum' || input === 'enum' || input === 'boolean')
  ) {
    input = 'number';
  }
  if (!input) {
    input = suggestedInputForBinding(binding);
  }

  let options = normalizeOptionStrings(rawEntry.options);
  if (options.length === 0 && inferred && Array.isArray(inferred.options)) {
    options = normalizeOptionStrings(inferred.options);
  }
  if ((input === 'enum' || input === 'multi_enum') && options.length === 0) {
    options = defaultOptionsForBinding(binding, schemaHints);
  }

  const validation = sanitizeClarificationValidation(rawEntry.validation, input);
  const required = rawEntry.required === true || (inferred && inferred.required === true);
  const id = typeof rawEntry.id === 'string' && rawEntry.id.trim()
    ? rawEntry.id.trim()
    : buildStableId('clarify', text, JSON.stringify(binding));

  const normalized = {
    id,
    text,
    required: required === true,
    binding,
    input,
    default_behavior: typeof rawEntry.default_behavior === 'string' && rawEntry.default_behavior.trim()
      ? rawEntry.default_behavior.trim()
      : (inferred && inferred.default_behavior ? inferred.default_behavior : 'use_default')
  };
  if (options.length > 0 && (input === 'enum' || input === 'multi_enum')) {
    normalized.options = options;
  }
  if (validation) {
    normalized.validation = validation;
  }
  return normalized;
}

function inferClarificationFromQuestionText(questionText, schemaHints, context = null) {
  const text = typeof questionText === 'string' ? questionText.trim() : '';
  if (!text) {
    return null;
  }
  const lower = text.toLowerCase();
  const promptLower = context && typeof context.prompt === 'string' ? context.prompt.toLowerCase() : '';
  const op = detectOperationMention(lower, schemaHints) || detectOperationMention(promptLower, schemaHints);
  const hasDistributionParamCue = clarificationMentionsDistributionParams(text);

  if (/\bwhich operations?\b|\boperations?\s+do you want\b|\boperation mix\b/.test(lower)) {
    return {
      id: buildStableId('clarify', 'operations_set', text),
      text,
      required: true,
      binding: { type: 'operations_set' },
      input: 'multi_enum',
      options: [...schemaHints.operation_order],
      default_behavior: 'wait_for_user'
    };
  }

  if (/\bphase\b|\bsections?\b/.test(lower)) {
    return {
      id: buildStableId('clarify', 'sections_count', text),
      text,
      required: false,
      binding: { type: 'top_field', field: 'sections_count' },
      input: 'number',
      validation: { min: 1, integer: true },
      default_behavior: 'use_default'
    };
  }

  if (/\bgroups?\s*(?:per|\/)\s*section\b/.test(lower)) {
    return {
      id: buildStableId('clarify', 'groups_per_section', text),
      text,
      required: false,
      binding: { type: 'top_field', field: 'groups_per_section' },
      input: 'number',
      validation: { min: 1, integer: true },
      default_behavior: 'use_default'
    };
  }

  if (/\bcharacter\s*set\b/.test(lower)) {
    return {
      id: buildStableId('clarify', 'character_set', text),
      text,
      required: false,
      binding: { type: 'top_field', field: 'character_set' },
      input: 'enum',
      options: [...schemaHints.character_sets],
      default_behavior: 'use_default'
    };
  }

  if ((/\bhow many\b|\bnumber of\b|\bop[_\s-]?count\b/.test(lower)) && op) {
    return {
      id: buildStableId('clarify', op + '.op_count', text),
      text,
      required: true,
      binding: { type: 'operation_field', operation: op, field: 'op_count' },
      input: 'number',
      validation: { min: 1, integer: true },
      default_behavior: 'wait_for_user'
    };
  }

  if (/\bkey\b.*\b(size|length|len)\b/.test(lower) && op) {
    return {
      id: buildStableId('clarify', op + '.key_len', text),
      text,
      required: false,
      binding: { type: 'operation_field', operation: op, field: 'key_len' },
      input: 'number',
      validation: { min: 1, integer: true },
      default_behavior: 'use_default'
    };
  }

  if (/\bvalue\b.*\b(size|length|len)\b|\bval\b.*\b(size|length|len)\b/.test(lower) && op) {
    return {
      id: buildStableId('clarify', op + '.val_len', text),
      text,
      required: false,
      binding: { type: 'operation_field', operation: op, field: 'val_len' },
      input: 'number',
      validation: { min: 1, integer: true },
      default_behavior: 'use_default'
    };
  }

  if (
    /\bstring pattern\b|\bpatterned distribution\b|\bsimple uniform random keys\/values\b|\bwhich value pattern should i use\b|\bwhich string pattern should i use\b/.test(lower)
  ) {
    const asksKey = /\bkey(?:s)?\b/.test(lower);
    const asksValue = /\bvalue(?:s)?\b|\bval(?:s)?\b/.test(lower);
    let targetField = null;
    if (asksKey && !asksValue) {
      targetField = 'key_pattern';
    } else if (asksValue && !asksKey) {
      targetField = 'val_pattern';
    }
    if (!targetField && op) {
      const caps = schemaHints.capabilities && schemaHints.capabilities[op] ? schemaHints.capabilities[op] : {};
      if (caps.has_key) {
        targetField = 'key_pattern';
      } else if (caps.has_val) {
        targetField = 'val_pattern';
      }
    }
    if (!targetField) {
      targetField = asksValue ? 'val_pattern' : 'key_pattern';
    }

    const targetOp = op
      || choosePreferredOperationForStringPattern(schemaHints, context, targetField, text)
      || firstOperationByCapability(schemaHints, targetField === 'key_pattern' ? 'key' : 'value');
    if (!targetOp) {
      return {
        id: buildStableId('clarify', 'operations_set.string_pattern', text),
        text,
        required: false,
        binding: {
          type: 'operations_set',
          capability: targetField === 'key_pattern' ? 'key' : 'value'
        },
        input: 'multi_enum',
        options: defaultOptionsForBinding(
          {
            type: 'operations_set',
            capability: targetField === 'key_pattern' ? 'key' : 'value'
          },
          schemaHints
        ),
        default_behavior: 'use_default'
      };
    }
    return {
      id: buildStableId('clarify', targetOp + '.' + targetField, text),
      text,
      required: false,
      binding: { type: 'operation_field', operation: targetOp, field: targetField },
      input: 'enum',
      options: defaultOptionsForBinding({ type: 'operation_field', operation: targetOp, field: targetField }, schemaHints),
      default_behavior: 'use_default'
    };
  }

  if ((/\bselection\s+distribution\b|\bkey selection distribution\b/.test(lower)) && !hasDistributionParamCue) {
    if (op) {
      return {
        id: buildStableId('clarify', op + '.selection_distribution', text),
        text,
        required: false,
        binding: { type: 'operation_field', operation: op, field: 'selection_distribution' },
        input: 'enum',
        options: [...schemaHints.selection_distributions],
        default_behavior: 'use_default'
      };
    }
    return {
      id: buildStableId('clarify', 'operations_set.selection', text),
      text,
      required: true,
      binding: { type: 'operations_set', capability: 'selection' },
      input: 'multi_enum',
      options: defaultOptionsForBinding({ type: 'operations_set', capability: 'selection' }, schemaHints),
      default_behavior: 'wait_for_user'
    };
  }

  const distributionParamMap = [
    { matcher: /\bmean\b/, field: 'selection_mean' },
    { matcher: /\bstandard\s+deviation\b|\bstd(?:\.?\s*dev|_?dev|_?deviation)?\b/, field: 'selection_std_dev' },
    { matcher: /\balpha\b/, field: 'selection_alpha' },
    { matcher: /\bbeta\b/, field: 'selection_beta' },
    { matcher: /\blambda\b/, field: 'selection_lambda' },
    { matcher: /\bscale\b/, field: 'selection_scale' },
    { matcher: /\bshape\b/, field: 'selection_shape' },
    { matcher: /\bmin(?:imum)?\b/, field: 'selection_min' },
    { matcher: /\bmax(?:imum)?\b/, field: 'selection_max' },
    { matcher: /\bparameter\s+n\b|\bn\b/, field: 'selection_n' },
    { matcher: /\bparameter\s+s\b|\bs\b/, field: 'selection_s' }
  ];
  const paramEntry = distributionParamMap.find((entry) => entry.matcher.test(lower));
  if (paramEntry) {
    const targetOp = op
      || choosePreferredOperationForSelectionParam(schemaHints, context, paramEntry.field, text)
      || firstOperationByCapability(schemaHints, 'selection');
    if (!targetOp) {
      return {
        id: buildStableId('clarify', 'operations_set.selection', text),
        text,
        required: true,
        binding: { type: 'operations_set', capability: 'selection' },
        input: 'multi_enum',
        options: defaultOptionsForBinding({ type: 'operations_set', capability: 'selection' }, schemaHints),
        default_behavior: 'wait_for_user'
      };
    }
    return {
      id: buildStableId('clarify', targetOp + '.' + paramEntry.field, text),
      text,
      required: true,
      binding: { type: 'operation_field', operation: targetOp, field: paramEntry.field },
      input: 'number',
      default_behavior: 'wait_for_user'
    };
  }

  // Safe downgrade for malformed/unsupported question metadata.
  return {
    id: buildStableId('clarify', 'operations_set.generic', text),
    text,
    required: false,
    binding: { type: 'operations_set' },
    input: 'multi_enum',
    options: [...schemaHints.operation_order],
    default_behavior: 'use_default'
  };
}

function sanitizeClarificationBinding(rawBinding, schemaHints) {
  if (!rawBinding || typeof rawBinding !== 'object') {
    return null;
  }
  const type = typeof rawBinding.type === 'string' ? rawBinding.type.trim() : '';
  if (type === 'top_field') {
    const field = typeof rawBinding.field === 'string' ? rawBinding.field.trim() : '';
    if (!TOP_LEVEL_BINDING_FIELDS.has(field)) {
      return null;
    }
    return { type: 'top_field', field };
  }
  if (type === 'operation_field') {
    const operation = typeof rawBinding.operation === 'string' ? rawBinding.operation.trim() : '';
    const field = typeof rawBinding.field === 'string' ? rawBinding.field.trim() : '';
    if (!schemaHints.operation_order.includes(operation)) {
      return null;
    }
    if (!OPERATION_BINDING_FIELDS.has(field)) {
      return null;
    }
    if (!operationSupportsField(operation, field, schemaHints)) {
      return null;
    }
    return { type: 'operation_field', operation, field };
  }
  if (type === 'operations_set') {
    const capability = typeof rawBinding.capability === 'string' ? rawBinding.capability.trim() : '';
    if (!capability) {
      return { type: 'operations_set' };
    }
    if (['selection', 'range', 'key', 'value', 'all'].includes(capability)) {
      return { type: 'operations_set', capability };
    }
    return { type: 'operations_set' };
  }
  return null;
}

function sanitizeClarificationValidation(rawValidation, inputType) {
  if (!rawValidation || typeof rawValidation !== 'object') {
    return null;
  }
  const validation = {};
  if (inputType === 'number') {
    if (Number.isFinite(rawValidation.min)) {
      validation.min = rawValidation.min;
    }
    if (Number.isFinite(rawValidation.max)) {
      validation.max = rawValidation.max;
    }
    if (rawValidation.integer === true) {
      validation.integer = true;
    }
  } else if (inputType === 'multi_enum') {
    if (Number.isFinite(rawValidation.min_items) && rawValidation.min_items >= 0) {
      validation.min_items = Math.floor(rawValidation.min_items);
    }
    if (Number.isFinite(rawValidation.max_items) && rawValidation.max_items >= 0) {
      validation.max_items = Math.floor(rawValidation.max_items);
    }
  } else if (inputType === 'text') {
    if (Number.isFinite(rawValidation.min_length) && rawValidation.min_length >= 0) {
      validation.min_length = Math.floor(rawValidation.min_length);
    }
    if (Number.isFinite(rawValidation.max_length) && rawValidation.max_length >= 0) {
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
      .map((value) => String(value || '').trim())
      .filter((value) => value.length > 0)
  );
}

function suggestedInputForBinding(binding) {
  if (!binding || typeof binding !== 'object') {
    return 'text';
  }
  if (binding.type === 'operations_set') {
    return 'multi_enum';
  }
  if (binding.type === 'top_field') {
    if (binding.field === 'character_set') {
      return 'enum';
    }
    return 'number';
  }
  if (binding.type === 'operation_field') {
    if (binding.field === 'enabled') {
      return 'boolean';
    }
    if (binding.field === 'selection_distribution' || binding.field === 'range_format' || binding.field === 'key_pattern' || binding.field === 'val_pattern') {
      return 'enum';
    }
    return 'number';
  }
  return 'text';
}

function defaultOptionsForBinding(binding, schemaHints) {
  if (!binding || typeof binding !== 'object') {
    return [];
  }
  if (binding.type === 'top_field' && binding.field === 'character_set') {
    return [...schemaHints.character_sets];
  }
  if (binding.type === 'operation_field' && binding.field === 'selection_distribution') {
    return [...schemaHints.selection_distributions];
  }
  if (binding.type === 'operation_field' && (binding.field === 'key_pattern' || binding.field === 'val_pattern')) {
    return Array.isArray(schemaHints.string_patterns) && schemaHints.string_patterns.length > 0
      ? [...schemaHints.string_patterns]
      : [...STRING_PATTERN_VALUES];
  }
  if (binding.type === 'operation_field' && binding.field === 'range_format') {
    return [...schemaHints.range_formats];
  }
  if (binding.type === 'operations_set') {
    const capability = binding.capability || 'all';
    if (capability === 'all') {
      return [...schemaHints.operation_order];
    }
    return schemaHints.operation_order.filter((op) => {
      const caps = schemaHints.capabilities && schemaHints.capabilities[op] ? schemaHints.capabilities[op] : {};
      if (capability === 'selection') {
        return !!caps.has_selection;
      }
      if (capability === 'range') {
        return !!caps.has_range;
      }
      if (capability === 'key') {
        return !!caps.has_key;
      }
      if (capability === 'value') {
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
  return operations.find((op) => {
    const caps = schemaHints.capabilities && schemaHints.capabilities[op] ? schemaHints.capabilities[op] : {};
    if (capabilityName === 'selection') {
      return !!caps.has_selection;
    }
    if (capabilityName === 'range') {
      return !!caps.has_range;
    }
    if (capabilityName === 'key') {
      return !!caps.has_key;
    }
    if (capabilityName === 'value') {
      return !!caps.has_val;
    }
    return true;
  }) || null;
}

function choosePreferredOperationForSelectionParam(schemaHints, context, fieldName, questionText) {
  if (typeof fieldName !== 'string' || !fieldName.startsWith('selection_')) {
    return null;
  }

  const safeContext = context && typeof context === 'object' ? context : {};
  const safeFormState = safeContext.formState && typeof safeContext.formState === 'object'
    ? safeContext.formState
    : {
      character_set: null,
      sections_count: null,
      groups_per_section: null,
      operations: {}
    };
  const safePatch = safeContext.patch && typeof safeContext.patch === 'object'
    ? safeContext.patch
    : {
      character_set: null,
      sections_count: null,
      groups_per_section: null,
      clear_operations: false,
      operations: {}
    };

  const effective = buildEffectiveState(safePatch, safeFormState, schemaHints);
  const enabledSelectionOps = getEnabledOperationNames(effective, schemaHints).filter((op) => {
    return operationSupportsField(op, fieldName, schemaHints);
  });

  if (enabledSelectionOps.length === 1) {
    return enabledSelectionOps[0];
  }

  let narrowed = enabledSelectionOps;
  const distributionHint = detectSelectionDistribution(String(questionText || '').toLowerCase(), schemaHints.selection_distributions);
  if (distributionHint) {
    const byDistribution = enabledSelectionOps.filter((op) => {
      const state = effective.operations && effective.operations[op] ? effective.operations[op] : {};
      return state.selection_distribution === distributionHint;
    });
    if (byDistribution.length === 1) {
      return byDistribution[0];
    }
    if (byDistribution.length > 0) {
      narrowed = byDistribution;
    }
  }

  const promptLower = typeof safeContext.prompt === 'string' ? safeContext.prompt.toLowerCase() : '';
  if (promptLower) {
    const mentionedNarrowed = narrowed.filter((op) => promptMentionsOperation(promptLower, op, schemaHints));
    if (mentionedNarrowed.length === 1) {
      return mentionedNarrowed[0];
    }
    const mentionedEnabled = enabledSelectionOps.filter((op) => promptMentionsOperation(promptLower, op, schemaHints));
    if (mentionedEnabled.length === 1) {
      return mentionedEnabled[0];
    }
  }

  return null;
}

function choosePreferredOperationForStringPattern(schemaHints, context, fieldName, questionText) {
  if (fieldName !== 'key_pattern' && fieldName !== 'val_pattern') {
    return null;
  }

  const safeContext = context && typeof context === 'object' ? context : {};
  const safeFormState = safeContext.formState && typeof safeContext.formState === 'object'
    ? safeContext.formState
    : {
      character_set: null,
      sections_count: null,
      groups_per_section: null,
      operations: {}
    };
  const safePatch = safeContext.patch && typeof safeContext.patch === 'object'
    ? safeContext.patch
    : {
      character_set: null,
      sections_count: null,
      groups_per_section: null,
      clear_operations: false,
      operations: {}
    };

  const effective = buildEffectiveState(safePatch, safeFormState, schemaHints);
  const enabledOps = getEnabledOperationNames(effective, schemaHints).filter((op) => {
    return operationSupportsField(op, fieldName, schemaHints);
  });
  if (enabledOps.length === 1) {
    return enabledOps[0];
  }

  const hintText = String(questionText || '').toLowerCase();
  if (hintText) {
    const hinted = enabledOps.filter((op) => promptMentionsOperation(hintText, op, schemaHints));
    if (hinted.length === 1) {
      return hinted[0];
    }
  }

  const promptLower = typeof safeContext.prompt === 'string' ? safeContext.prompt.toLowerCase() : '';
  if (promptLower) {
    const mentioned = enabledOps.filter((op) => promptMentionsOperation(promptLower, op, schemaHints));
    if (mentioned.length === 1) {
      return mentioned[0];
    }
  }

  return null;
}

function detectOperationMention(lowerText, schemaHints) {
  const text = String(lowerText || '');
  for (const op of schemaHints.operation_order) {
    if (promptMentionsOperation(text, op, schemaHints)) {
      return op;
    }
  }
  return null;
}

function clarificationMentionsDistributionParams(textValue) {
  const text = String(textValue || '').toLowerCase();
  if (!text) {
    return false;
  }
  return /\bmean\b|\bstandard\s+deviation\b|\bstd(?:\.?\s*dev|_?dev|_?deviation)?\b|\balpha\b|\bbeta\b|\blambda\b|\bscale\b|\bshape\b|\bmin(?:imum)?\b|\bmax(?:imum)?\b|\bparameter\s+n\b|\bparameter\s+s\b/.test(text);
}

function operationSupportsField(operation, fieldName, schemaHints) {
  if (!operation || !fieldName) {
    return false;
  }
  const caps = schemaHints.capabilities && schemaHints.capabilities[operation]
    ? schemaHints.capabilities[operation]
    : {};
  if (fieldName === 'enabled' || fieldName === 'op_count') {
    return true;
  }
  if (fieldName === 'key_len') {
    return !!caps.has_key;
  }
  if (fieldName === 'key_pattern' || fieldName === 'key_hot_len' || fieldName === 'key_hot_amount' || fieldName === 'key_hot_probability') {
    return !!caps.has_key;
  }
  if (fieldName === 'val_len') {
    return !!caps.has_val;
  }
  if (fieldName === 'val_pattern' || fieldName === 'val_hot_len' || fieldName === 'val_hot_amount' || fieldName === 'val_hot_probability') {
    return !!caps.has_val;
  }
  if (
    [
      'selection_distribution',
      'selection_min',
      'selection_max',
      'selection_mean',
      'selection_std_dev',
      'selection_alpha',
      'selection_beta',
      'selection_n',
      'selection_s',
      'selection_lambda',
      'selection_scale',
      'selection_shape'
    ].includes(fieldName)
  ) {
    return !!caps.has_selection;
  }
  if (fieldName === 'selectivity' || fieldName === 'range_format') {
    return !!caps.has_range;
  }
  return false;
}

function buildStableId(prefix, ...parts) {
  const joined = parts
    .map((part) => String(part || '').trim())
    .filter((part) => part.length > 0)
    .join('|');
  return prefix + '_' + hashString(joined || prefix);
}

function hashString(value) {
  const text = String(value || '');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function sanitizeSerializableValue(value) {
  if (value === undefined) {
    return null;
  }
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeSerializableValue(item));
  }
  if (typeof value === 'object') {
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
    const key = typeof keyFn === 'function' ? keyFn(entry) : String(entry);
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

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const slice = text.slice(firstBrace, lastBrace + 1);
    return safeJsonParse(slice);
  }

  return null;
}

function isAssistPayloadShape(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  if (!value.patch || typeof value.patch !== 'object' || Array.isArray(value.patch)) {
    return false;
  }
  if (!value.patch.operations || typeof value.patch.operations !== 'object' || Array.isArray(value.patch.operations)) {
    return false;
  }
  if (value.questions !== undefined && !Array.isArray(value.questions)) {
    return false;
  }
  if (value.clarifications !== undefined && !Array.isArray(value.clarifications)) {
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
  if (typeof result === 'string') {
    return result;
  }
  if (!result || typeof result !== 'object') {
    return '';
  }
  if (typeof result.response === 'string') {
    return result.response;
  }
  if (typeof result.output_text === 'string') {
    return result.output_text;
  }
  if (Array.isArray(result.response)) {
    return result.response.map((item) => (typeof item === 'string' ? item : '')).join('\n');
  }
  if (Array.isArray(result.output)) {
    return result.output
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return '';
        }
        if (typeof item.text === 'string') {
          return item.text;
        }
        if (Array.isArray(item.content)) {
          return item.content
            .map((part) => (part && typeof part.text === 'string' ? part.text : ''))
            .join('\n');
        }
        return '';
      })
      .join('\n');
  }
  if (result.result) {
    return extractAiText(result.result);
  }
  return '';
}

function normalizeStringOrNull(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') {
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
  if (typeof value !== 'string') {
    return null;
  }
  const cleaned = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  const candidates = Array.isArray(allowedPatterns) && allowedPatterns.length > 0
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
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackValue;
}

function parseFloatWithDefault(value, fallbackValue) {
  const parsed = Number.parseFloat(String(value || ''));
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
        reject(new Error(message || 'Operation timed out.'));
      }, ms);
    })
  ]).finally(() => {
    if (timer) {
      clearTimeout(timer);
    }
  });
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function jsonResponse(payload, status) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

function getAiRequestConfig(env) {
  const modelNames = parseModelNames(env);
  const modelName = modelNames[0];
  const configuredMaxTokens = parseIntegerWithDefault(env.AI_MAX_TOKENS, DEFAULT_MAX_TOKENS);
  const maxTokens = clamp(configuredMaxTokens, 120, 900);
  const temperature = parseFloatWithDefault(env.AI_TEMPERATURE, 0);
  const timeoutMs = parseIntegerWithDefault(env.AI_TIMEOUT_MS, DEFAULT_AI_TIMEOUT_MS);
  const retryAttempts = parseIntegerWithDefault(env.AI_RETRY_ATTEMPTS, DEFAULT_RETRY_ATTEMPTS);

  return {
    modelName,
    modelNames,
    maxTokens,
    temperature,
    timeoutMs,
    retryAttempts
  };
}

function parseModelNames(env) {
  const explicitChain = typeof env.AI_MODELS === 'string' && env.AI_MODELS.trim()
    ? env.AI_MODELS
    : '';
  const fromChain = explicitChain
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  if (fromChain.length > 0) {
    return uniqueStrings(fromChain);
  }

  const configured = typeof env.AI_NAME === 'string' && env.AI_NAME.trim()
    ? env.AI_NAME.trim()
    : DEFAULT_MODEL;
  return uniqueStrings([DEFAULT_MODEL, configured, ...DEFAULT_FALLBACK_MODELS]);
}

function buildAiDebugFromOutcome(aiConfig, outcome) {
  const attempts = outcome && Array.isArray(outcome.attempts) ? outcome.attempts : [];
  const retryAttempts = outcome && Number.isFinite(outcome.retry_attempts)
    ? outcome.retry_attempts
    : aiConfig.retryAttempts;
  const lastAiOutput = outcome && outcome.last_ai_output ? normalizeAiOutput(outcome.last_ai_output) : null;
  return {
    reason: 'Workers AI did not return a usable patch response.',
    binding_present: true,
    model: outcome && typeof outcome.model === 'string' ? outcome.model : aiConfig.modelName,
    models: Array.isArray(outcome && outcome.models) ? outcome.models : aiConfig.modelNames,
    max_tokens: aiConfig.maxTokens,
    temperature: aiConfig.temperature,
    timeout_ms: aiConfig.timeoutMs,
    retry_attempts: retryAttempts,
    attempts,
    last_ai_output: lastAiOutput
  };
}

function sanitizeErrorForClient(errorLike) {
  const error = errorLike && typeof errorLike === 'object' ? errorLike : {};
  const message = typeof error.message === 'string' && error.message.trim()
    ? error.message.trim()
    : String(errorLike || 'Unknown error');
  const name = typeof error.name === 'string' && error.name.trim()
    ? error.name.trim()
    : 'Error';

  const sanitized = { name, message };
  if (error.cause && typeof error.cause === 'object' && typeof error.cause.message === 'string') {
    sanitized.cause = String(error.cause.message);
  }
  if (typeof error.ai_output === 'string') {
    sanitized.ai_output = normalizeAiOutput(error.ai_output);
  }
  if (typeof error.model_name === 'string' && error.model_name.trim()) {
    sanitized.model = error.model_name.trim();
  }
  return sanitized;
}

function normalizeAiOutput(text) {
  if (typeof text !== 'string') {
    return null;
  }
  if (!text.trim()) {
    return null;
  }
  return text;
}

function logFullAiOutputToStdout(label, text) {
  if (typeof text !== 'string' || !text) {
    console.log('[assist-ai:' + label + '] (empty)');
    return;
  }

  // Keep chunks modest so logs are not truncated at a single-line boundary.
  const chunkSize = 3000;
  const totalChunks = Math.max(1, Math.ceil(text.length / chunkSize));
  console.log('[assist-ai:' + label + '] BEGIN length=' + text.length + ' chunks=' + totalChunks);
  for (let index = 0; index < totalChunks; index += 1) {
    const start = index * chunkSize;
    const end = start + chunkSize;
    const chunk = text.slice(start, end);
    console.log('[assist-ai:' + label + '] chunk ' + (index + 1) + '/' + totalChunks + '\n' + chunk);
  }
  console.log('[assist-ai:' + label + '] END');
}
