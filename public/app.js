const workloadForm = document.getElementById("workloadForm");
const formCharacterSet = document.getElementById("formCharacterSet");
const formSections = document.getElementById("formSections");
const formGroups = document.getElementById("formGroups");
const formSkipKeyContainsCheck = document.getElementById(
  "formSkipKeyContainsCheck",
);
const addSectionBtn = document.getElementById("addSectionBtn");
const structureTree = document.getElementById("structureTree");
const structurePanel = document.querySelector(".structure-panel");
const builderHint = document.querySelector(".builder-hint");
const structureSelectionLabel = document.getElementById(
  "structureSelectionLabel",
);
const formCharacterSetLabel = document.getElementById("formCharacterSetLabel");
const formSectionsLabel = document.getElementById("formSectionsLabel");
const formGroupsLabel = document.getElementById("formGroupsLabel");
const skipKeyContainsCheckLabel = document.getElementById(
  "skipKeyContainsCheckLabel",
);
const operationsTitle = document.getElementById("operationsTitle");
const presetFamilySelect = document.getElementById("presetFamilySelect");
const presetFileSelect = document.getElementById("presetFileSelect");
const presetSelectionNote = document.getElementById("presetSelectionNote");
const operationToggles = document.getElementById("operationToggles");
const operationConfigContainer = document.getElementById(
  "operationConfigContainer",
);
const jsonOutput = document.getElementById("jsonOutput");
const jsonOutputShell = document.getElementById("jsonOutputShell");
const jsonTree = document.getElementById("jsonTree");
const toggleJsonPreviewBtn = document.getElementById("toggleJsonPreviewBtn");
const jsonSectionsPill = document.getElementById("jsonSectionsPill");
const jsonOpsPill = document.getElementById("jsonOpsPill");
const jsonBytesPill = document.getElementById("jsonBytesPill");
const jsonSummary = document.getElementById("jsonSummary");
const benchmarkDatabaseSelect = document.getElementById(
  "benchmarkDatabaseSelect",
);
const characterSetDescription = document.getElementById(
  "characterSetDescription",
);
const sectionsDescription = document.getElementById("sectionsDescription");
const groupsDescription = document.getElementById("groupsDescription");
const skipKeyContainsCheckDescription = document.getElementById(
  "skipKeyContainsCheckDescription",
);
const downloadJsonBtn = document.getElementById("downloadJsonBtn");
const runWorkloadBtn = document.getElementById("runWorkloadBtn");
const copyBtn = document.getElementById("copyBtn");
const validationResult = document.getElementById("validationResult");
const runsList = document.getElementById("runsList");
const newWorkloadBtn = document.getElementById("newWorkloadBtn");
const presetBrowserBtn = document.getElementById("presetBrowserBtn");
const assistantInput = document.getElementById("assistantInput");
const assistantApplyBtn = document.getElementById("assistantApplyBtn");
const assistantClearBtn = document.getElementById("assistantClearBtn");
const assistantStatus = document.getElementById("assistantStatus");
const assistantTimeline = document.getElementById("assistantTimeline");
const assistantComposerHint = document.getElementById("assistantComposerHint");
const appShell = document.getElementById("appShell");
const appHeader = document.getElementById("appHeader");
const welcomePanel = document.getElementById("welcomePanel");
const customWorkloadBtn = document.getElementById("customWorkloadBtn");
const builderPanel = document.getElementById("builderPanel");
const previewPanel = document.getElementById("previewPanel");
const builderDescribeModeBtn = document.getElementById(
  "builderDescribeModeBtn",
);
const builderPresetModeBtn = document.getElementById("builderPresetModeBtn");
const builderDescribePanel = document.getElementById("builderDescribePanel");
const builderPresetPanel = document.getElementById("builderPresetPanel");
let pendingJsonFocusTarget = null;
const runsPanel = document.getElementById("runsPanel");
const structuredUiNormalizer =
  globalThis.TectonicUiStructuredNormalization || null;
let jsonTreeViewer = null;
let advancedExpressionRenderer = null;
let structurePanelRenderer = null;
let presetFlowController = null;
let assistantPanelController = null;
let workloadRunsPanelController = null;
let jsonPreviewVisible = false;
let builderInputMode = "preset";

const INITIAL_JSON_TEXT = "{}";
const CUSTOM_BUILDER_STORAGE_KEY = "tectonic.customBuilderState.v1";
const PRESET_INDEX_PATH = "/presets/index.json";
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
const operationAdvancedState = new Map();
const lockedTopFields = new Set();
const lockedOperationFields = new Map();
let activePresetJson = null;
let customWorkloadMode = false;
let schemaValidatorPromise = null;
let latestValidationToken = 0;
let workloadStructureState = [];
let activeSectionIndex = 0;
let activeGroupIndex = 0;

