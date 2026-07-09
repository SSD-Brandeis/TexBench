(function attachStructuredUiNormalization(global) {
  function cloneJsonValue(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function buildUniformStringExpr(len, characterSet) {
    const uniform = { len };
    if (characterSet) {
      uniform.character_set = characterSet;
    }
    return { uniform };
  }

  function createEmptyGroupSpec() {
    return {
      name: "Group 1",
      enable_granular_stats: true,
    };
  }

  function createEmptySectionState() {
    return {
      name: "Section 1",
      enable_granular_stats: true,
      skip_key_contains_check: false,
      groups: [createEmptyGroupSpec()],
    };
  }

  function buildDefaultSectionName(sectionIndex) {
    return "Section " + String(sectionIndex + 1);
  }

  function buildDefaultGroupName(groupIndex) {
    return "Group " + String(groupIndex + 1);
  }

  function buildDefaultStringExprFromDefaults(
    target,
    characterSet,
    defaults,
    stringPatternDefaults,
  ) {
    const isKey = target === "key";
    const patternField = isKey ? "key_pattern" : "val_pattern";
    const lenField = isKey ? "key_len" : "val_len";
    const hotLenField = isKey ? "key_hot_len" : "val_hot_len";
    const hotAmountField = isKey ? "key_hot_amount" : "val_hot_amount";
    const hotProbabilityField = isKey
      ? "key_hot_probability"
      : "val_hot_probability";
    const defaultLen = isKey ? defaults.key_len || 20 : defaults.val_len || 256;
    const patternName = defaults[patternField] || "uniform";

    if (patternName === "hot_range") {
      return {
        hot_range: {
          len: defaults[hotLenField] ?? stringPatternDefaults[hotLenField],
          amount:
            defaults[hotAmountField] ?? stringPatternDefaults[hotAmountField],
          probability:
            defaults[hotProbabilityField] ??
            stringPatternDefaults[hotProbabilityField],
        },
      };
    }

    if (patternName === "weighted") {
      return {
        weighted: [
          {
            weight: 1,
            value: buildUniformStringExpr(defaultLen, characterSet),
          },
        ],
      };
    }

    if (patternName === "segmented") {
      return {
        segmented: {
          separator: "-",
          segments: [buildUniformStringExpr(defaultLen, characterSet)],
        },
      };
    }

    return buildUniformStringExpr(defaultLen, characterSet);
  }

  function buildDefaultSelectionSpecFromDefaults(
    defaults,
    selectionParamDefaults,
    selectionDistributionParams,
  ) {
    const distributionName = defaults.selection_distribution || "uniform";
    const paramFields = selectionDistributionParams[distributionName] || [];
    const params = {};
    paramFields.forEach((fieldName) => {
      const defaultValue =
        defaults[fieldName] === undefined || defaults[fieldName] === null
          ? selectionParamDefaults[fieldName]
          : defaults[fieldName];
      const paramKey =
        fieldName === "selection_n"
          ? "n"
          : fieldName.replace(/^selection_/, "");
      params[paramKey] = defaultValue;
    });
    return { [distributionName]: params };
  }

  function distributionNameFromExpression(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    const keys = Object.keys(value);
    return keys.length === 1 ? keys[0] : null;
  }

  function selectionParamKeyForField(fieldName) {
    return fieldName === "selection_n"
      ? "n"
      : fieldName.replace(/^selection_/, "");
  }

  function applySelectionUiMetadata(operationSpec, config) {
    if (
      !operationSpec ||
      typeof operationSpec !== "object" ||
      Array.isArray(operationSpec)
    ) {
      return operationSpec;
    }
    const selectionDistributionParams =
      config && config.selectionDistributionParams
        ? config.selectionDistributionParams
        : {};
    const validDistributions = Object.keys(selectionDistributionParams);
    const explicitDistribution =
      typeof operationSpec.selection_distribution === "string"
        ? operationSpec.selection_distribution
        : "";
    const inferredDistribution = distributionNameFromExpression(
      operationSpec.selection,
    );
    const distributionName = validDistributions.includes(explicitDistribution)
      ? explicitDistribution
      : validDistributions.includes(inferredDistribution)
        ? inferredDistribution
        : null;
    if (!distributionName) {
      return operationSpec;
    }

    operationSpec.selection_distribution = distributionName;
    const rawParams =
      operationSpec.selection &&
      operationSpec.selection[distributionName] &&
      typeof operationSpec.selection[distributionName] === "object" &&
      !Array.isArray(operationSpec.selection[distributionName])
        ? operationSpec.selection[distributionName]
        : {};
    (selectionDistributionParams[distributionName] || []).forEach(
      (fieldName) => {
        if (Object.prototype.hasOwnProperty.call(operationSpec, fieldName)) {
          return;
        }
        const rawValue = rawParams[selectionParamKeyForField(fieldName)];
        if (Number.isFinite(rawValue)) {
          operationSpec[fieldName] = rawValue;
        }
      },
    );
    return operationSpec;
  }

  function buildStructuredDefaultOperationSpec(op, characterSet, config) {
    const defaults = config.operationDefaults[op] || {};
    const rangeFormats = Array.isArray(config.rangeFormats)
      ? config.rangeFormats
      : [];
    const withOpCount = new Set(config.opsWithOpCount || []);
    const withSorted = new Set(config.opsWithSorted || []);
    const withKey = new Set(config.opsWithKey || []);
    const withValue = new Set(config.opsWithValue || []);
    const withSelection = new Set((config && config.opsWithSelection) || []);
    const withRange = new Set(config.opsWithRange || []);
    const built = {};

    if (withOpCount.has(op)) {
      built.op_count = defaults.op_count || 500000;
    }
    if (withSorted.has(op)) {
      built.k = defaults.k === undefined ? 100 : defaults.k;
      built.l = defaults.l === undefined ? 1 : defaults.l;
    }
    if (withKey.has(op)) {
      built.key = buildDefaultStringExprFromDefaults(
        "key",
        characterSet,
        defaults,
        config.stringPatternDefaults,
      );
    }
    if (withValue.has(op)) {
      built.val = buildDefaultStringExprFromDefaults(
        "val",
        characterSet,
        defaults,
        config.stringPatternDefaults,
      );
    }
    if (withSelection.has(op)) {
      built.selection = buildDefaultSelectionSpecFromDefaults(
        defaults,
        config.selectionParamDefaults,
        config.selectionDistributionParams,
      );
    }
    if (withRange.has(op)) {
      built.selectivity =
        defaults.selectivity === undefined || defaults.selectivity === null
          ? 0.01
          : defaults.selectivity;
      built.range_format =
        defaults.range_format || rangeFormats[0] || "StartCount";
    }

    return built;
  }

  function normalizePatchedOperationSpec(op, spec, characterSet, config) {
    const normalized = buildStructuredDefaultOperationSpec(
      op,
      characterSet,
      config,
    );
    if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
      return normalized;
    }
    Object.entries(spec).forEach(function applyField(entry) {
      normalized[entry[0]] = cloneJsonValue(entry[1]);
    });
    const withSelection = new Set((config && config.opsWithSelection) || []);
    if (withSelection.has(op)) {
      applySelectionUiMetadata(normalized, config);
    }
    return normalized;
  }

  const fallbackOperationNames = new Set([
    "empty_point_deletes",
    "empty_point_queries",
    "inserts",
    "merges",
    "point_deletes",
    "point_queries",
    "range_deletes",
    "range_queries",
    "sorted",
    "updates",
  ]);

  function getKnownOperationNames(config) {
    const configuredOperationNames =
      config && Array.isArray(config.operationOrder)
        ? config.operationOrder.filter(
            (name) => typeof name === "string" && name.trim(),
          )
        : [];
    return configuredOperationNames.length > 0
      ? new Set(configuredOperationNames)
      : fallbackOperationNames;
  }

  function readPatchedFieldValue(fieldSpec) {
    if (!fieldSpec || typeof fieldSpec !== "object") {
      return null;
    }
    if (
      fieldSpec.boolean_value !== null &&
      fieldSpec.boolean_value !== undefined
    ) {
      return fieldSpec.boolean_value;
    }
    if (
      fieldSpec.number_value !== null &&
      fieldSpec.number_value !== undefined
    ) {
      return fieldSpec.number_value;
    }
    if (
      fieldSpec.string_value !== null &&
      fieldSpec.string_value !== undefined
    ) {
      return fieldSpec.string_value;
    }
    if (fieldSpec.json_value !== null && fieldSpec.json_value !== undefined) {
      if (typeof fieldSpec.json_value === "string") {
        try {
          return JSON.parse(fieldSpec.json_value);
        } catch (_error) {
          return fieldSpec.json_value;
        }
      }
      return fieldSpec.json_value;
    }
    return null;
  }

  function flattenPatchedGroup(group, knownOperationNames) {
    const flattenedGroup = {};
    if (!group || typeof group !== "object" || Array.isArray(group)) {
      return flattenedGroup;
    }
    Object.entries(group).forEach(([name, spec]) => {
      if (knownOperationNames.has(name)) {
        flattenedGroup[name] = spec;
      }
    });
    if (Array.isArray(group.operations)) {
      group.operations.forEach((operation) => {
        const opName =
          operation && typeof operation.name === "string"
            ? operation.name
            : null;
        if (!opName || !knownOperationNames.has(opName)) {
          return;
        }
        const flattenedSpec = {};
        if (Array.isArray(operation.fields)) {
          operation.fields.forEach((fieldSpec) => {
            const fieldName =
              fieldSpec && typeof fieldSpec.field === "string"
                ? fieldSpec.field
                : null;
            if (!fieldName) {
              return;
            }
            flattenedSpec[fieldName] = readPatchedFieldValue(fieldSpec);
          });
        }
        if (
          flattenedSpec.enabled === null ||
          flattenedSpec.enabled === undefined
        ) {
          flattenedSpec.enabled = true;
        }
        flattenedGroup[opName] = flattenedSpec;
      });
    }
    return flattenedGroup;
  }

  function normalizePatchedStructureSections(rawSections, config) {
    if (!Array.isArray(rawSections) || rawSections.length === 0) {
      return [createEmptySectionState()];
    }
    const knownOperationNames = getKnownOperationNames(config);
    const defaultCharacterSet =
      config && typeof config.defaultCharacterSet === "string"
        ? config.defaultCharacterSet
        : "";
    return rawSections.map((section, sectionIndex) => {
      const explicitSectionCharacterSet =
        section &&
        typeof section === "object" &&
        typeof section.character_set === "string" &&
        section.character_set.trim()
          ? section.character_set.trim()
          : "";
      const sectionName =
        section &&
        typeof section === "object" &&
        typeof section.name === "string" &&
        section.name.trim()
          ? section.name.trim()
          : buildDefaultSectionName(sectionIndex);
      const sectionCharacterSet =
        explicitSectionCharacterSet || defaultCharacterSet;
      const groups =
        section &&
        typeof section === "object" &&
        Array.isArray(section.groups) &&
        section.groups.length > 0
          ? section.groups.map((group, groupIndex) => {
              const normalizedGroup = {};
              if (group && typeof group === "object" && !Array.isArray(group)) {
                normalizedGroup.name =
                  typeof group.name === "string" && group.name.trim()
                    ? group.name.trim()
                    : buildDefaultGroupName(groupIndex);
                normalizedGroup.enable_granular_stats = true;
                const explicitGroupCharacterSet =
                  typeof group.character_set === "string" &&
                  group.character_set.trim()
                    ? group.character_set.trim()
                    : "";
                const groupCharacterSet =
                  explicitGroupCharacterSet || sectionCharacterSet;
                Object.entries(
                  flattenPatchedGroup(group, knownOperationNames),
                ).forEach(([op, spec]) => {
                  normalizedGroup[op] = normalizePatchedOperationSpec(
                    op,
                    spec,
                    groupCharacterSet,
                    config,
                  );
                });
                if (explicitGroupCharacterSet) {
                  normalizedGroup.character_set = explicitGroupCharacterSet;
                }
                return normalizedGroup;
              }
              return {
                name: buildDefaultGroupName(groupIndex),
                enable_granular_stats: true,
              };
            })
          : [createEmptyGroupSpec()];
      const normalizedSection = {
        name: sectionName,
        enable_granular_stats: true,
        skip_key_contains_check: !!(
          section &&
          typeof section === "object" &&
          section.skip_key_contains_check === true
        ),
        groups,
      };
      if (explicitSectionCharacterSet) {
        normalizedSection.character_set = explicitSectionCharacterSet;
      }
      return normalizedSection;
    });
  }

  global.TectonicUiStructuredNormalization = {
    normalizePatchedStructureSections,
  };
})(globalThis);
