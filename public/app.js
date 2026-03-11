const workloadForm = document.getElementById("workloadForm");
const formCharacterSet = document.getElementById("formCharacterSet");
const formSections = document.getElementById("formSections");
const formGroups = document.getElementById("formGroups");
const formSkipKeyContainsCheck = document.getElementById(
  "formSkipKeyContainsCheck",
);
const formCharacterSetLabel = document.getElementById("formCharacterSetLabel");
const formSectionsLabel = document.getElementById("formSectionsLabel");
const formGroupsLabel = document.getElementById("formGroupsLabel");
const skipKeyContainsCheckLabel = document.getElementById(
  "skipKeyContainsCheckLabel",
);
const operationsTitle = document.getElementById("operationsTitle");
const presetButtons = document.querySelectorAll(".preset-btn");
const operationToggles = document.getElementById("operationToggles");
const operationConfigContainer = document.getElementById(
  "operationConfigContainer",
);
const jsonOutput = document.getElementById("jsonOutput");
const hudSections = document.getElementById("hudSections");
const hudGroups = document.getElementById("hudGroups");
const hudOps = document.getElementById("hudOps");
const hudLines = document.getElementById("hudLines");
const jsonSectionsPill = document.getElementById("jsonSectionsPill");
const jsonOpsPill = document.getElementById("jsonOpsPill");
const jsonBytesPill = document.getElementById("jsonBytesPill");
const characterSetDescription = document.getElementById(
  "characterSetDescription",
);
const sectionsDescription = document.getElementById("sectionsDescription");
const groupsDescription = document.getElementById("groupsDescription");
const skipKeyContainsCheckDescription = document.getElementById(
  "skipKeyContainsCheckDescription",
);
const validateBtn = document.getElementById("validateBtn");
const downloadJsonBtn = document.getElementById("downloadJsonBtn");
const runWorkloadBtn = document.getElementById("runWorkloadBtn");
const copyBtn = document.getElementById("copyBtn");
const validationResult = document.getElementById("validationResult");
const runsList = document.getElementById("runsList");
const newWorkloadBtn = document.getElementById("newWorkloadBtn");
const assistantInput = document.getElementById("assistantInput");
const assistantApplyBtn = document.getElementById("assistantApplyBtn");
const assistantClearBtn = document.getElementById("assistantClearBtn");
const assistantStatus = document.getElementById("assistantStatus");
const assistantTimeline = document.getElementById("assistantTimeline");
const assistantComposerHint = document.getElementById("assistantComposerHint");

const INITIAL_JSON_TEXT = "{}";
const PROMPT_OPERATION_MATCHER_SOURCES = {
  inserts: "insert(?:s|ion)?",
  updates: "update(?:s)?",
  merges: "merge(?:s)?|read[- ]?modify[- ]?write|rmw",
  point_queries: "point\\s+(?:query|querie|queries|read|reads)",
  range_queries: "range\\s+(?:query|querie|queries)",
  point_deletes: "point\\s+delete(?:s)?",
  range_deletes: "range\\s+delete(?:s)?",
  empty_point_queries:
    "(?:empty|missing)\\s+point\\s+(?:query|querie|queries|read|reads)",
  empty_point_deletes:
    "(?:empty|missing|non[- ]?existent)\\s+point\\s+delete(?:s)?",
  sorted: "sorted",
};
const PROMPT_OPERATION_BLOCKED_PREFIXES = {
  point_queries: ["empty", "missing"],
  point_deletes: [
    "empty",
    "missing",
    "non existent",
    "non-existent",
    "nonexistent",
  ],
};
// Fallback ordering used only if schema-derived operation metadata is unavailable.
const DEFAULT_OPERATION_ORDER = [
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
const SELECTION_DISTRIBUTION_PARAMS = {
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
const SELECTION_PARAM_UI = {
  selection_min: { label: "Selection Min", step: "any", min: null },
  selection_max: { label: "Selection Max", step: "any", min: null },
  selection_mean: { label: "Selection Mean", step: "any", min: null },
  selection_std_dev: { label: "Selection Std Dev", step: "any", min: "0" },
  selection_alpha: { label: "Selection Alpha", step: "any", min: "0" },
  selection_beta: { label: "Selection Beta", step: "any", min: "0" },
  selection_n: { label: "Selection N", step: "1", min: "1" },
  selection_s: { label: "Selection S", step: "any", min: "0" },
  selection_lambda: { label: "Selection Lambda", step: "any", min: "0" },
  selection_scale: { label: "Selection Scale", step: "any", min: "0" },
  selection_shape: { label: "Selection Shape", step: "any", min: "0" },
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
const DEFAULT_STRING_PATTERNS = [
  "uniform",
  "weighted",
  "segmented",
  "hot_range",
];
const OPERATION_NUMBER_EXPR_FIELDS = ["op_count", "k", "l", "selectivity"];
const ADVANCED_OPERATION_FIELDS = [
  "op_count",
  "k",
  "l",
  "selectivity",
  "key",
  "val",
  "selection",
];
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
// UI defaults stay product-defined (not schema-defined) so presets remain predictable.
const OPERATION_DEFAULTS = {
  inserts: {
    op_count: 500000,
    key_len: 20,
    val_len: 1024,
    key_pattern: STRING_PATTERN_DEFAULTS.key_pattern,
    val_pattern: STRING_PATTERN_DEFAULTS.val_pattern,
    key_hot_len: STRING_PATTERN_DEFAULTS.key_hot_len,
    key_hot_amount: STRING_PATTERN_DEFAULTS.key_hot_amount,
    key_hot_probability: STRING_PATTERN_DEFAULTS.key_hot_probability,
    val_hot_len: STRING_PATTERN_DEFAULTS.val_hot_len,
    val_hot_amount: STRING_PATTERN_DEFAULTS.val_hot_amount,
    val_hot_probability: STRING_PATTERN_DEFAULTS.val_hot_probability,
  },
  updates: {
    op_count: 500000,
    val_len: 1024,
    val_pattern: STRING_PATTERN_DEFAULTS.val_pattern,
    val_hot_len: STRING_PATTERN_DEFAULTS.val_hot_len,
    val_hot_amount: STRING_PATTERN_DEFAULTS.val_hot_amount,
    val_hot_probability: STRING_PATTERN_DEFAULTS.val_hot_probability,
    selection_distribution: "uniform",
    ...SELECTION_PARAM_DEFAULTS,
  },
  merges: {
    op_count: 500000,
    val_len: 256,
    val_pattern: STRING_PATTERN_DEFAULTS.val_pattern,
    val_hot_len: STRING_PATTERN_DEFAULTS.val_hot_len,
    val_hot_amount: STRING_PATTERN_DEFAULTS.val_hot_amount,
    val_hot_probability: STRING_PATTERN_DEFAULTS.val_hot_probability,
    selection_distribution: "uniform",
    ...SELECTION_PARAM_DEFAULTS,
  },
  point_queries: {
    op_count: 500000,
    selection_distribution: "uniform",
    ...SELECTION_PARAM_DEFAULTS,
  },
  range_queries: {
    op_count: 500000,
    selectivity: 0.01,
    range_format: "StartCount",
    selection_distribution: "uniform",
    ...SELECTION_PARAM_DEFAULTS,
  },
  point_deletes: {
    op_count: 500000,
    selection_distribution: "uniform",
    ...SELECTION_PARAM_DEFAULTS,
  },
  range_deletes: {
    op_count: 500000,
    selectivity: 0.01,
    range_format: "StartCount",
    selection_distribution: "uniform",
    ...SELECTION_PARAM_DEFAULTS,
  },
  empty_point_queries: {
    op_count: 500000,
    key_len: 20,
    key_pattern: STRING_PATTERN_DEFAULTS.key_pattern,
    key_hot_len: STRING_PATTERN_DEFAULTS.key_hot_len,
    key_hot_amount: STRING_PATTERN_DEFAULTS.key_hot_amount,
    key_hot_probability: STRING_PATTERN_DEFAULTS.key_hot_probability,
  },
  empty_point_deletes: {
    op_count: 500000,
    key_len: 20,
    key_pattern: STRING_PATTERN_DEFAULTS.key_pattern,
    key_hot_len: STRING_PATTERN_DEFAULTS.key_hot_len,
    key_hot_amount: STRING_PATTERN_DEFAULTS.key_hot_amount,
    key_hot_probability: STRING_PATTERN_DEFAULTS.key_hot_probability,
  },
  sorted: {
    k: 100,
    l: 1,
  },
};

function titleCaseFromSnake(value) {
  return String(value || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

// Runtime metadata derived from the loaded schema.
let operationOrder = [...DEFAULT_OPERATION_ORDER];
let operationLabels = DEFAULT_OPERATION_ORDER.reduce((acc, op) => {
  acc[op] = titleCaseFromSnake(op);
  return acc;
}, {});
let formOpsWithKeyFields = new Set([
  "inserts",
  "empty_point_queries",
  "empty_point_deletes",
]);
let formOpsWithValueFields = new Set(["inserts", "updates", "merges"]);
let formOpsWithSelectionFields = new Set([
  "updates",
  "merges",
  "point_queries",
  "point_deletes",
  "range_queries",
  "range_deletes",
]);
let formOpsWithOpCountFields = new Set(DEFAULT_OPERATION_ORDER);
let formOpsWithOperationCharacterSet = new Set([
  "inserts",
  "updates",
  "merges",
  "range_queries",
  "range_deletes",
  "empty_point_queries",
  "empty_point_deletes",
]);
let formOpsWithRangeFields = new Set(["range_queries", "range_deletes"]);
let formOpsWithSortedFields = new Set();
let characterSetEnum = ["alphanumeric", "alphabetic", "numeric"];
let rangeFormatEnum = ["StartCount", "StartEnd"];
let selectionDistributionEnum = [...DEFAULT_SELECTION_DISTRIBUTIONS];
let stringPatternEnum = [...DEFAULT_STRING_PATTERNS];
const assistantConversation = [];
const assistantAnswerStore = {};
const assistantClarificationIndex = new Map();
const operationAdvancedState = new Map();
let assistantGateMessage = "";
const lockedTopFields = new Set();
const lockedOperationFields = new Map();

let schema = null;
let workloadRunsController = null;
const SCHEMA_ASSET_PATH = "/workload-schema.json";
const ASSIST_ENDPOINT = "/api/assist";

async function loadInitialSchema() {
  try {
    const response = await fetch(SCHEMA_ASSET_PATH, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }
    const loadedSchema = await response.json();
    if (!loadedSchema || typeof loadedSchema !== "object") {
      throw new Error("Schema asset did not return an object");
    }
    return loadedSchema;
  } catch (e) {
    reportUiIssue("Failed to load schema asset", e);
    return null;
  }
}

// Derive UI structure from schema so we avoid hardcoding operation capabilities.
function deriveUiConfigFromSchema() {
  if (!schema || typeof schema !== "object") {
    return;
  }

  const groupProperties =
    schema.$defs &&
    schema.$defs.WorkloadSpecGroup &&
    schema.$defs.WorkloadSpecGroup.properties
      ? schema.$defs.WorkloadSpecGroup.properties
      : null;

  if (groupProperties && typeof groupProperties === "object") {
    const derivedOps = [];
    const derivedLabels = {};
    const derivedOpCountFields = new Set();
    const derivedOperationCharacterSets = new Set();
    const derivedKeyFields = new Set();
    const derivedValueFields = new Set();
    const derivedSelectionFields = new Set();
    const derivedSortedFields = new Set();
    const derivedRangeFields = new Set();

    Object.entries(groupProperties).forEach(([op, rawNode]) => {
      const resolvedNode = unwrapSchemaNode(rawNode);
      if (
        !resolvedNode ||
        typeof resolvedNode !== "object" ||
        !resolvedNode.properties
      ) {
        return;
      }
      const hasOpCount = Object.prototype.hasOwnProperty.call(
        resolvedNode.properties,
        "op_count",
      );
      const hasSortedFields =
        Object.prototype.hasOwnProperty.call(resolvedNode.properties, "k") &&
        Object.prototype.hasOwnProperty.call(resolvedNode.properties, "l");
      // Include operation blocks that define any executable workload fields.
      if (!hasOpCount && !hasSortedFields) {
        return;
      }

      derivedOps.push(op);
      derivedLabels[op] = titleCaseFromSnake(op);
      if (hasOpCount) {
        derivedOpCountFields.add(op);
      }
      if (hasSortedFields) {
        derivedSortedFields.add(op);
      }
      if (
        Object.prototype.hasOwnProperty.call(
          resolvedNode.properties,
          "character_set",
        )
      ) {
        derivedOperationCharacterSets.add(op);
      }

      if (
        Object.prototype.hasOwnProperty.call(resolvedNode.properties, "key")
      ) {
        derivedKeyFields.add(op);
      }
      if (
        Object.prototype.hasOwnProperty.call(resolvedNode.properties, "val")
      ) {
        derivedValueFields.add(op);
      }
      if (
        Object.prototype.hasOwnProperty.call(
          resolvedNode.properties,
          "selection",
        )
      ) {
        derivedSelectionFields.add(op);
      }
      if (
        Object.prototype.hasOwnProperty.call(
          resolvedNode.properties,
          "range_format",
        ) ||
        Object.prototype.hasOwnProperty.call(
          resolvedNode.properties,
          "selectivity",
        )
      ) {
        derivedRangeFields.add(op);
      }
    });

    if (derivedOps.length > 0) {
      operationOrder = derivedOps;
      operationLabels = derivedLabels;
      formOpsWithKeyFields = derivedKeyFields;
      formOpsWithValueFields = derivedValueFields;
      formOpsWithSelectionFields = derivedSelectionFields;
      formOpsWithOpCountFields = derivedOpCountFields;
      formOpsWithOperationCharacterSet = derivedOperationCharacterSets;
      formOpsWithSortedFields = derivedSortedFields;
      formOpsWithRangeFields = derivedRangeFields;
    }
  }

  const derivedCharacterSetEnum =
    schema.$defs &&
    schema.$defs.CharacterSet &&
    Array.isArray(schema.$defs.CharacterSet.enum)
      ? schema.$defs.CharacterSet.enum.filter(
          (value) => typeof value === "string" && value.trim() !== "",
        )
      : [];
  if (derivedCharacterSetEnum.length > 0) {
    characterSetEnum = derivedCharacterSetEnum;
  }

  const rangeFormatVariants =
    schema.$defs &&
    schema.$defs.RangeFormat &&
    Array.isArray(schema.$defs.RangeFormat.oneOf)
      ? schema.$defs.RangeFormat.oneOf
      : [];
  const derivedRangeFormatEnum = rangeFormatVariants
    .map((entry) =>
      entry && typeof entry.const === "string" ? entry.const : null,
    )
    .filter(Boolean);
  if (derivedRangeFormatEnum.length > 0) {
    rangeFormatEnum = derivedRangeFormatEnum;
  }

  const distributionVariants =
    schema.$defs &&
    schema.$defs.Distribution &&
    Array.isArray(schema.$defs.Distribution.oneOf)
      ? schema.$defs.Distribution.oneOf
      : [];
  const derivedSelectionDistributionEnum = distributionVariants
    .map((entry) => {
      if (
        !entry ||
        typeof entry !== "object" ||
        !entry.properties ||
        typeof entry.properties !== "object"
      ) {
        return null;
      }
      const keys = Object.keys(entry.properties);
      return keys.length === 1 ? keys[0] : null;
    })
    .filter((value) => typeof value === "string" && value.trim() !== "");
  if (derivedSelectionDistributionEnum.length > 0) {
    selectionDistributionEnum = derivedSelectionDistributionEnum;
  }

  const stringExprVariants =
    schema.$defs &&
    schema.$defs.StringExprInner &&
    Array.isArray(schema.$defs.StringExprInner.oneOf)
      ? schema.$defs.StringExprInner.oneOf
      : [];
  const derivedStringPatterns = stringExprVariants
    .map((entry) => {
      if (
        !entry ||
        typeof entry !== "object" ||
        !entry.properties ||
        typeof entry.properties !== "object"
      ) {
        return null;
      }
      const keys = Object.keys(entry.properties);
      return keys.length === 1 ? keys[0] : null;
    })
    .filter((value) => typeof value === "string" && value.trim() !== "");
  if (derivedStringPatterns.length > 0) {
    stringPatternEnum = derivedStringPatterns;
  }
}

// Keep the character-set dropdown aligned with schema enum values.
function populateCharacterSetOptions() {
  if (!formCharacterSet) {
    return;
  }

  const currentValue = formCharacterSet.value;
  const values = Array.isArray(characterSetEnum) ? characterSetEnum : [];

  formCharacterSet.innerHTML = "";
  const unsetOption = document.createElement("option");
  unsetOption.value = "";
  unsetOption.textContent = "(unset)";
  formCharacterSet.appendChild(unsetOption);

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    formCharacterSet.appendChild(option);
  });

  if (values.includes(currentValue)) {
    formCharacterSet.value = currentValue;
  } else {
    formCharacterSet.value = "";
  }
}

// Prefer historical default when present; otherwise use first schema enum value.
function getDefaultCharacterSetValue() {
  if (!Array.isArray(characterSetEnum) || characterSetEnum.length === 0) {
    return "";
  }
  if (characterSetEnum.includes("alphanumeric")) {
    return "alphanumeric";
  }
  return characterSetEnum[0];
}

function reportUiIssue(prefix, errorLike) {
  const message =
    prefix +
    ": " +
    (errorLike && errorLike.message
      ? errorLike.message
      : String(errorLike || "Unknown error"));
  console.error(message, errorLike);
  setValidationStatus(message, "invalid");
}

async function initApp() {
  schema = await loadInitialSchema();
  // Schema must be loaded before building controls/descriptions.
  deriveUiConfigFromSchema();
  populateCharacterSetOptions();

  try {
    applySchemaDescriptions();
  } catch (e) {
    reportUiIssue("Failed to apply schema descriptions", e);
  }
  try {
    buildOperationControls();
  } catch (e) {
    reportUiIssue("Failed to build operation controls", e);
  }
  try {
    resetFormInterface();
  } catch (e) {
    reportUiIssue("Failed to reset form interface", e);
  }

  if (typeof window.createWorkloadRunsController === "function" && runsList) {
    workloadRunsController = window.createWorkloadRunsController({
      runsListEl: runsList,
      onInfo: (message) => setValidationStatus(message, "valid"),
      onError: (message) => setValidationStatus(message, "invalid"),
      onBusyChange: (isBusy) => setRunButtonBusy(isBusy),
    });
  }

  if (workloadForm) {
    workloadForm.addEventListener("input", onFormChange);
    workloadForm.addEventListener("change", onFormChange);
  }
  if (downloadJsonBtn) {
    downloadJsonBtn.addEventListener("click", downloadGeneratedJson);
  }
  if (newWorkloadBtn) {
    newWorkloadBtn.addEventListener("click", resetFormInterface);
  }
  if (runWorkloadBtn) {
    runWorkloadBtn.addEventListener("click", handleRunWorkload);
  }
  if (assistantApplyBtn) {
    assistantApplyBtn.addEventListener("click", handleAssistantApply);
  }
  if (assistantClearBtn) {
    assistantClearBtn.addEventListener("click", () => {
      if (assistantInput) {
        assistantInput.value = "";
        assistantInput.focus();
      }
      clearAssistantThread();
      setAssistantStatus("Ready", "default");
    });
  }
  if (assistantInput) {
    assistantInput.addEventListener("keydown", (event) => {
      const isMeta = event.metaKey || event.ctrlKey;
      if (isMeta && event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        handleAssistantApply();
      }
    });
  }
  Array.prototype.forEach.call(presetButtons || [], (btn) => {
    if (btn) {
      btn.addEventListener("click", () =>
        applyPreset(btn.dataset.preset || ""),
      );
    }
  });
  document.addEventListener("keydown", (event) => {
    const isMeta = event.metaKey || event.ctrlKey;
    if (isMeta && event.key === "Enter") {
      event.preventDefault();
      if (validateBtn) {
        validateBtn.click();
      }
    }
    if (isMeta && event.shiftKey && (event.key === "c" || event.key === "C")) {
      event.preventDefault();
      if (copyBtn) {
        copyBtn.click();
      }
    }
  });

  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      const text = jsonOutput ? jsonOutput.value : "";
      if (!text) return;
      if (
        !navigator.clipboard ||
        typeof navigator.clipboard.writeText !== "function"
      ) {
        setValidationStatus(
          "Clipboard not available in this browser context.",
          "invalid",
        );
        return;
      }
      navigator.clipboard
        .writeText(text)
        .then(() => {
          copyBtn.textContent = "Copied!";
          setTimeout(() => {
            if (copyBtn) {
              copyBtn.textContent = "Copy";
            }
          }, 1500);
        })
        .catch((e) => reportUiIssue("Failed to copy JSON", e));
    });
  }

  if (validateBtn) {
    validateBtn.addEventListener("click", async () => {
      const jsonText = jsonOutput ? jsonOutput.value.trim() : "";
      if (!jsonText || !schema) {
        setValidationStatus("No JSON or schema to validate", "invalid");
        return;
      }
      try {
        const json = JSON.parse(jsonText);
        const { default: Ajv2020 } =
          await import("https://esm.sh/ajv@8.17.1/dist/2020?bundle");
        const ajv = new Ajv2020({
          allErrors: true,
          strict: false,
          validateFormats: false,
        });
        const validate = ajv.compile(schema);
        const valid = validate(toSchemaValidationShape(json, schema));
        if (valid) {
          setValidationStatus("Valid! JSON conforms to schema.", "valid");
        } else {
          const errors = (validate.errors || [])
            .map((e) => {
              const path = e.instancePath || "/";
              return (path + " " + e.message).trim();
            })
            .join(", ");
          setValidationStatus("Invalid: " + errors, "invalid");
        }
      } catch (e) {
        setValidationStatus("Parse error: " + e.message, "invalid");
      }
    });
  }
}

