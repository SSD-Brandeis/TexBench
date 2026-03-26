(function initAssistantPanelModule(global) {
  "use strict";

  function createController(config) {
    const refs = (config && config.refs) || {};
    const FIRST_PROMPT_PLACEHOLDER =
      "Example: Generate an insert-only workload with 1 KB key value size. The number of inserts is 100K.";
    const ASSISTANT_USED_STORAGE_KEY = "tectonic.assistantUsed.v1";
    const operationOrder = Array.isArray(config.operationOrder)
      ? config.operationOrder
      : [];
    const operationLabels =
      config.operationLabels && typeof config.operationLabels === "object"
        ? config.operationLabels
        : {};
    const characterSetEnum = Array.isArray(config.characterSetEnum)
      ? config.characterSetEnum
      : [];
    const formOpsWithSelectionFields =
      config.formOpsWithSelectionFields || new Set();
    const formOpsWithRangeFields = config.formOpsWithRangeFields || new Set();
    const formOpsWithKeyFields = config.formOpsWithKeyFields || new Set();
    const formOpsWithValueFields = config.formOpsWithValueFields || new Set();

    const getSelectionDistributionValues =
      typeof config.getSelectionDistributionValues === "function"
        ? config.getSelectionDistributionValues
        : function getSelectionDistributionValuesFallback() {
            return [];
          };
    const getStringPatternValues =
      typeof config.getStringPatternValues === "function"
        ? config.getStringPatternValues
        : function getStringPatternValuesFallback() {
            return [];
          };
    const getRangeFormatValues =
      typeof config.getRangeFormatValues === "function"
        ? config.getRangeFormatValues
        : function getRangeFormatValuesFallback() {
            return [];
          };
    const getClarificationCurrentValue =
      typeof config.getClarificationCurrentValue === "function"
        ? config.getClarificationCurrentValue
        : function getClarificationCurrentValueFallback() {
            return null;
          };
    const applyClarificationAnswerToForm =
      typeof config.applyClarificationAnswerToForm === "function"
        ? config.applyClarificationAnswerToForm
        : function applyClarificationAnswerToFormFallback() {};
    const getCurrentWorkloadJson =
      typeof config.getCurrentWorkloadJson === "function"
        ? config.getCurrentWorkloadJson
        : function getCurrentWorkloadJsonFallback() {
            return null;
          };
    const getCurrentFormState =
      typeof config.getCurrentFormState === "function"
        ? config.getCurrentFormState
        : function getCurrentFormStateFallback() {
            return null;
          };
    const getSchemaHintsForAssist =
      typeof config.getSchemaHintsForAssist === "function"
        ? config.getSchemaHintsForAssist
        : function getSchemaHintsForAssistFallback() {
            return null;
          };
    const getSelectedOperations =
      typeof config.getSelectedOperations === "function"
        ? config.getSelectedOperations
        : function getSelectedOperationsFallback() {
            return [];
          };
    const applyAssistantPatch =
      typeof config.applyAssistantPatch === "function"
        ? config.applyAssistantPatch
        : function applyAssistantPatchFallback() {};
    const updateJsonFromForm =
      typeof config.updateJsonFromForm === "function"
        ? config.updateJsonFromForm
        : function updateJsonFromFormFallback() {};
    const getActivePresetJson =
      typeof config.getActivePresetJson === "function"
        ? config.getActivePresetJson
        : function getActivePresetJsonFallback() {
            return null;
          };
    const assistEndpoint =
      typeof config.assistEndpoint === "string" && config.assistEndpoint
        ? config.assistEndpoint
        : "/api/assist";

    const conversation = [];
    const clarificationIndex = new Map();
    const answerStore = {};
    let gateMessage = "";
    let hasUsedAssistant = false;

    function readAssistantUsageFlag() {
      try {
        return window.sessionStorage.getItem(ASSISTANT_USED_STORAGE_KEY) === "1";
      } catch (_error) {
        return false;
      }
    }

    function writeAssistantUsageFlag() {
      hasUsedAssistant = true;
      try {
        window.sessionStorage.setItem(ASSISTANT_USED_STORAGE_KEY, "1");
      } catch (_error) {
        // Ignore unavailable storage.
      }
    }

    function syncAssistantPlaceholder() {
      if (!refs.assistantInput) {
        return;
      }
      refs.assistantInput.placeholder = hasUsedAssistant
        ? ""
        : FIRST_PROMPT_PLACEHOLDER;
    }

    function setStatus(text, tone) {
      if (!refs.assistantStatus) {
        return;
      }
      refs.assistantStatus.textContent = text || "Ready";
      refs.assistantStatus.className = "assistant-status";
      if (tone === "loading") {
        refs.assistantStatus.classList.add("loading");
      } else if (tone === "error") {
        refs.assistantStatus.classList.add("error");
      } else if (tone === "warn") {
        refs.assistantStatus.classList.add("warn");
      }
    }

    function setBusy(isBusy) {
      if (refs.assistantApplyBtn) {
        refs.assistantApplyBtn.disabled = !!isBusy;
        refs.assistantApplyBtn.textContent = isBusy ? "Applying..." : "Apply";
      }
      if (refs.assistantClearBtn) {
        refs.assistantClearBtn.disabled = !!isBusy;
      }
      if (refs.assistantInput) {
        refs.assistantInput.disabled = !!isBusy;
      }
    }

    function setComposerHint(text) {
      if (!refs.assistantComposerHint) {
        return;
      }
      refs.assistantComposerHint.textContent = text || "";
    }

    function clearThread() {
      conversation.length = 0;
      clarificationIndex.clear();
      Object.keys(answerStore).forEach(function clearAnswer(key) {
        delete answerStore[key];
      });
      gateMessage = "";
      if (refs.assistantTimeline) {
        refs.assistantTimeline.innerHTML = "";
      }
      setComposerHint("");
      syncAssistantPlaceholder();
    }

    function createTurnId() {
      return (
        "turn-" +
        Date.now().toString(36) +
        "-" +
        Math.random().toString(36).slice(2, 7)
      );
    }

    function normalizeClarification(entry) {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const id =
        typeof entry.id === "string" && entry.id.trim()
          ? entry.id.trim()
          : createTurnId();
      const text = typeof entry.text === "string" ? entry.text.trim() : "";
      if (!text) {
        return null;
      }
      const binding =
        entry.binding && typeof entry.binding === "object" ? entry.binding : null;
      const type = binding && typeof binding.type === "string" ? binding.type : "";
      if (!["top_field", "operation_field", "operations_set"].includes(type)) {
        return null;
      }

      const inputType = typeof entry.input === "string" ? entry.input : "text";
      let options = Array.isArray(entry.options)
        ? entry.options
            .map(function normalizeOption(item) {
              return String(item || "").trim();
            })
            .filter(Boolean)
        : [];
      const validation =
        entry.validation && typeof entry.validation === "object"
          ? entry.validation
          : null;

      if (options.length === 0) {
        if (type === "top_field" && binding.field === "character_set") {
          options = characterSetEnum.slice();
        } else if (
          type === "operation_field" &&
          binding.field === "character_set"
        ) {
          options = characterSetEnum.slice();
        } else if (
          type === "operation_field" &&
          binding.field === "selection_distribution"
        ) {
          options = getSelectionDistributionValues();
        } else if (
          type === "operation_field" &&
          (binding.field === "key_pattern" || binding.field === "val_pattern")
        ) {
          options = getStringPatternValues();
        } else if (
          type === "operation_field" &&
          binding.field === "range_format"
        ) {
          options = getRangeFormatValues();
        } else if (type === "operations_set") {
          options = operationOrder.slice();
        }
      }

      return {
        id: id,
        text: text,
        required: entry.required === true,
        binding: binding,
        input: ["number", "enum", "multi_enum", "boolean", "text"].includes(
          inputType,
        )
          ? inputType
          : "text",
        options: options,
        validation: validation,
        default_behavior:
          typeof entry.default_behavior === "string"
            ? entry.default_behavior
            : "use_default",
      };
    }

    function normalizeAssumption(entry, index) {
      if (typeof entry === "string") {
        const text = entry.trim();
        return text
          ? {
              id: "assume-" + index,
              text: text,
              field_ref: null,
              reason: "default_applied",
              applied_value: null,
            }
          : null;
      }
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const text = typeof entry.text === "string" ? entry.text.trim() : "";
      if (!text) {
        return null;
      }
      return {
        id:
          typeof entry.id === "string" && entry.id.trim()
            ? entry.id.trim()
            : "assume-" + index,
        text: text,
        field_ref:
          typeof entry.field_ref === "string" ? entry.field_ref.trim() : null,
        reason:
          typeof entry.reason === "string"
            ? entry.reason.trim()
            : "default_applied",
        applied_value: entry.applied_value,
      };
    }

    function hasConfiguredWorkloadState(formState) {
      if (!formState || typeof formState !== "object") {
        return false;
      }

      const operations =
        formState.operations && typeof formState.operations === "object"
          ? formState.operations
          : {};
      const hasConfiguredOperations = Object.values(operations).some(function hasConfiguredOperation(entry) {
        if (!entry || typeof entry !== "object") {
          return false;
        }
        if (entry.enabled === true) {
          return true;
        }
        return Object.entries(entry).some(function hasConfiguredField(fieldEntry) {
          const fieldName = fieldEntry[0];
          const value = fieldEntry[1];
          return fieldName !== "enabled" && value !== null && value !== undefined;
        });
      });
      if (hasConfiguredOperations) {
        return true;
      }

      if (!Array.isArray(formState.sections)) {
        return false;
      }
      return formState.sections.some(function hasConfiguredSection(section) {
        if (!section || typeof section !== "object" || !Array.isArray(section.groups)) {
          return false;
        }
        return section.groups.some(function hasConfiguredGroup(group) {
          return (
            group &&
            typeof group === "object" &&
            Object.keys(group).some(function hasConfiguredGroupField(key) {
              return !!group[key];
            })
          );
        });
      });
    }

    function formatCompactCount(value) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) {
        return "";
      }
      const abs = Math.abs(numeric);
      if (abs >= 1000000) {
        const scaled = Math.round((numeric / 1000000) * 10) / 10;
        return (
          (Number.isInteger(scaled) ? String(scaled) : String(scaled)) + "M"
        );
      }
      if (abs >= 1000) {
        const scaled = Math.round((numeric / 1000) * 10) / 10;
        return (
          (Number.isInteger(scaled) ? String(scaled) : String(scaled)) + "K"
        );
      }
      return String(numeric);
    }

    function joinPhrases(parts) {
      const values = Array.isArray(parts)
        ? parts.filter(function filterValue(value) {
            return typeof value === "string" && value.trim();
          })
        : [];
      if (values.length === 0) {
        return "";
      }
      if (values.length === 1) {
        return values[0];
      }
      if (values.length === 2) {
        return values[0] + " and " + values[1];
      }
      return (
        values.slice(0, -1).join(", ") + ", and " + values[values.length - 1]
      );
    }

    function humanizeOperationName(operationName, spec) {
      if (
        (operationName === "range_queries" || operationName === "range_deletes") &&
        spec &&
        typeof spec === "object"
      ) {
        const selectivity = Number(spec.selectivity);
        if (Number.isFinite(selectivity)) {
          if (Math.abs(selectivity - 0.001) < 1e-9) {
            return operationName === "range_queries"
              ? "short range queries"
              : "short range deletes";
          }
          if (Math.abs(selectivity - 0.01) < 1e-9) {
            return operationName === "range_queries"
              ? "long range queries"
              : "long range deletes";
          }
        }
      }
      if (
        typeof operationLabels[operationName] === "string" &&
        operationLabels[operationName].trim()
      ) {
        return operationLabels[operationName].trim().toLowerCase();
      }
      return String(operationName || "").replace(/_/g, " ");
    }

    function buildOperationPhrase(operationName, spec) {
      if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
        return "";
      }
      if (
        Object.prototype.hasOwnProperty.call(spec, "enabled") &&
        spec.enabled === false
      ) {
        return "";
      }
      const label = humanizeOperationName(operationName, spec);
      if (!label) {
        return "";
      }
      if (Number.isFinite(spec.op_count)) {
        return formatCompactCount(spec.op_count) + " " + label;
      }
      return label;
    }

    function appendOperationPhrasesFromGroup(target, group) {
      if (!group || typeof group !== "object") {
        return;
      }
      const orderedOperations =
        operationOrder.length > 0 ? operationOrder : Object.keys(group);
      orderedOperations.forEach(function appendOperation(operationName) {
        if (!Object.prototype.hasOwnProperty.call(group, operationName)) {
          return;
        }
        const phrase = buildOperationPhrase(operationName, group[operationName]);
        if (phrase) {
          target.push(phrase);
        }
      });
    }

    function extractPatchOperationPhrases(patch) {
      if (!patch || typeof patch !== "object") {
        return [];
      }
      const phrases = [];
      if (Array.isArray(patch.sections) && patch.sections.length > 0) {
        patch.sections.forEach(function appendSection(section) {
          const groups =
            section && Array.isArray(section.groups) ? section.groups : [];
          groups.forEach(function appendGroup(group) {
            appendOperationPhrasesFromGroup(phrases, group);
          });
        });
      }
      if (phrases.length > 0) {
        return phrases;
      }
      if (patch.operations && typeof patch.operations === "object") {
        appendOperationPhrasesFromGroup(phrases, patch.operations);
      }
      return phrases;
    }

    function extractPatchedOperationEntries(patch) {
      if (!patch || typeof patch !== "object") {
        return [];
      }
      const operations =
        patch.operations && typeof patch.operations === "object"
          ? patch.operations
          : null;
      if (!operations) {
        return [];
      }
      const orderedOperations =
        operationOrder.length > 0 ? operationOrder : Object.keys(operations);
      return orderedOperations
        .filter(function hasOperation(operationName) {
          return Object.prototype.hasOwnProperty.call(operations, operationName);
        })
        .map(function mapOperation(operationName) {
          return {
            operationName: operationName,
            spec: operations[operationName],
          };
        });
    }

    function hasConfiguredNonEnabledFields(spec) {
      if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
        return false;
      }
      return Object.entries(spec).some(function hasConfiguredField(entry) {
        return entry[0] !== "enabled" && entry[1] !== null && entry[1] !== undefined;
      });
    }

    function isGenericSummary(summary) {
      const text = String(summary || "").trim();
      if (!text) {
        return true;
      }
      return [
        /^(?:generated|created|built|made|updated)(?: the)? (?:workload|form)(?: from your request| based on your request)?[.!]?$/i,
        /^applied(?: the ai response| your request| prompt)?(?: to the form)?[.!]?$/i,
      ].some(function matches(pattern) {
        return pattern.test(text);
      });
    }

    function buildSpecificSummary(context) {
      const patch = context && context.patch && typeof context.patch === "object"
        ? context.patch
        : null;
      const formStateBeforeApply =
        context &&
        context.formStateBeforeApply &&
        typeof context.formStateBeforeApply === "object"
          ? context.formStateBeforeApply
          : {};
      const phrases = extractPatchOperationPhrases(patch);
      const patchedOperationEntries = extractPatchedOperationEntries(patch);
      const isInitialGeneration =
        !context || context.hadConfiguredWorkloadBeforeApply !== true;
      const defaultVerb = isInitialGeneration ? "Generated" : "Updated";
      if (phrases.length === 0) {
        return isInitialGeneration
          ? "Generated the workload from your request."
          : "Updated the workload.";
      }

      if (!isInitialGeneration && patchedOperationEntries.length > 0) {
        const added = [];
        const removed = [];
        const updated = [];

        patchedOperationEntries.forEach(function classifyOperation(entry) {
          const operationName = entry.operationName;
          const spec = entry.spec;
          const currentState =
            formStateBeforeApply &&
            formStateBeforeApply.operations &&
            formStateBeforeApply.operations[operationName] &&
            typeof formStateBeforeApply.operations[operationName] === "object"
              ? formStateBeforeApply.operations[operationName]
              : {};
          const wasEnabled = currentState.enabled === true;
          const phrase =
            buildOperationPhrase(operationName, spec) ||
            humanizeOperationName(operationName, spec);

          if (
            spec &&
            typeof spec === "object" &&
            Object.prototype.hasOwnProperty.call(spec, "enabled") &&
            spec.enabled === false &&
            wasEnabled
          ) {
            removed.push(humanizeOperationName(operationName, spec));
            return;
          }
          if (
            spec &&
            typeof spec === "object" &&
            spec.enabled === true &&
            !wasEnabled
          ) {
            added.push(phrase);
            return;
          }
          if (hasConfiguredNonEnabledFields(spec)) {
            updated.push(phrase);
          }
        });

        if (added.length > 0 && removed.length === 0 && updated.length === 0) {
          return "Added " + joinPhrases(added) + " to the workload.";
        }
        if (removed.length > 0 && added.length === 0 && updated.length === 0) {
          return "Removed " + joinPhrases(removed) + " from the workload.";
        }
        if (updated.length > 0 && added.length === 0 && removed.length === 0) {
          return "Updated the workload with " + joinPhrases(updated) + ".";
        }
      }

      if (phrases.length <= 3) {
        return defaultVerb + " the workload with " + joinPhrases(phrases) + ".";
      }
      return (
        defaultVerb +
        " the workload with " +
        joinPhrases(phrases.slice(0, 3)) +
        " and " +
        String(phrases.length - 3) +
        " other operation type" +
        (phrases.length - 3 === 1 ? "" : "s") +
        "."
      );
    }

    function normalizeSummaryText(rawSummary, context) {
      const summary =
        typeof rawSummary === "string" && rawSummary.trim()
          ? rawSummary.trim()
          : "";
      if (isGenericSummary(summary)) {
        return buildSpecificSummary(context);
      }
      return summary;
    }

    function normalizeResponse(result, context) {
      const summary = normalizeSummaryText(result.summary, context);
      let clarifications = Array.isArray(result.clarifications)
        ? result.clarifications
            .map(function mapClarification(entry) {
              return normalizeClarification(entry);
            })
            .filter(Boolean)
        : [];
      if (clarifications.length === 0 && Array.isArray(result.questions)) {
        clarifications = result.questions
          .map(function mapLegacyQuestion(questionText, index) {
            return normalizeClarification({
              id: "question-" + index,
              text: String(questionText || "").trim(),
              required: false,
              binding: { type: "operations_set" },
              input: "multi_enum",
              options: operationOrder.slice(),
            });
          })
          .filter(Boolean);
      }
      const assumptions = Array.isArray(result.assumptions)
        ? result.assumptions
            .map(function mapAssumption(entry, index) {
              return normalizeAssumption(entry, index);
            })
            .filter(Boolean)
        : [];
      if (assumptions.length === 0 && Array.isArray(result.assumption_texts)) {
        result.assumption_texts.forEach(function appendAssumption(text, index) {
          const normalized = normalizeAssumption(String(text || ""), index);
          if (normalized) {
            assumptions.push(normalized);
          }
        });
      }
      const warnings = Array.isArray(result.warnings)
        ? result.warnings
            .map(function mapWarning(entry) {
              return String(entry || "").trim();
            })
            .filter(Boolean)
        : [];
      return {
        summary: summary,
        clarifications: clarifications,
        assumptions: assumptions,
        warnings: warnings,
        source: typeof result.source === "string" ? result.source : "unknown",
      };
    }

    function createTurnShell(role, timestamp) {
      const turnEl = document.createElement("article");
      turnEl.className = "assistant-turn " + role;

      const header = document.createElement("div");
      header.className = "assistant-turn-header";
      const left = document.createElement("span");
      left.textContent = role === "user" ? "You" : "Assistant";
      const right = document.createElement("span");
      right.textContent = timestamp || "";
      header.appendChild(left);
      header.appendChild(right);
      turnEl.appendChild(header);

      return turnEl;
    }

    function appendAssistantAssumptions(turnEl, assumptions) {
      const assumptionItems = Array.isArray(assumptions) ? assumptions : [];
      if (assumptionItems.length === 0) {
        const noAssumptions = document.createElement("p");
        noAssumptions.className = "assistant-inline-meta";
        noAssumptions.textContent =
          "No extra assistant-side assumptions were added.";
        turnEl.appendChild(noAssumptions);
        return;
      }

      const assumptionsWrap = document.createElement("div");
      assumptionsWrap.className = "assistant-assumptions";

      const title = document.createElement("p");
      title.className = "assistant-inline-meta assistant-assumptions-title";
      title.textContent = "Assumptions I used:";
      assumptionsWrap.appendChild(title);

      const list = document.createElement("ul");
      list.className = "assistant-assumption-list";
      assumptionItems.forEach(function appendAssumption(entry) {
        if (!entry || typeof entry.text !== "string" || !entry.text.trim()) {
          return;
        }
        const item = document.createElement("li");
        item.textContent = entry.text.trim();
        list.appendChild(item);
      });

      if (list.children.length === 0) {
        const noAssumptions = document.createElement("p");
        noAssumptions.className = "assistant-inline-meta";
        noAssumptions.textContent =
          "No extra assistant-side assumptions were added.";
        assumptionsWrap.appendChild(noAssumptions);
      } else {
        assumptionsWrap.appendChild(list);
      }
      turnEl.appendChild(assumptionsWrap);
    }

    function appendAssistantWarnings(turnEl, warnings) {
      const warningItems = Array.isArray(warnings) ? warnings : [];
      if (warningItems.length === 0) {
        return;
      }

      const warningText = document.createElement("p");
      warningText.className = "assistant-inline-meta assistant-turn-note";
      warningText.textContent = "Notes: " + warningItems.join(" ");
      turnEl.appendChild(warningText);
    }

    function createAssistantTurn(turn) {
      const turnEl = createTurnShell("assistant", turn.at);

      const summary = document.createElement("p");
      summary.className = "assistant-turn-message";
      summary.textContent = turn.summary || "Updated the form based on your request.";
      turnEl.appendChild(summary);

      appendAssistantAssumptions(turnEl, turn.assumptions);
      appendAssistantWarnings(turnEl, turn.warnings);

      const clarificationCount = Array.isArray(turn.clarifications)
        ? turn.clarifications.length
        : 0;
      const guidance = document.createElement("p");
      guidance.className = "assistant-inline-meta assistant-turn-note";
      guidance.textContent =
        clarificationCount > 0
          ? "You can fine-tune anything in the form, and I still need the details below to finish the remaining fields."
          : "You can fine-tune anything in the form if you want to adjust the generated workload.";
      turnEl.appendChild(guidance);

      return turnEl;
    }

    function addTimelineTurn(turn) {
      conversation.push(turn);
      while (conversation.length > 80) {
        conversation.shift();
      }
      renderTimeline();
    }

    function pruneAnswerStore() {
      const validIds = new Set(clarificationIndex.keys());
      Object.keys(answerStore).forEach(function pruneAnswer(answerId) {
        if (!validIds.has(answerId)) {
          delete answerStore[answerId];
        }
      });
    }

    function getAnswersForRequest() {
      pruneAnswerStore();
      const filtered = {};
      Object.entries(answerStore).forEach(function filterAnswer(entry) {
        const key = entry[0];
        const value = entry[1];
        if (!clarificationIndex.has(key)) {
          return;
        }
        filtered[key] = value;
      });
      return filtered;
    }

    function getOperationsForSelectionBinding(binding, clarification) {
      const available =
        Array.isArray(clarification.options) && clarification.options.length > 0
          ? clarification.options
          : operationOrder;
      if (!binding || binding.type !== "operations_set") {
        return available.slice();
      }
      const capability =
        typeof binding.capability === "string" ? binding.capability : "";
      if (!capability || capability === "all") {
        return available.slice();
      }
      return available.filter(function filterCapability(op) {
        if (capability === "selection") {
          return formOpsWithSelectionFields.has(op);
        }
        if (capability === "range") {
          return formOpsWithRangeFields.has(op);
        }
        if (capability === "key") {
          return formOpsWithKeyFields.has(op);
        }
        if (capability === "value") {
          return formOpsWithValueFields.has(op);
        }
        return true;
      });
    }

    function getCurrentValue(clarification) {
      if (!clarification) {
        return null;
      }
      if (Object.prototype.hasOwnProperty.call(answerStore, clarification.id)) {
        return answerStore[clarification.id];
      }
      return getClarificationCurrentValue(clarification);
    }

    function parseInputValueByType(inputEl, clarification) {
      if (!inputEl || !clarification) {
        return null;
      }
      if (clarification.input === "multi_enum") {
        if (Array.isArray(inputEl._checkboxOptions)) {
          return inputEl._checkboxOptions
            .filter(function filterChecked(option) {
              return option && option.checkbox && option.checkbox.checked;
            })
            .map(function mapChecked(option) {
              return String(option.value || "").trim();
            })
            .filter(Boolean);
        }
        if (!(inputEl instanceof HTMLSelectElement)) {
          return [];
        }
        return Array.from(inputEl.selectedOptions || [])
          .map(function mapSelectedOption(option) {
            return String(option.value || "").trim();
          })
          .filter(Boolean);
      }
      if (clarification.input === "boolean") {
        if (inputEl.value === "true") {
          return true;
        }
        if (inputEl.value === "false") {
          return false;
        }
        return null;
      }
      if (clarification.input === "number") {
        if (inputEl.value === "") {
          return null;
        }
        const value = Number(inputEl.value);
        return Number.isFinite(value) ? value : null;
      }
      const text = String(inputEl.value || "").trim();
      return text ? text : null;
    }

    function hasAnswerValue(value) {
      if (value === null || value === undefined) {
        return false;
      }
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      if (typeof value === "string") {
        return value.trim().length > 0;
      }
      return true;
    }

    function validateClarificationAnswer(clarification, value) {
      const validation =
        clarification &&
        clarification.validation &&
        typeof clarification.validation === "object"
          ? clarification.validation
          : {};

      if (!hasAnswerValue(value)) {
        if (clarification && clarification.required) {
          if (
            clarification.binding &&
            clarification.binding.type === "operations_set"
          ) {
            return {
              valid: false,
              message:
                "Select one or more operations in the Operations section below.",
            };
          }
          return { valid: false, message: "Required field." };
        }
        return { valid: true, message: "" };
      }

      if (clarification.input === "enum") {
        if (
          clarification.options.length > 0 &&
          !clarification.options.includes(String(value))
        ) {
          return {
            valid: false,
            message: "Choose one of the allowed options.",
          };
        }
      }

      if (clarification.input === "multi_enum") {
        const values = Array.isArray(value) ? value : [];
        if (validation.min_items && values.length < Number(validation.min_items)) {
          return {
            valid: false,
            message: "Select at least " + validation.min_items + " option(s).",
          };
        }
        if (validation.max_items && values.length > Number(validation.max_items)) {
          return {
            valid: false,
            message: "Select at most " + validation.max_items + " option(s).",
          };
        }
        if (
          clarification.options.length > 0 &&
          values.some(function isInvalidOption(item) {
            return !clarification.options.includes(item);
          })
        ) {
          return {
            valid: false,
            message: "Selected operation is not allowed.",
          };
        }
      }

      if (clarification.input === "number") {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
          return { valid: false, message: "Enter a valid number." };
        }
        if (validation.integer && !Number.isInteger(numeric)) {
          return { valid: false, message: "Enter a whole number." };
        }
        if (Number.isFinite(validation.min) && numeric < validation.min) {
          return {
            valid: false,
            message: "Value must be >= " + validation.min + ".",
          };
        }
        if (Number.isFinite(validation.max) && numeric > validation.max) {
          return {
            valid: false,
            message: "Value must be <= " + validation.max + ".",
          };
        }
      }

      return { valid: true, message: "" };
    }

    function validateAndRenderClarificationState() {
      const unresolved = [];
      clarificationIndex.forEach(function updateClarification(entry, id) {
        const value = getCurrentValue(entry.clarification);
        const validation = validateClarificationAnswer(entry.clarification, value);
        const resolved =
          entry.clarification.required === true &&
          validation.valid &&
          hasAnswerValue(value);

        entry.refs.forEach(function updateRef(ref) {
          if (ref && ref.errorEl) {
            ref.errorEl.textContent = validation.valid
              ? ""
              : entry.clarification.required || hasAnswerValue(value)
                ? validation.message
                : "";
          }
          if (ref && ref.inputEl) {
            ref.inputEl.classList.toggle(
              "invalid",
              !validation.valid &&
                (entry.clarification.required || hasAnswerValue(value)),
            );
          }
          if (ref && ref.blockEl) {
            ref.blockEl.classList.toggle(
              "required",
              entry.clarification.required === true && !resolved,
            );
            ref.blockEl.classList.toggle("resolved", resolved);
          }
          if (ref && ref.badgeEl) {
            ref.badgeEl.textContent = resolved ? "Resolved" : "Required";
            ref.badgeEl.classList.toggle("resolved", resolved);
          }
          if (ref && ref.hintEl) {
            ref.hintEl.textContent = buildClarificationHintText(
              entry.clarification,
              resolved,
            );
          }
        });

        if (entry.clarification.required && !validation.valid) {
          unresolved.push({ id: id, message: validation.message });
        }
      });

      if (unresolved.length > 0) {
        gateMessage =
          "Resolve " +
          unresolved.length +
          " required clarification" +
          (unresolved.length > 1 ? "s" : "") +
          " before sending the next prompt.";
        setComposerHint(gateMessage);
        if (
          !refs.assistantStatus ||
          !refs.assistantStatus.classList.contains("loading")
        ) {
          setStatus("Resolve required", "warn");
        }
      } else if (conversation.length > 0) {
        gateMessage = "";
        setComposerHint(
          "All required clarifications are resolved. You can continue the thread.",
        );
        if (
          !refs.assistantStatus ||
          (!refs.assistantStatus.classList.contains("loading") &&
            !refs.assistantStatus.classList.contains("error"))
        ) {
          setStatus("Ready", "default");
        }
      } else {
        gateMessage = "";
        setComposerHint("Answer required clarifications to continue the thread.");
      }

      return unresolved;
    }

    function registerClarificationRef(clarification, refsForClarification) {
      if (!clarification || !clarification.id) {
        return;
      }
      if (!clarificationIndex.has(clarification.id)) {
        clarificationIndex.set(clarification.id, {
          clarification: clarification,
          refs: [],
        });
      }
      const entry = clarificationIndex.get(clarification.id);
      entry.clarification = clarification;
      entry.refs.push(refsForClarification || {});
    }

    function writeValueToClarificationInput(inputEl, clarification, value) {
      if (!inputEl || !clarification) {
        return;
      }
      if (!hasAnswerValue(value)) {
        if (clarification.input === "multi_enum" && Array.isArray(inputEl._checkboxOptions)) {
          inputEl._checkboxOptions.forEach(function clearCheckbox(option) {
            if (option && option.checkbox) {
              option.checkbox.checked = false;
            }
          });
          return;
        }
        if (
          clarification.input === "multi_enum" &&
          inputEl instanceof HTMLSelectElement
        ) {
          Array.from(inputEl.options || []).forEach(function clearOption(option) {
            option.selected = false;
          });
        } else {
          inputEl.value = "";
        }
        return;
      }
      if (
        clarification.input === "multi_enum" &&
        Array.isArray(inputEl._checkboxOptions)
      ) {
        const asArray = Array.isArray(value) ? value : [];
        inputEl._checkboxOptions.forEach(function setCheckbox(option) {
          if (option && option.checkbox) {
            option.checkbox.checked = asArray.includes(option.value);
          }
        });
        return;
      }
      if (
        clarification.input === "multi_enum" &&
        inputEl instanceof HTMLSelectElement
      ) {
        const asArray = Array.isArray(value) ? value : [];
        Array.from(inputEl.options || []).forEach(function selectOption(option) {
          option.selected = asArray.includes(option.value);
        });
        return;
      }
      if (clarification.input === "boolean") {
        inputEl.value =
          value === true ? "true" : value === false ? "false" : "";
        return;
      }
      inputEl.value = String(value);
    }

    function clarificationUsesSingleChoiceCheckboxes(clarification) {
      if (!clarification || clarification.input !== "multi_enum") {
        return false;
      }
      const validation =
        clarification.validation && typeof clarification.validation === "object"
          ? clarification.validation
          : {};
      return Number(validation.max_items) === 1;
    }

    function createSingleChoiceCheckboxGroup(clarification) {
      const wrapper = document.createElement("div");
      wrapper.className =
        "assistant-clarification-input assistant-clarification-choice-list";
      wrapper._checkboxOptions = [];

      clarification.options.forEach(function appendCheckboxOption(optionValue, index) {
        const row = document.createElement("label");
        row.className = "assistant-clarification-choice";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = optionValue;
        checkbox.name = clarification.id || "assistant-clarification-choice";
        checkbox.setAttribute("aria-label", optionValue);
        checkbox.dataset.optionIndex = String(index);

        const text = document.createElement("span");
        text.className = "assistant-clarification-choice-label";
        text.textContent = optionValue;

        row.appendChild(checkbox);
        row.appendChild(text);
        wrapper.appendChild(row);
        wrapper._checkboxOptions.push({
          value: optionValue,
          checkbox: checkbox,
        });
      });

      return wrapper;
    }

    function createClarificationInput(clarification) {
      if (!clarification || shouldHideClarificationInput(clarification)) {
        return null;
      }
      let inputEl = null;
      if (clarification.input === "enum") {
        inputEl = document.createElement("select");
        inputEl.className = "assistant-clarification-input";
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "(choose)";
        inputEl.appendChild(placeholder);
        clarification.options.forEach(function appendOption(optionValue) {
          const optionEl = document.createElement("option");
          optionEl.value = optionValue;
          optionEl.textContent = optionValue;
          inputEl.appendChild(optionEl);
        });
        return inputEl;
      }
      if (clarification.input === "multi_enum") {
        if (clarificationUsesSingleChoiceCheckboxes(clarification)) {
          return createSingleChoiceCheckboxGroup(clarification);
        }
        inputEl = document.createElement("select");
        inputEl.className = "assistant-clarification-input";
        inputEl.multiple = true;
        inputEl.size = Math.max(3, Math.min(6, clarification.options.length || 4));
        clarification.options.forEach(function appendOption(optionValue) {
          const optionEl = document.createElement("option");
          optionEl.value = optionValue;
          optionEl.textContent = optionValue;
          inputEl.appendChild(optionEl);
        });
        return inputEl;
      }
      if (clarification.input === "boolean") {
        inputEl = document.createElement("select");
        inputEl.className = "assistant-clarification-input";
        [
          { value: "", label: "(choose)" },
          { value: "true", label: "Yes" },
          { value: "false", label: "No" },
        ].forEach(function appendBooleanOption(entry) {
          const optionEl = document.createElement("option");
          optionEl.value = entry.value;
          optionEl.textContent = entry.label;
          inputEl.appendChild(optionEl);
        });
        return inputEl;
      }

      inputEl = document.createElement("input");
      inputEl.className = "assistant-clarification-input";
      inputEl.type = clarification.input === "number" ? "number" : "text";
      if (clarification.input === "number") {
        inputEl.step =
          clarification.validation && clarification.validation.integer
            ? "1"
            : "any";
        if (
          clarification.validation &&
          Number.isFinite(clarification.validation.min)
        ) {
          inputEl.min = String(clarification.validation.min);
        }
        if (
          clarification.validation &&
          Number.isFinite(clarification.validation.max)
        ) {
          inputEl.max = String(clarification.validation.max);
        }
      }
      return inputEl;
    }

    function shouldHideClarificationInput(_clarification) {
      return false;
    }

    function buildClarificationHintText(clarification, resolved) {
      if (!clarification || !clarification.binding) {
        return "";
      }
      if (clarification.binding.type === "operations_set") {
        const maxItems =
          clarification.validation &&
          typeof clarification.validation === "object" &&
          Number.isFinite(clarification.validation.max_items)
            ? Number(clarification.validation.max_items)
            : null;
        if (clarification.required) {
          return resolved
            ? "Operations are selected. You can keep refining them."
            : maxItems === 1
              ? "Select one operation here to continue."
              : "Select one or more operations here to continue.";
        }
        return maxItems === 1
          ? "Select one operation here."
          : "Select one or more operations here.";
      }
      if (clarification.required) {
        return resolved ? "Required answer provided." : "Required for next prompt.";
      }
      return "Optional. Defaults will be used if left blank.";
    }

    function getClarificationFieldLabel(fieldName) {
      const labels = {
        selection_mean: "mean",
        selection_std_dev: "standard deviation",
        selection_alpha: "alpha",
        selection_beta: "beta",
        selection_lambda: "lambda",
        selection_scale: "scale",
        selection_shape: "shape",
        selection_min: "minimum",
        selection_max: "maximum",
        selection_n: "parameter n",
        selection_s: "parameter s",
      };
      return labels[fieldName] || "";
    }

    function getClarificationDisplayText(clarification) {
      const baseText =
        clarification && typeof clarification.text === "string"
          ? clarification.text.trim()
          : "";
      if (!baseText || !clarification || !clarification.binding) {
        return baseText;
      }
      if (
        clarification.binding.type !== "operation_field" ||
        clarification.input !== "number" ||
        typeof clarification.binding.field !== "string"
      ) {
        return baseText;
      }
      const fieldName = clarification.binding.field;
      if (!fieldName.startsWith("selection_")) {
        return baseText;
      }

      const lower = baseText.toLowerCase();
      const looksMultiParam =
        (/\bmean\b/.test(lower) &&
          /\bstandard\s+deviation\b|\bstd(?:\.?\s*dev|_?dev|_?deviation)?\b/.test(
            lower,
          )) ||
        (/\balpha\b/.test(lower) && /\bbeta\b/.test(lower)) ||
        (/\bmin(?:imum)?\b/.test(lower) && /\bmax(?:imum)?\b/.test(lower)) ||
        (/\bscale\b/.test(lower) && /\bshape\b/.test(lower));
      if (!looksMultiParam) {
        return baseText;
      }

      const fieldLabel = getClarificationFieldLabel(fieldName);
      if (!fieldLabel) {
        return baseText;
      }

      const distributionMatch = baseText.match(
        /\bfor\s+([a-z_ -]+)\s+selection distribution\b/i,
      );
      const distributionLabel =
        distributionMatch && distributionMatch[1]
          ? distributionMatch[1].trim()
          : "selection";
      return (
        "For " +
        distributionLabel +
        " distribution, what " +
        fieldLabel +
        " should I use?"
      );
    }

    function renderTimeline() {
      if (!refs.assistantTimeline) {
        return;
      }
      refs.assistantTimeline.innerHTML = "";
      clarificationIndex.clear();

      conversation.forEach(function renderTurn(turn) {
        if (turn.role !== "user") {
          refs.assistantTimeline.appendChild(createAssistantTurn(turn));

          if (
            !Array.isArray(turn.clarifications) ||
            turn.clarifications.length === 0
          ) {
            return;
          }

          const clarificationsWrap = document.createElement("div");
          clarificationsWrap.className = "assistant-clarification-list";
          turn.clarifications.forEach(function appendClarification(clarification) {
            const currentValue = getCurrentValue(clarification);
            const currentValidation = validateClarificationAnswer(
              clarification,
              currentValue,
            );
            const resolved =
              clarification.required === true &&
              currentValidation.valid &&
              hasAnswerValue(currentValue);
            const block = document.createElement("div");
            const blockClasses = ["assistant-clarification"];
            if (clarification.required && !resolved) {
              blockClasses.push("required");
            }
            if (resolved) {
              blockClasses.push("resolved");
            }
            block.className = blockClasses.join(" ");

            const label = document.createElement("label");
            label.className = "assistant-clarification-label";
            label.textContent = getClarificationDisplayText(clarification);
            let badge = null;
            if (clarification.required) {
              badge = document.createElement("span");
              badge.className = "assistant-required-badge";
              badge.textContent = resolved ? "Resolved" : "Required";
              badge.classList.toggle("resolved", resolved);
              label.appendChild(badge);
            }
            block.appendChild(label);

            const inputEl = createClarificationInput(clarification);
            if (inputEl) {
              writeValueToClarificationInput(inputEl, clarification, currentValue);
              block.appendChild(inputEl);
            }

            const hint = document.createElement("p");
            hint.className = "assistant-clarification-hint";
            hint.textContent = buildClarificationHintText(clarification, resolved);
            block.appendChild(hint);

            const errorEl = document.createElement("p");
            errorEl.className = "assistant-clarification-error";
            block.appendChild(errorEl);
            registerClarificationRef(clarification, {
              inputEl: inputEl,
              errorEl: errorEl,
              blockEl: block,
              badgeEl: badge,
              hintEl: hint,
            });

            if (inputEl) {
              const applyFromInput = function applyFromInput() {
                const parsedValue = parseInputValueByType(inputEl, clarification);
                if (hasAnswerValue(parsedValue)) {
                  answerStore[clarification.id] = parsedValue;
                } else {
                  delete answerStore[clarification.id];
                }
                const validation = validateClarificationAnswer(
                  clarification,
                  answerStore[clarification.id],
                );
                if (validation.valid) {
                  applyClarificationAnswerToForm(
                    clarification,
                    answerStore[clarification.id],
                  );
                }
                validateAndRenderClarificationState();
              };

              if (Array.isArray(inputEl._checkboxOptions)) {
                inputEl._checkboxOptions.forEach(function bindCheckboxOption(option) {
                  if (!option || !option.checkbox) {
                    return;
                  }
                  option.checkbox.addEventListener("change", function onCheckboxChange() {
                    if (
                      option.checkbox.checked &&
                      clarificationUsesSingleChoiceCheckboxes(clarification)
                    ) {
                      inputEl._checkboxOptions.forEach(function clearOther(other) {
                        if (other && other.checkbox && other.checkbox !== option.checkbox) {
                          other.checkbox.checked = false;
                        }
                      });
                    }
                    applyFromInput();
                  });
                });
              } else if (inputEl.tagName === "SELECT") {
                inputEl.addEventListener("change", applyFromInput);
              } else {
                inputEl.addEventListener("input", applyFromInput);
                inputEl.addEventListener("blur", applyFromInput);
              }
            }

            clarificationsWrap.appendChild(block);
          });

          refs.assistantTimeline.appendChild(clarificationsWrap);
          return;
        }

        const turnEl = createTurnShell("user", turn.at);

        if (turn.role === "user") {
          const message = document.createElement("p");
          message.className = "assistant-turn-message";
          message.textContent = turn.text || "";
          turnEl.appendChild(message);
          refs.assistantTimeline.appendChild(turnEl);
          return;
        }
      });

      pruneAnswerStore();
      refs.assistantTimeline.scrollTop = refs.assistantTimeline.scrollHeight;
      validateAndRenderClarificationState();
    }

    async function requestPatch(promptText) {
      const currentJson = getCurrentWorkloadJson();
      const response = await fetch(assistEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptText,
          conversation: conversation.map(function mapTurn(turn) {
            return {
              role: turn.role === "assistant" ? "assistant" : "user",
              text:
                turn.role === "assistant"
                  ? turn.summary || turn.text || ""
                  : turn.text || "",
            };
          }),
          answers: getAnswersForRequest(),
          form_state: getCurrentFormState(),
          schema_hints: getSchemaHintsForAssist(),
          current_json: currentJson,
        }),
      });

      let data = null;
      try {
        data = await response.json();
      } catch (error) {
        throw new Error("Assistant returned an unreadable response.");
      }

      if (!response.ok) {
        const errorMessage =
          data && data.error
            ? typeof data.error === "string"
              ? data.error
              : data.error.message || "Assistant request failed."
            : "Assistant request failed.";
        throw new Error(errorMessage);
      }
      if (!data || typeof data !== "object") {
        throw new Error("Assistant returned an empty response.");
      }
      return data;
    }

    async function handleApply() {
      const promptText = refs.assistantInput ? refs.assistantInput.value.trim() : "";
      if (!promptText) {
        setStatus("Enter details to apply", "warn");
        setComposerHint(
          "Describe your workload in plain English, then click Apply.",
        );
        return;
      }

      const unresolvedBeforeSend = validateAndRenderClarificationState();
      if (unresolvedBeforeSend.length > 0) {
        setStatus("Resolve required", "warn");
        setComposerHint(
          gateMessage ||
            "Resolve required clarifications before sending the next prompt.",
        );
        return;
      }

      addTimelineTurn({
        id: createTurnId(),
        role: "user",
        text: promptText,
        at: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      });
      writeAssistantUsageFlag();
      syncAssistantPlaceholder();

      if (refs.assistantInput) {
        refs.assistantInput.value = "";
      }

      setBusy(true);
      setStatus("Interpreting...", "loading");
      setComposerHint("Updating the form and summarizing the assumptions...");

      try {
        const formStateBeforeApply = getCurrentFormState();
        const hadConfiguredWorkloadBeforeApply = hasConfiguredWorkloadState(
          formStateBeforeApply,
        );
        const selectedOpsBeforeApply = getSelectedOperations();
        const result = await requestPatch(promptText);
        applyAssistantPatch(result.patch, {
          promptText: promptText,
          selectedOpsBeforeApply: selectedOpsBeforeApply,
        });
        updateJsonFromForm();

        const normalizedResult = normalizeResponse(result, {
          patch: result.patch,
          formStateBeforeApply,
          hadConfiguredWorkloadBeforeApply,
        });
        addTimelineTurn({
          id: createTurnId(),
          role: "assistant",
          summary: normalizedResult.summary,
          clarifications: normalizedResult.clarifications,
          assumptions: normalizedResult.assumptions,
          warnings: normalizedResult.warnings,
          source: normalizedResult.source,
          at: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        });

        const unresolvedAfterApply = validateAndRenderClarificationState();
        if (unresolvedAfterApply.length > 0) {
          setStatus("Resolve required", "warn");
        } else if (normalizedResult.warnings.length > 0) {
          setStatus("Applied with notes", "warn");
        } else {
          setStatus("Applied", "default");
        }
      } catch (error) {
        setStatus("Assistant failed", "error");
        addTimelineTurn({
          id: createTurnId(),
          role: "assistant",
          summary:
            error && error.message
              ? error.message
              : "Failed to apply assistant suggestion.",
          clarifications: [],
          assumptions: [],
          warnings: [],
          source: "error",
          at: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        });
        setComposerHint(
          "The previous request failed. Update your prompt and try again.",
        );
      } finally {
        setBusy(false);
      }
    }

    function handleClearClick() {
      if (refs.assistantInput) {
        refs.assistantInput.value = "";
        refs.assistantInput.focus();
      }
      clearThread();
      setStatus("Ready", "default");
    }

    function bindEvents() {
      hasUsedAssistant = readAssistantUsageFlag();
      syncAssistantPlaceholder();
      if (refs.assistantApplyBtn) {
        refs.assistantApplyBtn.addEventListener("click", handleApply);
      }
      if (refs.assistantClearBtn) {
        refs.assistantClearBtn.addEventListener("click", handleClearClick);
      }
      if (refs.assistantInput) {
        refs.assistantInput.addEventListener("keydown", function onKeyDown(event) {
          const isMeta = event.metaKey || event.ctrlKey;
          if (isMeta && event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
            void handleApply();
          }
        });
      }
    }

    return {
      bindEvents: bindEvents,
      clearThread: clearThread,
      handleApply: handleApply,
      requestPatch: requestPatch,
      setBusy: setBusy,
      setComposerHint: setComposerHint,
      setStatus: setStatus,
    };
  }

  global.TectonicAssistantPanel = {
    createController: createController,
  };
})(globalThis);
