(function initAssistantFollowupsModule(globalScope) {
  const OPERATION_TEXT_MATCHERS = {
    inserts: /\binsert(?:s|ion)?\b/,
    updates: /\bupdate(?:s)?\b/,
    merges: /\bmerge(?:s)?\b|\bread[- ]?modify[- ]?write\b|\brmw\b/,
    point_queries: /\bpoint\s*(?:query|queries|read|reads)\b/,
    range_queries: /\brange\s*(?:query|queries)\b/,
    point_deletes: /\bpoint\s*delete(?:s)?\b/,
    range_deletes: /\brange\s*delete(?:s)?\b/,
    empty_point_queries: /\bempty\s+point\s*(?:query|queries|read|reads)\b/,
    empty_point_deletes: /\bempty\s+point\s*delete(?:s)?\b/,
  };

  const SELECTION_FIELD_DEFAULT_DISTRIBUTION = {
    selection_min: "uniform",
    selection_max: "uniform",
    selection_mean: "normal",
    selection_std_dev: "normal",
    selection_alpha: "beta",
    selection_beta: "beta",
    selection_n: "zipf",
    selection_s: "zipf",
    selection_lambda: "exponential",
    selection_scale: "weibull",
    selection_shape: "weibull",
  };

  const POSITIVE_INTEGER_FIELDS = new Set([
    "op_count",
    "key_len",
    "val_len",
    "selection_n",
    "sections_count",
    "groups_per_section",
  ]);

  const NON_NEGATIVE_FIELDS = new Set([
    "selection_std_dev",
    "selection_alpha",
    "selection_beta",
    "selection_s",
    "selection_lambda",
    "selection_scale",
    "selection_shape",
    "selectivity",
  ]);

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function uniqueStrings(values) {
    return [...new Set(values)];
  }

  function parseHumanCount(rawValue) {
    const text = normalizeText(rawValue).toLowerCase().replace(/,/g, "");
    if (!text) {
      return null;
    }

    const match = text.match(/^(-?\d+(?:\.\d+)?)\s*(k|m|b)?$/);
    if (!match) {
      const numeric = Number(text);
      return Number.isFinite(numeric) ? numeric : null;
    }

    const base = Number(match[1]);
    if (!Number.isFinite(base)) {
      return null;
    }
    const suffix = match[2] || "";
    const multiplier =
      suffix === "k" ? 1e3 : suffix === "m" ? 1e6 : suffix === "b" ? 1e9 : 1;
    return base * multiplier;
  }

  function parseHumanLength(rawValue) {
    const text = normalizeText(rawValue).toLowerCase().replace(/,/g, "");
    if (!text) {
      return null;
    }

    const match = text.match(/^(-?\d+(?:\.\d+)?)\s*(kb|mb|gb|bytes?|b)?$/);
    if (!match) {
      const fallback = parseHumanCount(text);
      return Number.isFinite(fallback) ? fallback : null;
    }

    const base = Number(match[1]);
    if (!Number.isFinite(base)) {
      return null;
    }
    const unit = match[2] || "";
    const multiplier =
      unit === "kb"
        ? 1024
        : unit === "mb"
          ? 1024 * 1024
          : unit === "gb"
            ? 1024 * 1024 * 1024
            : 1;
    return base * multiplier;
  }

  function parseBoolean(rawValue) {
    const text = normalizeText(rawValue).toLowerCase();
    if (!text) {
      return null;
    }
    if (["yes", "y", "true", "1", "on", "include"].includes(text)) {
      return true;
    }
    if (["no", "n", "false", "0", "off", "exclude"].includes(text)) {
      return false;
    }
    return null;
  }

  function normalizeEnumChoice(rawValue, options) {
    const allowed = Array.isArray(options) ? options : [];
    const text = normalizeText(rawValue);
    if (!text || allowed.length === 0) {
      return null;
    }
    const exact = allowed.find((option) => option === text);
    if (exact) {
      return exact;
    }
    const lowered = text.toLowerCase();
    return (
      allowed.find((option) => String(option).toLowerCase() === lowered) || null
    );
  }

  function mentionsOperation(lowerText, operationName) {
    if (!lowerText || !operationName) {
      return false;
    }

    const matcher = OPERATION_TEXT_MATCHERS[operationName];
    if (matcher && matcher.test(lowerText)) {
      return true;
    }
    if (lowerText.includes(String(operationName).toLowerCase())) {
      return true;
    }

    const phrase = String(operationName).replace(/_/g, " ");
    return lowerText.includes(phrase);
  }

  function detectOperationsFromText(lowerText, operationOrder) {
    const order = Array.isArray(operationOrder) ? operationOrder : [];
    const detected = order.filter((op) => mentionsOperation(lowerText, op));
    if (detected.length > 0) {
      return uniqueStrings(detected);
    }

    if (/\bdelete(?:s)?\b/.test(lowerText)) {
      if (order.includes("point_deletes") && order.includes("range_deletes")) {
        return ["point_deletes", "range_deletes"];
      }
      if (order.includes("point_deletes")) {
        return ["point_deletes"];
      }
      if (order.includes("range_deletes")) {
        return ["range_deletes"];
      }
    }
    return [];
  }

  function detectDistributionFromText(lowerText, distributionValues) {
    const values = Array.isArray(distributionValues) ? distributionValues : [];
    const normalizedValues = values.map((value) => String(value).toLowerCase());
    const aliases = {
      zipfian: "zipf",
      "log normal": "log_normal",
      lognormal: "log_normal",
    };

    for (const rawValue of normalizedValues) {
      const candidate = rawValue.replace(/_/g, " ");
      if (lowerText.includes(rawValue) || lowerText.includes(candidate)) {
        return rawValue;
      }
    }

    for (const [alias, value] of Object.entries(aliases)) {
      if (lowerText.includes(alias) && normalizedValues.includes(value)) {
        return value;
      }
    }

    return null;
  }

  function hasPatchValues(operationPatch) {
    if (!operationPatch || typeof operationPatch !== "object") {
      return false;
    }
    return Object.values(operationPatch).some(
      (value) => value !== null && value !== undefined,
    );
  }

  function getPatchPreferredOperations(contextPatch, operationOrder) {
    if (
      !contextPatch ||
      typeof contextPatch !== "object" ||
      !contextPatch.operations ||
      typeof contextPatch.operations !== "object"
    ) {
      return [];
    }
    const order = Array.isArray(operationOrder) ? operationOrder : [];
    return order.filter((op) => {
      const opPatch = contextPatch.operations[op];
      if (!opPatch || typeof opPatch !== "object") {
        return false;
      }
      if (opPatch.enabled === true) {
        return true;
      }
      return hasPatchValues(opPatch);
    });
  }

  function isDefaultToken(rawValue) {
    return /^(?:default|use default|use assumption|use assumptions)$/i.test(
      normalizeText(rawValue),
    );
  }

  function createAssistantQuestionController(api) {
    if (!api || !api.containerEl) {
      return {
        clear() {},
        render() {},
      };
    }

    const container = api.containerEl;

    function clear() {
      container.innerHTML = "";
    }

    function getCapabilityOperations(capabilityName) {
      const order = api.getOperationOrder();
      return order.filter((op) => {
        if (capabilityName === "selection") {
          return api.isSelectionOp(op);
        }
        if (capabilityName === "range") {
          return api.isRangeOp(op);
        }
        if (capabilityName === "key") {
          return api.isKeyOp(op);
        }
        if (capabilityName === "value") {
          return api.isValueOp(op);
        }
        return true;
      });
    }

    function chooseOperationsForBinding(
      candidates,
      mentionedOps,
      patchOps,
      selectedOps,
    ) {
      const mentioned = mentionedOps.filter((op) => candidates.includes(op));
      if (mentioned.length > 0) {
        return uniqueStrings(mentioned);
      }
      const selected = selectedOps.filter((op) => candidates.includes(op));
      if (selected.length > 0) {
        return uniqueStrings(selected);
      }
      const patchPreferred = patchOps.filter((op) => candidates.includes(op));
      if (patchPreferred.length > 0) {
        return uniqueStrings(patchPreferred);
      }
      if (candidates.length > 0) {
        return [candidates[0]];
      }
      return [];
    }

    function inferBinding(questionText, context) {
      const question = normalizeText(questionText);
      const lower = question.toLowerCase();
      const operationOrder = api.getOperationOrder();
      const contextPrompt = normalizeText(
        context && context.prompt ? context.prompt : "",
      ).toLowerCase();
      const questionOps = detectOperationsFromText(lower, operationOrder);
      const promptOps = contextPrompt
        ? detectOperationsFromText(contextPrompt, operationOrder)
        : [];
      const mentionedOps = uniqueStrings([...questionOps, ...promptOps]);
      const patchOps = getPatchPreferredOperations(
        context && context.patch ? context.patch : null,
        operationOrder,
      );
      const selectedOps = Array.isArray(api.getSelectedOperations())
        ? api.getSelectedOperations()
        : [];
      const distributionHint = detectDistributionFromText(
        lower,
        api.getSelectionDistributions(),
      );

      const operationsForDistributionPrompt =
        /\bwhich operations?\b[\s\S]{0,40}\bdistribution\b|\boperations?\b[\s\S]{0,40}\bshould use\b/.test(
          lower,
        );
      if (operationsForDistributionPrompt && distributionHint) {
        return {
          type: "selection_target_ops",
          distribution: distributionHint,
          inputType: "text",
        };
      }

      const containsOperationPrompt =
        /\b(which|what)\s+operations?\b|\boperations?\s+should\s+be\s+included\b|\boperation mix\b/.test(
          lower,
        );
      if (containsOperationPrompt) {
        return { type: "operations_set" };
      }

      if (/\bcharacter\s*set\b/.test(lower)) {
        return {
          type: "top",
          field: "character_set",
          inputType: "select",
          options: api.getCharacterSets(),
        };
      }

      if (/\bgroups?\s*(?:per|\/)\s*section\b/.test(lower)) {
        return { type: "top", field: "groups_per_section", inputType: "text" };
      }

      if (/\bsections?\b|\bphases?\b/.test(lower)) {
        return { type: "top", field: "sections_count", inputType: "text" };
      }

      const selectionCandidates = getCapabilityOperations("selection");
      const selectionOps = chooseOperationsForBinding(
        selectionCandidates,
        mentionedOps,
        patchOps,
        selectedOps,
      );
      const selectionOp = selectionOps.length > 0 ? selectionOps[0] : null;

      const selectionFieldMatchers = [
        {
          field: "selection_std_dev",
          matcher: /\bstandard deviation\b|\bstd\.?\s*dev\b/,
          fallbackDistribution: "normal",
        },
        {
          field: "selection_mean",
          matcher: /\bmean\b/,
          fallbackDistribution: "normal",
        },
        {
          field: "selection_alpha",
          matcher: /\balpha\b/,
          fallbackDistribution: "beta",
        },
        {
          field: "selection_beta",
          matcher: /\bbeta\b/,
          fallbackDistribution: "beta",
        },
        {
          field: "selection_lambda",
          matcher: /\blambda\b/,
          fallbackDistribution: "exponential",
        },
        {
          field: "selection_scale",
          matcher: /\bscale\b/,
          fallbackDistribution: "weibull",
        },
        {
          field: "selection_shape",
          matcher: /\bshape\b/,
          fallbackDistribution: "weibull",
        },
        {
          field: "selection_min",
          matcher: /\bmin(?:imum)?\b/,
          fallbackDistribution: "uniform",
        },
        {
          field: "selection_max",
          matcher: /\bmax(?:imum)?\b/,
          fallbackDistribution: "uniform",
        },
      ];

      for (const entry of selectionFieldMatchers) {
        if (entry.matcher.test(lower)) {
          if (selectionOp) {
            return {
              type: "op_field",
              op: selectionOp,
              field: entry.field,
              inputType: "text",
              preferredDistribution:
                distributionHint || entry.fallbackDistribution,
            };
          }
          return {
            type: "selection_param_unscoped",
            field: entry.field,
            inputType: "text",
            preferredDistribution:
              distributionHint || entry.fallbackDistribution,
          };
        }
      }

      if (
        (/\bzipf\b/.test(lower) && /\bn\b/.test(lower)) ||
        /\bparameter\s+n\b/.test(lower)
      ) {
        if (selectionOp) {
          return {
            type: "op_field",
            op: selectionOp,
            field: "selection_n",
            inputType: "text",
            preferredDistribution: distributionHint || "zipf",
          };
        }
        return {
          type: "selection_param_unscoped",
          field: "selection_n",
          inputType: "text",
          preferredDistribution: distributionHint || "zipf",
        };
      }

      if (
        (/\bzipf\b/.test(lower) && /\bs\b/.test(lower)) ||
        /\bparameter\s+s\b/.test(lower)
      ) {
        if (selectionOp) {
          return {
            type: "op_field",
            op: selectionOp,
            field: "selection_s",
            inputType: "text",
            preferredDistribution: distributionHint || "zipf",
          };
        }
        return {
          type: "selection_param_unscoped",
          field: "selection_s",
          inputType: "text",
          preferredDistribution: distributionHint || "zipf",
        };
      }

      if (
        (/\bselection\b/.test(lower) || /\bdistribution\b/.test(lower)) &&
        /\bdistribution\b/.test(lower)
      ) {
        if (selectionOp) {
          return {
            type: "op_field",
            op: selectionOp,
            field: "selection_distribution",
            inputType: "select",
            options: api.getSelectionDistributions(),
          };
        }
        return {
          type: "selection_distribution_unscoped",
          inputType: "select",
          options: api.getSelectionDistributions(),
        };
      }

      if (/\bselectivity\b/.test(lower)) {
        const rangeCandidates = getCapabilityOperations("range");
        const rangeOps = chooseOperationsForBinding(
          rangeCandidates,
          mentionedOps,
          patchOps,
          selectedOps,
        );
        if (rangeOps.length > 1) {
          return {
            type: "op_field_many",
            ops: rangeOps,
            field: "selectivity",
            inputType: "text",
          };
        }
        if (rangeOps.length === 1) {
          return {
            type: "op_field",
            op: rangeOps[0],
            field: "selectivity",
            inputType: "text",
          };
        }
      }

      if (/\brange[_\s-]?format\b|\brange format\b/.test(lower)) {
        const rangeCandidates = getCapabilityOperations("range");
        const rangeOps = chooseOperationsForBinding(
          rangeCandidates,
          mentionedOps,
          patchOps,
          selectedOps,
        );
        if (rangeOps.length > 1) {
          return {
            type: "op_field_many",
            ops: rangeOps,
            field: "range_format",
            inputType: "select",
            options: api.getRangeFormats(),
          };
        }
        if (rangeOps.length === 1) {
          return {
            type: "op_field",
            op: rangeOps[0],
            field: "range_format",
            inputType: "select",
            options: api.getRangeFormats(),
          };
        }
      }

      const countPrompt = /\bop[_\s-]?count\b|\bhow many\b|\bnumber of\b/.test(
        lower,
      );
      if (countPrompt) {
        const opCandidates = getCapabilityOperations("all");
        const ops = chooseOperationsForBinding(
          opCandidates,
          mentionedOps,
          patchOps,
          selectedOps,
        );
        if (ops.length > 1) {
          return {
            type: "op_field_many",
            ops,
            field: "op_count",
            inputType: "text",
          };
        }
        if (ops.length === 1) {
          return {
            type: "op_field",
            op: ops[0],
            field: "op_count",
            inputType: "text",
          };
        }
      }

      const keyPrompt =
        /\bkey(?:s)?\b.*\b(size|length|len|look like)\b|\bkey[-\s]*value size\b/.test(
          lower,
        );
      if (keyPrompt) {
        const keyCandidates = getCapabilityOperations("key");
        const keyOps = chooseOperationsForBinding(
          keyCandidates,
          mentionedOps,
          patchOps,
          selectedOps,
        );
        if (keyOps.length > 1) {
          return {
            type: "op_field_many",
            ops: keyOps,
            field: "key_len",
            inputType: "text",
          };
        }
        if (keyOps.length === 1) {
          return {
            type: "op_field",
            op: keyOps[0],
            field: "key_len",
            inputType: "text",
          };
        }
      }

      const valuePrompt =
        /\bvalue(?:s)?\b.*\b(size|length|len|look like)\b|\bkey[-\s]*value size\b/.test(
          lower,
        );
      if (valuePrompt) {
        const valueCandidates = getCapabilityOperations("value");
        const valueOps = chooseOperationsForBinding(
          valueCandidates,
          mentionedOps,
          patchOps,
          selectedOps,
        );
        if (valueOps.length > 1) {
          return {
            type: "op_field_many",
            ops: valueOps,
            field: "val_len",
            inputType: "text",
          };
        }
        if (valueOps.length === 1) {
          return {
            type: "op_field",
            op: valueOps[0],
            field: "val_len",
            inputType: "text",
          };
        }
      }

      if (
        /\binclude\b|\boptional\b/.test(lower) &&
        /\bselection\b/.test(lower)
      ) {
        if (selectionOp) {
          return {
            type: "op_field",
            op: selectionOp,
            field: "selection_distribution",
            inputType: "select",
            options: api.getSelectionDistributions(),
          };
        }
      }

      return { type: "free_text" };
    }

    function getOperationFieldDefault(op, field) {
      const opDefaults = api.getOperationDefaults(op);
      const selectionDefaults = api.getSelectionParamDefaults();
      if (Object.prototype.hasOwnProperty.call(selectionDefaults, field)) {
        return selectionDefaults[field];
      }
      if (Object.prototype.hasOwnProperty.call(opDefaults, field)) {
        return opDefaults[field];
      }
      return null;
    }

    function readBindingValue(binding) {
      if (!binding || typeof binding !== "object") {
        return "";
      }

      if (binding.type === "top") {
        const current = api.readTopField(binding.field);
        if (
          current !== null &&
          current !== undefined &&
          String(current).trim() !== ""
        ) {
          return String(current);
        }
        if (
          binding.field === "sections_count" ||
          binding.field === "groups_per_section"
        ) {
          return "1";
        }
        return "";
      }

      if (binding.type === "operations_set") {
        const selected = api.getSelectedOperations();
        return selected.join(", ");
      }

      if (binding.type === "selection_target_ops") {
        const selected = api
          .getSelectedOperations()
          .filter((op) => api.isSelectionOp(op));
        return selected.join(", ");
      }

      if (binding.type === "selection_param_unscoped") {
        const selected = api
          .getSelectedOperations()
          .filter((op) => api.isSelectionOp(op));
        if (selected.length === 0) {
          return "";
        }
        const firstSelected = selected[0];
        const current = api.readOperationField(firstSelected, binding.field);
        if (
          current !== null &&
          current !== undefined &&
          String(current).trim() !== ""
        ) {
          return String(current);
        }
        const fallback = getOperationFieldDefault(firstSelected, binding.field);
        return fallback !== null && fallback !== undefined
          ? String(fallback)
          : "";
      }

      if (binding.type === "selection_distribution_unscoped") {
        const selected = api
          .getSelectedOperations()
          .filter((op) => api.isSelectionOp(op));
        if (selected.length === 0) {
          return "";
        }
        const current = api.readOperationField(
          selected[0],
          "selection_distribution",
        );
        return current || "";
      }

      if (binding.type === "op_field") {
        const current = api.readOperationField(binding.op, binding.field);
        if (
          current !== null &&
          current !== undefined &&
          String(current).trim() !== ""
        ) {
          return String(current);
        }
        const fallback = getOperationFieldDefault(binding.op, binding.field);
        return fallback !== null && fallback !== undefined
          ? String(fallback)
          : "";
      }

      if (binding.type === "op_field_many") {
        const values = binding.ops
          .map((op) => api.readOperationField(op, binding.field))
          .filter(
            (value) =>
              value !== null &&
              value !== undefined &&
              String(value).trim() !== "",
          );
        if (values.length === 0) {
          if (binding.ops.length === 0) {
            return "";
          }
          const fallback = getOperationFieldDefault(
            binding.ops[0],
            binding.field,
          );
          return fallback !== null && fallback !== undefined
            ? String(fallback)
            : "";
        }
        const first = String(values[0]);
        const allSame = values.every((value) => String(value) === first);
        return allSame ? first : "";
      }

      return "";
    }

    function chooseDistributionForField(fieldName, preferredDistribution) {
      const distributions = api.getSelectionDistributions();
      const prefer = normalizeEnumChoice(preferredDistribution, distributions);
      if (prefer) {
        const params = api.getSelectionParamsForDistribution(prefer);
        if (params.includes(fieldName)) {
          return prefer;
        }
      }

      const hinted = normalizeEnumChoice(
        SELECTION_FIELD_DEFAULT_DISTRIBUTION[fieldName],
        distributions,
      );
      if (hinted) {
        const params = api.getSelectionParamsForDistribution(hinted);
        if (params.includes(fieldName)) {
          return hinted;
        }
      }

      for (const distributionName of distributions) {
        const params = api.getSelectionParamsForDistribution(distributionName);
        if (params.includes(fieldName)) {
          return distributionName;
        }
      }
      return distributions.length > 0 ? distributions[0] : "uniform";
    }

    function parseFieldValue(fieldName, rawValue) {
      if (isDefaultToken(rawValue)) {
        return { useDefault: true, value: null };
      }

      if (
        fieldName === "selection_distribution" ||
        fieldName === "range_format" ||
        fieldName === "character_set"
      ) {
        return { useDefault: false, value: normalizeText(rawValue) };
      }

      if (fieldName === "key_len" || fieldName === "val_len") {
        const parsedLength = parseHumanLength(rawValue);
        return { useDefault: false, value: parsedLength };
      }

      if (
        fieldName === "op_count" ||
        fieldName === "selection_n" ||
        fieldName === "sections_count" ||
        fieldName === "groups_per_section"
      ) {
        const parsedCount = parseHumanCount(rawValue);
        return { useDefault: false, value: parsedCount };
      }

      const numeric = Number(normalizeText(rawValue));
      return {
        useDefault: false,
        value: Number.isFinite(numeric) ? numeric : null,
      };
    }

    function ensureOperationReady(op) {
      api.setOperationChecked(op, true);
      api.ensureOperationDefaultsIfEmpty(op);
    }

    function applyOperationField(op, fieldName, rawValue, binding) {
      if (!op || !fieldName) {
        return false;
      }

      ensureOperationReady(op);
      const parsed = parseFieldValue(fieldName, rawValue);
      if (parsed.useDefault) {
        const defaultValue = getOperationFieldDefault(op, fieldName);
        if (defaultValue === null || defaultValue === undefined) {
          return false;
        }
        api.writeOperationField(op, fieldName, defaultValue);
        if (api.isSelectionOp(op)) {
          api.refreshSelectionParamVisibility(op);
        }
        return true;
      }

      if (fieldName === "selection_distribution") {
        const distribution = normalizeEnumChoice(
          parsed.value,
          api.getSelectionDistributions(),
        );
        if (!distribution) {
          return false;
        }
        api.writeOperationField(op, "selection_distribution", distribution);
        api.refreshSelectionParamVisibility(op);
        return true;
      }

      if (fieldName === "range_format") {
        const rangeFormat = normalizeEnumChoice(
          parsed.value,
          api.getRangeFormats(),
        );
        if (!rangeFormat) {
          return false;
        }
        api.writeOperationField(op, "range_format", rangeFormat);
        return true;
      }

      let numericValue = parsed.value;
      if (!Number.isFinite(numericValue)) {
        return false;
      }

      if (POSITIVE_INTEGER_FIELDS.has(fieldName)) {
        numericValue = Math.floor(numericValue);
        if (numericValue <= 0) {
          return false;
        }
      }
      if (NON_NEGATIVE_FIELDS.has(fieldName) && numericValue < 0) {
        return false;
      }

      if (
        fieldName.startsWith("selection_") &&
        fieldName !== "selection_distribution" &&
        api.isSelectionOp(op)
      ) {
        const currentDistribution = api.readOperationField(
          op,
          "selection_distribution",
        );
        const currentDistributionParams =
          api.getSelectionParamsForDistribution(currentDistribution);
        const requiresSwitch = !currentDistributionParams.includes(fieldName);
        if (requiresSwitch) {
          const desiredDistribution = chooseDistributionForField(
            fieldName,
            binding && binding.preferredDistribution,
          );
          api.writeOperationField(
            op,
            "selection_distribution",
            desiredDistribution,
          );
          api.refreshSelectionParamVisibility(op);
        }
      }

      api.writeOperationField(op, fieldName, numericValue);
      if (fieldName.startsWith("selection_") && api.isSelectionOp(op)) {
        api.refreshSelectionParamVisibility(op);
      }
      return true;
    }

    function applyTopField(fieldName, rawValue, binding) {
      if (!fieldName) {
        return false;
      }

      if (isDefaultToken(rawValue)) {
        if (fieldName === "character_set") {
          const values = api.getCharacterSets();
          if (values.length === 0) {
            return false;
          }
          const fallback = values.includes("alphanumeric")
            ? "alphanumeric"
            : values[0];
          api.writeTopField(fieldName, fallback);
          return true;
        }
        api.writeTopField(fieldName, 1);
        return true;
      }

      if (fieldName === "character_set") {
        const next = normalizeEnumChoice(rawValue, api.getCharacterSets());
        if (!next) {
          return false;
        }
        api.writeTopField(fieldName, next);
        return true;
      }

      const parsed = parseFieldValue(fieldName, rawValue);
      if (!Number.isFinite(parsed.value)) {
        return false;
      }
      let numericValue = Math.floor(parsed.value);
      if (numericValue <= 0) {
        return false;
      }
      api.writeTopField(fieldName, numericValue);
      return true;
    }

    function applyOperationsSet(rawValue) {
      const lower = normalizeText(rawValue).toLowerCase();
      const operationOrder = api.getOperationOrder();

      const clearIntent =
        parseBoolean(rawValue) === false || /\bnone\b/.test(lower);
      if (clearIntent) {
        operationOrder.forEach((op) => api.setOperationChecked(op, false));
        return true;
      }

      const selected = detectOperationsFromText(lower, operationOrder);
      if (selected.length === 0) {
        return false;
      }

      operationOrder.forEach((op) => api.setOperationChecked(op, false));
      selected.forEach((op) => {
        ensureOperationReady(op);
      });
      return true;
    }

    function applySelectionTargetOperations(rawValue, distributionName) {
      const lower = normalizeText(rawValue).toLowerCase();
      const operationOrder = api.getOperationOrder();
      const mentioned = detectOperationsFromText(lower, operationOrder);
      const selectionOps = mentioned.filter((op) => api.isSelectionOp(op));
      if (selectionOps.length === 0) {
        return false;
      }

      const candidate =
        normalizeEnumChoice(
          distributionName,
          api.getSelectionDistributions(),
        ) ||
        detectDistributionFromText(lower, api.getSelectionDistributions()) ||
        "uniform";

      let changed = false;
      selectionOps.forEach((op) => {
        ensureOperationReady(op);
        api.writeOperationField(op, "selection_distribution", candidate);
        api.refreshSelectionParamVisibility(op);
        changed = true;
      });
      return changed;
    }

    function applyUnscopedSelectionParam(fieldName, rawValue, binding) {
      const selected = api
        .getSelectedOperations()
        .filter((op) => api.isSelectionOp(op));
      if (selected.length === 0) {
        return false;
      }
      let changed = false;
      selected.forEach((op) => {
        const applied = applyOperationField(op, fieldName, rawValue, binding);
        changed = changed || applied;
      });
      return changed;
    }

    function applyUnscopedSelectionDistribution(rawValue) {
      const selected = api
        .getSelectedOperations()
        .filter((op) => api.isSelectionOp(op));
      if (selected.length === 0) {
        return false;
      }
      const distribution = normalizeEnumChoice(
        rawValue,
        api.getSelectionDistributions(),
      );
      if (!distribution) {
        return false;
      }
      selected.forEach((op) => {
        ensureOperationReady(op);
        api.writeOperationField(op, "selection_distribution", distribution);
        api.refreshSelectionParamVisibility(op);
      });
      return true;
    }

    function applyBinding(binding, rawValue) {
      if (!binding || binding.type === "free_text") {
        return false;
      }
      if (binding.type === "operations_set") {
        return applyOperationsSet(rawValue);
      }
      if (binding.type === "selection_target_ops") {
        return applySelectionTargetOperations(rawValue, binding.distribution);
      }
      if (binding.type === "top") {
        return applyTopField(binding.field, rawValue, binding);
      }
      if (binding.type === "op_field") {
        return applyOperationField(
          binding.op,
          binding.field,
          rawValue,
          binding,
        );
      }
      if (binding.type === "op_field_many") {
        let changedAny = false;
        binding.ops.forEach((op) => {
          const applied = applyOperationField(
            op,
            binding.field,
            rawValue,
            binding,
          );
          changedAny = changedAny || applied;
        });
        return changedAny;
      }
      if (binding.type === "selection_param_unscoped") {
        return applyUnscopedSelectionParam(binding.field, rawValue, binding);
      }
      if (binding.type === "selection_distribution_unscoped") {
        return applyUnscopedSelectionDistribution(rawValue);
      }
      return false;
    }

    function buildBindingHint(binding) {
      if (!binding || binding.type === "free_text") {
        return "This question is informational and does not map to a specific form field.";
      }
      if (binding.type === "operations_set") {
        return "Answer with one or more operation names.";
      }
      if (binding.type === "selection_target_ops") {
        return "Names here will be added and configured with the requested selection distribution.";
      }
      if (binding.type === "top") {
        return "";
      }
      if (binding.type === "op_field") {
        return "Applies to " + api.getOperationLabel(binding.op) + ".";
      }
      if (binding.type === "op_field_many") {
        const labels = binding.ops.map((op) => api.getOperationLabel(op));
        return labels.length > 0 ? "Applies to " + labels.join(", ") + "." : "";
      }
      if (
        binding.type === "selection_param_unscoped" ||
        binding.type === "selection_distribution_unscoped"
      ) {
        return "Applies to currently selected operations that support selection.";
      }
      return "";
    }

    function createInputElement(binding) {
      if (
        binding.inputType === "select" &&
        Array.isArray(binding.options) &&
        binding.options.length > 0
      ) {
        const select = document.createElement("select");
        select.className = "assistant-question-input";
        const emptyOption = document.createElement("option");
        emptyOption.value = "";
        emptyOption.textContent = "(choose)";
        select.appendChild(emptyOption);
        binding.options.forEach((optionValue) => {
          const option = document.createElement("option");
          option.value = optionValue;
          option.textContent = optionValue;
          select.appendChild(option);
        });
        return select;
      }

      const input = document.createElement("input");
      input.type = "text";
      input.className = "assistant-question-input";
      input.placeholder = "Type answer...";
      return input;
    }

    function renderQuestion(questionText, context) {
      const binding = inferBinding(questionText, context);
      const wrapper = document.createElement("label");
      wrapper.className = "assistant-question-field";

      const label = document.createElement("span");
      label.className = "assistant-question-label";
      const hint = buildBindingHint(binding);
      label.textContent = hint ? questionText + " " + hint : questionText;
      wrapper.appendChild(label);

      const input = createInputElement(binding);
      const initialValue = readBindingValue(binding);
      if (initialValue) {
        input.value = initialValue;
      }

      const applyFromInput = () => {
        const changed = applyBinding(binding, input.value);
        if (changed) {
          api.updateJson();
          input.dataset.applied = "true";
        } else {
          input.dataset.applied = "";
        }
      };

      if (input.tagName === "SELECT") {
        input.addEventListener("change", applyFromInput);
      } else {
        let timer = null;
        input.addEventListener("input", () => {
          if (timer) {
            clearTimeout(timer);
          }
          timer = setTimeout(applyFromInput, 150);
        });
        input.addEventListener("blur", applyFromInput);
      }

      wrapper.appendChild(input);
      container.appendChild(wrapper);
    }

    function render(questions, context) {
      clear();
      const list = Array.isArray(questions) ? questions : [];
      list.forEach((question) => {
        const cleaned = normalizeText(question);
        if (!cleaned) {
          return;
        }
        renderQuestion(cleaned, context || null);
      });
    }

    return {
      clear,
      render,
    };
  }

  globalScope.AssistantFollowups = {
    createController: createAssistantQuestionController,
  };
})(window);