window.addEventListener("error", (event) => {
  reportUiIssue(
    "Unhandled runtime error",
    event && event.error
      ? event.error
      : event && event.message
        ? event.message
        : "Unknown error",
  );
});

window.addEventListener("unhandledrejection", (event) => {
  const reason =
    event && event.reason ? event.reason : "Unknown promise rejection";
  reportUiIssue("Unhandled promise rejection", reason);
});

initApp().catch((initError) => {
  reportUiIssue("UI init failed", initError);
  if (jsonOutput && !jsonOutput.value) {
    jsonOutput.value = "{}";
  }
});

function onFormChange(event) {
  const eventTarget = event && event.target ? event.target : null;
  markFieldAsUserLocked(eventTarget);
  clearAdvancedStateForFormEdit(eventTarget);
  if (
    eventTarget &&
    eventTarget.classList &&
    eventTarget.classList.contains("operation-toggle")
  ) {
    const op = eventTarget.value;
    const isEnabled = eventTarget.checked;
    setOperationCardVisibility(op, isEnabled);
    if (isEnabled) {
      ensureOperationDefaultsIfEmpty(op);
    }
  } else if (
    eventTarget &&
    eventTarget.dataset &&
    eventTarget.dataset.field === "selection_distribution"
  ) {
    refreshSelectionParamVisibility(eventTarget.dataset.op);
  } else if (
    eventTarget &&
    eventTarget.dataset &&
    (eventTarget.dataset.field === "key_pattern" ||
      eventTarget.dataset.field === "val_pattern")
  ) {
    refreshStringPatternVisibility(eventTarget.dataset.op);
  }
  updateJsonFromForm();
}

function clearAdvancedStateForFormEdit(eventTarget) {
  if (
    !eventTarget ||
    !eventTarget.dataset ||
    !eventTarget.dataset.op ||
    !eventTarget.dataset.field
  ) {
    return;
  }
  const op = eventTarget.dataset.op;
  const field = eventTarget.dataset.field;
  if (
    field === "op_count" ||
    field === "k" ||
    field === "l" ||
    field === "selectivity"
  ) {
    clearAdvancedFieldValue(op, field);
    return;
  }
  if (
    field === "selection_distribution" ||
    field === "selection_min" ||
    field === "selection_max" ||
    field === "selection_mean" ||
    field === "selection_std_dev" ||
    field === "selection_alpha" ||
    field === "selection_beta" ||
    field === "selection_n" ||
    field === "selection_s" ||
    field === "selection_lambda" ||
    field === "selection_scale" ||
    field === "selection_shape"
  ) {
    clearAdvancedFieldValue(op, "selection");
    return;
  }
  if (
    field === "key_pattern" ||
    field === "key_len" ||
    field === "key_hot_len" ||
    field === "key_hot_amount" ||
    field === "key_hot_probability"
  ) {
    clearAdvancedFieldValue(op, "key");
    return;
  }
  if (
    field === "val_pattern" ||
    field === "val_len" ||
    field === "val_hot_len" ||
    field === "val_hot_amount" ||
    field === "val_hot_probability"
  ) {
    clearAdvancedFieldValue(op, "val");
  }
}

function ensureLockedOperationFieldSet(op) {
  if (!lockedOperationFields.has(op)) {
    lockedOperationFields.set(op, new Set());
  }
  return lockedOperationFields.get(op);
}

function ensureOperationAdvancedEntry(op) {
  if (!operationAdvancedState.has(op)) {
    operationAdvancedState.set(op, {});
  }
  return operationAdvancedState.get(op);
}

function getAdvancedFieldValue(op, field) {
  const entry = operationAdvancedState.get(op);
  if (!entry || !Object.prototype.hasOwnProperty.call(entry, field)) {
    return null;
  }
  return entry[field];
}

function setAdvancedFieldValue(op, field, value) {
  const normalized = sanitizeTypedExpression(
    value,
    field === "selection"
      ? "distribution"
      : ["key", "val"].includes(field)
        ? "string_expr"
        : "number_expr",
  );
  const entry = ensureOperationAdvancedEntry(op);
  if (normalized === null) {
    delete entry[field];
  } else {
    entry[field] = normalized;
  }
  if (Object.keys(entry).length === 0) {
    operationAdvancedState.delete(op);
  }
  refreshAdvancedExpressionSummary(op);
}

function clearAdvancedFieldValue(op, field) {
  const entry = operationAdvancedState.get(op);
  if (!entry) {
    return;
  }
  delete entry[field];
  if (Object.keys(entry).length === 0) {
    operationAdvancedState.delete(op);
  }
  refreshAdvancedExpressionSummary(op);
}

function clearAllAdvancedFieldValues(op) {
  operationAdvancedState.delete(op);
  refreshAdvancedExpressionSummary(op);
}

function lockTopField(fieldName) {
  if (!fieldName) return;
  lockedTopFields.add(fieldName);
}

function lockOperationField(op, fieldName) {
  if (!op || !fieldName) return;
  const set = ensureLockedOperationFieldSet(op);
  set.add(fieldName);
}

function isTopFieldLocked(fieldName) {
  return lockedTopFields.has(fieldName);
}

function isOperationFieldLocked(op, fieldName) {
  const set = lockedOperationFields.get(op);
  return !!(set && set.has(fieldName));
}

function clearFieldLocks() {
  lockedTopFields.clear();
  lockedOperationFields.clear();
}

function markFieldAsUserLocked(eventTarget) {
  if (!eventTarget) {
    return;
  }
  if (eventTarget === formCharacterSet) {
    lockTopField("character_set");
    return;
  }
  if (eventTarget === formSections) {
    lockTopField("sections_count");
    return;
  }
  if (eventTarget === formGroups) {
    lockTopField("groups_per_section");
    return;
  }
  if (eventTarget === formSkipKeyContainsCheck) {
    lockTopField("skip_key_contains_check");
    return;
  }
  if (
    eventTarget.classList &&
    eventTarget.classList.contains("operation-toggle")
  ) {
    lockOperationField(eventTarget.value, "enabled");
    return;
  }
  if (
    eventTarget.dataset &&
    eventTarget.dataset.op &&
    eventTarget.dataset.field
  ) {
    lockOperationField(eventTarget.dataset.op, eventTarget.dataset.field);
  }
}

function getOperationToggle(op) {
  return operationToggles.querySelector(
    '.operation-toggle[value="' + op + '"]',
  );
}

function setOperationChecked(op, checked) {
  const toggle = getOperationToggle(op);
  if (!toggle) return;
  toggle.checked = checked;
  setOperationCardVisibility(op, checked);
  if (checked) {
    refreshSelectionParamVisibility(op);
    refreshStringPatternVisibility(op);
  }
}

function setOperationInputValue(op, field, value) {
  const selector = '[data-op="' + op + '"][data-field="' + field + '"]';
  const el = operationConfigContainer.querySelector(selector);
  if (!el) return;
  el.value = String(value);
}