let schema = null;
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
    resetFormInterface({ stayInBuilder: false });
  } catch (e) {
    reportUiIssue("Failed to reset form interface", e);
  }
  try {
    await loadPresetCatalog();
  } catch (e) {
    reportUiIssue("Failed to load preset catalog", e);
  }
  try {
    if (window.__TECTONIC_FORCE_INIT__ === true) {
      clearPersistedCustomBuilderState();
    } else {
      restorePersistedCustomBuilderState();
    }
  } catch (e) {
    reportUiIssue("Failed to restore custom builder state", e);
  }
  syncLandingUi();

  const runsController = getWorkloadRunsPanelController();
  if (runsController) {
    runsController.init();
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
  if (toggleJsonPreviewBtn) {
    toggleJsonPreviewBtn.addEventListener("click", () => {
      setJsonPreviewVisible(!jsonPreviewVisible);
    });
  }
  if (runsController) {
    runsController.bindEvents();
  }
  const assistantController = getAssistantPanelController();
  if (assistantController) {
    assistantController.bindEvents();
  }
  const presetController = getPresetFlowController();
  if (presetController) {
    presetController.bindEvents();
  }
  if (addSectionBtn) {
    addSectionBtn.addEventListener("click", () => {
      persistActiveStructureFromForm();
      ensureWorkloadStructureState();
      workloadStructureState.push(createEmptySectionState());
      activeSectionIndex = workloadStructureState.length - 1;
      activeGroupIndex = 0;
      loadActiveStructureIntoForm();
      updateJsonFromForm();
    });
  }
  document.addEventListener("keydown", (event) => {
    const isMeta = event.metaKey || event.ctrlKey;
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
  if (eventTarget === formSections) {
    persistActiveStructureFromForm();
    activeSectionIndex = Math.max(
      0,
      (parsePositiveInt(formSections ? formSections.value : "") || 1) - 1,
    );
    activeGroupIndex = 0;
    loadActiveStructureIntoForm();
    updateJsonFromForm();
    return;
  }
  if (eventTarget === formGroups) {
    persistActiveStructureFromForm();
    activeGroupIndex = Math.max(
      0,
      (parsePositiveInt(formGroups ? formGroups.value : "") || 1) - 1,
    );
    loadActiveStructureIntoForm();
    updateJsonFromForm();
    return;
  }
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

function hasAdvancedFieldValue(op, field) {
  return getAdvancedFieldValue(op, field) !== null;
}

function setAdvancedFieldValue(op, field, value, options = {}) {
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
  if (options.refresh !== false) {
    refreshAdvancedExpressionSummary(op);
    refreshStringPatternVisibility(op);
  }
}

function clearAdvancedFieldValue(op, field, options = {}) {
  const entry = operationAdvancedState.get(op);
  if (!entry) {
    return;
  }
  delete entry[field];
  if (Object.keys(entry).length === 0) {
    operationAdvancedState.delete(op);
  }
  if (options.refresh !== false) {
    refreshAdvancedExpressionSummary(op);
    refreshStringPatternVisibility(op);
  }
}

function clearAllAdvancedFieldValues(op, options = {}) {
  operationAdvancedState.delete(op);
  if (options.refresh !== false) {
    refreshAdvancedExpressionSummary(op);
    refreshStringPatternVisibility(op);
  }
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
    return;
  }
  if (eventTarget === formGroups) {
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

function cloneJsonValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function readCustomBuilderStorage() {
  try {
    return window.localStorage.getItem(CUSTOM_BUILDER_STORAGE_KEY);
  } catch (_error) {
    return null;
  }
}

function writeCustomBuilderStorage(snapshot) {
  try {
    window.localStorage.setItem(
      CUSTOM_BUILDER_STORAGE_KEY,
      JSON.stringify(snapshot),
    );
  } catch (_error) {
    // Ignore unavailable storage.
  }
}

function clearPersistedCustomBuilderState() {
  try {
    window.localStorage.removeItem(CUSTOM_BUILDER_STORAGE_KEY);
  } catch (_error) {
    // Ignore unavailable storage.
  }
}

function createEmptyGroupSpec() {
  return {};
}

function createEmptySectionState() {
  return {
    skip_key_contains_check: false,
    groups: [createEmptyGroupSpec()],
  };
}

function normalizePatchedStructureSections(rawSections) {
  if (
    !structuredUiNormalizer ||
    typeof structuredUiNormalizer.normalizePatchedStructureSections !==
      "function"
  ) {
    return [createEmptySectionState()];
  }
  return structuredUiNormalizer.normalizePatchedStructureSections(rawSections, {
    defaultCharacterSet:
      formCharacterSet && formCharacterSet.value
        ? formCharacterSet.value.trim()
        : "",
    operationDefaults: OPERATION_DEFAULTS,
    stringPatternDefaults: STRING_PATTERN_DEFAULTS,
    selectionParamDefaults: SELECTION_PARAM_DEFAULTS,
    selectionDistributionParams: SELECTION_DISTRIBUTION_PARAMS,
    rangeFormats: getRangeFormatValues(),
    opsWithOpCount: Array.from(formOpsWithOpCountFields),
    opsWithSorted: Array.from(formOpsWithSortedFields),
    opsWithKey: Array.from(formOpsWithKeyFields),
    opsWithValue: Array.from(formOpsWithValueFields),
    opsWithSelection: Array.from(formOpsWithSelectionFields),
    opsWithRange: Array.from(formOpsWithRangeFields),
  });
}

function ensureWorkloadStructureState() {
  if (
    !Array.isArray(workloadStructureState) ||
    workloadStructureState.length === 0
  ) {
    workloadStructureState = [createEmptySectionState()];
  }
  if (activeSectionIndex < 0) {
    activeSectionIndex = 0;
  }
  if (activeSectionIndex >= workloadStructureState.length) {
    activeSectionIndex = workloadStructureState.length - 1;
  }
  const activeSection = workloadStructureState[activeSectionIndex];
  if (
    !activeSection ||
    !Array.isArray(activeSection.groups) ||
    activeSection.groups.length === 0
  ) {
    workloadStructureState[activeSectionIndex] = createEmptySectionState();
  }
  const section = workloadStructureState[activeSectionIndex];
  if (activeGroupIndex < 0) {
    activeGroupIndex = 0;
  }
  if (activeGroupIndex >= section.groups.length) {
    activeGroupIndex = section.groups.length - 1;
  }
}

function resetWorkloadStructureState() {
  workloadStructureState = [createEmptySectionState()];
  activeSectionIndex = 0;
  activeGroupIndex = 0;
  renderStructureSelectors();
}

function getActiveSectionState() {
  ensureWorkloadStructureState();
  return workloadStructureState[activeSectionIndex];
}

function getActiveGroupState() {
  const section = getActiveSectionState();
  return section.groups[activeGroupIndex];
}

function setPresetSelectionNote(message) {
  const controller = getPresetFlowController();
  if (!controller) {
    return;
  }
  controller.setPresetSelectionNote(message);
}

function clearLoadedPresetState() {
  const controller = getPresetFlowController();
  if (!controller) {
    activePresetJson = null;
    return;
  }
  controller.clearLoadedPresetState();
}

function renderStructureSelectors() {
  ensureWorkloadStructureState();

  if (formSections) {
    formSections.innerHTML = "";
    workloadStructureState.forEach((_, index) => {
      const option = document.createElement("option");
      option.value = String(index + 1);
      option.textContent = "Section " + (index + 1);
      formSections.appendChild(option);
    });
    formSections.value = String(activeSectionIndex + 1);
  }

  const activeSection = getActiveSectionState();
  if (formGroups) {
    formGroups.innerHTML = "";
    activeSection.groups.forEach((_, index) => {
      const option = document.createElement("option");
      option.value = String(index + 1);
      option.textContent = "Group " + (index + 1);
      formGroups.appendChild(option);
    });
    formGroups.value = String(activeGroupIndex + 1);
  }
  renderStructureTree();
}

function countConfiguredGroupOperations(group) {
  if (!group || typeof group !== "object") {
    return 0;
  }
  return operationOrder.filter((op) =>
    Object.prototype.hasOwnProperty.call(group, op),
  ).length;
}

function hasConfiguredWorkloadStructure() {
  return Array.isArray(workloadStructureState)
    ? workloadStructureState.some((section) =>
        Array.isArray(section && section.groups)
          ? section.groups.some(
              (group) =>
                group &&
                typeof group === "object" &&
                countConfiguredGroupOperations(group) > 0,
            )
          : false,
      )
    : false;
}

function updateStructurePanelVisibility() {
  const showBuilderEditor = hasConfiguredWorkloadStructure();
  if (builderHint) {
    builderHint.hidden = !showBuilderEditor;
  }
  if (structurePanel) {
    structurePanel.hidden = !showBuilderEditor;
  }
  if (workloadForm) {
    workloadForm.hidden = !showBuilderEditor;
  }
}

function renderStructureTree() {
  ensureWorkloadStructureState();
  updateStructurePanelVisibility();
  const renderer = getStructurePanelRenderer();
  if (!renderer) {
    return;
  }
  renderer.render({
    sections: workloadStructureState,
    activeSectionIndex,
    activeGroupIndex,
  });
}

function getStructurePanelRenderer() {
  if (structurePanelRenderer) {
    return structurePanelRenderer;
  }
  if (
    !structureTree ||
    !globalThis.TectonicStructurePanel ||
    typeof globalThis.TectonicStructurePanel.createRenderer !== "function"
  ) {
    return null;
  }
  structurePanelRenderer = globalThis.TectonicStructurePanel.createRenderer({
    container: structureTree,
    selectionLabel: structureSelectionLabel,
    countConfiguredGroupOperations,
    onSelectSection(sectionIndex, section) {
      persistActiveStructureFromForm();
      activeSectionIndex = sectionIndex;
      if (activeGroupIndex >= section.groups.length) {
        activeGroupIndex = section.groups.length - 1;
      }
      loadActiveStructureIntoForm();
      updateJsonFromForm();
    },
    onAddGroup(sectionIndex, section) {
      persistActiveStructureFromForm();
      section.groups.push(createEmptyGroupSpec());
      activeSectionIndex = sectionIndex;
      activeGroupIndex = section.groups.length - 1;
      loadActiveStructureIntoForm();
      updateJsonFromForm();
    },
    onRemoveSection(sectionIndex) {
      if (workloadStructureState.length <= 1) {
        return;
      }
      persistActiveStructureFromForm();
      workloadStructureState.splice(sectionIndex, 1);
      if (activeSectionIndex >= workloadStructureState.length) {
        activeSectionIndex = workloadStructureState.length - 1;
      }
      activeGroupIndex = 0;
      loadActiveStructureIntoForm();
      updateJsonFromForm();
    },
    onSelectGroup(sectionIndex, groupIndex) {
      persistActiveStructureFromForm();
      activeSectionIndex = sectionIndex;
      activeGroupIndex = groupIndex;
      pendingJsonFocusTarget = { sectionIndex, groupIndex };
      loadActiveStructureIntoForm();
      updateJsonFromForm();
    },
    onRemoveGroup(sectionIndex, groupIndex, section) {
      if (section.groups.length <= 1) {
        return;
      }
      persistActiveStructureFromForm();
      section.groups.splice(groupIndex, 1);
      activeSectionIndex = sectionIndex;
      if (activeGroupIndex >= section.groups.length) {
        activeGroupIndex = section.groups.length - 1;
      }
      loadActiveStructureIntoForm();
      updateJsonFromForm();
    },
  });
  return structurePanelRenderer;
}

function getPresetFlowController() {
  if (presetFlowController) {
    return presetFlowController;
  }
  if (
    !globalThis.TectonicPresetFlow ||
    typeof globalThis.TectonicPresetFlow.createController !== "function"
  ) {
    return null;
  }
    presetFlowController = globalThis.TectonicPresetFlow.createController({
    refs: {
      appHeader,
      appShell,
      assistantInput,
      builderPanel,
      builderDescribeModeBtn,
      builderDescribePanel,
      builderPresetModeBtn,
      builderPresetPanel,
      copyBtn,
      customWorkloadBtn,
      downloadJsonBtn,
      newWorkloadBtn,
      presetBrowserBtn,
      presetFamilySelect,
      presetFileSelect,
      presetSelectionNote,
      previewPanel,
      runWorkloadBtn,
      runsPanel,
      validationResult,
      welcomePanel,
    },
    state: {
      getActivePresetJson() {
        return activePresetJson;
      },
      setActivePresetJson(nextValue) {
        activePresetJson = nextValue;
      },
      getCustomWorkloadMode() {
        return customWorkloadMode;
      },
      setCustomWorkloadMode(nextValue) {
        customWorkloadMode = nextValue === true;
      },
      getBuilderInputMode() {
        return builderInputMode;
      },
      setBuilderInputMode(nextValue) {
        builderInputMode = nextValue === "describe" ? "describe" : "preset";
      },
      hasConfiguredWorkload() {
        return hasConfiguredWorkloadStructure();
      },
    },
    presetIndexPath: PRESET_INDEX_PATH,
      cloneJsonValue,
      clearWorkloadRuns() {
        const controller = getWorkloadRunsPanelController();
        if (!controller || typeof controller.clearRuns !== "function") {
          return;
        }
        controller.clearRuns();
      },
      clearPersistedCustomBuilderState,
      ensureWorkloadStructureState,
      loadActiveStructureIntoForm,
    loadPresetIntoBuilder,
    renderGeneratedJson,
    resetFormInterface,
    setValidationStatus,
    updateInteractiveStats,
    updateJsonFromForm,
    validateGeneratedJson,
  });
  return presetFlowController;
}

function getAssistantPanelController() {
  if (assistantPanelController) {
    return assistantPanelController;
  }
  if (
    !globalThis.TectonicAssistantPanel ||
    typeof globalThis.TectonicAssistantPanel.createController !== "function"
  ) {
    return null;
  }
  assistantPanelController = globalThis.TectonicAssistantPanel.createController(
    {
      refs: {
        assistantApplyBtn,
        assistantClearBtn,
        assistantComposerHint,
        assistantInput,
        assistantStatus,
        assistantTimeline,
      },
      assistEndpoint: ASSIST_ENDPOINT,
      applyAssistantPatch,
      applyClarificationAnswerToForm,
      characterSetEnum,
      formOpsWithKeyFields,
      formOpsWithRangeFields,
      formOpsWithSelectionFields,
      formOpsWithValueFields,
      getActivePresetJson() {
        return activePresetJson;
      },
      getClarificationCurrentValue,
      getCurrentFormState,
      getCurrentWorkloadJson,
      getRangeFormatValues,
      getSchemaHintsForAssist,
      getSelectedOperations,
      getSelectionDistributionValues,
      getStringPatternValues,
      operationOrder,
      updateJsonFromForm,
    },
  );
  return assistantPanelController;
}

function getWorkloadRunsPanelController() {
  if (workloadRunsPanelController) {
    return workloadRunsPanelController;
  }
  if (
    !globalThis.TectonicWorkloadRunsPanel ||
    typeof globalThis.TectonicWorkloadRunsPanel.createController !== "function"
  ) {
    return null;
  }
  workloadRunsPanelController =
    globalThis.TectonicWorkloadRunsPanel.createController({
      refs: {
        runWorkloadBtn,
        runsList,
      },
      getCurrentWorkloadJson,
      getSelectedDatabase() {
        if (
          benchmarkDatabaseSelect &&
          typeof benchmarkDatabaseSelect.value === "string" &&
          benchmarkDatabaseSelect.value.trim()
        ) {
          return benchmarkDatabaseSelect.value.trim();
        }
        return "rocksdb";
      },
      setValidationStatus,
    });
  return workloadRunsPanelController;
}

function clearOperationFormState() {
  operationAdvancedState.clear();
  operationOrder.forEach((op) => {
    setOperationChecked(op, false);
    refreshAdvancedExpressionSummary(op);
  });
}

function loadPresetIntoBuilder(presetJson) {
  const normalizedJson =
    presetJson && typeof presetJson === "object"
      ? stripValidationMetadata(cloneJsonValue(presetJson))
      : {};
  workloadForm.reset();
  clearFieldLocks();
  clearOperationFormState();
  activePresetJson = null;

  const presetCharacterSet =
    normalizedJson && typeof normalizedJson.character_set === "string"
      ? normalizedJson.character_set.trim()
      : "";
  if (formCharacterSet) {
    const options = Array.from(formCharacterSet.options || []).map(
      (option) => option.value,
    );
    formCharacterSet.value = options.includes(presetCharacterSet)
      ? presetCharacterSet
      : "";
  }

  workloadStructureState =
    normalizedJson &&
    Array.isArray(normalizedJson.sections) &&
    normalizedJson.sections.length > 0
      ? normalizePatchedStructureSections(normalizedJson.sections)
      : [createEmptySectionState()];
  activeSectionIndex = 0;
  activeGroupIndex = 0;
  customWorkloadMode = true;
  builderInputMode = "describe";
  clearAssistantThread();
  setAssistantStatus("Ready", "default");
  setRunButtonBusy(false);
  loadActiveStructureIntoForm();
  updateJsonFromForm();
  syncLandingUi();
}

function persistCustomBuilderState() {
  if (!customWorkloadMode) {
    return;
  }
  ensureWorkloadStructureState();
  persistActiveStructureFromForm();
  writeCustomBuilderStorage({
    character_set:
      formCharacterSet && typeof formCharacterSet.value === "string"
        ? formCharacterSet.value.trim()
        : "",
    sections: cloneJsonValue(workloadStructureState),
    activeSectionIndex,
    activeGroupIndex,
  });
}

function restorePersistedCustomBuilderState() {
  const rawSnapshot = readCustomBuilderStorage();
  if (!rawSnapshot) {
    return false;
  }

  let snapshot = null;
  try {
    snapshot = JSON.parse(rawSnapshot);
  } catch (_error) {
    clearPersistedCustomBuilderState();
    return false;
  }

  if (!snapshot || typeof snapshot !== "object") {
    clearPersistedCustomBuilderState();
    return false;
  }

  const restoredSections =
    Array.isArray(snapshot.sections) && snapshot.sections.length > 0
      ? normalizePatchedStructureSections(snapshot.sections)
      : [createEmptySectionState()];
  if (
    !Array.isArray(restoredSections) ||
    !restoredSections.some(
      (section) =>
        Array.isArray(section && section.groups)
          ? section.groups.some(
              (group) =>
                group &&
                typeof group === "object" &&
                countConfiguredGroupOperations(group) > 0,
            )
          : false,
    )
  ) {
    clearPersistedCustomBuilderState();
    return false;
  }

  activePresetJson = null;
  customWorkloadMode = true;
  builderInputMode = "describe";
  clearFieldLocks();
  clearOperationFormState();
  clearAssistantThread();
  setAssistantStatus("Ready", "default");
  setRunButtonBusy(false);

  const restoredCharacterSet =
    typeof snapshot.character_set === "string" ? snapshot.character_set.trim() : "";
  if (formCharacterSet) {
    const options = Array.from(formCharacterSet.options || []).map(
      (option) => option.value,
    );
    formCharacterSet.value = options.includes(restoredCharacterSet)
      ? restoredCharacterSet
      : "";
  }

  workloadStructureState = restoredSections;
  activeSectionIndex = Math.max(
    0,
    Math.min(
      Number(snapshot.activeSectionIndex) || 0,
      workloadStructureState.length - 1,
    ),
  );
  const activeSection = workloadStructureState[activeSectionIndex];
  activeGroupIndex = Math.max(
    0,
    Math.min(
      Number(snapshot.activeGroupIndex) || 0,
      Array.isArray(activeSection && activeSection.groups)
        ? activeSection.groups.length - 1
        : 0,
    ),
  );

  loadActiveStructureIntoForm();
  updateJsonFromForm();
  syncLandingUi();
  return true;
}

function applyOperationSpecToForm(op, spec) {
  applyDefaultsToOperation(op);

  if (spec && typeof spec === "object") {
    if (typeof spec.character_set === "string") {
      setOperationInputValue(op, "character_set", spec.character_set);
    }
    if (Object.prototype.hasOwnProperty.call(spec, "op_count")) {
      const value = spec.op_count;
      if (Number.isFinite(value)) {
        clearAdvancedFieldValue(op, "op_count");
        setOperationInputValue(op, "op_count", value);
      } else {
        setAdvancedFieldValue(op, "op_count", value);
      }
    }
    if (Object.prototype.hasOwnProperty.call(spec, "k")) {
      const value = spec.k;
      if (Number.isFinite(value)) {
        clearAdvancedFieldValue(op, "k");
        setOperationInputValue(op, "k", value);
      } else {
        setAdvancedFieldValue(op, "k", value);
      }
    }
    if (Object.prototype.hasOwnProperty.call(spec, "l")) {
      const value = spec.l;
      if (Number.isFinite(value)) {
        clearAdvancedFieldValue(op, "l");
        setOperationInputValue(op, "l", value);
      } else {
        setAdvancedFieldValue(op, "l", value);
      }
    }
    if (Object.prototype.hasOwnProperty.call(spec, "selectivity")) {
      const value = spec.selectivity;
      if (Number.isFinite(value)) {
        clearAdvancedFieldValue(op, "selectivity");
        setOperationInputValue(op, "selectivity", value);
      } else {
        setAdvancedFieldValue(op, "selectivity", value);
      }
    }
    if (Object.prototype.hasOwnProperty.call(spec, "key")) {
      setAdvancedFieldValue(op, "key", spec.key);
    }
    if (Object.prototype.hasOwnProperty.call(spec, "val")) {
      setAdvancedFieldValue(op, "val", spec.val);
    }
    if (Object.prototype.hasOwnProperty.call(spec, "selection")) {
      setAdvancedFieldValue(op, "selection", spec.selection);
    }
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
      if (
        Object.prototype.hasOwnProperty.call(spec, field) &&
        Number.isFinite(spec[field])
      ) {
        setOperationInputValue(op, field, spec[field]);
      }
    });
    if (typeof spec.selection_distribution === "string") {
      setOperationInputValue(op, "selection_distribution", spec.selection_distribution);
    }
    if (typeof spec.key_pattern === "string") {
      setOperationInputValue(op, "key_pattern", spec.key_pattern);
    }
    if (typeof spec.val_pattern === "string") {
      setOperationInputValue(op, "val_pattern", spec.val_pattern);
    }
    if (typeof spec.range_format === "string") {
      setOperationInputValue(op, "range_format", spec.range_format);
    }
  }

  refreshSelectionParamVisibility(op);
  refreshStringPatternVisibility(op);
  refreshAdvancedExpressionSummary(op);
}

function loadActiveStructureIntoForm() {
  ensureWorkloadStructureState();
  renderStructureSelectors();
  clearOperationFormState();

  const activeSection = getActiveSectionState();
  const activeGroup = getActiveGroupState();

  if (formSkipKeyContainsCheck) {
    formSkipKeyContainsCheck.checked = !!activeSection.skip_key_contains_check;
  }

  operationOrder.forEach((op) => {
    const spec =
      activeGroup &&
      typeof activeGroup === "object" &&
      Object.prototype.hasOwnProperty.call(activeGroup, op)
        ? activeGroup[op]
        : null;
    if (!spec || typeof spec !== "object") {
      refreshAdvancedExpressionSummary(op);
      return;
    }
    setOperationChecked(op, true);
    applyOperationSpecToForm(op, spec);
  });
}

function buildActiveGroupSpecFromForm(characterSet) {
  const selectedOps = getSelectedOperations();
  const group = {};
  selectedOps.forEach((op) => {
    group[op] = buildOperationSpec(op, characterSet);
  });
  return group;
}

function persistActiveStructureFromForm() {
  if (!customWorkloadMode) {
    return;
  }
  ensureWorkloadStructureState();
  const activeSection = getActiveSectionState();
  activeSection.skip_key_contains_check = !!(
    formSkipKeyContainsCheck && formSkipKeyContainsCheck.checked
  );
  activeSection.groups[activeGroupIndex] = buildActiveGroupSpecFromForm(
    formCharacterSet ? formCharacterSet.value.trim() : "",
  );
}

function resizeSections(nextCount) {
  const count = Math.max(1, Math.floor(Number(nextCount) || 1));
  persistActiveStructureFromForm();
  ensureWorkloadStructureState();
  while (workloadStructureState.length < count) {
    workloadStructureState.push(createEmptySectionState());
  }
  workloadStructureState = workloadStructureState.slice(0, count);
  if (activeSectionIndex >= workloadStructureState.length) {
    activeSectionIndex = workloadStructureState.length - 1;
  }
  activeGroupIndex = 0;
  loadActiveStructureIntoForm();
}

function resizeGroupsPerSection(nextCount) {
  const count = Math.max(1, Math.floor(Number(nextCount) || 1));
  persistActiveStructureFromForm();
  ensureWorkloadStructureState();
  workloadStructureState.forEach((section) => {
    while (section.groups.length < count) {
      section.groups.push(createEmptyGroupSpec());
    }
    section.groups = section.groups.slice(0, count);
  });
  const activeSection = getActiveSectionState();
  if (activeGroupIndex >= activeSection.groups.length) {
    activeGroupIndex = activeSection.groups.length - 1;
  }
  loadActiveStructureIntoForm();
}

function syncLandingUi() {
  const controller = getPresetFlowController();
  if (!controller) {
    return;
  }
  controller.syncLandingUi();
}

function enableCustomWorkloadMode() {
  const controller = getPresetFlowController();
  if (!controller) {
    customWorkloadMode = true;
    builderInputMode = "describe";
    return;
  }
  controller.enableCustomWorkloadMode();
}

async function loadPresetCatalog() {
  const controller = getPresetFlowController();
  if (!controller) {
    return;
  }
  await controller.loadPresetCatalog();
}

function handlePresetFamilyChange(event) {
  const controller = getPresetFlowController();
  if (!controller) {
    return;
  }
  controller.handlePresetFamilyChange(event);
}

async function handlePresetFileChange(event) {
  const controller = getPresetFlowController();
  if (!controller) {
    return;
  }
  await controller.handlePresetFileChange(event);
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
  const sectionsHelp = combineDescriptions([
    "Sections do not share valid keys. Use different sections for independent keyspaces or phases that should not share inserted keys.",
    getTopLevelDescription("sections"),
  ]);
  const groupsHelp = combineDescriptions([
    "Groups inside a section share valid keys. Use different groups when operations share keys but are not interleaved; put interleaved operations in the same group.",
    getSectionDescription("groups"),
  ]);
  const skipKeyContainsHelp = getSectionDescription("skip_key_contains_check");

  setInlineLabelWithHelp(
    formCharacterSetLabel,
    "Character Set",
    characterSetHelp,
  );
  setInlineLabelWithHelp(formSectionsLabel, "Active Section", sectionsHelp);
  setInlineLabelWithHelp(formGroupsLabel, "Active Group", groupsHelp);
  setInlineLabelWithHelp(
    skipKeyContainsCheckLabel,
    "Skip Key Contains Check",
    combineDescriptions([
      "Applies to the active section only.",
      skipKeyContainsHelp,
    ]),
  );
  setInlineLabelWithHelp(
    operationsTitle,
    "Operations",
    combineDescriptions([
      "Configure the operations that belong to the active group.",
      groupsHelp,
    ]),
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
  title.textContent = "Assistant-applied advanced config";
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
  const opCard = document.getElementById(getOperationCardId(op));
  if (!opCard) {
    return;
  }
  const patternValues = getStringPatternValues();
  ["key", "val"].forEach((target) => {
    const supportsTarget =
      target === "key"
        ? formOpsWithKeyFields.has(op)
        : formOpsWithValueFields.has(op);
    if (!supportsTarget) {
      return;
    }

    const targetFields = opCard.querySelectorAll(
      '.field[data-pattern-target="' + target + '"]',
    );
    if (hasAdvancedFieldValue(op, target)) {
      targetFields.forEach((fieldContainer) => {
        fieldContainer.classList.add("hidden");
      });
      return;
    }
    targetFields.forEach((fieldContainer) => {
      fieldContainer.classList.remove("hidden");
    });

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

    const uniformLenInput = opCard.querySelector(
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
      const input = opCard.querySelector(
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

function getEffectiveOperationCharacterSet(op) {
  const operationCharacterSet = readOperationField(op, "character_set");
  if (operationCharacterSet) {
    return operationCharacterSet;
  }
  if (formCharacterSet && formCharacterSet.value) {
    return formCharacterSet.value;
  }
  return null;
}

function getAdvancedExpressionRenderer() {
  if (advancedExpressionRenderer) {
    return advancedExpressionRenderer;
  }
  if (
    !globalThis.TectonicAdvancedExpressions ||
    typeof globalThis.TectonicAdvancedExpressions.createRenderer !== "function"
  ) {
    return null;
  }
  advancedExpressionRenderer = globalThis.TectonicAdvancedExpressions.createRenderer(
    {
      titleCaseFromSnake,
      getSelectionDistributionValues,
      getSelectionParamsForDistribution,
      selectionParamUi: SELECTION_PARAM_UI,
      selectionParamDefaults: SELECTION_PARAM_DEFAULTS,
      operationDefaults: OPERATION_DEFAULTS,
      stringPatternDefaults: STRING_PATTERN_DEFAULTS,
      cloneJsonValue,
      buildUniformStringExpr,
      intOrDefault,
      numberOrDefault,
      nonNegativeIntOrDefault,
      probabilityOrDefault,
      getEffectiveOperationCharacterSet,
      setAdvancedFieldValue,
      clearAdvancedFieldValue,
      updateJsonFromForm,
    },
  );
  return advancedExpressionRenderer;
}

function refreshAdvancedExpressionSummary(op) {
  const container = document.getElementById("advanced-summary-" + op);
  if (!container) {
    return;
  }
  const renderer = getAdvancedExpressionRenderer();
  if (!renderer) {
    container.classList.add("hidden");
    return;
  }
  renderer.render(
    container,
    op,
    operationAdvancedState.get(op) || {},
    ADVANCED_OPERATION_FIELDS,
  );
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
  if (characterSet) {
    json.character_set = characterSet;
  }

  if (customWorkloadMode) {
    persistActiveStructureFromForm();
  }
  ensureWorkloadStructureState();

  const sections = workloadStructureState.map((sectionState) => {
    const section = {
      groups: Array.isArray(sectionState.groups)
        ? sectionState.groups.map((group) => cloneJsonValue(group))
        : [],
    };
    if (characterSet) {
      section.character_set = characterSet;
    }
    if (sectionState.skip_key_contains_check === true) {
      section.skip_key_contains_check = true;
    }
    return section;
  });

  const hasConfiguredGroups = sections.some(
    (section) =>
      Array.isArray(section.groups) &&
      section.groups.some(
        (group) =>
          group && typeof group === "object" && Object.keys(group).length > 0,
      ),
  );
  const hasSectionFlags = sections.some(
    (section) => section.skip_key_contains_check === true,
  );
  if (!hasConfiguredGroups && !hasSectionFlags && !characterSet) {
    return json;
  }

  json.sections = sections;
  return json;
}

function findJsonGroupLineIndex(jsonText, targetSectionIndex, targetGroupIndex) {
  const lines = String(jsonText || "").split("\n");
  let inSections = false;
  let inGroups = false;
  let currentSectionIndex = -1;
  let currentGroupIndex = -1;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    const indent = line.length - line.trimStart().length;

    if (trimmed === '"sections": [') {
      inSections = true;
      inGroups = false;
      currentSectionIndex = -1;
      currentGroupIndex = -1;
      continue;
    }

    if (inSections && !inGroups && indent === 4 && trimmed === "{") {
      currentSectionIndex += 1;
      currentGroupIndex = -1;
      continue;
    }

    if (inSections && indent === 6 && trimmed === '"groups": [') {
      inGroups = true;
      currentGroupIndex = -1;
      continue;
    }

    if (inGroups && indent === 8 && trimmed === "{") {
      currentGroupIndex += 1;
      if (
        currentSectionIndex === targetSectionIndex &&
        currentGroupIndex === targetGroupIndex
      ) {
        return index;
      }
      continue;
    }

    if (inGroups && indent === 6 && (trimmed === "]" || trimmed === "],")) {
      inGroups = false;
      continue;
    }

    if (inSections && indent === 2 && (trimmed === "]" || trimmed === "],")) {
      inSections = false;
    }
  }

  return null;
}

function getJsonTreeViewer() {
  if (jsonTreeViewer) {
    return jsonTreeViewer;
  }
  if (
    !jsonTree ||
    !globalThis.TectonicJsonTreeView ||
    typeof globalThis.TectonicJsonTreeView.createViewer !== "function"
  ) {
    return null;
  }
  jsonTreeViewer = globalThis.TectonicJsonTreeView.createViewer({
    container: jsonTree,
  });
  return jsonTreeViewer;
}

function syncJsonPreviewVisibility() {
  if (jsonOutputShell) {
    jsonOutputShell.hidden = !jsonPreviewVisible;
  }
  if (toggleJsonPreviewBtn) {
    toggleJsonPreviewBtn.textContent = jsonPreviewVisible
      ? "Hide Spec JSON"
      : "Show Spec JSON";
  }
}

function setJsonPreviewVisible(nextValue) {
  jsonPreviewVisible = nextValue === true;
  syncJsonPreviewVisibility();
}

function operationDisplayName(op) {
  const labels = {
    inserts: "inserts",
    updates: "updates",
    merges: "read-modify-write merges",
    point_queries: "point queries",
    range_queries: "range queries",
    point_deletes: "point deletes",
    range_deletes: "range deletes",
    empty_point_queries: "empty point queries",
    empty_point_deletes: "empty point deletes",
    sorted: "sorted operations",
  };
  return labels[op] || String(op || "").replace(/_/g, " ");
}

function joinPhrases(parts) {
  const values = Array.isArray(parts)
    ? parts.filter((value) => typeof value === "string" && value.trim())
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
  return values.slice(0, -1).join(", ") + ", and " + values[values.length - 1];
}

function extractConfiguredOperations(group) {
  if (!group || typeof group !== "object") {
    return [];
  }
  return operationOrder
    .filter((op) => {
      if (!Object.prototype.hasOwnProperty.call(group, op)) {
        return false;
      }
      const spec = group[op];
      if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
        return false;
      }
      if (
        Object.prototype.hasOwnProperty.call(spec, "enabled") &&
        spec.enabled === false
      ) {
        return false;
      }
      return true;
    })
    .map((op) => ({
      name: op,
      spec: group[op],
    }));
}

function getEffectiveCharacterSet(rootJson, section, group, spec) {
  if (spec && typeof spec.character_set === "string" && spec.character_set) {
    return spec.character_set;
  }
  if (group && typeof group.character_set === "string" && group.character_set) {
    return group.character_set;
  }
  if (
    section &&
    typeof section.character_set === "string" &&
    section.character_set
  ) {
    return section.character_set;
  }
  if (
    rootJson &&
    typeof rootJson.character_set === "string" &&
    rootJson.character_set
  ) {
    return rootJson.character_set;
  }
  return "";
}

function describeStringExpression(expr) {
  if (typeof expr === "string" && expr.trim()) {
    return 'set to "' + expr.trim() + '"';
  }
  if (!expr || typeof expr !== "object" || Array.isArray(expr)) {
    return "";
  }
  if (
    expr.uniform &&
    typeof expr.uniform === "object" &&
    Number.isFinite(expr.uniform.len)
  ) {
    return "generated uniformly at length " + formatCount(expr.uniform.len);
  }
  if (expr.hot_range && typeof expr.hot_range === "object") {
    return "generated with a hot-range expression";
  }
  if (Array.isArray(expr.weighted)) {
    return "generated with a weighted expression";
  }
  if (Array.isArray(expr.segmented)) {
    return "generated with a segmented expression";
  }
  return "generated with a custom expression";
}

function describeStringField(spec, fieldBase) {
  if (!spec || typeof spec !== "object") {
    return "";
  }
  const expressionDescription = describeStringExpression(spec[fieldBase]);
  if (expressionDescription) {
    return expressionDescription;
  }
  const pattern = spec[fieldBase + "_pattern"];
  const length = spec[fieldBase + "_len"];
  if (typeof pattern === "string" && pattern && Number.isFinite(length)) {
    if (pattern === "uniform") {
      return "generated uniformly at length " + formatCount(length);
    }
    return pattern.replace(/_/g, " ") + " pattern at length " + formatCount(length);
  }
  if (typeof pattern === "string" && pattern) {
    return "generated with a " + pattern.replace(/_/g, " ") + " pattern";
  }
  if (Number.isFinite(length)) {
    return "generated at length " + formatCount(length);
  }
  return "";
}

function hasConfiguredStringField(spec, fieldBase) {
  if (!spec || typeof spec !== "object") {
    return false;
  }
  return !!(
    spec[fieldBase] ||
    (typeof spec[fieldBase + "_pattern"] === "string" &&
      spec[fieldBase + "_pattern"]) ||
    Number.isFinite(spec[fieldBase + "_len"])
  );
}

function isPlaceholderUniformSelection(spec) {
  return !!(
    spec &&
    typeof spec === "object" &&
    !spec.selection &&
    spec.selection_distribution === "uniform" &&
    Number(spec.selection_min) === 0 &&
    Number(spec.selection_max) === 1
  );
}

function getRangeProfileLabel(spec) {
  if (!spec || typeof spec !== "object") {
    return "";
  }
  const selectivity = Number(spec.selectivity);
  if (!Number.isFinite(selectivity)) {
    return "";
  }
  if (Math.abs(selectivity - 0.001) < 1e-9) {
    return "short";
  }
  if (Math.abs(selectivity - 0.01) < 1e-9) {
    return "long";
  }
  return "";
}

function hasCustomRangeShape(spec) {
  if (!spec || typeof spec !== "object") {
    return false;
  }
  return !!(
    (Number.isFinite(spec.k) && Number(spec.k) !== 0) ||
    (Number.isFinite(spec.l) && Number(spec.l) !== 0)
  );
}

function operationSummaryName(op, spec) {
  if (op === "range_queries" || op === "range_deletes") {
    const profile = getRangeProfileLabel(spec);
    if (profile === "short") {
      return op === "range_queries" ? "short range queries" : "short range deletes";
    }
    if (profile === "long") {
      return op === "range_queries" ? "long range queries" : "long range deletes";
    }
  }
  return operationDisplayName(op);
}

function describeSelectionSettings(spec, context) {
  if (!spec || typeof spec !== "object") {
    return "";
  }
  if (
    context &&
    context.targetsInsertedKeys &&
    isPlaceholderUniformSelection(spec)
  ) {
    return "";
  }
  if (spec.selection && typeof spec.selection === "object") {
    if (
      spec.selection.uniform &&
      typeof spec.selection.uniform === "object" &&
      Number.isFinite(spec.selection.uniform.min) &&
      Number.isFinite(spec.selection.uniform.max)
    ) {
      return (
        "selection uniform from " +
        formatCount(spec.selection.uniform.min) +
        " to " +
        formatCount(spec.selection.uniform.max)
      );
    }
    return "selection uses a custom distribution";
  }
  if (
    typeof spec.selection_distribution === "string" &&
    spec.selection_distribution
  ) {
    const parts = [spec.selection_distribution.replace(/_/g, " ")];
    if (
      Number.isFinite(spec.selection_min) &&
      Number.isFinite(spec.selection_max)
    ) {
      parts.push(
        "range " +
          formatCount(spec.selection_min) +
          "-" +
          formatCount(spec.selection_max),
      );
    } else if (
      Number.isFinite(spec.selection_mean) ||
      Number.isFinite(spec.selection_std_dev)
    ) {
      const params = [];
      if (Number.isFinite(spec.selection_mean)) {
        params.push("mean " + formatCount(spec.selection_mean));
      }
      if (Number.isFinite(spec.selection_std_dev)) {
        params.push("std dev " + formatCount(spec.selection_std_dev));
      }
      if (params.length > 0) {
        parts.push(params.join(", "));
      }
    }
    return "selection " + parts.join(" ");
  }
  return "";
}

function describeRangeSettings(spec) {
  if (!spec || typeof spec !== "object") {
    return "";
  }
  if (
    getRangeProfileLabel(spec) &&
    typeof spec.range_format === "string" &&
    spec.range_format === "StartCount" &&
    !hasCustomRangeShape(spec)
  ) {
    return "";
  }
  const details = [];
  if (typeof spec.range_format === "string" && spec.range_format) {
    details.push(spec.range_format + " format");
  }
  if (Number.isFinite(spec.k) && Number(spec.k) !== 0) {
    details.push("k " + formatCount(spec.k));
  }
  if (Number.isFinite(spec.l) && Number(spec.l) !== 0) {
    details.push("l " + formatCount(spec.l));
  }
  if (Number.isFinite(spec.selectivity)) {
    details.push("selectivity " + spec.selectivity);
  }
  return details.length > 0 ? "range " + details.join(", ") : "";
}

function describeOperationPhrase(op, spec, rootJson, section, group, context) {
  const prefix = Number.isFinite(spec && spec.op_count)
    ? formatCount(spec.op_count) + " " + operationSummaryName(op, spec)
    : operationSummaryName(op, spec);
  let phrase = prefix;
  const details = [];
  const effectiveCharacterSet = getEffectiveCharacterSet(
    rootJson,
    section,
    group,
    spec,
  );

  if (op === "inserts") {
    const keyDescription = describeStringField(spec, "key");
    const valueDescription = describeStringField(spec, "val");
    if (effectiveCharacterSet) {
      details.push("character set " + effectiveCharacterSet);
    }
    if (keyDescription) {
      details.push("keys " + keyDescription);
    }
    if (valueDescription) {
      details.push("values " + valueDescription);
    }
  } else {
    const targetsInsertedKeys =
      !!(context && context.targetsInsertedKeys) &&
      (isPlaceholderUniformSelection(spec) || !hasExplicitSelectionSettings(spec));
    if (targetsInsertedKeys) {
      phrase += " against inserted keys";
    }
    const selectionDescription = describeSelectionSettings(spec, {
      targetsInsertedKeys: targetsInsertedKeys,
    });
    const rangeDescription =
      op === "range_queries" || op === "range_deletes"
        ? describeRangeSettings(spec)
        : "";
    if (selectionDescription) {
      details.push(selectionDescription);
    }
    if (rangeDescription) {
      details.push(rangeDescription);
    }
  }

  return details.length > 0 ? phrase + " (" + details.join("; ") + ")" : phrase;
}

function operationProducesKeys(op) {
  return op === "inserts";
}

function operationNeedsExistingKeys(op) {
  return [
    "updates",
    "merges",
    "point_queries",
    "range_queries",
    "point_deletes",
    "range_deletes",
    "empty_point_queries",
    "empty_point_deletes",
  ].includes(op);
}

function hasExplicitSelectionSettings(spec) {
  if (!spec || typeof spec !== "object") {
    return false;
  }
  return !!(
    (spec.selection && typeof spec.selection === "object") ||
    (typeof spec.selection_distribution === "string" &&
      spec.selection_distribution)
  );
}

function hasExplicitRangeSettings(spec) {
  if (!spec || typeof spec !== "object") {
    return false;
  }
  return !!(
    (typeof spec.range_format === "string" && spec.range_format) ||
    Number.isFinite(spec.k) ||
    Number.isFinite(spec.l) ||
    Number.isFinite(spec.selectivity)
  );
}

function buildWorkloadSummaryModel(json) {
  if (!json || typeof json !== "object" || !Array.isArray(json.sections)) {
    return {
      overview: "No workload JSON is available yet.",
      groups: [],
      assumptions: [],
    };
  }

  const sections = json.sections.filter(
    (section) => section && typeof section === "object",
  );
  const groupDescriptions = [];
  const assumptions = [];
  let totalGroups = 0;
  let writesSeen = false;
  let operationsNeedingExistingKeys = false;
  let inheritedCharacterSetUsed = false;
  let implicitSelectionUsed = false;
  let implicitRangeUsed = false;
  let implicitInsertGenerators = false;
  let sectionLevelSkipEnabled = false;
  let defaultShortRangeProfileUsed = false;
  let insertedKeyspaceNarrationUsed = false;

  sections.forEach((section, sectionIndex) => {
    const groups = Array.isArray(section.groups)
      ? section.groups.filter((group) => group && typeof group === "object")
      : [];
    groups.forEach((group, groupIndex) => {
      totalGroups += 1;
      const configuredOperations = extractConfiguredOperations(group);
      if (configuredOperations.length === 0) {
        return;
      }
      const groupCreatesKeys = configuredOperations.some((entry) =>
        operationProducesKeys(entry.name),
      );

      const phrases = configuredOperations.map((entry) =>
        describeOperationPhrase(entry.name, entry.spec, json, section, group, {
          targetsInsertedKeys:
            operationNeedsExistingKeys(entry.name) && (writesSeen || groupCreatesKeys),
        }),
      );
      const label =
        sections.length === 1
          ? "Group " + (groupIndex + 1)
          : "Section " + (sectionIndex + 1) + ", group " + (groupIndex + 1);
      const verb = configuredOperations.length > 1 ? "interleaves " : "runs ";
      if (configuredOperations.length === 0) {
        groupDescriptions.push(label + " is empty.");
        return;
      }

      groupDescriptions.push(label + " " + verb + joinPhrases(phrases) + ".");

      configuredOperations.forEach((entry) => {
        const spec = entry.spec;
        const op = entry.name;
        const effectiveCharacterSet = getEffectiveCharacterSet(
          json,
          section,
          group,
          spec,
        );
        const explicitCharacterSet =
          spec && typeof spec.character_set === "string" && spec.character_set;
        if (!explicitCharacterSet && effectiveCharacterSet) {
          inheritedCharacterSetUsed = true;
        }
        if (operationNeedsExistingKeys(op) && (writesSeen || groupCreatesKeys)) {
          operationsNeedingExistingKeys = true;
        }
        if (
          operationNeedsExistingKeys(op) &&
          !hasExplicitSelectionSettings(spec) &&
          op !== "empty_point_queries" &&
          op !== "empty_point_deletes"
        ) {
          implicitSelectionUsed = true;
        }
        if (
          (op === "range_queries" || op === "range_deletes") &&
          !hasExplicitRangeSettings(spec)
        ) {
          implicitRangeUsed = true;
        }
        if (
          (op === "range_queries" || op === "range_deletes") &&
          getRangeProfileLabel(spec) === "short" &&
          !hasCustomRangeShape(spec)
        ) {
          defaultShortRangeProfileUsed = true;
        }
        if (
          operationNeedsExistingKeys(op) &&
          (writesSeen || groupCreatesKeys) &&
          (isPlaceholderUniformSelection(spec) || !hasExplicitSelectionSettings(spec))
        ) {
          insertedKeyspaceNarrationUsed = true;
        }
        if (
          op === "inserts" &&
          (!hasConfiguredStringField(spec, "key") ||
            !hasConfiguredStringField(spec, "val"))
        ) {
          implicitInsertGenerators = true;
        }
      });

      if (
        configuredOperations.some((entry) => operationProducesKeys(entry.name))
      ) {
        writesSeen = true;
      }
    });

    if (section.skip_key_contains_check === true) {
      sectionLevelSkipEnabled = true;
    }
  });

  const totalOperations = sections.reduce((total, section) => {
    const groups = Array.isArray(section.groups) ? section.groups : [];
    return (
      total +
      groups.reduce((groupTotal, group) => {
        return groupTotal + extractConfiguredOperations(group).length;
      }, 0)
    );
  }, 0);

  const overviewParts = [
    "This workload contains " +
      formatCount(sections.length) +
      " section" +
      (sections.length === 1 ? "" : "s") +
      ", " +
      formatCount(totalGroups) +
      " group" +
      (totalGroups === 1 ? "" : "s") +
      ", and " +
      formatCount(totalOperations) +
      " active operation type" +
      (totalOperations === 1 ? "" : "s") +
      ".",
  ];
  if (typeof json.character_set === "string" && json.character_set) {
    overviewParts.push(
      "The workload-wide character set is " + json.character_set + ".",
    );
  }
  if (json.skip_key_contains_check === true) {
    overviewParts.push("Global skip key contains check is enabled.");
  }

  if (inheritedCharacterSetUsed) {
    assumptions.push(
      'Operations without an explicit character set inherit it from the nearest group, section, or workload setting' +
        (typeof json.character_set === "string" && json.character_set
          ? ', with "' + json.character_set + '" as the workload default.'
          : "."),
    );
  }
  if (operationsNeedingExistingKeys) {
    assumptions.push(
      "Read, update, merge, and delete operations are assumed to target keys created by earlier write phases or by inserts interleaved in the same group.",
    );
  }
  if (insertedKeyspaceNarrationUsed) {
    assumptions.push(
      "Where selection bounds are left at placeholder defaults, the summary describes those operations as targeting the inserted keyspace instead of literal 0-1 bounds.",
    );
  }
  if (implicitSelectionUsed) {
    assumptions.push(
      "Operations without explicit selection settings keep Tectonic's default key-selection behavior.",
    );
  }
  if (implicitRangeUsed) {
    assumptions.push(
      "Range operations without explicit width or selectivity settings keep Tectonic's default range behavior.",
    );
  }
  if (implicitInsertGenerators) {
    assumptions.push(
      "Insert operations without explicit key/value generators keep Tectonic's default generator settings.",
    );
  }
  if (defaultShortRangeProfileUsed) {
    assumptions.push(
      "Short range queries use the app's default short-range profile unless a custom range shape is specified.",
    );
  }
  if (sectionLevelSkipEnabled && json.skip_key_contains_check !== true) {
    assumptions.push(
      "Skip key contains check is enabled only for specific sections, not globally.",
    );
  }

  return {
    overview: overviewParts.join(" "),
    groups: groupDescriptions,
    assumptions: Array.from(new Set(assumptions)),
  };
}

function renderJsonSummary(json) {
  if (!jsonSummary) {
    return;
  }
  const model = buildWorkloadSummaryModel(json);
  jsonSummary.replaceChildren();

  const header = document.createElement("div");
  header.className = "json-summary-header";

  const title = document.createElement("div");
  title.className = "json-summary-title";
  title.textContent = "Workload Summary";
  header.appendChild(title);
  jsonSummary.appendChild(header);

  const overview = document.createElement("div");
  overview.className = "json-summary-overview";
  overview.textContent = model.overview;
  jsonSummary.appendChild(overview);

  if (Array.isArray(model.groups) && model.groups.length > 0) {
    const groupsSection = document.createElement("section");
    groupsSection.className = "json-summary-section";

    const groupsTitle = document.createElement("div");
    groupsTitle.className = "json-summary-section-title";
    groupsTitle.textContent = "Execution plan";
    groupsSection.appendChild(groupsTitle);

    const groupsList = document.createElement("ul");
    groupsList.className = "json-summary-list";
    model.groups.forEach((text) => {
      const item = document.createElement("li");
      item.textContent = text;
      groupsList.appendChild(item);
    });
    groupsSection.appendChild(groupsList);
    jsonSummary.appendChild(groupsSection);
  }

  if (Array.isArray(model.assumptions) && model.assumptions.length > 0) {
    const assumptionsSection = document.createElement("section");
    assumptionsSection.className = "json-summary-section";

    const assumptionsTitle = document.createElement("div");
    assumptionsTitle.className = "json-summary-section-title";
    assumptionsTitle.textContent = "Assumptions filled in";
    assumptionsSection.appendChild(assumptionsTitle);

    const assumptionsList = document.createElement("ul");
    assumptionsList.className = "json-summary-assumptions";
    model.assumptions.forEach((text) => {
      const item = document.createElement("li");
      item.textContent = text;
      assumptionsList.appendChild(item);
    });
    assumptionsSection.appendChild(assumptionsList);
    jsonSummary.appendChild(assumptionsSection);
  }
}

function renderGeneratedJson(json) {
  const jsonText = JSON.stringify(json, null, 2);
  jsonOutput.value = jsonText;
  renderJsonSummary(json);
  syncJsonPreviewVisibility();
  const viewer = getJsonTreeViewer();
  if (viewer) {
    jsonOutput.hidden = true;
    viewer.render(json);
    return;
  }
  jsonOutput.hidden = false;
}

function scrollJsonOutputToGroupFocus(target) {
  if (!jsonPreviewVisible) {
    setJsonPreviewVisible(true);
  }
  const viewer = getJsonTreeViewer();
  if (viewer && viewer.focusGroup(target)) {
    return;
  }
  if (
    !jsonOutput ||
    !target ||
    !Number.isInteger(target.sectionIndex) ||
    !Number.isInteger(target.groupIndex)
  ) {
    return;
  }
  const lineIndex = findJsonGroupLineIndex(
    jsonOutput.value,
    target.sectionIndex,
    target.groupIndex,
  );
  if (lineIndex === null) {
    return;
  }
  const style = window.getComputedStyle(jsonOutput);
  const lineHeight =
    Number.parseFloat(style.lineHeight) ||
    Number.parseFloat(style.fontSize || "13") * 1.6 ||
    20;
  jsonOutput.scrollTop = Math.max(0, lineIndex * lineHeight - lineHeight * 2);
}

function shouldAutoValidateJson(json) {
  if (!json || typeof json !== "object") {
    return false;
  }
  if (Array.isArray(json.sections)) {
    return json.sections.length > 0;
  }
  return Object.keys(json).length > 0;
}

function stripValidationMetadata(json) {
  const cloned = cloneJsonValue(json);
  if (
    cloned &&
    typeof cloned === "object" &&
    !Array.isArray(cloned) &&
    Object.prototype.hasOwnProperty.call(cloned, "$schema")
  ) {
    delete cloned.$schema;
  }
  return cloned;
}

async function getSchemaValidator() {
  if (!schema) {
    throw new Error("Schema not loaded.");
  }
  if (!schemaValidatorPromise) {
    schemaValidatorPromise =
      import("https://esm.sh/ajv@8.17.1/dist/2020?bundle")
        .then(({ default: Ajv2020 }) => {
          const ajv = new Ajv2020({
            allErrors: true,
            strict: false,
            validateFormats: false,
          });
          return ajv.compile(schema);
        })
        .catch((error) => {
          schemaValidatorPromise = null;
          throw error;
        });
  }
  return schemaValidatorPromise;
}

async function validateGeneratedJson(json) {
  const validationToken = ++latestValidationToken;
  if (!shouldAutoValidateJson(json)) {
    validationResult.className = "validation-result";
    validationResult.textContent = "";
    return;
  }

  setValidationStatus("Validating...", "default");
  try {
    const validate = await getSchemaValidator();
    const valid = validate(
      toSchemaValidationShape(stripValidationMetadata(json), schema),
    );
    if (validationToken !== latestValidationToken) {
      return;
    }
    if (valid) {
      setValidationStatus("Valid ✓", "valid");
      return;
    }
    const errors = (validate.errors || [])
      .map((error) => {
        const path = error.instancePath || "/";
        return (path + " " + error.message).trim();
      })
      .join(", ");
    setValidationStatus("Warning: " + errors, "invalid");
  } catch (error) {
    if (validationToken !== latestValidationToken) {
      return;
    }
    setValidationStatus(
      "Warning: validation failed: " +
        (error && error.message ? error.message : String(error)),
      "invalid",
    );
  }
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
  const selectedOps = operationOrder.filter((op) =>
    hasSections
      ? json.sections.some(
          (section) =>
            Array.isArray(section.groups) &&
            section.groups.some(
              (group) =>
                group &&
                typeof group === "object" &&
                Object.prototype.hasOwnProperty.call(group, op),
            ),
        )
      : false,
  );
  const bytes = safeTextSizeBytes(jsonOutput.value || "{}");

  jsonSectionsPill.textContent = "sections: " + formatCount(sectionsCount);
  jsonOpsPill.textContent = "ops: " + formatCount(selectedOps.length);
  jsonBytesPill.textContent = "bytes: " + formatCount(bytes);
}

function updateJsonFromForm() {
  const generated = buildJsonFromForm();
  if (customWorkloadMode) {
    renderStructureSelectors();
  }
  renderGeneratedJson(generated);
  updateStructurePanelVisibility();
  if (pendingJsonFocusTarget) {
    scrollJsonOutputToGroupFocus(pendingJsonFocusTarget);
    pendingJsonFocusTarget = null;
  }
  updateInteractiveStats(generated);
  void validateGeneratedJson(generated);
  persistCustomBuilderState();
}

function getCurrentWorkloadJson() {
  return buildJsonFromForm();
}

function clearAssistantThread() {
  const controller = getAssistantPanelController();
  if (!controller) {
    return;
  }
  controller.clearThread();
}

function setAssistantStatus(text, tone) {
  const controller = getAssistantPanelController();
  if (!controller) {
    return;
  }
  controller.setStatus(text, tone);
}

function setAssistantBusy(isBusy) {
  const controller = getAssistantPanelController();
  if (!controller) {
    return;
  }
  controller.setBusy(isBusy);
}

function setRunButtonBusy(isBusy) {
  const controller = getWorkloadRunsPanelController();
  if (!controller) {
    return;
  }
  controller.setBusy(isBusy);
}

function setAssistantComposerHint(text) {
  const controller = getAssistantPanelController();
  if (!controller) {
    return;
  }
  controller.setComposerHint(text);
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
  const binding = clarification.binding;
  if (binding.type === "top_field") {
    if (binding.field === "character_set") {
      return formCharacterSet ? formCharacterSet.value : "";
    }
    if (binding.field === "sections_count") {
      return Array.isArray(workloadStructureState)
        ? workloadStructureState.length
        : 0;
    }
    if (binding.field === "groups_per_section") {
      const section = getActiveSectionState();
      return Array.isArray(section.groups) ? section.groups.length : 0;
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
        resizeSections(numeric);
        lockTopField("sections_count");
      }
    } else if (binding.field === "groups_per_section" && formGroups) {
      const numeric = Math.floor(Number(value));
      if (Number.isFinite(numeric) && numeric > 0) {
        resizeGroupsPerSection(numeric);
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

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getCurrentFormState() {
  if (customWorkloadMode) {
    persistActiveStructureFromForm();
  }
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
    sections_count: Array.isArray(workloadStructureState)
      ? workloadStructureState.length
      : null,
    groups_per_section: Array.isArray(getActiveSectionState().groups)
      ? getActiveSectionState().groups.length
      : null,
    skip_key_contains_check: !!(
      formSkipKeyContainsCheck && formSkipKeyContainsCheck.checked
    ),
    operations,
    sections: customWorkloadMode
      ? cloneJsonValue(workloadStructureState)
      : null,
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
  builderInputMode = "describe";

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

  if (Array.isArray(patch.sections) && patch.sections.length > 0) {
    workloadStructureState = normalizePatchedStructureSections(patch.sections);
    activeSectionIndex = 0;
    activeGroupIndex = 0;
    customWorkloadMode = true;
    builderInputMode = "describe";
    syncLandingUi();
    loadActiveStructureIntoForm();
    return;
  }

  if (
    Number.isFinite(patch.sections_count) &&
    patch.sections_count > 0 &&
    formSections &&
    !isTopFieldLocked("sections_count")
  ) {
    resizeSections(patch.sections_count);
  }

  if (
    Number.isFinite(patch.groups_per_section) &&
    patch.groups_per_section > 0 &&
    formGroups &&
    !isTopFieldLocked("groups_per_section")
  ) {
    resizeGroupsPerSection(patch.groups_per_section);
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
  const controller = getWorkloadRunsPanelController();
  if (!controller) {
    return;
  }
  await controller.handleRun();
}

async function handleAssistantApply() {
  const controller = getAssistantPanelController();
  if (!controller) {
    return;
  }
  await controller.handleApply();
}

function resetFormInterface(options) {
  const stayInBuilder =
    !options || typeof options !== "object"
      ? true
      : options.stayInBuilder !== false;
  workloadForm.reset();
  customWorkloadMode = stayInBuilder;
  builderInputMode = stayInBuilder ? "describe" : "preset";
  clearLoadedPresetState();
  resetWorkloadStructureState();
  clearFieldLocks();
  operationAdvancedState.clear();
  operationOrder.forEach((op) => setOperationCardVisibility(op, false));
  operationOrder.forEach((op) => refreshAdvancedExpressionSummary(op));
  if (formSkipKeyContainsCheck) {
    formSkipKeyContainsCheck.checked = false;
  }
  clearAssistantThread();
  setAssistantStatus("Ready", "default");
  setRunButtonBusy(false);
  const initial = JSON.parse(INITIAL_JSON_TEXT);
  renderGeneratedJson(initial);
  updateStructurePanelVisibility();
  updateInteractiveStats(initial);
  void validateGeneratedJson(initial);
  syncLandingUi();
  if (stayInBuilder) {
    persistCustomBuilderState();
  }
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
