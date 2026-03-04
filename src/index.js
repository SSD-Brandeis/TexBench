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
  const fallbackAssistPayload = buildFallbackAssistPayload(prompt, schemaHints, formState);
  const warnings = [];

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
      const outcome = await runAssistantWithRetries(env, prompt, schemaHints, formState, currentJson, aiConfig);
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

async function runAssistantWithRetries(env, prompt, schemaHints, formState, currentJson, aiConfig) {
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

async function runAssistantOnce(env, prompt, schemaHints, formState, currentJson, aiConfig, modelName, maxTokensOverride) {
  const messages = buildAssistantMessages(prompt, schemaHints, formState, currentJson);
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

function buildAssistantMessages(prompt, schemaHints, formState, currentJson) {
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
    'If user asks for a distribution but no selection-capable operation is active, ask which operations should use it.',
    'Output contract (sparse):',
    '{ "summary": "short sentence", "patch": { "character_set": "...", "sections_count": 1, "groups_per_section": 1, "clear_operations": false, "operations": { "<operation_name>": { "enabled": true, "op_count": 100000, "selection_distribution": "normal", "selection_mean": 0.5, "selection_std_dev": 0.15 } } }, "questions": ["high-level question"], "assumptions": ["short assumption"] }',
    'Allowed operation field names: enabled, op_count, key_len, val_len, selection_distribution, selection_min, selection_max, selection_mean, selection_std_dev, selection_alpha, selection_beta, selection_n, selection_s, selection_lambda, selection_scale, selection_shape, selectivity, range_format.',
    'Rules:',
    '- Ask only for missing information.',
    '- Keep questions high-level and user-friendly.',
    '- Use safe defaults when missing; list them in assumptions.',
    '- Keep output compact. Do not emit untouched operations.',
    '- Convert units/counts: 1KB=1024, 100K=100000, 1M=1000000.',
    '- Use only operation names and enum values from schema_hints.',
    '- If unsure, return a conservative patch and ask questions.'
  ].join('\n');

  const userMessage = JSON.stringify(
    {
      request: prompt,
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
    'Extract/repair into exactly one JSON object with keys: summary, patch, questions, assumptions.',
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
  const capabilities = hints.capabilities && typeof hints.capabilities === 'object'
    ? hints.capabilities
    : {};

  return {
    operation_order: operationOrder.length > 0 ? operationOrder : [...FALLBACK_OPERATION_ORDER],
    operation_labels: operationLabels,
    character_sets: characterSets.length > 0 ? characterSets : ['alphanumeric', 'alphabetic', 'numeric'],
    range_formats: rangeFormats.length > 0 ? rangeFormats : ['StartCount', 'StartEnd'],
    selection_distributions: selectionDistributions.length > 0 ? selectionDistributions : [...DEFAULT_SELECTION_DISTRIBUTIONS],
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

function normalizeAssistPayload(rawPayload, schemaHints, formState, prompt) {
  const payload = rawPayload && typeof rawPayload === 'object' ? rawPayload : {};
  const patch = normalizePatch(payload.patch, schemaHints);
  const fallback = buildFallbackAssistPayload(prompt, schemaHints, formState);

  const payloadAssumptions = Array.isArray(payload.assumptions)
    ? normalizeStringList(payload.assumptions)
    : [];
  const fallbackAssumptions = normalizeStringList(fallback.assumptions);
  const assumptions = uniqueStrings([...payloadAssumptions, ...fallbackAssumptions]);

  const payloadQuestions = Array.isArray(payload.questions)
    ? normalizeStringList(payload.questions)
    : [];
  const fallbackQuestions = normalizeStringList(fallback.questions);
  const questions = uniqueStrings([...payloadQuestions, ...fallbackQuestions]);

  const mergedPatch = mergePatchWithFallback(patch, fallback.patch, formState, prompt, schemaHints);
  const summary = buildSummary(payload.summary, assumptions);

  return {
    summary,
    patch: mergedPatch,
    questions,
    assumptions
  };
}

function mergePatchWithFallback(primaryPatch, fallbackPatch, formState, prompt, schemaHints) {
  const clearOperations = primaryPatch.clear_operations === true || fallbackPatch.clear_operations === true;
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
    const mergedEnabled = primary.enabled === true
      ? true
      : (primaryDisableRequested
          ? false
          : (typeof fallback.enabled === 'boolean'
              ? fallback.enabled
              : (clearOperations ? false : !!current.enabled)));

    merged.operations[op] = {
      enabled: mergedEnabled,
      op_count: primary.op_count ?? fallback.op_count ?? current.op_count,
      key_len: primary.key_len ?? fallback.key_len ?? current.key_len,
      val_len: primary.val_len ?? fallback.val_len ?? current.val_len,
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

function operationPatchHasSignal(operationPatch) {
  if (!operationPatch || typeof operationPatch !== 'object') {
    return false;
  }
  const signalFields = [
    'op_count',
    'key_len',
    'val_len',
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
  const caps = schemaHints.capabilities && schemaHints.capabilities[op] ? schemaHints.capabilities[op] : {};

  const normalized = {
    enabled: typeof patch.enabled === 'boolean' ? patch.enabled : undefined,
    op_count: positiveNumberOrNull(patch.op_count),
    key_len: positiveIntegerOrNull(patch.key_len),
    val_len: positiveIntegerOrNull(patch.val_len),
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

  if (normalized.enabled === undefined && hasExplicitFields) {
    normalized.enabled = inferOperationEnabledFromPatch(normalized, op, schemaHints);
  }

  // Enforce schema capabilities so AI cannot set invalid fields for an operation.
  if (!caps.has_key) {
    normalized.key_len = null;
  }
  if (!caps.has_val) {
    normalized.val_len = null;
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
  if (caps.has_key && operationPatch.key_len !== null) {
    return true;
  }
  if (caps.has_val && operationPatch.val_len !== null) {
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
  applyRangeSettingsDefaults(patch, schemaHints);
  applyMissingDefaults(patch, schemaHints, formState, assumptions);

  const questions = buildHighLevelMissingQuestions(prompt, patch, schemaHints, formState);

  return {
    summary: 'Applied what I could from your message and filled safe defaults for missing values.',
    patch,
    assumptions,
    questions
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
  const noOutstandingQuestions = !Array.isArray(fallbackAssistPayload.questions) || fallbackAssistPayload.questions.length === 0;

  if (!hasParsedChanges) {
    return !noOutstandingQuestions;
  }
  if (noOutstandingQuestions) {
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
    if (opPatch.selection_distribution && opPatch.selection_distribution !== current.selection_distribution) {
      return true;
    }
    const numericFields = [
      'op_count',
      'key_len',
      'val_len',
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
    assumptions.push('Using ' + fallbackCharacterSet + ' character set.');
  }

  if (!patch.sections_count && !formState.sections_count) {
    patch.sections_count = 1;
    assumptions.push('Using one workload section.');
  }

  if (!patch.groups_per_section && !formState.groups_per_section) {
    patch.groups_per_section = 1;
    assumptions.push('Using one group per section.');
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
      assumptions.push('Using default operation count (500000) for ' + humanizeOperation(op, schemaHints) + '.');
    }

    if (caps.has_key && opPatch.key_len === undefined && currentOp.key_len == null) {
      opPatch.key_len = 20;
      assumptions.push('Using default key length (20) for ' + humanizeOperation(op, schemaHints) + '.');
    }

    if (caps.has_val && opPatch.val_len === undefined && currentOp.val_len == null) {
      opPatch.val_len = 256;
      assumptions.push('Using default value length (256) for ' + humanizeOperation(op, schemaHints) + '.');
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
        assumptions.push('Using ' + opPatch.selection_distribution + ' selection distribution for ' + humanizeOperation(op, schemaHints) + '.');
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
  const mentionsStringPattern = mentionsStringPatternStyle(lowerPrompt);
  const asksForKeyValueDistribution = /\b(key|keys|value|values)\b[\s\S]{0,30}\bdistribution\b|\bdistribution\b[\s\S]{0,30}\b(key|keys|value|values)\b/.test(lowerPrompt);

  if (hasStringOperations && !mentionsStringPattern) {
    if (asksForKeyValueDistribution && requestedSelectionDistribution) {
      questions.push('For keys/values, which string pattern do you want (uniform, weighted, segmented, or hot_range)?');
    } else {
      questions.push('Do you want simple uniform random keys/values, or a patterned distribution (weighted, segmented, or hot range)?');
    }
  }

  const selectedSelectionOps = selectedOps.filter((op) => {
    const caps = schemaHints.capabilities && schemaHints.capabilities[op] ? schemaHints.capabilities[op] : {};
    return !!caps.has_selection;
  });

  if (requestedSelectionDistribution && selectedSelectionOps.length === 0) {
    const selectionCapable = schemaHints.operation_order.filter((op) => {
      const caps = schemaHints.capabilities && schemaHints.capabilities[op] ? schemaHints.capabilities[op] : {};
      return !!caps.has_selection;
    });
    const operationList = selectionCapable.map((op) => humanizeOperation(op, schemaHints)).join(', ');
    questions.push(
      'Which operations should use ' + requestedSelectionDistribution + ' key selection distribution? Available: ' + operationList + '.'
    );
  }

  if (requestedSelectionDistribution) {
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
  return /\b(uniform|weighted|segment(?:ed)?|hot[_ -]?range|literal)\b/.test(lowerPrompt);
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
  return summary + ' Assumptions: ' + assumptions.join(' ');
}

function normalizeStringList(values) {
  if (!Array.isArray(values)) {
    return [];
  }
  return uniqueStrings(
    values
      .map((value) => String(value || '').trim())
      .filter((value) => value.length > 0)
  );
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