function applyDefaultsToOperation(op) {
  clearAllAdvancedFieldValues(op);
  const defaults = OPERATION_DEFAULTS[op] || {};
  Object.entries(defaults).forEach(([field, value]) => {
    setOperationInputValue(op, field, value);
  });
  refreshSelectionParamVisibility(op);
  refreshStringPatternVisibility(op);
}

function ensureOperationDefaultsIfEmpty(op) {
  const defaults = OPERATION_DEFAULTS[op] || {};
  Object.entries(defaults).forEach(([field, value]) => {
    if (readOperationField(op, field) === "") {
      setOperationInputValue(op, field, value);
    }
  });
  refreshSelectionParamVisibility(op);
  refreshStringPatternVisibility(op);
}

function applyPreset(presetName) {
  resetFormInterface();
  formCharacterSet.value = getDefaultCharacterSetValue();
  formSections.value = "1";
  formGroups.value = "1";
  lockTopField("character_set");
  lockTopField("sections_count");
  lockTopField("groups_per_section");

  const presets = {
    insert_only: ["inserts"],
    read_heavy: ["point_queries", "range_queries"],
    mixed_crud: ["inserts", "updates", "point_queries", "point_deletes"],
    baseline: ["inserts", "point_queries"],
  };
  const ops = presets[presetName] || presets.baseline;

  operationOrder.forEach((op) => {
    const enabled = ops.includes(op);
    setOperationChecked(op, enabled);
    lockOperationField(op, "enabled");
    if (enabled) {
      applyDefaultsToOperation(op);
      Object.keys(OPERATION_DEFAULTS[op] || {}).forEach((fieldName) => {
        lockOperationField(op, fieldName);
      });
    }
  });

  if (presetName === "read_heavy") {
    setOperationInputValue("point_queries", "op_count", 700000);
    setOperationInputValue("range_queries", "op_count", 150000);
    lockOperationField("point_queries", "op_count");
    lockOperationField("range_queries", "op_count");
  }
  if (presetName === "mixed_crud") {
    setOperationInputValue("inserts", "op_count", 400000);
    setOperationInputValue("updates", "op_count", 300000);
    setOperationInputValue("point_queries", "op_count", 350000);
    setOperationInputValue("point_deletes", "op_count", 80000);
    lockOperationField("inserts", "op_count");
    lockOperationField("updates", "op_count");
    lockOperationField("point_queries", "op_count");
    lockOperationField("point_deletes", "op_count");
  }

  updateJsonFromForm();
}

function normalizeDescription(text) {
  if (typeof text !== "string") {
    return "";
  }
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\\r\\n|\\n|\\r/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n+ */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function resolveSchemaRef(ref) {
  if (typeof ref !== "string" || !ref.startsWith("#/")) {
    return null;
  }
  const parts = ref.slice(2).split("/");
  let node = schema;
  for (const part of parts) {
    if (!node || typeof node !== "object") {
      return null;
    }
    node = node[part];
  }
  return node || null;
}

function unwrapSchemaNode(node) {
  if (!node || typeof node !== "object") {
    return null;
  }
  if (node.$ref) {
    return resolveSchemaRef(node.$ref);
  }
  if (Array.isArray(node.anyOf)) {
    const refCandidate = node.anyOf.find(
      (entry) => entry && typeof entry === "object" && entry.$ref,
    );
    if (refCandidate) {
      return resolveSchemaRef(refCandidate.$ref);
    }
    const nonNull = node.anyOf.find((entry) => entry && entry.type !== "null");
    return nonNull || null;
  }
  return node;
}

function getTopLevelDescription(field) {
  if (!schema || !schema.properties || !schema.properties[field]) {
    return "";
  }
  return normalizeDescription(schema.properties[field].description);
}

function getSectionDescription(field) {
  if (
    !schema ||
    !schema.$defs ||
    !schema.$defs.WorkloadSpecSection ||
    !schema.$defs.WorkloadSpecSection.properties
  ) {
    return "";
  }
  const sectionField = schema.$defs.WorkloadSpecSection.properties[field];
  return normalizeDescription(sectionField && sectionField.description);
}

function getGroupOperationSchema(op) {
  if (
    !schema ||
    !schema.$defs ||
    !schema.$defs.WorkloadSpecGroup ||
    !schema.$defs.WorkloadSpecGroup.properties
  ) {
    return null;
  }
  const node = schema.$defs.WorkloadSpecGroup.properties[op];
  return unwrapSchemaNode(node);
}

function getOperationDescription(op) {
  const operationSchema = getGroupOperationSchema(op);
  return normalizeDescription(operationSchema && operationSchema.description);
}

function getOperationFieldDescription(op, field) {
  const opSchema = getGroupOperationSchema(op);
  if (!opSchema || !opSchema.properties || !opSchema.properties[field]) {
    return "";
  }
  return normalizeDescription(opSchema.properties[field].description);
}

function getStringUniformLengthDescription() {
  const variants =
    schema && schema.$defs && schema.$defs.StringExprInner
      ? schema.$defs.StringExprInner.oneOf
      : null;
  if (!Array.isArray(variants)) {
    return "";
  }
  const uniform = variants.find(
    (variant) => variant && variant.properties && variant.properties.uniform,
  );
  if (
    !uniform ||
    !uniform.properties ||
    !uniform.properties.uniform ||
    !uniform.properties.uniform.properties ||
    !uniform.properties.uniform.properties.len
  ) {
    return "";
  }
  return normalizeDescription(
    uniform.properties.uniform.properties.len.description,
  );
}

function getRangeFormatDescriptions() {
  const rangeFormat =
    schema && schema.$defs && schema.$defs.RangeFormat
      ? schema.$defs.RangeFormat.oneOf
      : null;
  if (!Array.isArray(rangeFormat)) {
    return {};
  }
  const byConst = {};
  rangeFormat.forEach((entry) => {
    if (entry && entry.const) {
      byConst[entry.const] = normalizeDescription(entry.description);
    }
  });
  return byConst;
}

// Range-format options are schema-derived with a stable fallback.
function getRangeFormatValues() {
  if (Array.isArray(rangeFormatEnum) && rangeFormatEnum.length > 0) {
    return rangeFormatEnum;
  }
  return ["StartCount", "StartEnd"];
}

function getSelectionDistributionValues() {
  if (
    Array.isArray(selectionDistributionEnum) &&
    selectionDistributionEnum.length > 0
  ) {
    return selectionDistributionEnum;
  }
  return [...DEFAULT_SELECTION_DISTRIBUTIONS];
}

function getStringPatternValues() {
  if (Array.isArray(stringPatternEnum) && stringPatternEnum.length > 0) {
    return stringPatternEnum;
  }
  return [...DEFAULT_STRING_PATTERNS];
}

function getSelectionParamsForDistribution(distributionName) {
  return (
    SELECTION_DISTRIBUTION_PARAMS[distributionName] ||
    SELECTION_DISTRIBUTION_PARAMS.uniform
  );
}

function combineDescriptions(parts) {
  const cleaned = (parts || []).map(normalizeDescription).filter(Boolean);
  return [...new Set(cleaned)].join(" ");
}

function getUiFieldDescription(op, field) {
  const stringLenDescription = getStringUniformLengthDescription();
  const selectionDescription = getOperationFieldDescription(op, "selection");
  if (field === "op_count") {
    return getOperationFieldDescription(op, "op_count");
  }
  if (field === "k") {
    return getOperationFieldDescription(op, "k");
  }
  if (field === "l") {
    return getOperationFieldDescription(op, "l");
  }
  if (field === "key_len") {
    return combineDescriptions([
      getOperationFieldDescription(op, "key"),
      stringLenDescription,
    ]);
  }
  if (field === "val_len") {
    return combineDescriptions([
      getOperationFieldDescription(op, "val"),
      stringLenDescription,
    ]);
  }
  if (field === "key_pattern") {
    return combineDescriptions([
      getOperationFieldDescription(op, "key"),
      "Pattern options: " + getStringPatternValues().join(", ") + ".",
    ]);
  }
  if (field === "val_pattern") {
    return combineDescriptions([
      getOperationFieldDescription(op, "val"),
      "Pattern options: " + getStringPatternValues().join(", ") + ".",
    ]);
  }
  if (field === "key_hot_len") {
    return combineDescriptions([
      getOperationFieldDescription(op, "key"),
      "Length for key hot_range pattern.",
    ]);
  }
  if (field === "key_hot_amount") {
    return combineDescriptions([
      getOperationFieldDescription(op, "key"),
      "Amount for key hot_range pattern.",
    ]);
  }
  if (field === "key_hot_probability") {
    return combineDescriptions([
      getOperationFieldDescription(op, "key"),
      "Probability for key hot_range pattern.",
    ]);
  }
  if (field === "val_hot_len") {
    return combineDescriptions([
      getOperationFieldDescription(op, "val"),
      "Length for value hot_range pattern.",
    ]);
  }
  if (field === "val_hot_amount") {
    return combineDescriptions([
      getOperationFieldDescription(op, "val"),
      "Amount for value hot_range pattern.",
    ]);
  }
  if (field === "val_hot_probability") {
    return combineDescriptions([
      getOperationFieldDescription(op, "val"),
      "Probability for value hot_range pattern.",
    ]);
  }
  if (field === "selection_distribution") {
    const optionsText = getSelectionDistributionValues().join(", ");
    return combineDescriptions([
      selectionDescription,
      "Distribution options: " + optionsText + ".",
    ]);
  }
  if (field === "selection_min") {
    return combineDescriptions([
      selectionDescription,
      "Uniform distribution minimum value.",
    ]);
  }
  if (field === "selection_max") {
    return combineDescriptions([
      selectionDescription,
      "Uniform distribution maximum value.",
    ]);
  }
  if (field === "selection_mean") {
    return combineDescriptions([
      selectionDescription,
      "Mean value for normal/log_normal distribution.",
    ]);
  }
  if (field === "selection_std_dev") {
    return combineDescriptions([
      selectionDescription,
      "Standard deviation for normal/log_normal distribution.",
    ]);
  }
  if (field === "selection_alpha") {
    return combineDescriptions([
      selectionDescription,
      "Alpha parameter for beta distribution.",
    ]);
  }
  if (field === "selection_beta") {
    return combineDescriptions([
      selectionDescription,
      "Beta parameter for beta distribution.",
    ]);
  }
  if (field === "selection_n") {
    return combineDescriptions([
      selectionDescription,
      "N parameter for zipf distribution.",
    ]);
  }
  if (field === "selection_s") {
    return combineDescriptions([
      selectionDescription,
      "S parameter for zipf distribution.",
    ]);
  }
  if (field === "selection_lambda") {
    return combineDescriptions([
      selectionDescription,
      "Lambda parameter for exponential/poisson distribution.",
    ]);
  }
  if (field === "selection_scale") {
    return combineDescriptions([
      selectionDescription,
      "Scale parameter for weibull/pareto distribution.",
    ]);
  }
  if (field === "selection_shape") {
    return combineDescriptions([
      selectionDescription,
      "Shape parameter for weibull/pareto distribution.",
    ]);
  }
  if (field === "selectivity") {
    return getOperationFieldDescription(op, "selectivity");
  }
  if (field === "range_format") {
    const rangeDescription = getOperationFieldDescription(op, "range_format");
    const formatDescriptions = getRangeFormatDescriptions();
    const optionHelp = Object.entries(formatDescriptions)
      .map(([name, desc]) => (desc ? name + ": " + desc : name))
      .join(" | ");
    return combineDescriptions([rangeDescription, optionHelp]);
  }
  return "";
}

function setDescriptionText(target, text) {
  if (!target) return;
  target.textContent = normalizeDescription(text);
}

function setInlineLabelWithHelp(target, labelText, description) {
  if (!target) return;
  target.textContent = "";
  target.classList.add("field-row");
  const text = document.createElement("span");
  text.textContent = labelText;
  target.appendChild(text);
  const dot = createHelpDot(description);
  if (dot) {
    target.appendChild(dot);
  }
}

function createHelpDot(description) {
  const cleaned = normalizeDescription(description);
  if (!cleaned) {
    return null;
  }
  const dot = document.createElement("span");
  dot.className = "help-dot";
  dot.textContent = "i";
  dot.title = cleaned;
  dot.setAttribute("aria-label", cleaned);
  return dot;
}

function appendTitleWithHelp(container, text, description) {
  const row = document.createElement("span");
  row.className = "field-row";
  const label = document.createElement("span");
  label.textContent = text;
  row.appendChild(label);
  const dot = createHelpDot(description);
  if (dot) {
    row.appendChild(dot);
  }
  container.appendChild(row);
}

function applySchemaDescriptions() {
  const characterSetHelp = getTopLevelDescription("character_set");
  const sectionsHelp = getTopLevelDescription("sections");
  const groupsHelp = getSectionDescription("groups");
  const skipKeyContainsHelp = getSectionDescription("skip_key_contains_check");

  setInlineLabelWithHelp(
    formCharacterSetLabel,
    "Character Set",
    characterSetHelp,
  );
  setInlineLabelWithHelp(formSectionsLabel, "Sections", sectionsHelp);
  setInlineLabelWithHelp(formGroupsLabel, "Groups / Section", groupsHelp);
  setInlineLabelWithHelp(
    skipKeyContainsCheckLabel,
    "Skip Key Contains Check",
    skipKeyContainsHelp,
  );
  setInlineLabelWithHelp(
    operationsTitle,
    "Operations",
    combineDescriptions([groupsHelp, "Select one or more operation blocks."]),
  );

  setDescriptionText(characterSetDescription, characterSetHelp);
  setDescriptionText(sectionsDescription, sectionsHelp);
  setDescriptionText(groupsDescription, groupsHelp);
  setDescriptionText(skipKeyContainsCheckDescription, skipKeyContainsHelp);
}

function buildOperationControls() {
  if (!operationToggles || !operationConfigContainer) {
    reportUiIssue(
      "Operation controls container missing",
      "operationToggles/operationConfigContainer not found",
    );
    return;
  }
  operationToggles.innerHTML = "";
  operationConfigContainer.innerHTML = "";
  operationOrder.forEach((op) => {
    const toggle = buildWithFallback(
      () => createOperationToggle(op),
      () => createOperationToggleFallback(op),
      "Failed to build operation toggle for " + op,
    );
    const card = buildWithFallback(
      () => createOperationConfigCard(op),
      () => createOperationConfigCardFallback(op),
      "Failed to build operation config for " + op,
    );
    if (toggle) {
      operationToggles.appendChild(toggle);
    }
    if (card) {
      operationConfigContainer.appendChild(card);
      refreshSelectionParamVisibility(op);
      refreshStringPatternVisibility(op);
    }
  });
}

function buildWithFallback(primaryBuilder, fallbackBuilder, errorPrefix) {
  try {
    return primaryBuilder();
  } catch (e) {
    reportUiIssue(errorPrefix, e);
    return fallbackBuilder();
  }
}

function getOperationLabel(op) {
  return operationLabels[op] || titleCaseFromSnake(op);
}

function createOperationToggleFallback(op) {
  return createOperationToggleCore(op, false);
}

function createOperationToggle(op) {
  return createOperationToggleCore(op, true);
}

function createOperationToggleCore(op, includeDescriptions) {
  const label = document.createElement("label");
  label.className = "checkbox-item";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.className = "operation-toggle";
  input.value = op;
  label.appendChild(input);

  const textWrap = document.createElement("span");
  textWrap.className = "checkbox-label-text";
  if (!includeDescriptions) {
    textWrap.textContent = getOperationLabel(op);
    label.appendChild(textWrap);
    return label;
  }

  const titleRow = document.createElement("span");
  titleRow.className = "field-row";
  const text = document.createElement("span");
  text.textContent = getOperationLabel(op);
  titleRow.appendChild(text);
  const opDescription = getOperationDescription(op);
  const helpDot = createHelpDot(opDescription);
  if (helpDot) {
    titleRow.appendChild(helpDot);
  }
  textWrap.appendChild(titleRow);
  if (opDescription) {
    const desc = document.createElement("small");
    desc.className = "field-description";
    desc.textContent = opDescription;
    textWrap.appendChild(desc);
  }
  label.appendChild(textWrap);
  return label;
}

function createOperationConfigCardFallback(op) {
  return createOperationConfigCardCore(op, false);
}

function createOperationConfigCard(op) {
  return createOperationConfigCardCore(op, true);
}

function createOperationConfigCardCore(op, includeDescriptions) {
  const defaults = OPERATION_DEFAULTS[op] || {};
  const card = document.createElement("section");
  card.className = "op-config hidden";
  card.id = getOperationCardId(op);

  const head = document.createElement("div");
  head.className = "op-config-head";
  const title = document.createElement("div");
  title.className = "op-config-title";
  title.textContent = getOperationLabel(op) + " settings";
  head.appendChild(title);
  const defaultsBtn = document.createElement("button");
  defaultsBtn.type = "button";
  defaultsBtn.className = "op-default-btn";
  defaultsBtn.textContent = "Apply defaults";
  defaultsBtn.addEventListener("click", () => {
    applyDefaultsToOperation(op);
    updateJsonFromForm();
  });
  head.appendChild(defaultsBtn);
  card.appendChild(head);

  const opDescription = includeDescriptions ? getOperationDescription(op) : "";
  if (opDescription) {
    const opDesc = document.createElement("p");
    opDesc.className = "field-description";
    opDesc.textContent = opDescription;
    card.appendChild(opDesc);
  }

  const rangeFormatDefaults = getRangeFormatValues();
  const grid = document.createElement("div");
  grid.className = "form-grid";
  if (formOpsWithOperationCharacterSet.has(op)) {
    grid.appendChild(
      createOperationCharacterSetField(
        op,
        defaults.character_set || "",
        includeDescriptions
          ? getOperationFieldDescription(op, "character_set")
          : "",
      ),
    );
  }
  if (formOpsWithOpCountFields.has(op)) {
    grid.appendChild(
      createNumberField(
        op,
        "op_count",
        "Op Count",
        includeDescriptions ? defaults.op_count : defaults.op_count || 500000,
        "1",
        "0",
        includeDescriptions ? getUiFieldDescription(op, "op_count") : "",
      ),
    );
  }
  if (formOpsWithSortedFields.has(op)) {
    grid.appendChild(
      createNumberField(
        op,
        "k",
        "k",
        includeDescriptions ? defaults.k : defaults.k || 100,
        "1",
        "1",
        includeDescriptions ? getUiFieldDescription(op, "k") : "",
      ),
    );
    grid.appendChild(
      createNumberField(
        op,
        "l",
        "l",
        includeDescriptions ? defaults.l : defaults.l || 1,
        "1",
        "1",
        includeDescriptions ? getUiFieldDescription(op, "l") : "",
      ),
    );
  }

  if (formOpsWithKeyFields.has(op)) {
    grid.appendChild(
      createStringPatternField(
        op,
        "key_pattern",
        "Key Pattern",
        defaults.key_pattern || STRING_PATTERN_DEFAULTS.key_pattern,
        includeDescriptions ? getUiFieldDescription(op, "key_pattern") : "",
      ),
    );
    const keyLenField = createNumberField(
      op,
      "key_len",
      "Key Length",
      includeDescriptions ? defaults.key_len : defaults.key_len || 20,
      "1",
      "1",
      includeDescriptions ? getUiFieldDescription(op, "key_len") : "",
    );
    keyLenField.classList.add("string-uniform-field");
    keyLenField.dataset.patternTarget = "key";
    grid.appendChild(keyLenField);
    grid.appendChild(
      createStringPatternHotField(
        op,
        "key_hot_len",
        "Key Hot Length",
        defaults.key_hot_len || STRING_PATTERN_DEFAULTS.key_hot_len,
        "1",
        "1",
        "key",
        includeDescriptions ? getUiFieldDescription(op, "key_hot_len") : "",
      ),
    );
    grid.appendChild(
      createStringPatternHotField(
        op,
        "key_hot_amount",
        "Key Hot Amount",
        defaults.key_hot_amount || STRING_PATTERN_DEFAULTS.key_hot_amount,
        "1",
        "0",
        "key",
        includeDescriptions ? getUiFieldDescription(op, "key_hot_amount") : "",
      ),
    );
    grid.appendChild(
      createStringPatternHotField(
        op,
        "key_hot_probability",
        "Key Hot Probability",
        defaults.key_hot_probability === undefined
          ? STRING_PATTERN_DEFAULTS.key_hot_probability
          : defaults.key_hot_probability,
        "any",
        "0",
        "key",
        includeDescriptions
          ? getUiFieldDescription(op, "key_hot_probability")
          : "",
      ),
    );
  }
  if (formOpsWithValueFields.has(op)) {
    grid.appendChild(
      createStringPatternField(
        op,
        "val_pattern",
        "Value Pattern",
        defaults.val_pattern || STRING_PATTERN_DEFAULTS.val_pattern,
        includeDescriptions ? getUiFieldDescription(op, "val_pattern") : "",
      ),
    );
    const valLenField = createNumberField(
      op,
      "val_len",
      "Value Length",
      includeDescriptions ? defaults.val_len : defaults.val_len || 256,
      "1",
      "1",
      includeDescriptions ? getUiFieldDescription(op, "val_len") : "",
    );
    valLenField.classList.add("string-uniform-field");
    valLenField.dataset.patternTarget = "val";
    grid.appendChild(valLenField);
    grid.appendChild(
      createStringPatternHotField(
        op,
        "val_hot_len",
        "Value Hot Length",
        defaults.val_hot_len || STRING_PATTERN_DEFAULTS.val_hot_len,
        "1",
        "1",
        "val",
        includeDescriptions ? getUiFieldDescription(op, "val_hot_len") : "",
      ),
    );
    grid.appendChild(
      createStringPatternHotField(
        op,
        "val_hot_amount",
        "Value Hot Amount",
        defaults.val_hot_amount || STRING_PATTERN_DEFAULTS.val_hot_amount,
        "1",
        "0",
        "val",
        includeDescriptions ? getUiFieldDescription(op, "val_hot_amount") : "",
      ),
    );
    grid.appendChild(
      createStringPatternHotField(
        op,
        "val_hot_probability",
        "Value Hot Probability",
        defaults.val_hot_probability === undefined
          ? STRING_PATTERN_DEFAULTS.val_hot_probability
          : defaults.val_hot_probability,
        "any",
        "0",
        "val",
        includeDescriptions
          ? getUiFieldDescription(op, "val_hot_probability")
          : "",
      ),
    );
  }
  if (formOpsWithSelectionFields.has(op)) {
    const selectionDistributionDefault =
      defaults.selection_distribution || "uniform";
    grid.appendChild(
      createSelectionDistributionField(
        op,
        selectionDistributionDefault,
        includeDescriptions
          ? getUiFieldDescription(op, "selection_distribution")
          : "",
      ),
    );
    Object.entries(SELECTION_PARAM_UI).forEach(([field, meta]) => {
      const fallbackDefault = SELECTION_PARAM_DEFAULTS[field];
      grid.appendChild(
        createSelectionParamField(
          op,
          field,
          meta.label,
          includeDescriptions ? defaults[field] : fallbackDefault,
          meta.step,
          meta.min,
          includeDescriptions ? getUiFieldDescription(op, field) : "",
        ),
      );
    });
  }
  if (formOpsWithRangeFields.has(op)) {
    const selectivityDefault =
      defaults.selectivity === undefined || defaults.selectivity === null
        ? 0.01
        : defaults.selectivity;
    grid.appendChild(
      createNumberField(
        op,
        "selectivity",
        "Selectivity",
        includeDescriptions ? defaults.selectivity : selectivityDefault,
        "any",
        "0",
        includeDescriptions ? getUiFieldDescription(op, "selectivity") : "",
      ),
    );
    grid.appendChild(
      createRangeFormatField(
        op,
        defaults.range_format || rangeFormatDefaults[0],
        includeDescriptions ? getUiFieldDescription(op, "range_format") : "",
      ),
    );
  }

  card.appendChild(grid);
  card.appendChild(createAdvancedSummaryContainer(op));
  if (formOpsWithSelectionFields.has(op)) {
    refreshSelectionParamVisibility(op);
  }
  refreshStringPatternVisibility(op);
  refreshAdvancedExpressionSummary(op);
  return card;
}

function createNumberField(
  op,
  field,
  labelText,
  placeholder,
  step,
  min,
  description = "",
) {
  const label = document.createElement("label");
  label.className = "field";
  const title = document.createElement("span");
  appendTitleWithHelp(title, labelText, description);
  const input = document.createElement("input");
  input.type = "number";
  input.dataset.op = op;
  input.dataset.field = field;
  input.placeholder = String(placeholder);
  input.step = step || "1";
  if (min !== null && min !== undefined) {
    input.min = String(min);
  }
  label.appendChild(title);
  label.appendChild(input);
  if (description) {
    const desc = document.createElement("small");
    desc.className = "field-description";
    desc.textContent = description;
    label.appendChild(desc);
  }
  return label;
}

function createOperationCharacterSetField(op, defaultValue, description = "") {
  const label = document.createElement("label");
  label.className = "field";
  const title = document.createElement("span");
  appendTitleWithHelp(title, "Operation Character Set", description);
  const select = document.createElement("select");
  select.dataset.op = op;
  select.dataset.field = "character_set";

  const unsetOption = document.createElement("option");
  unsetOption.value = "";
  unsetOption.textContent = "(inherit)";
  select.appendChild(unsetOption);

  characterSetEnum.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });

  select.value = defaultValue || "";
  label.appendChild(title);
  label.appendChild(select);
  if (description) {
    const desc = document.createElement("small");
    desc.className = "field-description";
    desc.textContent = description;
    label.appendChild(desc);
  }
  return label;
}

