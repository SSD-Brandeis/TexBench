const SELECTION_DISTRIBUTION_ALIASES = {
  uniform: ["uniform"],
  normal: ["normal", "gaussian"],
  beta: ["beta"],
  zipf: ["zipf", "zipfian", "skewed", "skew"],
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
  point_queries: "point\\s+quer(?:y|ie|ies)|point\\s+read(?:s)?|get(?:s)?",
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

export function createPromptParser(deps = {}) {
  const {
    defaultSelectionDistributions = [],
    selectionDistributionParamKeys = {},
    selectionParamDefaults = {},
    rangeQuerySelectivityProfiles = {},
    writeHeavyDefaultSplit = {},
    structuredWorkloadPattern = null,
    distributionRequiredKeys = {},
    parseHumanCountToken,
    positiveIntegerOrNull,
    normalizedFinitePositiveNumber,
    numberOrNull,
    normalizeDistributionValue,
    distributionNameFromValue,
    uniqueStrings,
    operationPatchHasConfiguredValues,
    getOperationCapabilities,
    escapeRegExp,
    isPlainObject,
  } = deps;

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

  function promptLikelySetsOperationCount(lowerPrompt) {
    const text = String(lowerPrompt || "").toLowerCase();
    if (!text) {
      return false;
    }
    if (/\b(?:remove|disable|exclude|without|no)\b/.test(text)) {
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

  function promptRequestsAllOperationCountScaling(lowerPrompt) {
    const text = String(lowerPrompt || "");
    return (
      /\b(?:all|every|each)\b[\s\S]{0,32}\b(?:operation counts?|op counts?|counts?)\b/.test(
        text,
      ) ||
      /\b(?:operation counts?|op counts?|counts?)\b[\s\S]{0,32}\b(?:all|every|each)\b/.test(
        text,
      ) ||
      /\bfor all operations\b/.test(text)
    );
  }

  function extractPromptOperationCountScaleFactor(lowerPrompt) {
    const text = String(lowerPrompt || "");
    if (!text) {
      return null;
    }
    if (
      /\bone order of magnitude smaller\b/.test(text) ||
      /\ban order of magnitude smaller\b/.test(text)
    ) {
      return 0.1;
    }

    let match = text.match(
      /\bdivide(?:[\s\S]{0,24})\bby\s+([0-9][0-9,]*(?:\.\d+)?)\b/,
    );
    if (match) {
      const divisor = normalizedFinitePositiveNumber(
        parseHumanCountToken(match[1]),
      );
      return divisor ? 1 / divisor : null;
    }

    match = text.match(/\b([0-9][0-9,]*(?:\.\d+)?)x\s+(?:smaller|lower)\b/);
    if (match) {
      const divisor = normalizedFinitePositiveNumber(
        parseHumanCountToken(match[1]),
      );
      return divisor ? 1 / divisor : null;
    }

    match = text.match(
      /\b(?:decrease|decreased|reduce|reduced|lower|lowered|shrink|shrunken|cut|make)\b[\s\S]{0,48}\b(?:factor|magnitude)\s+of\s+([0-9][0-9,]*(?:\.\d+)?)\b/,
    );
    if (match) {
      const divisor = normalizedFinitePositiveNumber(
        parseHumanCountToken(match[1]),
      );
      return divisor ? 1 / divisor : null;
    }

    if (
      /\b(?:decrease|decreased|reduce|reduced|lower|lowered|shrink|shrunken|cut)\b[\s\S]{0,48}\border of magnitude\b/.test(
        text,
      )
    ) {
      return 0.1;
    }

    match = text.match(
      /\b(?:multiply|scale|increase|grow|raise)\b[\s\S]{0,24}\bby\s+([0-9][0-9,]*(?:\.\d+)?)\b/,
    );
    if (match) {
      return normalizedFinitePositiveNumber(parseHumanCountToken(match[1]));
    }

    match = text.match(/\b([0-9][0-9,]*(?:\.\d+)?)x\s+(?:larger|bigger)\b/);
    if (match) {
      return normalizedFinitePositiveNumber(parseHumanCountToken(match[1]));
    }

    return null;
  }

  function extractPromptRangeScanLengthHint(prompt) {
    const text = String(prompt || "");
    if (!text) {
      return null;
    }
    const patterns = [
      /\b(?:scan|range)\s+length\b[\s\S]{0,24}?\b(?:(?:to|of)\s+)?(?:exact(?:ly)?\s+)?([0-9][0-9,]*(?:\.\d+)?(?:\s*(?:k|m|b|thousand|million|billion))?)\b/i,
      /\b(?:exact(?:ly)?\s+)?([0-9][0-9,]*(?:\.\d+)?(?:\s*(?:k|m|b|thousand|million|billion))?)\b[\s\S]{0,12}\b(?:key|keys)\s+per\s+scan\b/i,
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (!match) {
        continue;
      }
      const parsed = parseHumanCountToken(match[1]);
      if (normalizedFinitePositiveNumber(parsed) !== null) {
        return parsed;
      }
    }
    return null;
  }

  function extractPromptRangeSelectivityHint(prompt) {
    const text = String(prompt || "");
    if (!text) {
      return null;
    }
    const leadingPercentMatch = text.match(
      /\b([0-9][0-9,]*(?:\.\d+)?)\s*%\s+selectivity\b/i,
    );
    if (leadingPercentMatch) {
      const parsed = numberOrNull(leadingPercentMatch[1].replace(/,/g, ""));
      if (parsed !== null) {
        const fraction = parsed / 100;
        return fraction >= 0 ? fraction : null;
      }
    }
    const percentMatch = text.match(
      /\bselectivity\b[\s\S]{0,16}?\b([0-9][0-9,]*(?:\.\d+)?)\s*%/i,
    );
    if (percentMatch) {
      const parsed = numberOrNull(percentMatch[1].replace(/,/g, ""));
      if (parsed !== null) {
        const fraction = parsed / 100;
        return fraction >= 0 ? fraction : null;
      }
    }

    const numericMatch = text.match(
      /\bselectivity\b[\s\S]{0,16}?\b([0-9](?:[0-9,]*)(?:\.\d+)?)\b/i,
    );
    if (numericMatch) {
      const parsed = numberOrNull(numericMatch[1].replace(/,/g, ""));
      if (parsed !== null && parsed >= 0 && parsed <= 1) {
        return parsed;
      }
    }
    return null;
  }

  function extractPromptSelectionParameterHints(prompt) {
    const text = String(prompt || "");
    if (!text) {
      return {};
    }

    const numericValuePattern =
      "([0-9][0-9,]*(?:\\.\\d+)?(?:\\s*(?:k|m|b|thousand|million|billion))?)";
    const separatorPattern = "(?:\\s+(?:as|is|of))?\\s*[:=]?\\s*";
    const fieldPatterns = {
      selection_min: [
        new RegExp(`\\bmin(?:imum)?\\b${separatorPattern}${numericValuePattern}`, "i"),
      ],
      selection_max: [
        new RegExp(`\\bmax(?:imum)?\\b${separatorPattern}${numericValuePattern}`, "i"),
      ],
      selection_mean: [
        new RegExp(`\\bmean\\b${separatorPattern}${numericValuePattern}`, "i"),
      ],
      selection_std_dev: [
        new RegExp(
          `\\bstandard\\s+deviation\\b${separatorPattern}${numericValuePattern}`,
          "i",
        ),
        new RegExp(
          `\\bstd(?:\\.?\\s*dev|_?dev|_?deviation)?\\b${separatorPattern}${numericValuePattern}`,
          "i",
        ),
      ],
      selection_alpha: [
        new RegExp(`\\balpha\\b${separatorPattern}${numericValuePattern}`, "i"),
      ],
      selection_beta: [
        new RegExp(`\\bbeta\\b${separatorPattern}${numericValuePattern}`, "i"),
      ],
      selection_lambda: [
        new RegExp(`\\blambda\\b${separatorPattern}${numericValuePattern}`, "i"),
      ],
      selection_scale: [
        new RegExp(`\\bscale\\b${separatorPattern}${numericValuePattern}`, "i"),
      ],
      selection_shape: [
        new RegExp(`\\bshape\\b${separatorPattern}${numericValuePattern}`, "i"),
      ],
      selection_n: [
        new RegExp(
          `\\b(?:parameter\\s+n|zipf\\s+n)\\b${separatorPattern}${numericValuePattern}`,
          "i",
        ),
      ],
      selection_s: [
        new RegExp(
          `\\b(?:parameter\\s+s|zipf\\s+s)\\b${separatorPattern}${numericValuePattern}`,
          "i",
        ),
      ],
    };

    const hints = {};
    Object.entries(fieldPatterns).forEach(([fieldName, patterns]) => {
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (!match || !match[1]) {
          continue;
        }
        const rawValue = match[1].replace(/,/g, "");
        const parsed =
          fieldName === "selection_n"
            ? positiveIntegerOrNull(parseHumanCountToken(rawValue))
            : numberOrNull(rawValue);
        if (parsed !== null && parsed !== undefined) {
          hints[fieldName] = parsed;
          break;
        }
      }
    });
    return hints;
  }

  function buildSelectionDistributionValue(distributionName, source) {
    const distribution =
      typeof distributionName === "string" ? distributionName.trim() : "";
    if (!distribution) {
      return null;
    }
    const requiredKeys = distributionRequiredKeys[distribution] || [];
    if (requiredKeys.length === 0) {
      return null;
    }
    const payload = {};
    for (const key of requiredKeys) {
      const fieldName = `selection_${key}`;
      const value = source ? source[fieldName] : null;
      if (value === null || value === undefined) {
        return null;
      }
      payload[key] = value;
    }
    return { [distribution]: payload };
  }

  function applyDetectedSelectionDistributionToOperationPatch(
    operationPatch,
    currentState,
    prompt,
    distributionName,
  ) {
    if (!operationPatch || typeof operationPatch !== "object" || !distributionName) {
      return false;
    }
    const current =
      currentState && typeof currentState === "object" ? currentState : {};
    const paramHints = extractPromptSelectionParameterHints(prompt);
    operationPatch.selection = null;
    operationPatch.selection_distribution = distributionName;
    const requiredParams =
      selectionDistributionParamKeys[distributionName] || [];
    requiredParams.forEach((fieldName) => {
      if (paramHints[fieldName] !== null && paramHints[fieldName] !== undefined) {
        operationPatch[fieldName] = paramHints[fieldName];
        return;
      }
      const currentValue = current[fieldName];
      if (currentValue !== null && currentValue !== undefined) {
        operationPatch[fieldName] = currentValue;
        return;
      }
      if (Object.prototype.hasOwnProperty.call(selectionParamDefaults, fieldName)) {
        operationPatch[fieldName] = selectionParamDefaults[fieldName];
      }
    });
    const selectionValue = buildSelectionDistributionValue(
      distributionName,
      operationPatch,
    );
    if (selectionValue) {
      operationPatch.selection = selectionValue;
    }
    return true;
  }

  function buildStructuredGroupsFromPromptText(text, schemaHints) {
    const rawClauses = splitPromptIntoPhaseClauses(text);
    const clauses = [];
    rawClauses.forEach((clause) => {
      const lowerClause = String(clause || "").toLowerCase();
      const previousClause =
        clauses.length > 0 ? String(clauses[clauses.length - 1] || "") : "";
      const lowerPrevious = previousClause.toLowerCase();
      const startsInterleave = /^\s*interleave(?:d)?\b/.test(lowerClause);
      const previousIsStandaloneWriteStep =
        /\binsert(?:s|ion)?\b|\bupdate(?:s)?\b|\bmerge(?:s)?\b/.test(
          lowerPrevious,
        ) &&
        !/\bpreload\b|\bseed\b|\bprime\b|\bload\s+the\s+(?:db|database)\b|\bphase\b/.test(
          lowerPrevious,
        ) &&
        !/\binterleave(?:d)?\b/.test(lowerPrevious);
      if (startsInterleave && previousIsStandaloneWriteStep) {
        clauses[clauses.length - 1] = `${previousClause}, ${clause}`;
        return;
      }
      clauses.push(clause);
    });
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
    applyStructuredPromptSelectionHints(groups, text, schemaHints);
    applyStructuredPromptScanLengthHints(groups, text);
    return groups;
  }

  function splitPromptIntoSectionClauses(prompt) {
    const text = String(prompt || "");
    if (!text) {
      return null;
    }
    const matches = Array.from(
      text.matchAll(
        /\b(?:in\s+)?(?:the\s+)?(\d+|1st|first|2nd|second|3rd|third|4th|fourth)\s+section\b\s*[:,-]?\s*/gi,
      ),
    );
    if (matches.length === 0) {
      return null;
    }
    const sections = [];
    matches.forEach((match, index) => {
      const sectionIndex = parsePromptOrdinalIndex(match[1]);
      if (!Number.isInteger(sectionIndex) || sectionIndex < 0) {
        return;
      }
      const start = (match.index ?? 0) + match[0].length;
      const end =
        index + 1 < matches.length && Number.isInteger(matches[index + 1].index)
          ? matches[index + 1].index
          : text.length;
      const clause = text.slice(start, end).trim().replace(/^[,.\s]+|[,.\s]+$/g, "");
      sections[sectionIndex] = clause;
    });
    return sections.every((sectionText) => typeof sectionText === "string" && sectionText)
      ? sections
      : null;
  }

  function deriveStructuredSectionsFromPrompt(prompt, schemaHints) {
    const text = typeof prompt === "string" ? prompt.trim() : "";
    if (!text || !structuredWorkloadPattern || !structuredWorkloadPattern.test(text)) {
      return null;
    }

    const lowerPrompt = text.toLowerCase();
    const sectionClauses = splitPromptIntoSectionClauses(text);
    if (Array.isArray(sectionClauses) && sectionClauses.length > 0) {
      const sections = sectionClauses
        .map((sectionText) => {
          const groups = buildStructuredGroupsFromPromptText(
            sectionText,
            schemaHints,
          );
          return groups ? { groups } : null;
        })
        .filter(Boolean);
      if (sections.length === sectionClauses.length && sections.length > 0) {
        return sections;
      }
    }

    const groups = buildStructuredGroupsFromPromptText(text, schemaHints);
    if (!Array.isArray(groups) || groups.length === 0) {
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

  function applyStructuredPromptSelectionHints(groups, prompt, schemaHints) {
    const lowerPrompt = String(prompt || "").toLowerCase();
    if (!/\bskew(?:ed)?\s+distribution\b|\bskewed\b/.test(lowerPrompt)) {
      return;
    }
    if (!Array.isArray(groups) || groups.length === 0) {
      return;
    }

    let priorInsertedKeys = 0;
    groups.forEach((group) => {
      if (!group || typeof group !== "object") {
        return;
      }

      const inserts =
        group.inserts && typeof group.inserts === "object" ? group.inserts : null;
      const insertedThisGroup =
        inserts && Number.isFinite(inserts.op_count) && inserts.op_count > 0
          ? inserts.op_count
          : 0;

      Object.entries(group).forEach(([operationName, operationPatch]) => {
        const capabilities =
          schemaHints.capabilities && schemaHints.capabilities[operationName]
            ? schemaHints.capabilities[operationName]
            : {};
        if (!capabilities.has_selection || !isPlainObject(operationPatch)) {
          return;
        }

        const explicitSelection = normalizeDistributionValue(
          operationPatch.selection,
          schemaHints.selection_distributions || [],
        );
        const currentDistribution =
          (typeof operationPatch.selection_distribution === "string" &&
            operationPatch.selection_distribution.trim()) ||
          distributionNameFromValue(explicitSelection) ||
          null;
        if (explicitSelection && currentDistribution !== "zipf") {
          return;
        }

        const validKeyCount = Math.max(
          1,
          priorInsertedKeys > 0
            ? priorInsertedKeys
            : insertedThisGroup > 0
              ? insertedThisGroup
              : selectionParamDefaults.selection_n,
        );
        const zipfS =
          Number.isFinite(operationPatch.selection_s) &&
          operationPatch.selection_s >= 0
            ? Number(operationPatch.selection_s)
            : selectionParamDefaults.selection_s;

        operationPatch.selection_distribution = "zipf";
        operationPatch.selection_n = validKeyCount;
        operationPatch.selection_s = zipfS;
        operationPatch.selection = {
          zipf: {
            n: validKeyCount,
            s: zipfS,
          },
        };
      });

      priorInsertedKeys += insertedThisGroup;
    });
  }

  function applyStructuredPromptScanLengthHints(groups, prompt) {
    if (!Array.isArray(groups) || groups.length === 0) {
      return;
    }
    const scanLength = extractPromptRangeScanLengthHint(prompt);
    if (scanLength === null) {
      return;
    }

    let priorInsertedKeys = 0;
    groups.forEach((group) => {
      if (!group || typeof group !== "object") {
        return;
      }

      const inserts =
        group.inserts && typeof group.inserts === "object" ? group.inserts : null;
      const insertedThisGroup =
        inserts && Number.isFinite(inserts.op_count) && inserts.op_count > 0
          ? inserts.op_count
          : 0;

      const targetOperation = group.range_queries
        ? "range_queries"
        : group.range_deletes
          ? "range_deletes"
          : null;
      if (targetOperation) {
        const validKeyCount = Math.max(
          1,
          priorInsertedKeys > 0 ? priorInsertedKeys : insertedThisGroup,
        );
        const targetSpec =
          group[targetOperation] && typeof group[targetOperation] === "object"
            ? group[targetOperation]
            : {};
        targetSpec.range_format = "StartCount";
        targetSpec.selectivity = Math.min(1, scanLength / validKeyCount);
        group[targetOperation] = targetSpec;
      }

      priorInsertedKeys += insertedThisGroup;
    });
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
          ? `(?:short\\s+|long\\s+)?(?:${patternSource}|scan(?:s)?)`
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
        new RegExp(
          `\\b${amountPatternSource}\\b\\s+(?:of\\s+)?(\\d[\\d,]*(?:\\.\\d+)?\\s*[kmb]?|\\d+(?:\\.\\d+)?)\\s*(%)?\\s+(?:new\\s+)?(?:keys?|records?|entries?|operations?|ops?)\\b`,
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

  function deriveStructuredGroupFromClause(clause, schemaHints, options = {}) {
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
        updates: writeHeavyDefaultSplit.write,
        [readOperation]: writeHeavyDefaultSplit.read,
      };
    }

    if (operations.length === 0) {
      return null;
    }

    const totalCount = extractPromptCountHint(text);
    const amountHints = extractOperationAmountHints(text, operations);
    const defaultPercentTotalCount = positiveIntegerOrNull(
      options.defaultPercentTotalCount,
    );
    const effectiveTotalCount =
      totalCount !== null
        ? totalCount
        : Object.values(amountHints).some((entry) => entry && entry.type === "percent")
          ? defaultPercentTotalCount
          : defaultPercents && operations.length > 0
            ? defaultPercentTotalCount
            : null;
    const group = {};

    operations.forEach((operationName) => {
      const amountHint = amountHints[operationName] || null;
      const capabilities = getOperationCapabilities(schemaHints, operationName);
      let opCount = null;
      if (amountHint && amountHint.type === "count") {
        opCount = amountHint.value;
      } else if (
        amountHint &&
        amountHint.type === "percent" &&
        effectiveTotalCount !== null
      ) {
        opCount = Math.round((effectiveTotalCount * amountHint.value) / 100);
      } else if (
        defaultPercents &&
        Object.prototype.hasOwnProperty.call(defaultPercents, operationName) &&
        effectiveTotalCount !== null
      ) {
        opCount = Math.round(
          (effectiveTotalCount * defaultPercents[operationName]) / 100,
        );
      } else if (operations.length === 1 && effectiveTotalCount !== null) {
        opCount = effectiveTotalCount;
      }

      const spec = {};
      if (opCount !== null) {
        spec.op_count = opCount;
      }
      const detectedDistribution =
        capabilities.has_selection &&
        !shouldTreatPromptAsStringDistribution(lowerClause, schemaHints)
          ? detectSelectionDistribution(
              lowerClause,
              schemaHints.selection_distributions,
            )
          : null;
      if (detectedDistribution) {
        applyDetectedSelectionDistributionToOperationPatch(
          spec,
          {},
          text,
          detectedDistribution,
        );
      }
      if (
        operationName === "range_queries" ||
        operationName === "range_deletes"
      ) {
        const explicitSelectivity = extractPromptRangeSelectivityHint(text);
        const rangeProfile = detectRangeQueryProfile(lowerClause);
        if (explicitSelectivity !== null) {
          spec.selectivity = explicitSelectivity;
          spec.range_format = "StartCount";
        } else if (rangeProfile) {
          spec.selectivity = rangeQuerySelectivityProfiles[rangeProfile];
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
        /(\d[\d,]*(?:\.\d+)?(?:\s*(?:k|m|b|thousand|million|billion))?)(?!\s*%)(?=\s+(?:operations?|ops?|entries?|inserts?|updates?|merges?|deletes?|queries?|reads?|scans?))/gi,
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
    for (let index = genericMatches.length - 1; index >= 0; index -= 1) {
      const match = genericMatches[index];
      const token = match && match[1] ? match[1] : null;
      const matchIndex = Number.isInteger(match && match.index) ? match.index : -1;
      if (!token || matchIndex < 0) {
        continue;
      }
      const prefix = text
        .slice(Math.max(0, matchIndex - 24), matchIndex)
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trimEnd();
      if (
        /\b(?:group|section|phase)\s*$/.test(prefix) ||
        /\b(?:group|section|phase)\s+(?:the\s+)?$/.test(prefix)
      ) {
        continue;
      }
      return parseHumanCountToken(token);
    }
    return null;
  }

  function detectSelectionDistribution(lowerPrompt, allowedDistributions) {
    const candidates =
      Array.isArray(allowedDistributions) && allowedDistributions.length > 0
        ? allowedDistributions
        : defaultSelectionDistributions;

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
    const text = String(lowerPrompt || "").toLowerCase();
    const escapedOperationName = escapeRegExp(operationName.toLowerCase());
    if (new RegExp(`\\b${escapedOperationName}\\b`).test(text)) {
      return true;
    }
    const patternSource = getOperationPromptPatternSource(operationName);
    if (
      patternSource &&
      operationPatternMatchesWithPrefixGuards(
        text,
        new RegExp(`\\b(?:${patternSource})\\b`, "g"),
        getOperationPromptBlockedPrefixes(operationName),
      )
    ) {
      return true;
    }
    if (operationName === "range_queries" && promptMentionsScanIntent(text)) {
      return true;
    }
    return false;
  }

  function promptMentionsScanIntent(lowerPrompt) {
    const text = String(lowerPrompt || "").toLowerCase();
    if (!text) {
      return false;
    }
    const patterns = [
      /\b\d[\d,]*(?:\.\d+)?(?:\s*(?:k|m|b|thousand|million|billion))?\s+scan(?:s)?\b/,
      /\b(?:perform|run|issue|do|interleave|execut(?:e|ing))\b[\s\S]{0,24}\bscan(?:s)?\b/,
      /\bscan(?:s)?\b[\s\S]{0,24}\b(?:scan|range)\s+length\b/,
      /\bscan(?:s)?\b[\s\S]{0,16}\bkeys?\s+per\s+scan\b/,
    ];
    return patterns.some((pattern) => pattern.test(text));
  }

  function getMentionedOperationsFromPrompt(lowerPrompt, schemaHints) {
    const text = String(lowerPrompt || "").toLowerCase();
    if (!text) {
      return [];
    }
    return schemaHints.operation_order.filter((op) =>
      promptMentionsOperation(text, op),
    );
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

  return {
    parsePromptOrdinalIndex,
    promptLikelySetsOperationCount,
    promptMentionsDistributionChange,
    promptRequestsAllOperationCountScaling,
    extractPromptOperationCountScaleFactor,
    extractPromptRangeScanLengthHint,
    extractPromptRangeSelectivityHint,
    extractPromptSelectionParameterHints,
    buildSelectionDistributionValue,
    applyDetectedSelectionDistributionToOperationPatch,
    buildStructuredGroupsFromPromptText,
    splitPromptIntoSectionClauses,
    deriveStructuredSectionsFromPrompt,
    applyStructuredPromptSelectionHints,
    applyStructuredPromptScanLengthHints,
    splitPromptIntoPhaseClauses,
    extractOperationAmountHints,
    detectRangeQueryProfile,
    deriveStructuredGroupFromClause,
    extractPromptCountHint,
    detectSelectionDistribution,
    getOperationPromptPatternSource,
    getOperationPromptBlockedPrefixes,
    operationPatternMatchesWithPrefixGuards,
    promptExplicitlyRestrictsToOperation,
    promptMentionsOperation,
    promptMentionsScanIntent,
    getMentionedOperationsFromPrompt,
    shouldTreatPromptAsStringDistribution,
  };
}