function createAdvancedSummaryContainer(op) {
  const container = document.createElement("div");
  container.className = "advanced-summary hidden";
  container.id = "advanced-summary-" + op;

  const title = document.createElement("div");
  title.className = "advanced-summary-title";
  title.textContent = "Advanced Assistant Expressions";
  container.appendChild(title);

  const list = document.createElement("div");
  list.className = "advanced-summary-list";
  list.dataset.op = op;
  container.appendChild(list);
  return container;
}

function createRangeFormatField(op, defaultValue, description = "") {
  const label = document.createElement("label");
  label.className = "field";
  const title = document.createElement("span");
  appendTitleWithHelp(title, "Range Format", description);
  const select = document.createElement("select");
  select.dataset.op = op;
  select.dataset.field = "range_format";

  getRangeFormatValues().forEach((rangeFormatValue) => {
    const option = document.createElement("option");
    option.value = rangeFormatValue;
    option.textContent = rangeFormatValue;
    select.appendChild(option);
  });

  select.value = defaultValue;
  label.appendChild(title);
  label.appendChild(select);
  if (description) {
    const desc = document.createElement("small");
    desc.className = "field-description";
    desc.textContent = description;
    label.appendChild(desc);
  }
  return label;
}

function createSelectionDistributionField(op, defaultValue, description = "") {
  const label = document.createElement("label");
  label.className = "field";
  const title = document.createElement("span");
  appendTitleWithHelp(title, "Selection Distribution", description);
  const select = document.createElement("select");
  select.dataset.op = op;
  select.dataset.field = "selection_distribution";

  getSelectionDistributionValues().forEach((distributionName) => {
    const option = document.createElement("option");
    option.value = distributionName;
    option.textContent = distributionName;
    select.appendChild(option);
  });

  select.value = defaultValue;
  label.appendChild(title);
  label.appendChild(select);
  if (description) {
    const desc = document.createElement("small");
    desc.className = "field-description";
    desc.textContent = description;
    label.appendChild(desc);
  }
  return label;
}

function createStringPatternField(
  op,
  field,
  labelText,
  defaultValue,
  description = "",
) {
  const label = document.createElement("label");
  label.className = "field string-pattern-selector";
  label.dataset.patternTarget = field === "key_pattern" ? "key" : "val";
  const title = document.createElement("span");
  appendTitleWithHelp(title, labelText, description);
  const select = document.createElement("select");
  select.dataset.op = op;
  select.dataset.field = field;

  getStringPatternValues().forEach((patternName) => {
    const option = document.createElement("option");
    option.value = patternName;
    option.textContent = patternName;
    select.appendChild(option);
  });

  select.value = defaultValue;
  label.appendChild(title);
  label.appendChild(select);
  if (description) {
    const desc = document.createElement("small");
    desc.className = "field-description";
    desc.textContent = description;
    label.appendChild(desc);
  }
  return label;
}

function createStringPatternHotField(
  op,
  field,
  labelText,
  placeholder,
  step,
  min,
  target,
  description = "",
) {
  const label = createNumberField(
    op,
    field,
    labelText,
    placeholder,
    step,
    min,
    description,
  );
  label.classList.add("string-hot-field");
  label.dataset.patternTarget = target;
  return label;
}

function createSelectionParamField(
  op,
  field,
  labelText,
  placeholder,
  step,
  min,
  description = "",
) {
  const label = createNumberField(
    op,
    field,
    labelText,
    placeholder,
    step,
    min,
    description,
  );
  label.classList.add("selection-param-field");
  label.dataset.op = op;
  label.dataset.selectionField = field;
  return label;
}

function refreshSelectionParamVisibility(op) {
  if (!formOpsWithSelectionFields.has(op)) {
    return;
  }
  const validValues = getSelectionDistributionValues();
  let distributionName =
    readOperationField(op, "selection_distribution") || "uniform";
  if (!validValues.includes(distributionName)) {
    distributionName = validValues[0] || "uniform";
    setOperationInputValue(op, "selection_distribution", distributionName);
  }
  const visibleFields = new Set(
    getSelectionParamsForDistribution(distributionName),
  );

  Object.keys(SELECTION_PARAM_UI).forEach((fieldName) => {
    const input = operationConfigContainer.querySelector(
      '[data-op="' + op + '"][data-field="' + fieldName + '"]',
    );
    if (!input) {
      return;
    }
    const fieldContainer = input.closest(".field");
    if (!fieldContainer) {
      return;
    }
    const isVisible = visibleFields.has(fieldName);
    fieldContainer.classList.toggle("hidden", !isVisible);
    if (isVisible && input.value === "") {
      const defaultValue = SELECTION_PARAM_DEFAULTS[fieldName];
      if (defaultValue !== undefined && defaultValue !== null) {
        input.value = String(defaultValue);
      }
    }
  });
}

function refreshStringPatternVisibility(op) {
  const patternValues = getStringPatternValues();
  ["key", "val"].forEach((target) => {
    const supportsTarget =
      target === "key"
        ? formOpsWithKeyFields.has(op)
        : formOpsWithValueFields.has(op);
    if (!supportsTarget) {
      return;
    }

    const patternField = target === "key" ? "key_pattern" : "val_pattern";
    const uniformLenField = target === "key" ? "key_len" : "val_len";
    const hotLenField = target === "key" ? "key_hot_len" : "val_hot_len";
    const hotAmountField =
      target === "key" ? "key_hot_amount" : "val_hot_amount";
    const hotProbabilityField =
      target === "key" ? "key_hot_probability" : "val_hot_probability";

    let patternName =
      readOperationField(op, patternField) ||
      STRING_PATTERN_DEFAULTS[patternField] ||
      "uniform";
    if (!patternValues.includes(patternName)) {
      patternName = patternValues[0] || "uniform";
      setOperationInputValue(op, patternField, patternName);
    }

    const showUniformLen = patternName === "uniform";
    const showHotFields = patternName === "hot_range";

    const uniformLenInput = operationConfigContainer.querySelector(
      '[data-op="' + op + '"][data-field="' + uniformLenField + '"]',
    );
    if (uniformLenInput && uniformLenInput.closest(".field")) {
      uniformLenInput
        .closest(".field")
        .classList.toggle("hidden", !showUniformLen);
      if (showUniformLen && uniformLenInput.value === "") {
        const fallbackLen =
          target === "key"
            ? (OPERATION_DEFAULTS[op] && OPERATION_DEFAULTS[op].key_len) || 20
            : (OPERATION_DEFAULTS[op] && OPERATION_DEFAULTS[op].val_len) || 256;
        uniformLenInput.value = String(fallbackLen);
      }
    }

    [hotLenField, hotAmountField, hotProbabilityField].forEach((fieldName) => {
      const input = operationConfigContainer.querySelector(
        '[data-op="' + op + '"][data-field="' + fieldName + '"]',
      );
      if (!input || !input.closest(".field")) {
        return;
      }
      input.closest(".field").classList.toggle("hidden", !showHotFields);
      if (showHotFields && input.value === "") {
        const defaultValue = STRING_PATTERN_DEFAULTS[fieldName];
        if (defaultValue !== undefined) {
          input.value = String(defaultValue);
        }
      }
    });
  });
}

function getOperationCardId(op) {
  return "op-config-" + op;
}

function setOperationCardVisibility(op, isVisible) {
  const card = document.getElementById(getOperationCardId(op));
  if (!card) return;
  card.classList.toggle("hidden", !isVisible);
}

function getSelectedOperations() {
  const selected = [];
  const toggles = operationToggles.querySelectorAll(".operation-toggle");
  toggles.forEach((el) => {
    if (el.checked) {
      selected.push(el.value);
    }
  });
  return selected;
}

function parsePositiveInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const asInt = Math.floor(n);
  return asInt > 0 ? asInt : null;
}

function numberOrDefault(value, fallback) {
  if (value === "" || value === null || value === undefined) {
    return fallback;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function intOrDefault(value, fallback) {
  const n = parsePositiveInt(value);
  return n || fallback;
}

function nonNegativeIntOrDefault(value, fallback) {
  if (value === "" || value === null || value === undefined) {
    return fallback;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.max(0, Math.floor(numeric));
}

function readOperationField(op, field) {
  const selector = '[data-op="' + op + '"][data-field="' + field + '"]';
  const el = operationConfigContainer.querySelector(selector);
  return el ? el.value : "";
}

function buildUniformStringExpr(len, characterSet) {
  const uniform = { len };
  if (characterSet) {
    uniform.character_set = characterSet;
  }
  return { uniform };
}

function probabilityOrDefault(value, fallback) {
  const numeric = numberOrDefault(value, fallback);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  if (numeric < 0) {
    return 0;
  }
  if (numeric > 1) {
    return 1;
  }
  return numeric;
}

function sanitizeParsedExpression(value) {
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
  if (Array.isArray(value)) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return null;
    }
  }
  if (typeof value === "object") {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return null;
    }
  }
  return null;
}

function isExpressionObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function sanitizeTypedExpression(value, kind) {
  const parsed = sanitizeParsedExpression(value);
  if (parsed === null) {
    return null;
  }
  if (kind === "number_expr") {
    return typeof parsed === "number" || isExpressionObject(parsed)
      ? parsed
      : null;
  }
  if (kind === "distribution") {
    return isExpressionObject(parsed) ? parsed : null;
  }
  if (kind === "string_expr") {
    return typeof parsed === "string" || isExpressionObject(parsed)
      ? parsed
      : null;
  }
  return null;
}

function formatExpressionSummary(value) {
  if (typeof value === "string") {
    return '"' + value + '"';
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (!isExpressionObject(value)) {
    return "configured";
  }
  const keys = Object.keys(value);
  if (keys.length !== 1) {
    return "configured";
  }
  const variant = keys[0];
  const inner = value[variant];
  if (!isExpressionObject(inner)) {
    return variant;
  }
  const params = Object.entries(inner)
    .map(([key, paramValue]) => {
      if (Array.isArray(paramValue)) {
        return key + ":" + paramValue.length;
      }
      if (isExpressionObject(paramValue)) {
        const nestedKeys = Object.keys(paramValue);
        return key + ":" + (nestedKeys[0] || "object");
      }
      return key + ":" + String(paramValue);
    })
    .join(", ");
  return variant + (params ? " (" + params + ")" : "");
}

function refreshAdvancedExpressionSummary(op) {
  const container = document.getElementById("advanced-summary-" + op);
  if (!container) {
    return;
  }
  const list = container.querySelector(".advanced-summary-list");
  if (!list) {
    return;
  }
  list.innerHTML = "";
  const entry = operationAdvancedState.get(op) || {};
  const activeFields = ADVANCED_OPERATION_FIELDS.filter((field) =>
    Object.prototype.hasOwnProperty.call(entry, field),
  );
  if (activeFields.length === 0) {
    container.classList.add("hidden");
    return;
  }
  activeFields.forEach((field) => {
    const item = document.createElement("div");
    item.className = "advanced-summary-item";

    const text = document.createElement("div");
    text.className = "advanced-summary-text";
    text.textContent =
      titleCaseFromSnake(field) + ": " + formatExpressionSummary(entry[field]);
    item.appendChild(text);

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "advanced-summary-clear";
    clearBtn.textContent = "Clear";
    clearBtn.addEventListener("click", () => {
      clearAdvancedFieldValue(op, field);
      updateJsonFromForm();
    });
    item.appendChild(clearBtn);

    list.appendChild(item);
  });
  container.classList.remove("hidden");
}

function buildStringExprFromForm(op, target, characterSet, defaults) {
  const rawExpression = sanitizeTypedExpression(
    getAdvancedFieldValue(op, target),
    "string_expr",
  );
  if (rawExpression !== null) {
    return rawExpression;
  }

  const isKey = target === "key";
  const patternField = isKey ? "key_pattern" : "val_pattern";
  const lenField = isKey ? "key_len" : "val_len";
  const hotLenField = isKey ? "key_hot_len" : "val_hot_len";
  const hotAmountField = isKey ? "key_hot_amount" : "val_hot_amount";
  const hotProbabilityField = isKey
    ? "key_hot_probability"
    : "val_hot_probability";
  const defaultLen = isKey ? defaults.key_len || 20 : defaults.val_len || 256;
  const validPatterns = getStringPatternValues();
  let patternName =
    readOperationField(op, patternField) ||
    defaults[patternField] ||
    STRING_PATTERN_DEFAULTS[patternField] ||
    "uniform";
  if (!validPatterns.includes(patternName)) {
    patternName = validPatterns[0] || "uniform";
  }

  if (patternName === "hot_range") {
    const hotLenDefault =
      defaults[hotLenField] === undefined
        ? STRING_PATTERN_DEFAULTS[hotLenField]
        : defaults[hotLenField];
    const hotAmountDefault =
      defaults[hotAmountField] === undefined
        ? STRING_PATTERN_DEFAULTS[hotAmountField]
        : defaults[hotAmountField];
    const hotProbabilityDefault =
      defaults[hotProbabilityField] === undefined
        ? STRING_PATTERN_DEFAULTS[hotProbabilityField]
        : defaults[hotProbabilityField];
    return {
      hot_range: {
        len: intOrDefault(readOperationField(op, hotLenField), hotLenDefault),
        amount: nonNegativeIntOrDefault(
          readOperationField(op, hotAmountField),
          hotAmountDefault,
        ),
        probability: probabilityOrDefault(
          readOperationField(op, hotProbabilityField),
          hotProbabilityDefault,
        ),
      },
    };
  }

  if (patternName === "weighted") {
    const weightedValue = buildUniformStringExpr(
      intOrDefault(readOperationField(op, lenField), defaultLen),
      characterSet,
    );
    return {
      weighted: [
        {
          weight: 1,
          value: weightedValue,
        },
      ],
    };
  }

  if (patternName === "segmented") {
    const segmentValue = buildUniformStringExpr(
      intOrDefault(readOperationField(op, lenField), defaultLen),
      characterSet,
    );
    return {
      segmented: {
        separator: "-",
        segments: [segmentValue],
      },
    };
  }

  return buildUniformStringExpr(
    intOrDefault(readOperationField(op, lenField), defaultLen),
    characterSet,
  );
}

function buildNumberExprFromForm(op, field, fallback) {
  const rawExpression = sanitizeTypedExpression(
    getAdvancedFieldValue(op, field),
    "number_expr",
  );
  if (rawExpression !== null) {
    return rawExpression;
  }
  return numberOrDefault(readOperationField(op, field), fallback);
}

function buildSelectionDistributionSpec(op, defaults) {
  const rawExpression = sanitizeTypedExpression(
    getAdvancedFieldValue(op, "selection"),
    "distribution",
  );
  if (rawExpression !== null) {
    return rawExpression;
  }

  let distributionName =
    readOperationField(op, "selection_distribution") ||
    defaults.selection_distribution ||
    "uniform";
  const validValues = getSelectionDistributionValues();
  if (!validValues.includes(distributionName)) {
    distributionName = validValues[0] || "uniform";
  }
  const distributionParamKeys =
    getSelectionParamsForDistribution(distributionName);
  const params = {};

  distributionParamKeys.forEach((fieldName) => {
    const defaultValue =
      defaults[fieldName] === undefined || defaults[fieldName] === null
        ? SELECTION_PARAM_DEFAULTS[fieldName]
        : defaults[fieldName];
    if (fieldName === "selection_n") {
      params.n = intOrDefault(
        readOperationField(op, fieldName),
        defaultValue || 1,
      );
      return;
    }
    const paramKey = fieldName.replace(/^selection_/, "");
    params[paramKey] = numberOrDefault(
      readOperationField(op, fieldName),
      defaultValue,
    );
  });

  return { [distributionName]: params };
}

function buildOperationSpec(op, characterSet) {
  const defaults = OPERATION_DEFAULTS[op] || {};
  const config = {};
  const operationCharacterSet = readOperationField(op, "character_set") || "";
  const effectiveCharacterSet = operationCharacterSet || characterSet || null;

  if (operationCharacterSet) {
    config.character_set = operationCharacterSet;
  }

  if (formOpsWithOpCountFields.has(op)) {
    config.op_count = buildNumberExprFromForm(
      op,
      "op_count",
      defaults.op_count || 500000,
    );
  }

  if (formOpsWithSortedFields.has(op)) {
    config.k = buildNumberExprFromForm(
      op,
      "k",
      defaults.k === undefined ? 100 : defaults.k,
    );
    config.l = buildNumberExprFromForm(
      op,
      "l",
      defaults.l === undefined ? 1 : defaults.l,
    );
  }

  if (formOpsWithKeyFields.has(op)) {
    config.key = buildStringExprFromForm(
      op,
      "key",
      effectiveCharacterSet,
      defaults,
    );
  }

  if (formOpsWithValueFields.has(op)) {
    config.val = buildStringExprFromForm(
      op,
      "val",
      effectiveCharacterSet,
      defaults,
    );
  }

  if (formOpsWithSelectionFields.has(op)) {
    config.selection = buildSelectionDistributionSpec(op, defaults);
  }

  if (formOpsWithRangeFields.has(op)) {
    const selectivityDefault =
      defaults.selectivity === undefined || defaults.selectivity === null
        ? 0.01
        : defaults.selectivity;
    const rangeFormatDefaults = getRangeFormatValues();
    config.selectivity = buildNumberExprFromForm(
      op,
      "selectivity",
      selectivityDefault,
    );
    config.range_format =
      readOperationField(op, "range_format") ||
      defaults.range_format ||
      rangeFormatDefaults[0];
  }

  return config;
}

function buildJsonFromForm() {
  const json = {};
  const characterSet = formCharacterSet.value.trim();
  const skipKeyContainsCheck = !!(
    formSkipKeyContainsCheck && formSkipKeyContainsCheck.checked
  );
  if (characterSet) {
    json.character_set = characterSet;
  }

  const selectedOps = getSelectedOperations();
  const hasSectionInput =
    formSections.value.trim() !== "" || formGroups.value.trim() !== "";
  if (!selectedOps.length && !hasSectionInput) {
    return json;
  }

  const sectionsCount = parsePositiveInt(formSections.value) || 1;
  const groupsCount = parsePositiveInt(formGroups.value) || 1;
  const sections = [];

  for (let i = 0; i < sectionsCount; i += 1) {
    const section = { groups: [] };
    if (characterSet) {
      section.character_set = characterSet;
    }
    if (skipKeyContainsCheck) {
      section.skip_key_contains_check = true;
    }

    for (let g = 0; g < groupsCount; g += 1) {
      const group = {};
      if (characterSet) {
        group.character_set = characterSet;
      }

      selectedOps.forEach((op) => {
        group[op] = buildOperationSpec(op, characterSet);
      });

      section.groups.push(group);
    }
    sections.push(section);
  }

  json.sections = sections;
  return json;
}

function renderGeneratedJson(json) {
  jsonOutput.value = JSON.stringify(json, null, 2);
  jsonOutput.style.display = "block";
}

function safeTextSizeBytes(text) {
  return new Blob([text]).size;
}

function formatCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return new Intl.NumberFormat("en-US").format(n);
}

function updateInteractiveStats(json) {
  const hasSections = json && Array.isArray(json.sections);
  const sectionsCount = hasSections ? json.sections.length : 0;
  const firstSection =
    hasSections && sectionsCount > 0 ? json.sections[0] : null;
  const groupsCount =
    firstSection && Array.isArray(firstSection.groups)
      ? firstSection.groups.length
      : 0;
  const selectedOps = getSelectedOperations();
  const lines = jsonOutput.value ? jsonOutput.value.split("\n").length : 1;
  const bytes = safeTextSizeBytes(jsonOutput.value || "{}");

  hudSections.textContent = formatCount(sectionsCount);
  hudGroups.textContent = formatCount(groupsCount);
  hudOps.textContent = formatCount(selectedOps.length);
  hudLines.textContent = formatCount(lines);

  jsonSectionsPill.textContent = "sections: " + formatCount(sectionsCount);
  jsonOpsPill.textContent = "ops: " + formatCount(selectedOps.length);
  jsonBytesPill.textContent = "bytes: " + formatCount(bytes);
}

function updateJsonFromForm() {
  const generated = buildJsonFromForm();
  renderGeneratedJson(generated);
  updateInteractiveStats(generated);
  validationResult.className = "validation-result";
  validationResult.textContent = "";
}

function clearAssistantThread() {
  assistantConversation.length = 0;
  assistantClarificationIndex.clear();
  Object.keys(assistantAnswerStore).forEach(
    (key) => delete assistantAnswerStore[key],
  );
  assistantGateMessage = "";
  if (assistantTimeline) {
    assistantTimeline.innerHTML = "";
  }
  setAssistantComposerHint(
    "Answer required clarifications to continue the thread.",
  );
}

function setAssistantStatus(text, tone) {
  if (!assistantStatus) {
    return;
  }
  assistantStatus.textContent = text || "Ready";
  assistantStatus.className = "assistant-status";
  if (tone === "loading") {
    assistantStatus.classList.add("loading");
  } else if (tone === "error") {
    assistantStatus.classList.add("error");
  } else if (tone === "warn") {
    assistantStatus.classList.add("warn");
  }
}

function setAssistantBusy(isBusy) {
  if (assistantApplyBtn) {
    assistantApplyBtn.disabled = !!isBusy;
    assistantApplyBtn.textContent = isBusy ? "Applying..." : "Apply";
  }
  if (assistantClearBtn) {
    assistantClearBtn.disabled = !!isBusy;
  }
  if (assistantInput) {
    assistantInput.disabled = !!isBusy;
  }
}

function setRunButtonBusy(isBusy) {
  if (!runWorkloadBtn) {
    return;
  }
  runWorkloadBtn.disabled = !!isBusy;
  runWorkloadBtn.textContent = isBusy ? "Running..." : "Run Workload";
}

function setAssistantComposerHint(text) {
  if (!assistantComposerHint) {
    return;
  }
  assistantComposerHint.textContent = text || "";
}

function createTurnId() {
  return (
    "turn-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 7)
  );
}

function normalizeAssistantClarification(entry) {
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
    ? entry.options.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const validation =
    entry.validation && typeof entry.validation === "object"
      ? entry.validation
      : null;
  if (options.length === 0) {
    if (type === "top_field" && binding.field === "character_set") {
      options = [...characterSetEnum];
    } else if (
      type === "operation_field" &&
      binding.field === "character_set"
    ) {
      options = [...characterSetEnum];
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
    } else if (type === "operation_field" && binding.field === "range_format") {
      options = getRangeFormatValues();
    } else if (type === "operations_set") {
      options = [...operationOrder];
    }
  }

  return {
    id,
    text,
    required: entry.required === true,
    binding,
    input: ["number", "enum", "multi_enum", "boolean", "text"].includes(
      inputType,
    )
      ? inputType
      : "text",
    options,
    validation,
    default_behavior:
      typeof entry.default_behavior === "string"
        ? entry.default_behavior
        : "use_default",
  };
}

function normalizeAssistantAssumption(entry, index) {
  if (typeof entry === "string") {
    const text = entry.trim();
    return text
      ? {
          id: "assume-" + index,
          text,
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
    text,
    field_ref:
      typeof entry.field_ref === "string" ? entry.field_ref.trim() : null,
    reason:
      typeof entry.reason === "string"
        ? entry.reason.trim()
        : "default_applied",
    applied_value: entry.applied_value,
  };
}

function normalizeAssistantResponse(result) {
  const summary =
    typeof result.summary === "string" && result.summary.trim()
      ? result.summary.trim()
      : "Applied your request to the form.";
  let clarifications = Array.isArray(result.clarifications)
    ? result.clarifications
        .map((entry) => normalizeAssistantClarification(entry))
        .filter(Boolean)
    : [];
  if (clarifications.length === 0 && Array.isArray(result.questions)) {
    clarifications = result.questions
      .map((questionText, index) =>
        normalizeAssistantClarification({
          id: "question-" + index,
          text: String(questionText || "").trim(),
          required: false,
          binding: { type: "operations_set" },
          input: "multi_enum",
          options: [...operationOrder],
        }),
      )
      .filter(Boolean);
  }
  const assumptions = Array.isArray(result.assumptions)
    ? result.assumptions
        .map((entry, index) => normalizeAssistantAssumption(entry, index))
        .filter(Boolean)
    : [];
  if (assumptions.length === 0 && Array.isArray(result.assumption_texts)) {
    result.assumption_texts.forEach((text, index) => {
      const normalized = normalizeAssistantAssumption(
        String(text || ""),
        index,
      );
      if (normalized) {
        assumptions.push(normalized);
      }
    });
  }
  const warnings = Array.isArray(result.warnings)
    ? result.warnings.map((entry) => String(entry || "").trim()).filter(Boolean)
    : [];
  return {
    summary,
    clarifications,
    assumptions,
    warnings,
    source: typeof result.source === "string" ? result.source : "unknown",
  };
}

function addAssistantTimelineTurn(turn) {
  assistantConversation.push(turn);
  while (assistantConversation.length > 80) {
    assistantConversation.shift();
  }
  renderAssistantTimeline();
}

function pruneAssistantAnswerStore() {
  const validClarificationIds = new Set(assistantClarificationIndex.keys());
  Object.keys(assistantAnswerStore).forEach((answerId) => {
    if (!validClarificationIds.has(answerId)) {
      delete assistantAnswerStore[answerId];
    }
  });
}

function getAnswersForRequest() {
  pruneAssistantAnswerStore();
  const filtered = {};
  Object.entries(assistantAnswerStore).forEach(([key, value]) => {
    if (!assistantClarificationIndex.has(key)) {
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
    return [...available];
  }
  const capability =
    typeof binding.capability === "string" ? binding.capability : "";
  if (!capability || capability === "all") {
    return [...available];
  }
  return available.filter((op) => {
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

function getClarificationCurrentValue(clarification) {
  if (!clarification || !clarification.binding) {
    return null;
  }
  if (
    Object.prototype.hasOwnProperty.call(assistantAnswerStore, clarification.id)
  ) {
    return assistantAnswerStore[clarification.id];
  }
  const binding = clarification.binding;
  if (binding.type === "top_field") {
    if (binding.field === "character_set") {
      return formCharacterSet ? formCharacterSet.value : "";
    }
    if (binding.field === "sections_count") {
      return formSections ? formSections.value : "";
    }
    if (binding.field === "groups_per_section") {
      return formGroups ? formGroups.value : "";
    }
    if (binding.field === "skip_key_contains_check") {
      return !!(formSkipKeyContainsCheck && formSkipKeyContainsCheck.checked);
    }
  }
  if (
    binding.type === "operation_field" &&
    typeof binding.operation === "string"
  ) {
    if (binding.field === "enabled") {
      const toggle = getOperationToggle(binding.operation);
      return !!(toggle && toggle.checked);
    }
    return readOperationField(binding.operation, binding.field);
  }
  if (binding.type === "operations_set") {
    const selected = getSelectedOperations();
    return selected.filter((op) =>
      getOperationsForSelectionBinding(binding, clarification).includes(op),
    );
  }
  return null;
}

function parseInputValueByType(inputEl, clarification) {
  if (!inputEl || !clarification) {
    return null;
  }
  const inputType = clarification.input;
  if (inputType === "multi_enum") {
    if (!(inputEl instanceof HTMLSelectElement)) {
      return [];
    }
    return Array.from(inputEl.selectedOptions || [])
      .map((opt) => String(opt.value || "").trim())
      .filter(Boolean);
  }
  if (inputType === "boolean") {
    if (inputEl.value === "true") return true;
    if (inputEl.value === "false") return false;
    return null;
  }
  if (inputType === "number") {
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
      return { valid: false, message: "Choose one of the allowed options." };
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
      values.some((item) => !clarification.options.includes(item))
    ) {
      return { valid: false, message: "Selected operation is not allowed." };
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

function applyClarificationAnswerToForm(clarification, value) {
  if (!clarification || !clarification.binding || !hasAnswerValue(value)) {
    return;
  }
  const binding = clarification.binding;

  if (binding.type === "top_field") {
    if (
      binding.field === "character_set" &&
      typeof value === "string" &&
      formCharacterSet
    ) {
      const values = Array.from(formCharacterSet.options || []).map(
        (option) => option.value,
      );
      if (values.includes(value)) {
        formCharacterSet.value = value;
        lockTopField("character_set");
      }
    } else if (binding.field === "sections_count" && formSections) {
      const numeric = Math.floor(Number(value));
      if (Number.isFinite(numeric) && numeric > 0) {
        formSections.value = String(numeric);
        lockTopField("sections_count");
      }
    } else if (binding.field === "groups_per_section" && formGroups) {
      const numeric = Math.floor(Number(value));
      if (Number.isFinite(numeric) && numeric > 0) {
        formGroups.value = String(numeric);
        lockTopField("groups_per_section");
      }
    } else if (
      binding.field === "skip_key_contains_check" &&
      formSkipKeyContainsCheck
    ) {
      formSkipKeyContainsCheck.checked = value === true;
      lockTopField("skip_key_contains_check");
    }
    updateJsonFromForm();
    return;
  }

  if (binding.type === "operations_set") {
    const selected = Array.isArray(value) ? value : [];
    const allowed = new Set(
      getOperationsForSelectionBinding(binding, clarification),
    );
    allowed.forEach((op) => {
      setOperationChecked(op, selected.includes(op));
      lockOperationField(op, "enabled");
      if (selected.includes(op)) {
        ensureOperationDefaultsIfEmpty(op);
      }
    });
    updateJsonFromForm();
    return;
  }

  if (
    binding.type === "operation_field" &&
    typeof binding.operation === "string" &&
    operationOrder.includes(binding.operation)
  ) {
    const op = binding.operation;
    const field = binding.field;
    if (field === "enabled") {
      setOperationChecked(op, value === true);
      lockOperationField(op, "enabled");
      if (value === true) {
        ensureOperationDefaultsIfEmpty(op);
      }
      updateJsonFromForm();
      return;
    }

    setOperationChecked(op, true);
    ensureOperationDefaultsIfEmpty(op);

    if (field === "selection_distribution") {
      const options = getSelectionDistributionValues();
      if (typeof value === "string" && options.includes(value)) {
        setOperationInputValue(op, field, value);
        refreshSelectionParamVisibility(op);
        lockOperationField(op, field);
      }
      updateJsonFromForm();
      return;
    }

    if (field === "character_set") {
      const options = [""].concat(characterSetEnum);
      if (typeof value === "string" && options.includes(value)) {
        setOperationInputValue(op, field, value);
        lockOperationField(op, field);
      }
      updateJsonFromForm();
      return;
    }

    if (field === "key_pattern" || field === "val_pattern") {
      const options = getStringPatternValues();
      if (typeof value === "string" && options.includes(value)) {
        setOperationInputValue(op, field, value);
        refreshStringPatternVisibility(op);
        lockOperationField(op, field);
      }
      updateJsonFromForm();
      return;
    }

    if (field === "range_format") {
      const options = getRangeFormatValues();
      if (typeof value === "string" && options.includes(value)) {
        setOperationInputValue(op, field, value);
        lockOperationField(op, field);
      }
      updateJsonFromForm();
      return;
    }

    if (field === "key" || field === "val" || field === "selection") {
      updateJsonFromForm();
      return;
    }

    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      setOperationInputValue(op, field, numericValue);
      lockOperationField(op, field);
    }
    if (field.startsWith("selection_")) {
      refreshSelectionParamVisibility(op);
    }
    updateJsonFromForm();
  }
}

function validateAndRenderClarificationState() {
  const unresolved = [];
  assistantClarificationIndex.forEach((entry, clarificationId) => {
    const value = assistantAnswerStore[clarificationId];
    const validation = validateClarificationAnswer(entry.clarification, value);
    const hasValue = hasAnswerValue(value);
    const isResolved =
      entry.clarification.required === true && validation.valid && hasValue;
    entry.refs.forEach((ref) => {
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
          entry.clarification.required === true && !isResolved,
        );
        ref.blockEl.classList.toggle("resolved", isResolved);
      }
      if (ref && ref.badgeEl) {
        ref.badgeEl.textContent = isResolved ? "Resolved" : "Required";
        ref.badgeEl.classList.toggle("resolved", isResolved);
      }
      if (ref && ref.hintEl) {
        ref.hintEl.textContent = buildClarificationHintText(
          entry.clarification,
          isResolved,
        );
      }
    });
    if (entry.clarification.required && !validation.valid) {
      unresolved.push({ id: clarificationId, message: validation.message });
    }
  });

  if (unresolved.length > 0) {
    assistantGateMessage =
      "Resolve " +
      unresolved.length +
      " required clarification" +
      (unresolved.length > 1 ? "s" : "") +
      " before sending the next prompt.";
    setAssistantComposerHint(assistantGateMessage);
    if (!assistantStatus || !assistantStatus.classList.contains("loading")) {
      setAssistantStatus("Resolve required", "warn");
    }
  } else if (assistantConversation.length > 0) {
    assistantGateMessage = "";
    setAssistantComposerHint(
      "All required clarifications are resolved. You can continue the thread.",
    );
    if (
      !assistantStatus ||
      (!assistantStatus.classList.contains("loading") &&
        !assistantStatus.classList.contains("error"))
    ) {
      setAssistantStatus("Ready", "default");
    }
  } else {
    assistantGateMessage = "";
    setAssistantComposerHint(
      "Answer required clarifications to continue the thread.",
    );
  }

  return unresolved;
}

function registerClarificationRef(clarification, refs) {
  if (!clarification || !clarification.id) {
    return;
  }
  if (!assistantClarificationIndex.has(clarification.id)) {
    assistantClarificationIndex.set(clarification.id, {
      clarification,
      refs: [],
    });
  }
  const entry = assistantClarificationIndex.get(clarification.id);
  entry.clarification = clarification;
  entry.refs.push(refs || {});
}

function writeValueToClarificationInput(inputEl, clarification, value) {
  if (!inputEl || !clarification) {
    return;
  }
  if (!hasAnswerValue(value)) {
    if (
      clarification.input === "multi_enum" &&
      inputEl instanceof HTMLSelectElement
    ) {
      Array.from(inputEl.options || []).forEach((optionEl) => {
        optionEl.selected = false;
      });
    } else {
      inputEl.value = "";
    }
    return;
  }
  if (
    clarification.input === "multi_enum" &&
    inputEl instanceof HTMLSelectElement
  ) {
    const asArray = Array.isArray(value) ? value : [];
    Array.from(inputEl.options || []).forEach((optionEl) => {
      optionEl.selected = asArray.includes(optionEl.value);
    });
    return;
  }
  if (clarification.input === "boolean") {
    inputEl.value = value === true ? "true" : value === false ? "false" : "";
    return;
  }
  inputEl.value = String(value);
}

function createClarificationInput(clarification) {
  if (!clarification) {
    return null;
  }
  if (shouldHideClarificationInput(clarification)) {
    return null;
  }
  let inputEl;
  if (clarification.input === "enum") {
    const select = document.createElement("select");
    select.className = "assistant-clarification-input";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "(choose)";
    select.appendChild(placeholder);
    clarification.options.forEach((optionValue) => {
      const optionEl = document.createElement("option");
      optionEl.value = optionValue;
      optionEl.textContent = optionValue;
      select.appendChild(optionEl);
    });
    inputEl = select;
  } else if (clarification.input === "multi_enum") {
    const select = document.createElement("select");
    select.className = "assistant-clarification-input";
    select.multiple = true;
    select.size = Math.max(3, Math.min(6, clarification.options.length || 4));
    clarification.options.forEach((optionValue) => {
      const optionEl = document.createElement("option");
      optionEl.value = optionValue;
      optionEl.textContent = optionValue;
      select.appendChild(optionEl);
    });
    inputEl = select;
  } else if (clarification.input === "boolean") {
    const select = document.createElement("select");
    select.className = "assistant-clarification-input";
    [
      { value: "", label: "(choose)" },
      { value: "true", label: "Yes" },
      { value: "false", label: "No" },
    ].forEach((entry) => {
      const optionEl = document.createElement("option");
      optionEl.value = entry.value;
      optionEl.textContent = entry.label;
      select.appendChild(optionEl);
    });
    inputEl = select;
  } else {
    const input = document.createElement("input");
    input.className = "assistant-clarification-input";
    input.type = clarification.input === "number" ? "number" : "text";
    if (clarification.input === "number") {
      input.step =
        clarification.validation && clarification.validation.integer
          ? "1"
          : "any";
      if (
        clarification.validation &&
        Number.isFinite(clarification.validation.min)
      ) {
        input.min = String(clarification.validation.min);
      }
      if (
        clarification.validation &&
        Number.isFinite(clarification.validation.max)
      ) {
        input.max = String(clarification.validation.max);
      }
    }
    inputEl = input;
  }
  return inputEl;
}

function shouldHideClarificationInput(clarification) {
  return !!(
    clarification &&
    clarification.binding &&
    clarification.binding.type === "operations_set"
  );
}

function buildClarificationHintText(clarification, isResolved) {
  if (!clarification || !clarification.binding) {
    return "";
  }
  if (clarification.binding.type === "operations_set") {
    if (clarification.required) {
      return isResolved
        ? "Operations are set below."
        : "Use the Operations section below. At least one operation is required.";
    }
    return "Use the Operations section below to change operation selection.";
  }
  if (clarification.required) {
    return isResolved
      ? "Required answer provided."
      : "Required for next prompt.";
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

function renderAssistantTimeline() {
  if (!assistantTimeline) {
    return;
  }
  assistantTimeline.innerHTML = "";
  assistantClarificationIndex.clear();

  assistantConversation.forEach((turn) => {
    const turnEl = document.createElement("article");
    turnEl.className =
      "assistant-turn " + (turn.role === "user" ? "user" : "assistant");

    const header = document.createElement("div");
    header.className = "assistant-turn-header";
    const left = document.createElement("span");
    left.textContent = turn.role === "user" ? "You" : "Assistant";
    const right = document.createElement("span");
    right.textContent = turn.at || "";
    header.appendChild(left);
    header.appendChild(right);
    turnEl.appendChild(header);

    if (turn.role === "user") {
      const message = document.createElement("p");
      message.className = "assistant-turn-message";
      message.textContent = turn.text || "";
      turnEl.appendChild(message);
      assistantTimeline.appendChild(turnEl);
      return;
    }

    const summary = document.createElement("p");
    summary.className = "assistant-turn-summary";
    summary.textContent = turn.summary || "Applied.";
    turnEl.appendChild(summary);

    if (Array.isArray(turn.warnings) && turn.warnings.length > 0) {
      const warning = document.createElement("p");
      warning.className = "assistant-inline-meta";
      warning.textContent = "Warnings: " + turn.warnings.join(" ");
      turnEl.appendChild(warning);
    }

    if (Array.isArray(turn.assumptions) && turn.assumptions.length > 0) {
      const assumptionsWrap = document.createElement("div");
      assumptionsWrap.className = "assistant-assumptions";
      const assumptionsTitle = document.createElement("span");
      assumptionsTitle.className = "assistant-inline-meta";
      assumptionsTitle.textContent = "Assumptions applied:";
      assumptionsWrap.appendChild(assumptionsTitle);
      const assumptionList = document.createElement("ul");
      assumptionList.className = "assistant-assumption-list";
      turn.assumptions.forEach((entry) => {
        const item = document.createElement("li");
        item.textContent = entry.text;
        assumptionList.appendChild(item);
      });
      assumptionsWrap.appendChild(assumptionList);
      turnEl.appendChild(assumptionsWrap);
    }

    if (Array.isArray(turn.clarifications) && turn.clarifications.length > 0) {
      const clarificationsWrap = document.createElement("div");
      clarificationsWrap.className = "assistant-clarification-list";
      turn.clarifications.forEach((clarification) => {
        const currentValue = getClarificationCurrentValue(clarification);
        const currentValidation = validateClarificationAnswer(
          clarification,
          currentValue,
        );
        const isResolved =
          clarification.required === true &&
          currentValidation.valid &&
          hasAnswerValue(currentValue);
        const block = document.createElement("div");
        const blockClasses = ["assistant-clarification"];
        if (clarification.required && !isResolved) {
          blockClasses.push("required");
        }
        if (isResolved) {
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
          badge.textContent = isResolved ? "Resolved" : "Required";
          badge.classList.toggle("resolved", isResolved);
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
        hint.textContent = buildClarificationHintText(
          clarification,
          isResolved,
        );
        block.appendChild(hint);

        const errorEl = document.createElement("p");
        errorEl.className = "assistant-clarification-error";
        block.appendChild(errorEl);
        registerClarificationRef(clarification, {
          inputEl,
          errorEl,
          blockEl: block,
          badgeEl: badge,
          hintEl: hint,
        });

        if (inputEl) {
          const applyFromInput = () => {
            const parsedValue = parseInputValueByType(inputEl, clarification);
            if (hasAnswerValue(parsedValue)) {
              assistantAnswerStore[clarification.id] = parsedValue;
            } else {
              delete assistantAnswerStore[clarification.id];
            }
            const validation = validateClarificationAnswer(
              clarification,
              assistantAnswerStore[clarification.id],
            );
            if (validation.valid) {
              applyClarificationAnswerToForm(
                clarification,
                assistantAnswerStore[clarification.id],
              );
            }
            validateAndRenderClarificationState();
          };

          if (inputEl.tagName === "SELECT") {
            inputEl.addEventListener("change", applyFromInput);
          } else {
            inputEl.addEventListener("input", applyFromInput);
            inputEl.addEventListener("blur", applyFromInput);
          }
        }

        clarificationsWrap.appendChild(block);
      });
      turnEl.appendChild(clarificationsWrap);

      const footer = document.createElement("div");
      footer.className = "assistant-card-footer";
      const footerLeft = document.createElement("span");
      footerLeft.textContent = "Edits save automatically.";
      const footerRight = document.createElement("span");
      footerRight.textContent = "Required answers gate next send.";
      footer.appendChild(footerLeft);
      footer.appendChild(footerRight);
      turnEl.appendChild(footer);
    }

    assistantTimeline.appendChild(turnEl);
  });

  pruneAssistantAnswerStore();
  assistantTimeline.scrollTop = assistantTimeline.scrollHeight;
  validateAndRenderClarificationState();
}

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getCurrentFormState() {
  const operations = {};
  operationOrder.forEach((op) => {
    const toggle = getOperationToggle(op);
    const opState = { enabled: !!(toggle && toggle.checked) };
    OPERATION_NUMBER_EXPR_FIELDS.forEach((field) => {
      const rawExpression = sanitizeTypedExpression(
        getAdvancedFieldValue(op, field),
        "number_expr",
      );
      if (rawExpression !== null) {
        opState[field] = rawExpression;
        return;
      }
      const value = toFiniteNumber(readOperationField(op, field));
      if (value !== null) {
        opState[field] = value;
      }
    });
    [
      "key_len",
      "val_len",
      "key_hot_len",
      "key_hot_amount",
      "key_hot_probability",
      "val_hot_len",
      "val_hot_amount",
      "val_hot_probability",
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
    ].forEach((field) => {
      const value = toFiniteNumber(readOperationField(op, field));
      if (value !== null) {
        opState[field] = value;
      }
    });
    const operationCharacterSet = readOperationField(op, "character_set");
    if (operationCharacterSet) {
      opState.character_set = operationCharacterSet;
    }
    ["key", "val", "selection"].forEach((field) => {
      const kind = field === "selection" ? "distribution" : "string_expr";
      const rawExpression = sanitizeTypedExpression(
        getAdvancedFieldValue(op, field),
        kind,
      );
      if (rawExpression !== null) {
        opState[field] = rawExpression;
      }
    });
    const selectionDistribution = readOperationField(
      op,
      "selection_distribution",
    );
    if (selectionDistribution) {
      opState.selection_distribution = selectionDistribution;
    }
    const keyPattern = readOperationField(op, "key_pattern");
    if (keyPattern) {
      opState.key_pattern = keyPattern;
    }
    const valPattern = readOperationField(op, "val_pattern");
    if (valPattern) {
      opState.val_pattern = valPattern;
    }
    const rangeFormatValue = readOperationField(op, "range_format");
    if (rangeFormatValue) {
      opState.range_format = rangeFormatValue;
    }
    operations[op] = opState;
  });

  return {
    character_set:
      formCharacterSet && formCharacterSet.value
        ? formCharacterSet.value
        : null,
    sections_count:
      parsePositiveInt(formSections ? formSections.value : "") || null,
    groups_per_section:
      parsePositiveInt(formGroups ? formGroups.value : "") || null,
    skip_key_contains_check: !!(
      formSkipKeyContainsCheck && formSkipKeyContainsCheck.checked
    ),
    operations,
  };
}

function getSchemaHintsForAssist() {
  const capabilities = {};
  operationOrder.forEach((op) => {
    capabilities[op] = {
      has_op_count: formOpsWithOpCountFields.has(op),
      has_character_set: formOpsWithOperationCharacterSet.has(op),
      has_key: formOpsWithKeyFields.has(op),
      has_val: formOpsWithValueFields.has(op),
      has_selection: formOpsWithSelectionFields.has(op),
      has_sorted: formOpsWithSortedFields.has(op),
      has_range: formOpsWithRangeFields.has(op),
    };
  });
  return {
    operation_order: operationOrder,
    operation_labels: operationLabels,
    character_sets: characterSetEnum,
    range_formats: getRangeFormatValues(),
    selection_distributions: getSelectionDistributionValues(),
    string_patterns: getStringPatternValues(),
    capabilities,
  };
}

function applyAssistantPatch(patch) {
  let context = {};
  if (
    arguments.length > 1 &&
    arguments[1] &&
    typeof arguments[1] === "object"
  ) {
    context = arguments[1];
  }
  if (!patch || typeof patch !== "object") {
    return;
  }

  const scopeOp = deriveAssistantScopeOperation(context);
  const allowOperationSetChanges = assistantPromptHasOperationIntent(
    context && typeof context.promptText === "string" ? context.promptText : "",
  );

  if (
    typeof patch.character_set === "string" &&
    formCharacterSet &&
    !isTopFieldLocked("character_set")
  ) {
    const optionValues = Array.from(formCharacterSet.options || []).map(
      (option) => option.value,
    );
    if (optionValues.includes(patch.character_set)) {
      formCharacterSet.value = patch.character_set;
    }
  }

  if (
    Number.isFinite(patch.sections_count) &&
    patch.sections_count > 0 &&
    formSections &&
    !isTopFieldLocked("sections_count")
  ) {
    formSections.value = String(Math.floor(patch.sections_count));
  }

  if (
    Number.isFinite(patch.groups_per_section) &&
    patch.groups_per_section > 0 &&
    formGroups &&
    !isTopFieldLocked("groups_per_section")
  ) {
    formGroups.value = String(Math.floor(patch.groups_per_section));
  }

  if (
    Object.prototype.hasOwnProperty.call(patch, "skip_key_contains_check") &&
    formSkipKeyContainsCheck &&
    !isTopFieldLocked("skip_key_contains_check")
  ) {
    formSkipKeyContainsCheck.checked = patch.skip_key_contains_check === true;
  }

  if (patch.clear_operations === true && allowOperationSetChanges) {
    operationOrder.forEach((op) => {
      if (!isOperationFieldLocked(op, "enabled")) {
        setOperationChecked(op, false);
      }
    });
  }

  const operationsPatch =
    patch.operations && typeof patch.operations === "object"
      ? patch.operations
      : {};

  Object.entries(operationsPatch).forEach(([op, opPatch]) => {
    if (
      !operationOrder.includes(op) ||
      !opPatch ||
      typeof opPatch !== "object"
    ) {
      return;
    }
    const scopeBlocksEnable =
      scopeOp && op !== scopeOp && opPatch.enabled === true;
    const scopeBlocksDisable =
      scopeOp && op === scopeOp && opPatch.enabled === false;
    if (
      typeof opPatch.enabled === "boolean" &&
      allowOperationSetChanges &&
      !isOperationFieldLocked(op, "enabled") &&
      !scopeBlocksEnable &&
      !scopeBlocksDisable
    ) {
      setOperationChecked(op, opPatch.enabled);
      if (opPatch.enabled) {
        ensureOperationDefaultsIfEmpty(op);
      }
    }

    ["op_count", "k", "l", "selectivity"].forEach((field) => {
      if (!Object.prototype.hasOwnProperty.call(opPatch, field)) {
        return;
      }
      if (isOperationFieldLocked(op, field)) {
        return;
      }
      const exprValue = sanitizeTypedExpression(opPatch[field], "number_expr");
      if (exprValue !== null && typeof exprValue === "object") {
        setAdvancedFieldValue(op, field, exprValue);
        return;
      }
      const numericValue = toFiniteNumber(opPatch[field]);
      if (numericValue === null) {
        return;
      }
      clearAdvancedFieldValue(op, field);
      setOperationInputValue(op, field, numericValue);
    });

    [
      "key_len",
      "val_len",
      "key_hot_len",
      "key_hot_amount",
      "key_hot_probability",
      "val_hot_len",
      "val_hot_amount",
      "val_hot_probability",
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
    ].forEach((field) => {
      if (!Object.prototype.hasOwnProperty.call(opPatch, field)) {
        return;
      }
      if (isOperationFieldLocked(op, field)) {
        return;
      }
      const numericValue = toFiniteNumber(opPatch[field]);
      if (numericValue === null) {
        return;
      }
      if (field.startsWith("selection_")) {
        clearAdvancedFieldValue(op, "selection");
      } else if (field.startsWith("key_")) {
        clearAdvancedFieldValue(op, "key");
      } else if (field.startsWith("val_")) {
        clearAdvancedFieldValue(op, "val");
      }
      setOperationInputValue(op, field, numericValue);
    });

    if (
      typeof opPatch.character_set === "string" &&
      !isOperationFieldLocked(op, "character_set")
    ) {
      const validCharacterSets = [""].concat(characterSetEnum);
      if (validCharacterSets.includes(opPatch.character_set)) {
        setOperationInputValue(op, "character_set", opPatch.character_set);
      }
    }

    ["key", "val", "selection"].forEach((field) => {
      if (!Object.prototype.hasOwnProperty.call(opPatch, field)) {
        return;
      }
      if (isOperationFieldLocked(op, field)) {
        return;
      }
      const exprValue = sanitizeTypedExpression(
        opPatch[field],
        field === "selection" ? "distribution" : "string_expr",
      );
      if (exprValue === null) {
        return;
      }
      setAdvancedFieldValue(op, field, exprValue);
    });

    if (
      typeof opPatch.selection_distribution === "string" &&
      !isOperationFieldLocked(op, "selection_distribution")
    ) {
      const validDistributions = getSelectionDistributionValues();
      if (validDistributions.includes(opPatch.selection_distribution)) {
        clearAdvancedFieldValue(op, "selection");
        setOperationInputValue(
          op,
          "selection_distribution",
          opPatch.selection_distribution,
        );
        refreshSelectionParamVisibility(op);
      }
    }

    if (
      typeof opPatch.key_pattern === "string" &&
      !isOperationFieldLocked(op, "key_pattern")
    ) {
      const validPatterns = getStringPatternValues();
      if (validPatterns.includes(opPatch.key_pattern)) {
        clearAdvancedFieldValue(op, "key");
        setOperationInputValue(op, "key_pattern", opPatch.key_pattern);
        refreshStringPatternVisibility(op);
      }
    }

    if (
      typeof opPatch.val_pattern === "string" &&
      !isOperationFieldLocked(op, "val_pattern")
    ) {
      const validPatterns = getStringPatternValues();
      if (validPatterns.includes(opPatch.val_pattern)) {
        clearAdvancedFieldValue(op, "val");
        setOperationInputValue(op, "val_pattern", opPatch.val_pattern);
        refreshStringPatternVisibility(op);
      }
    }

    if (
      typeof opPatch.range_format === "string" &&
      !isOperationFieldLocked(op, "range_format")
    ) {
      const validRangeFormats = getRangeFormatValues();
      if (validRangeFormats.includes(opPatch.range_format)) {
        setOperationInputValue(op, "range_format", opPatch.range_format);
      }
    }
  });
}

function deriveAssistantScopeOperation(context) {
  const promptText =
    context && typeof context.promptText === "string"
      ? context.promptText.trim()
      : "";
  const selectedBefore =
    context && Array.isArray(context.selectedOpsBeforeApply)
      ? context.selectedOpsBeforeApply.filter((op) =>
          operationOrder.includes(op),
        )
      : [];
  if (selectedBefore.length !== 1) {
    return null;
  }
  if (assistantPromptBroadensOperationScope(promptText, selectedBefore[0])) {
    return null;
  }
  return selectedBefore[0];
}

function assistantPromptHasOperationIntent(promptText) {
  const lower = String(promptText || "").toLowerCase();
  if (!lower) {
    return false;
  }
  if (
    /\boperation(?:s)?\b|\boperation\s*mix\b|\bonly\b|\binclude\b|\badd\b|\benable\b|\bdisable\b|\bremove\b|\bexclude\b|\bwithout\b/.test(
      lower,
    )
  ) {
    return true;
  }
  return operationOrder.some((op) => promptMentionsOperation(op, lower));
}

function assistantPromptBroadensOperationScope(promptText, scopedOp) {
  const lower = String(promptText || "").toLowerCase();
  if (!lower) {
    return false;
  }

  const explicitScopeChange =
    /\b(add|include|also|plus|enable|disable|remove|exclude|operation\s*mix|operations?)\b/.test(
      lower,
    );
  if (explicitScopeChange) {
    return true;
  }

  const matchedOps = operationOrder.filter((op) =>
    promptMentionsOperation(op, lower),
  );
  if (matchedOps.length === 0) {
    return false;
  }
  if (matchedOps.length === 1 && matchedOps[0] === scopedOp) {
    return false;
  }
  return true;
}

function promptMentionsOperation(op, lowerPromptText) {
  const lower = String(lowerPromptText || "");
  if (!lower || !op) {
    return false;
  }

  const escapedOp = op.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`\\b${escapedOp}\\b`).test(lower)) {
    return true;
  }

  const matcherSource = PROMPT_OPERATION_MATCHER_SOURCES[op];
  if (!matcherSource) {
    return false;
  }

  const guardedMatcher = new RegExp(`\\b(?:${matcherSource})\\b`, "g");
  const blockedPrefixes = PROMPT_OPERATION_BLOCKED_PREFIXES[op] || [];
  if (!blockedPrefixes.length) {
    return guardedMatcher.test(lower);
  }

  let match = null;
  while ((match = guardedMatcher.exec(lower)) !== null) {
    const prefix = lower.slice(0, match.index).trimEnd();
    const isBlocked = blockedPrefixes.some((blockedPrefix) =>
      prefix.endsWith(blockedPrefix),
    );
    if (!isBlocked) {
      return true;
    }
  }
  return false;
}

async function handleRunWorkload() {
  if (!workloadRunsController) {
    setValidationStatus(
      "Workload run controller is unavailable in this build.",
      "invalid",
    );
    return;
  }

  const specJson = buildJsonFromForm();
  if (
    !specJson ||
    typeof specJson !== "object" ||
    !Array.isArray(specJson.sections) ||
    specJson.sections.length === 0
  ) {
    setValidationStatus(
      "Build a valid spec with at least one section before running workload generation.",
      "invalid",
    );
    return;
  }

  await workloadRunsController.startRun(specJson);
}

async function requestAssistantPatch(promptText) {
  const currentJson = buildJsonFromForm();
  const response = await fetch(ASSIST_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: promptText,
      conversation: assistantConversation.map((turn) => ({
        role: turn.role === "assistant" ? "assistant" : "user",
        text:
          turn.role === "assistant"
            ? turn.summary || turn.text || ""
            : turn.text || "",
      })),
      answers: getAnswersForRequest(),
      form_state: getCurrentFormState(),
      schema_hints: getSchemaHintsForAssist(),
      current_json: currentJson,
    }),
  });

  let data = null;
  try {
    data = await response.json();
  } catch (parseError) {
    throw new Error("Assistant returned an unreadable response.");
  }

  if (!response.ok) {
    const message =
      data && data.error ? data.error : "Assistant request failed.";
    throw new Error(message);
  }
  if (!data || typeof data !== "object") {
    throw new Error("Assistant returned an empty response.");
  }
  return data;
}

async function handleAssistantApply() {
  const promptText = assistantInput ? assistantInput.value.trim() : "";
  if (!promptText) {
    setAssistantStatus("Enter details to apply", "warn");
    setAssistantComposerHint(
      "Describe your workload in plain English, then click Apply.",
    );
    return;
  }

  const unresolvedBeforeSend = validateAndRenderClarificationState();
  if (unresolvedBeforeSend.length > 0) {
    setAssistantStatus("Resolve required", "warn");
    setAssistantComposerHint(
      assistantGateMessage ||
        "Resolve required clarifications before sending the next prompt.",
    );
    return;
  }

  const userTurn = {
    id: createTurnId(),
    role: "user",
    text: promptText,
    at: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
  addAssistantTimelineTurn(userTurn);
  if (assistantInput) {
    assistantInput.value = "";
  }

  setAssistantBusy(true);
  setAssistantStatus("Interpreting...", "loading");
  setAssistantComposerHint("Generating a patch and clarification metadata...");

  try {
    const selectedOpsBeforeApply = getSelectedOperations();
    const result = await requestAssistantPatch(promptText);
    applyAssistantPatch(result.patch, {
      promptText,
      selectedOpsBeforeApply,
    });
    updateJsonFromForm();

    const normalizedResult = normalizeAssistantResponse(result);
    const assistantTurn = {
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
    };
    addAssistantTimelineTurn(assistantTurn);

    const unresolvedAfterApply = validateAndRenderClarificationState();
    if (unresolvedAfterApply.length > 0) {
      setAssistantStatus("Resolve required", "warn");
    } else if (normalizedResult.warnings.length > 0) {
      setAssistantStatus("Applied with notes", "warn");
    } else {
      setAssistantStatus("Applied", "default");
    }
  } catch (e) {
    setAssistantStatus("Assistant failed", "error");
    const errorTurn = {
      id: createTurnId(),
      role: "assistant",
      summary:
        e && e.message ? e.message : "Failed to apply assistant suggestion.",
      clarifications: [],
      assumptions: [],
      warnings: [],
      source: "error",
      at: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    addAssistantTimelineTurn(errorTurn);
    setAssistantComposerHint(
      "The previous request failed. Update your prompt and try again.",
    );
  } finally {
    setAssistantBusy(false);
  }
}

function resetFormInterface() {
  workloadForm.reset();
  clearFieldLocks();
  operationAdvancedState.clear();
  operationOrder.forEach((op) => setOperationCardVisibility(op, false));
  operationOrder.forEach((op) => refreshAdvancedExpressionSummary(op));
  formSections.value = "";
  formGroups.value = "";
  if (formSkipKeyContainsCheck) {
    formSkipKeyContainsCheck.checked = false;
  }
  clearAssistantThread();
  setAssistantStatus("Ready", "default");
  setRunButtonBusy(false);
  const initial = JSON.parse(INITIAL_JSON_TEXT);
  renderGeneratedJson(initial);
  updateInteractiveStats(initial);
  validationResult.className = "validation-result";
  validationResult.textContent = "";
}

function downloadGeneratedJson() {
  const text = jsonOutput.value;
  if (!text) return;
  const blob = new Blob([text], { type: "application/json" });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = "tectonic-generated-" + timestamp + ".json";
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function toSchemaValidationShape(json, schemaDoc) {
  if (!Array.isArray(json)) {
    return json;
  }
  const properties =
    schemaDoc && typeof schemaDoc === "object" ? schemaDoc.properties : null;
  const required =
    schemaDoc && Array.isArray(schemaDoc.required) ? schemaDoc.required : [];
  if (properties && properties.sections && required.includes("sections")) {
    return { sections: json };
  }
  return json;
}

function setValidationStatus(message, status) {
  validationResult.textContent = message;
  validationResult.className = "validation-result show " + status;
}
