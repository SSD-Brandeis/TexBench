    const workloadForm = document.getElementById('workloadForm');
    const formCharacterSet = document.getElementById('formCharacterSet');
    const formSections = document.getElementById('formSections');
    const formGroups = document.getElementById('formGroups');
    const formCharacterSetLabel = document.getElementById('formCharacterSetLabel');
    const formSectionsLabel = document.getElementById('formSectionsLabel');
    const formGroupsLabel = document.getElementById('formGroupsLabel');
    const operationsTitle = document.getElementById('operationsTitle');
    const presetButtons = document.querySelectorAll('.preset-btn');
    const operationToggles = document.getElementById('operationToggles');
    const operationConfigContainer = document.getElementById('operationConfigContainer');
    const jsonOutput = document.getElementById('jsonOutput');
    const hudSections = document.getElementById('hudSections');
    const hudGroups = document.getElementById('hudGroups');
    const hudOps = document.getElementById('hudOps');
    const hudLines = document.getElementById('hudLines');
    const jsonSectionsPill = document.getElementById('jsonSectionsPill');
    const jsonOpsPill = document.getElementById('jsonOpsPill');
    const jsonBytesPill = document.getElementById('jsonBytesPill');
    const characterSetDescription = document.getElementById('characterSetDescription');
    const sectionsDescription = document.getElementById('sectionsDescription');
    const groupsDescription = document.getElementById('groupsDescription');
    const validateBtn = document.getElementById('validateBtn');
    const downloadJsonBtn = document.getElementById('downloadJsonBtn');
    const copyBtn = document.getElementById('copyBtn');
    const validationResult = document.getElementById('validationResult');
    const newWorkloadBtn = document.getElementById('newWorkloadBtn');
    const assistantInput = document.getElementById('assistantInput');
    const assistantApplyBtn = document.getElementById('assistantApplyBtn');
    const assistantClearBtn = document.getElementById('assistantClearBtn');
    const assistantStatus = document.getElementById('assistantStatus');
    const assistantSummary = document.getElementById('assistantSummary');
    const assistantQuestions = document.getElementById('assistantQuestions');
    const assistantQuestionInputs = document.getElementById('assistantQuestionInputs');
    const assistantRawWrap = document.getElementById('assistantRawWrap');
    const assistantRawOutput = document.getElementById('assistantRawOutput');

    const INITIAL_JSON_TEXT = '{}';
    // Fallback ordering used only if schema-derived operation metadata is unavailable.
    const DEFAULT_OPERATION_ORDER = [
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
    const SELECTION_DISTRIBUTION_PARAMS = {
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
    const SELECTION_PARAM_UI = {
      selection_min: { label: 'Selection Min', step: 'any', min: null },
      selection_max: { label: 'Selection Max', step: 'any', min: null },
      selection_mean: { label: 'Selection Mean', step: 'any', min: null },
      selection_std_dev: { label: 'Selection Std Dev', step: 'any', min: '0' },
      selection_alpha: { label: 'Selection Alpha', step: 'any', min: '0' },
      selection_beta: { label: 'Selection Beta', step: 'any', min: '0' },
      selection_n: { label: 'Selection N', step: '1', min: '1' },
      selection_s: { label: 'Selection S', step: 'any', min: '0' },
      selection_lambda: { label: 'Selection Lambda', step: 'any', min: '0' },
      selection_scale: { label: 'Selection Scale', step: 'any', min: '0' },
      selection_shape: { label: 'Selection Shape', step: 'any', min: '0' }
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
    // UI defaults stay product-defined (not schema-defined) so presets remain predictable.
    const OPERATION_DEFAULTS = {
      inserts: { op_count: 500000, key_len: 20, val_len: 1024 },
      updates: {
        op_count: 500000,
        val_len: 1024,
        selection_distribution: 'uniform',
        ...SELECTION_PARAM_DEFAULTS
      },
      merges: {
        op_count: 500000,
        val_len: 256,
        selection_distribution: 'uniform',
        ...SELECTION_PARAM_DEFAULTS
      },
      point_queries: {
        op_count: 500000,
        selection_distribution: 'uniform',
        ...SELECTION_PARAM_DEFAULTS
      },
      range_queries: {
        op_count: 500000,
        selectivity: 0.01,
        range_format: 'StartCount',
        selection_distribution: 'uniform',
        ...SELECTION_PARAM_DEFAULTS
      },
      point_deletes: {
        op_count: 500000,
        selection_distribution: 'uniform',
        ...SELECTION_PARAM_DEFAULTS
      },
      range_deletes: {
        op_count: 500000,
        selectivity: 0.01,
        range_format: 'StartCount',
        selection_distribution: 'uniform',
        ...SELECTION_PARAM_DEFAULTS
      },
      empty_point_queries: { op_count: 500000, key_len: 20 },
      empty_point_deletes: { op_count: 500000, key_len: 20 }
    };

    function titleCaseFromSnake(value) {
      return String(value || '')
        .split('_')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
    }

    // Runtime metadata derived from the loaded schema.
    let operationOrder = [...DEFAULT_OPERATION_ORDER];
    let operationLabels = DEFAULT_OPERATION_ORDER.reduce((acc, op) => {
      acc[op] = titleCaseFromSnake(op);
      return acc;
    }, {});
    let formOpsWithKeyFields = new Set(['inserts', 'empty_point_queries', 'empty_point_deletes']);
    let formOpsWithValueFields = new Set(['inserts', 'updates', 'merges']);
    let formOpsWithSelectionFields = new Set([
      'updates',
      'merges',
      'point_queries',
      'point_deletes',
      'range_queries',
      'range_deletes'
    ]);
    let formOpsWithRangeFields = new Set(['range_queries', 'range_deletes']);
    let characterSetEnum = ['alphanumeric', 'alphabetic', 'numeric'];
    let rangeFormatEnum = ['StartCount', 'StartEnd'];
    let selectionDistributionEnum = [...DEFAULT_SELECTION_DISTRIBUTIONS];
    let assistantFollowups = null;
    const lockedTopFields = new Set();
    const lockedOperationFields = new Map();

    let schema = null;
    const SCHEMA_ASSET_PATH = '/workload-schema.json';
    const ASSIST_ENDPOINT = '/api/assist';

    async function loadInitialSchema() {
      try {
        const response = await fetch(SCHEMA_ASSET_PATH, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('HTTP ' + response.status);
        }
        const loadedSchema = await response.json();
        if (!loadedSchema || typeof loadedSchema !== 'object') {
          throw new Error('Schema asset did not return an object');
        }
        return loadedSchema;
      } catch (e) {
        reportUiIssue('Failed to load schema asset', e);
        return null;
      }
    }

    // Derive UI structure from schema so we avoid hardcoding operation capabilities.
    function deriveUiConfigFromSchema() {
      if (!schema || typeof schema !== 'object') {
        return;
      }

      const groupProperties = schema.$defs && schema.$defs.WorkloadSpecGroup && schema.$defs.WorkloadSpecGroup.properties
        ? schema.$defs.WorkloadSpecGroup.properties
        : null;

      if (groupProperties && typeof groupProperties === 'object') {
        const derivedOps = [];
        const derivedLabels = {};
        const derivedKeyFields = new Set();
        const derivedValueFields = new Set();
        const derivedSelectionFields = new Set();
        const derivedRangeFields = new Set();

        Object.entries(groupProperties).forEach(([op, rawNode]) => {
          const resolvedNode = unwrapSchemaNode(rawNode);
          if (!resolvedNode || typeof resolvedNode !== 'object' || !resolvedNode.properties) {
            return;
          }
          // We treat operation blocks as group properties that define op_count.
          if (!Object.prototype.hasOwnProperty.call(resolvedNode.properties, 'op_count')) {
            return;
          }

          derivedOps.push(op);
          derivedLabels[op] = titleCaseFromSnake(op);

          if (Object.prototype.hasOwnProperty.call(resolvedNode.properties, 'key')) {
            derivedKeyFields.add(op);
          }
          if (Object.prototype.hasOwnProperty.call(resolvedNode.properties, 'val')) {
            derivedValueFields.add(op);
          }
          if (Object.prototype.hasOwnProperty.call(resolvedNode.properties, 'selection')) {
            derivedSelectionFields.add(op);
          }
          if (
            Object.prototype.hasOwnProperty.call(resolvedNode.properties, 'range_format') ||
            Object.prototype.hasOwnProperty.call(resolvedNode.properties, 'selectivity')
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
          formOpsWithRangeFields = derivedRangeFields;
        }
      }

      const derivedCharacterSetEnum = schema.$defs && schema.$defs.CharacterSet && Array.isArray(schema.$defs.CharacterSet.enum)
        ? schema.$defs.CharacterSet.enum.filter((value) => typeof value === 'string' && value.trim() !== '')
        : [];
      if (derivedCharacterSetEnum.length > 0) {
        characterSetEnum = derivedCharacterSetEnum;
      }

      const rangeFormatVariants = schema.$defs && schema.$defs.RangeFormat && Array.isArray(schema.$defs.RangeFormat.oneOf)
        ? schema.$defs.RangeFormat.oneOf
        : [];
      const derivedRangeFormatEnum = rangeFormatVariants
        .map((entry) => (entry && typeof entry.const === 'string' ? entry.const : null))
        .filter(Boolean);
      if (derivedRangeFormatEnum.length > 0) {
        rangeFormatEnum = derivedRangeFormatEnum;
      }

      const distributionVariants = schema.$defs && schema.$defs.Distribution && Array.isArray(schema.$defs.Distribution.oneOf)
        ? schema.$defs.Distribution.oneOf
        : [];
      const derivedSelectionDistributionEnum = distributionVariants
        .map((entry) => {
          if (!entry || typeof entry !== 'object' || !entry.properties || typeof entry.properties !== 'object') {
            return null;
          }
          const keys = Object.keys(entry.properties);
          return keys.length === 1 ? keys[0] : null;
        })
        .filter((value) => typeof value === 'string' && value.trim() !== '');
      if (derivedSelectionDistributionEnum.length > 0) {
        selectionDistributionEnum = derivedSelectionDistributionEnum;
      }
    }

    // Keep the character-set dropdown aligned with schema enum values.
    function populateCharacterSetOptions() {
      if (!formCharacterSet) {
        return;
      }

      const currentValue = formCharacterSet.value;
      const values = Array.isArray(characterSetEnum) ? characterSetEnum : [];

      formCharacterSet.innerHTML = '';
      const unsetOption = document.createElement('option');
      unsetOption.value = '';
      unsetOption.textContent = '(unset)';
      formCharacterSet.appendChild(unsetOption);

      values.forEach((value) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        formCharacterSet.appendChild(option);
      });

      if (values.includes(currentValue)) {
        formCharacterSet.value = currentValue;
      } else {
        formCharacterSet.value = '';
      }
    }

    // Prefer historical default when present; otherwise use first schema enum value.
    function getDefaultCharacterSetValue() {
      if (!Array.isArray(characterSetEnum) || characterSetEnum.length === 0) {
        return '';
      }
      if (characterSetEnum.includes('alphanumeric')) {
        return 'alphanumeric';
      }
      return characterSetEnum[0];
    }

    function reportUiIssue(prefix, errorLike) {
      const message = prefix + ': ' + (errorLike && errorLike.message ? errorLike.message : String(errorLike || 'Unknown error'));
      console.error(message, errorLike);
      setValidationStatus(message, 'invalid');
    }

    async function initApp() {
      schema = await loadInitialSchema();
      // Schema must be loaded before building controls/descriptions.
      deriveUiConfigFromSchema();
      populateCharacterSetOptions();

      try {
        applySchemaDescriptions();
      } catch (e) {
        reportUiIssue('Failed to apply schema descriptions', e);
      }
      try {
        buildOperationControls();
      } catch (e) {
        reportUiIssue('Failed to build operation controls', e);
      }
      try {
        assistantFollowups = createAssistantFollowupController();
      } catch (e) {
        assistantFollowups = null;
        reportUiIssue('Failed to initialize assistant follow-up controls', e);
      }
      try {
        resetFormInterface();
      } catch (e) {
        reportUiIssue('Failed to reset form interface', e);
      }

      if (workloadForm) {
        workloadForm.addEventListener('input', onFormChange);
        workloadForm.addEventListener('change', onFormChange);
      }
      if (downloadJsonBtn) {
        downloadJsonBtn.addEventListener('click', downloadGeneratedJson);
      }
      if (newWorkloadBtn) {
        newWorkloadBtn.addEventListener('click', resetFormInterface);
      }
      if (assistantApplyBtn) {
        assistantApplyBtn.addEventListener('click', handleAssistantApply);
      }
      if (assistantClearBtn) {
        assistantClearBtn.addEventListener('click', () => {
          if (assistantInput) {
            assistantInput.value = '';
            assistantInput.focus();
          }
          clearAssistantFeedback();
          setAssistantStatus('Ready', 'default');
        });
      }
      if (assistantInput) {
        assistantInput.addEventListener('keydown', (event) => {
          const isMeta = event.metaKey || event.ctrlKey;
          if (isMeta && event.key === 'Enter') {
            event.preventDefault();
            event.stopPropagation();
            handleAssistantApply();
          }
        });
      }
      Array.prototype.forEach.call(presetButtons || [], (btn) => {
        if (btn) {
          btn.addEventListener('click', () => applyPreset(btn.dataset.preset || ''));
        }
      });
      document.addEventListener('keydown', (event) => {
        const isMeta = event.metaKey || event.ctrlKey;
        if (isMeta && event.key === 'Enter') {
          event.preventDefault();
          if (validateBtn) {
            validateBtn.click();
          }
        }
        if (isMeta && event.shiftKey && (event.key === 'c' || event.key === 'C')) {
          event.preventDefault();
          if (copyBtn) {
            copyBtn.click();
          }
        }
      });

      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          const text = jsonOutput ? jsonOutput.value : '';
          if (!text) return;
          if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
            setValidationStatus('Clipboard not available in this browser context.', 'invalid');
            return;
          }
          navigator.clipboard.writeText(text).then(() => {
            copyBtn.textContent = 'Copied!';
            setTimeout(() => {
              if (copyBtn) {
                copyBtn.textContent = 'Copy';
              }
            }, 1500);
          }).catch((e) => reportUiIssue('Failed to copy JSON', e));
        });
      }

      if (validateBtn) {
        validateBtn.addEventListener('click', async () => {
          const jsonText = jsonOutput ? jsonOutput.value.trim() : '';
          if (!jsonText || !schema) {
            setValidationStatus('No JSON or schema to validate', 'invalid');
            return;
          }
          try {
            const json = JSON.parse(jsonText);
            const { default: Ajv2020 } = await import('https://esm.sh/ajv@8.17.1/dist/2020?bundle');
            const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
            const validate = ajv.compile(schema);
            const valid = validate(toSchemaValidationShape(json, schema));
            if (valid) {
              setValidationStatus('Valid! JSON conforms to schema.', 'valid');
            } else {
              const errors = (validate.errors || []).map((e) => {
                const path = e.instancePath || '/';
                return (path + ' ' + e.message).trim();
              }).join(', ');
              setValidationStatus('Invalid: ' + errors, 'invalid');
            }
          } catch (e) {
            setValidationStatus('Parse error: ' + e.message, 'invalid');
          }
        });
      }
    }

    window.addEventListener('error', (event) => {
      reportUiIssue('Unhandled runtime error', event && event.error ? event.error : event && event.message ? event.message : 'Unknown error');
    });

    window.addEventListener('unhandledrejection', (event) => {
      const reason = event && event.reason ? event.reason : 'Unknown promise rejection';
      reportUiIssue('Unhandled promise rejection', reason);
    });

    initApp().catch((initError) => {
      reportUiIssue('UI init failed', initError);
      if (jsonOutput && !jsonOutput.value) {
        jsonOutput.value = '{}';
      }
    });

    function onFormChange(event) {
      const eventTarget = event && event.target ? event.target : null;
      markFieldAsUserLocked(eventTarget);
      if (eventTarget && eventTarget.classList && eventTarget.classList.contains('operation-toggle')) {
        const op = eventTarget.value;
        const isEnabled = eventTarget.checked;
        setOperationCardVisibility(op, isEnabled);
        if (isEnabled) {
          ensureOperationDefaultsIfEmpty(op);
        }
      } else if (eventTarget && eventTarget.dataset && eventTarget.dataset.field === 'selection_distribution') {
        refreshSelectionParamVisibility(eventTarget.dataset.op);
      }
      updateJsonFromForm();
    }

    function ensureLockedOperationFieldSet(op) {
      if (!lockedOperationFields.has(op)) {
        lockedOperationFields.set(op, new Set());
      }
      return lockedOperationFields.get(op);
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
        lockTopField('character_set');
        return;
      }
      if (eventTarget === formSections) {
        lockTopField('sections_count');
        return;
      }
      if (eventTarget === formGroups) {
        lockTopField('groups_per_section');
        return;
      }
      if (eventTarget.classList && eventTarget.classList.contains('operation-toggle')) {
        lockOperationField(eventTarget.value, 'enabled');
        return;
      }
      if (eventTarget.dataset && eventTarget.dataset.op && eventTarget.dataset.field) {
        lockOperationField(eventTarget.dataset.op, eventTarget.dataset.field);
      }
    }

    function getOperationToggle(op) {
      return operationToggles.querySelector('.operation-toggle[value="' + op + '"]');
    }

    function setOperationChecked(op, checked) {
      const toggle = getOperationToggle(op);
      if (!toggle) return;
      toggle.checked = checked;
      setOperationCardVisibility(op, checked);
      if (checked) {
        refreshSelectionParamVisibility(op);
      }
    }

    function setOperationInputValue(op, field, value) {
      const selector = '[data-op="' + op + '"][data-field="' + field + '"]';
      const el = operationConfigContainer.querySelector(selector);
      if (!el) return;
      el.value = String(value);
    }

    function applyDefaultsToOperation(op) {
      const defaults = OPERATION_DEFAULTS[op] || {};
      Object.entries(defaults).forEach(([field, value]) => {
        setOperationInputValue(op, field, value);
      });
      refreshSelectionParamVisibility(op);
    }

    function ensureOperationDefaultsIfEmpty(op) {
      const defaults = OPERATION_DEFAULTS[op] || {};
      Object.entries(defaults).forEach(([field, value]) => {
        if (readOperationField(op, field) === '') {
          setOperationInputValue(op, field, value);
        }
      });
      refreshSelectionParamVisibility(op);
    }

    function applyPreset(presetName) {
      resetFormInterface();
      formCharacterSet.value = getDefaultCharacterSetValue();
      formSections.value = '1';
      formGroups.value = '1';
      lockTopField('character_set');
      lockTopField('sections_count');
      lockTopField('groups_per_section');

      const presets = {
        insert_only: ['inserts'],
        read_heavy: ['point_queries', 'range_queries'],
        mixed_crud: ['inserts', 'updates', 'point_queries', 'point_deletes'],
        baseline: ['inserts', 'point_queries']
      };
      const ops = presets[presetName] || presets.baseline;

      operationOrder.forEach((op) => {
        const enabled = ops.includes(op);
        setOperationChecked(op, enabled);
        lockOperationField(op, 'enabled');
        if (enabled) {
          applyDefaultsToOperation(op);
          Object.keys(OPERATION_DEFAULTS[op] || {}).forEach((fieldName) => {
            lockOperationField(op, fieldName);
          });
        }
      });

      if (presetName === 'read_heavy') {
        setOperationInputValue('point_queries', 'op_count', 700000);
        setOperationInputValue('range_queries', 'op_count', 150000);
        lockOperationField('point_queries', 'op_count');
        lockOperationField('range_queries', 'op_count');
      }
      if (presetName === 'mixed_crud') {
        setOperationInputValue('inserts', 'op_count', 400000);
        setOperationInputValue('updates', 'op_count', 300000);
        setOperationInputValue('point_queries', 'op_count', 350000);
        setOperationInputValue('point_deletes', 'op_count', 80000);
        lockOperationField('inserts', 'op_count');
        lockOperationField('updates', 'op_count');
        lockOperationField('point_queries', 'op_count');
        lockOperationField('point_deletes', 'op_count');
      }

      updateJsonFromForm();
    }

    function normalizeDescription(text) {
      if (typeof text !== 'string') {
        return '';
      }
      return text
        .replace(/\r\n?/g, '\n')
        .replace(/\\r\\n|\\n|\\r/g, '\n')
        .replace(/[ \t\f\v]+/g, ' ')
        .replace(/ *\n+ */g, '\n')
        .replace(/\n{2,}/g, '\n')
        .trim();
    }

    function resolveSchemaRef(ref) {
      if (typeof ref !== 'string' || !ref.startsWith('#/')) {
        return null;
      }
      const parts = ref.slice(2).split('/');
      let node = schema;
      for (const part of parts) {
        if (!node || typeof node !== 'object') {
          return null;
        }
        node = node[part];
      }
      return node || null;
    }

    function unwrapSchemaNode(node) {
      if (!node || typeof node !== 'object') {
        return null;
      }
      if (node.$ref) {
        return resolveSchemaRef(node.$ref);
      }
      if (Array.isArray(node.anyOf)) {
        const refCandidate = node.anyOf.find((entry) => entry && typeof entry === 'object' && entry.$ref);
        if (refCandidate) {
          return resolveSchemaRef(refCandidate.$ref);
        }
        const nonNull = node.anyOf.find((entry) => entry && entry.type !== 'null');
        return nonNull || null;
      }
      return node;
    }

    function getTopLevelDescription(field) {
      if (!schema || !schema.properties || !schema.properties[field]) {
        return '';
      }
      return normalizeDescription(schema.properties[field].description);
    }

    function getSectionDescription(field) {
      if (!schema || !schema.$defs || !schema.$defs.WorkloadSpecSection || !schema.$defs.WorkloadSpecSection.properties) {
        return '';
      }
      const sectionField = schema.$defs.WorkloadSpecSection.properties[field];
      return normalizeDescription(sectionField && sectionField.description);
    }

    function getGroupOperationSchema(op) {
      if (!schema || !schema.$defs || !schema.$defs.WorkloadSpecGroup || !schema.$defs.WorkloadSpecGroup.properties) {
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
        return '';
      }
      return normalizeDescription(opSchema.properties[field].description);
    }

    function getStringUniformLengthDescription() {
      const variants = schema && schema.$defs && schema.$defs.StringExprInner
        ? schema.$defs.StringExprInner.oneOf
        : null;
      if (!Array.isArray(variants)) {
        return '';
      }
      const uniform = variants.find((variant) => variant && variant.properties && variant.properties.uniform);
      if (
        !uniform ||
        !uniform.properties ||
        !uniform.properties.uniform ||
        !uniform.properties.uniform.properties ||
        !uniform.properties.uniform.properties.len
      ) {
        return '';
      }
      return normalizeDescription(uniform.properties.uniform.properties.len.description);
    }

    function getRangeFormatDescriptions() {
      const rangeFormat = schema && schema.$defs && schema.$defs.RangeFormat
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
      return ['StartCount', 'StartEnd'];
    }

    function getSelectionDistributionValues() {
      if (Array.isArray(selectionDistributionEnum) && selectionDistributionEnum.length > 0) {
        return selectionDistributionEnum;
      }
      return [...DEFAULT_SELECTION_DISTRIBUTIONS];
    }

    function getSelectionParamsForDistribution(distributionName) {
      return SELECTION_DISTRIBUTION_PARAMS[distributionName] || SELECTION_DISTRIBUTION_PARAMS.uniform;
    }

    function combineDescriptions(parts) {
      const cleaned = (parts || []).map(normalizeDescription).filter(Boolean);
      return [...new Set(cleaned)].join(' ');
    }

    function getUiFieldDescription(op, field) {
      const stringLenDescription = getStringUniformLengthDescription();
      const selectionDescription = getOperationFieldDescription(op, 'selection');
      if (field === 'op_count') {
        return getOperationFieldDescription(op, 'op_count');
      }
      if (field === 'key_len') {
        return combineDescriptions([getOperationFieldDescription(op, 'key'), stringLenDescription]);
      }
      if (field === 'val_len') {
        return combineDescriptions([getOperationFieldDescription(op, 'val'), stringLenDescription]);
      }
      if (field === 'selection_distribution') {
        const optionsText = getSelectionDistributionValues().join(', ');
        return combineDescriptions([selectionDescription, 'Distribution options: ' + optionsText + '.']);
      }
      if (field === 'selection_min') {
        return combineDescriptions([selectionDescription, 'Uniform distribution minimum value.']);
      }
      if (field === 'selection_max') {
        return combineDescriptions([selectionDescription, 'Uniform distribution maximum value.']);
      }
      if (field === 'selection_mean') {
        return combineDescriptions([selectionDescription, 'Mean value for normal/log_normal distribution.']);
      }
      if (field === 'selection_std_dev') {
        return combineDescriptions([selectionDescription, 'Standard deviation for normal/log_normal distribution.']);
      }
      if (field === 'selection_alpha') {
        return combineDescriptions([selectionDescription, 'Alpha parameter for beta distribution.']);
      }
      if (field === 'selection_beta') {
        return combineDescriptions([selectionDescription, 'Beta parameter for beta distribution.']);
      }
      if (field === 'selection_n') {
        return combineDescriptions([selectionDescription, 'N parameter for zipf distribution.']);
      }
      if (field === 'selection_s') {
        return combineDescriptions([selectionDescription, 'S parameter for zipf distribution.']);
      }
      if (field === 'selection_lambda') {
        return combineDescriptions([selectionDescription, 'Lambda parameter for exponential/poisson distribution.']);
      }
      if (field === 'selection_scale') {
        return combineDescriptions([selectionDescription, 'Scale parameter for weibull/pareto distribution.']);
      }
      if (field === 'selection_shape') {
        return combineDescriptions([selectionDescription, 'Shape parameter for weibull/pareto distribution.']);
      }
      if (field === 'selectivity') {
        return getOperationFieldDescription(op, 'selectivity');
      }
      if (field === 'range_format') {
        const rangeDescription = getOperationFieldDescription(op, 'range_format');
        const formatDescriptions = getRangeFormatDescriptions();
        const optionHelp = Object.entries(formatDescriptions)
          .map(([name, desc]) => (desc ? name + ': ' + desc : name))
          .join(' | ');
        return combineDescriptions([rangeDescription, optionHelp]);
      }
      return '';
    }

    function setDescriptionText(target, text) {
      if (!target) return;
      target.textContent = normalizeDescription(text);
    }

    function setInlineLabelWithHelp(target, labelText, description) {
      if (!target) return;
      target.textContent = '';
      target.classList.add('field-row');
      const text = document.createElement('span');
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
      const dot = document.createElement('span');
      dot.className = 'help-dot';
      dot.textContent = 'i';
      dot.title = cleaned;
      dot.setAttribute('aria-label', cleaned);
      return dot;
    }

    function appendTitleWithHelp(container, text, description) {
      const row = document.createElement('span');
      row.className = 'field-row';
      const label = document.createElement('span');
      label.textContent = text;
      row.appendChild(label);
      const dot = createHelpDot(description);
      if (dot) {
        row.appendChild(dot);
      }
      container.appendChild(row);
    }

    function applySchemaDescriptions() {
      const characterSetHelp = getTopLevelDescription('character_set');
      const sectionsHelp = getTopLevelDescription('sections');
      const groupsHelp = getSectionDescription('groups');

      setInlineLabelWithHelp(formCharacterSetLabel, 'Character Set', characterSetHelp);
      setInlineLabelWithHelp(formSectionsLabel, 'Sections', sectionsHelp);
      setInlineLabelWithHelp(formGroupsLabel, 'Groups / Section', groupsHelp);
      setInlineLabelWithHelp(
        operationsTitle,
        'Operations',
        combineDescriptions([groupsHelp, 'Select one or more operation blocks.'])
      );

      setDescriptionText(characterSetDescription, characterSetHelp);
      setDescriptionText(sectionsDescription, sectionsHelp);
      setDescriptionText(groupsDescription, groupsHelp);
    }

    function buildOperationControls() {
      if (!operationToggles || !operationConfigContainer) {
        reportUiIssue('Operation controls container missing', 'operationToggles/operationConfigContainer not found');
        return;
      }
      operationToggles.innerHTML = '';
      operationConfigContainer.innerHTML = '';
      operationOrder.forEach((op) => {
        const toggle = buildWithFallback(
          () => createOperationToggle(op),
          () => createOperationToggleFallback(op),
          'Failed to build operation toggle for ' + op
        );
        const card = buildWithFallback(
          () => createOperationConfigCard(op),
          () => createOperationConfigCardFallback(op),
          'Failed to build operation config for ' + op
        );
        if (toggle) {
          operationToggles.appendChild(toggle);
        }
        if (card) {
          operationConfigContainer.appendChild(card);
          refreshSelectionParamVisibility(op);
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
      const label = document.createElement('label');
      label.className = 'checkbox-item';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.className = 'operation-toggle';
      input.value = op;
      label.appendChild(input);

      const textWrap = document.createElement('span');
      textWrap.className = 'checkbox-label-text';
      if (!includeDescriptions) {
        textWrap.textContent = getOperationLabel(op);
        label.appendChild(textWrap);
        return label;
      }

      const titleRow = document.createElement('span');
      titleRow.className = 'field-row';
      const text = document.createElement('span');
      text.textContent = getOperationLabel(op);
      titleRow.appendChild(text);
      const opDescription = getOperationDescription(op);
      const helpDot = createHelpDot(opDescription);
      if (helpDot) {
        titleRow.appendChild(helpDot);
      }
      textWrap.appendChild(titleRow);
      if (opDescription) {
        const desc = document.createElement('small');
        desc.className = 'field-description';
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
      const card = document.createElement('section');
      card.className = 'op-config hidden';
      card.id = getOperationCardId(op);

      const head = document.createElement('div');
      head.className = 'op-config-head';
      const title = document.createElement('div');
      title.className = 'op-config-title';
      title.textContent = getOperationLabel(op) + ' settings';
      head.appendChild(title);
      const defaultsBtn = document.createElement('button');
      defaultsBtn.type = 'button';
      defaultsBtn.className = 'op-default-btn';
      defaultsBtn.textContent = 'Apply defaults';
      defaultsBtn.addEventListener('click', () => {
        applyDefaultsToOperation(op);
        updateJsonFromForm();
      });
      head.appendChild(defaultsBtn);
      card.appendChild(head);

      const opDescription = includeDescriptions ? getOperationDescription(op) : '';
      if (opDescription) {
        const opDesc = document.createElement('p');
        opDesc.className = 'field-description';
        opDesc.textContent = opDescription;
        card.appendChild(opDesc);
      }

      const rangeFormatDefaults = getRangeFormatValues();
      const grid = document.createElement('div');
      grid.className = 'form-grid';
      grid.appendChild(
        createNumberField(
          op,
          'op_count',
          'Op Count',
          includeDescriptions ? defaults.op_count : (defaults.op_count || 500000),
          '1',
          '0',
          includeDescriptions ? getUiFieldDescription(op, 'op_count') : ''
        )
      );

      if (formOpsWithKeyFields.has(op)) {
        grid.appendChild(
          createNumberField(
            op,
            'key_len',
            'Key Length',
            includeDescriptions ? defaults.key_len : (defaults.key_len || 20),
            '1',
            '1',
            includeDescriptions ? getUiFieldDescription(op, 'key_len') : ''
          )
        );
      }
      if (formOpsWithValueFields.has(op)) {
        grid.appendChild(
          createNumberField(
            op,
            'val_len',
            'Value Length',
            includeDescriptions ? defaults.val_len : (defaults.val_len || 256),
            '1',
            '1',
            includeDescriptions ? getUiFieldDescription(op, 'val_len') : ''
          )
        );
      }
      if (formOpsWithSelectionFields.has(op)) {
        const selectionDistributionDefault = defaults.selection_distribution || 'uniform';
        grid.appendChild(
          createSelectionDistributionField(
            op,
            selectionDistributionDefault,
            includeDescriptions ? getUiFieldDescription(op, 'selection_distribution') : ''
          )
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
              includeDescriptions ? getUiFieldDescription(op, field) : ''
            )
          );
        });
      }
      if (formOpsWithRangeFields.has(op)) {
        const selectivityDefault = defaults.selectivity === undefined || defaults.selectivity === null ? 0.01 : defaults.selectivity;
        grid.appendChild(
          createNumberField(
            op,
            'selectivity',
            'Selectivity',
            includeDescriptions ? defaults.selectivity : selectivityDefault,
            'any',
            '0',
            includeDescriptions ? getUiFieldDescription(op, 'selectivity') : ''
          )
        );
        grid.appendChild(
          createRangeFormatField(
            op,
            defaults.range_format || rangeFormatDefaults[0],
            includeDescriptions ? getUiFieldDescription(op, 'range_format') : ''
          )
        );
      }

      card.appendChild(grid);
      if (formOpsWithSelectionFields.has(op)) {
        refreshSelectionParamVisibility(op);
      }
      return card;
    }

    function createNumberField(op, field, labelText, placeholder, step, min, description = '') {
      const label = document.createElement('label');
      label.className = 'field';
      const title = document.createElement('span');
      appendTitleWithHelp(title, labelText, description);
      const input = document.createElement('input');
      input.type = 'number';
      input.dataset.op = op;
      input.dataset.field = field;
      input.placeholder = String(placeholder);
      input.step = step || '1';
      if (min !== null && min !== undefined) {
        input.min = String(min);
      }
      label.appendChild(title);
      label.appendChild(input);
      if (description) {
        const desc = document.createElement('small');
        desc.className = 'field-description';
        desc.textContent = description;
        label.appendChild(desc);
      }
      return label;
    }

    function createRangeFormatField(op, defaultValue, description = '') {
      const label = document.createElement('label');
      label.className = 'field';
      const title = document.createElement('span');
      appendTitleWithHelp(title, 'Range Format', description);
      const select = document.createElement('select');
      select.dataset.op = op;
      select.dataset.field = 'range_format';

      getRangeFormatValues().forEach((rangeFormatValue) => {
        const option = document.createElement('option');
        option.value = rangeFormatValue;
        option.textContent = rangeFormatValue;
        select.appendChild(option);
      });

      select.value = defaultValue;
      label.appendChild(title);
      label.appendChild(select);
      if (description) {
        const desc = document.createElement('small');
        desc.className = 'field-description';
        desc.textContent = description;
        label.appendChild(desc);
      }
      return label;
    }

    function createSelectionDistributionField(op, defaultValue, description = '') {
      const label = document.createElement('label');
      label.className = 'field';
      const title = document.createElement('span');
      appendTitleWithHelp(title, 'Selection Distribution', description);
      const select = document.createElement('select');
      select.dataset.op = op;
      select.dataset.field = 'selection_distribution';

      getSelectionDistributionValues().forEach((distributionName) => {
        const option = document.createElement('option');
        option.value = distributionName;
        option.textContent = distributionName;
        select.appendChild(option);
      });

      select.value = defaultValue;
      label.appendChild(title);
      label.appendChild(select);
      if (description) {
        const desc = document.createElement('small');
        desc.className = 'field-description';
        desc.textContent = description;
        label.appendChild(desc);
      }
      return label;
    }

    function createSelectionParamField(op, field, labelText, placeholder, step, min, description = '') {
      const label = createNumberField(op, field, labelText, placeholder, step, min, description);
      label.classList.add('selection-param-field');
      label.dataset.op = op;
      label.dataset.selectionField = field;
      return label;
    }

    function refreshSelectionParamVisibility(op) {
      if (!formOpsWithSelectionFields.has(op)) {
        return;
      }
      const validValues = getSelectionDistributionValues();
      let distributionName = readOperationField(op, 'selection_distribution') || 'uniform';
      if (!validValues.includes(distributionName)) {
        distributionName = validValues[0] || 'uniform';
        setOperationInputValue(op, 'selection_distribution', distributionName);
      }
      const visibleFields = new Set(getSelectionParamsForDistribution(distributionName));

      Object.keys(SELECTION_PARAM_UI).forEach((fieldName) => {
        const input = operationConfigContainer.querySelector('[data-op="' + op + '"][data-field="' + fieldName + '"]');
        if (!input) {
          return;
        }
        const fieldContainer = input.closest('.field');
        if (!fieldContainer) {
          return;
        }
        const isVisible = visibleFields.has(fieldName);
        fieldContainer.classList.toggle('hidden', !isVisible);
        if (isVisible && input.value === '') {
          const defaultValue = SELECTION_PARAM_DEFAULTS[fieldName];
          if (defaultValue !== undefined && defaultValue !== null) {
            input.value = String(defaultValue);
          }
        }
      });
    }

    function getOperationCardId(op) {
      return 'op-config-' + op;
    }

    function setOperationCardVisibility(op, isVisible) {
      const card = document.getElementById(getOperationCardId(op));
      if (!card) return;
      card.classList.toggle('hidden', !isVisible);
    }

    function getSelectedOperations() {
      const selected = [];
      const toggles = operationToggles.querySelectorAll('.operation-toggle');
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
      if (value === '' || value === null || value === undefined) {
        return fallback;
      }
      const n = Number(value);
      return Number.isFinite(n) ? n : fallback;
    }

    function intOrDefault(value, fallback) {
      const n = parsePositiveInt(value);
      return n || fallback;
    }

    function readOperationField(op, field) {
      const selector = '[data-op="' + op + '"][data-field="' + field + '"]';
      const el = operationConfigContainer.querySelector(selector);
      return el ? el.value : '';
    }

    function buildStringExpr(len, characterSet) {
      const uniform = { len };
      if (characterSet) {
        uniform.character_set = characterSet;
      }
      return { uniform };
    }

    function buildSelectionDistributionSpec(op, defaults) {
      let distributionName = readOperationField(op, 'selection_distribution')
        || defaults.selection_distribution
        || 'uniform';
      const validValues = getSelectionDistributionValues();
      if (!validValues.includes(distributionName)) {
        distributionName = validValues[0] || 'uniform';
      }
      const distributionParamKeys = getSelectionParamsForDistribution(distributionName);
      const params = {};

      distributionParamKeys.forEach((fieldName) => {
        const defaultValue = defaults[fieldName] === undefined || defaults[fieldName] === null
          ? SELECTION_PARAM_DEFAULTS[fieldName]
          : defaults[fieldName];
        if (fieldName === 'selection_n') {
          params.n = intOrDefault(readOperationField(op, fieldName), defaultValue || 1);
          return;
        }
        const paramKey = fieldName.replace(/^selection_/, '');
        params[paramKey] = numberOrDefault(readOperationField(op, fieldName), defaultValue);
      });

      return { [distributionName]: params };
    }

    function buildOperationSpec(op, characterSet) {
      const defaults = OPERATION_DEFAULTS[op] || {};
      const config = {
        op_count: numberOrDefault(readOperationField(op, 'op_count'), defaults.op_count || 500000)
      };

      if (formOpsWithKeyFields.has(op)) {
        config.key = buildStringExpr(
          intOrDefault(readOperationField(op, 'key_len'), defaults.key_len || 20),
          characterSet
        );
      }

      if (formOpsWithValueFields.has(op)) {
        config.val = buildStringExpr(
          intOrDefault(readOperationField(op, 'val_len'), defaults.val_len || 256),
          characterSet
        );
      }

      if (formOpsWithSelectionFields.has(op)) {
        config.selection = buildSelectionDistributionSpec(op, defaults);
      }

      if (formOpsWithRangeFields.has(op)) {
        const selectivityDefault = defaults.selectivity === undefined || defaults.selectivity === null
          ? 0.01
          : defaults.selectivity;
        const rangeFormatDefaults = getRangeFormatValues();
        config.selectivity = numberOrDefault(readOperationField(op, 'selectivity'), selectivityDefault);
        config.range_format = readOperationField(op, 'range_format') || defaults.range_format || rangeFormatDefaults[0];
      }

      return config;
    }

    function buildJsonFromForm() {
      const json = {};
      const characterSet = formCharacterSet.value.trim();
      if (characterSet) {
        json.character_set = characterSet;
      }

      const selectedOps = getSelectedOperations();
      const hasSectionInput = formSections.value.trim() !== '' || formGroups.value.trim() !== '';
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
      jsonOutput.style.display = 'block';
    }

    function safeTextSizeBytes(text) {
      return new Blob([text]).size;
    }

    function formatCount(value) {
      const n = Number(value);
      if (!Number.isFinite(n)) return '0';
      return new Intl.NumberFormat('en-US').format(n);
    }

    function updateInteractiveStats(json) {
      const hasSections = json && Array.isArray(json.sections);
      const sectionsCount = hasSections ? json.sections.length : 0;
      const firstSection = hasSections && sectionsCount > 0 ? json.sections[0] : null;
      const groupsCount = firstSection && Array.isArray(firstSection.groups)
        ? firstSection.groups.length
        : 0;
      const selectedOps = getSelectedOperations();
      const lines = jsonOutput.value ? jsonOutput.value.split('\n').length : 1;
      const bytes = safeTextSizeBytes(jsonOutput.value || '{}');

      hudSections.textContent = formatCount(sectionsCount);
      hudGroups.textContent = formatCount(groupsCount);
      hudOps.textContent = formatCount(selectedOps.length);
      hudLines.textContent = formatCount(lines);

      jsonSectionsPill.textContent = 'sections: ' + formatCount(sectionsCount);
      jsonOpsPill.textContent = 'ops: ' + formatCount(selectedOps.length);
      jsonBytesPill.textContent = 'bytes: ' + formatCount(bytes);
    }

    function updateJsonFromForm() {
      const generated = buildJsonFromForm();
      renderGeneratedJson(generated);
      updateInteractiveStats(generated);
      validationResult.className = 'validation-result';
      validationResult.textContent = '';
    }

    function createAssistantFollowupController() {
      if (
        !assistantQuestionInputs ||
        !window.AssistantFollowups ||
        typeof window.AssistantFollowups.createController !== 'function'
      ) {
        if (assistantQuestionInputs) {
          assistantQuestionInputs.innerHTML = '';
        }
        return null;
      }

      return window.AssistantFollowups.createController({
        containerEl: assistantQuestionInputs,
        getOperationOrder: () => [...operationOrder],
        getOperationLabel: (op) => getOperationLabel(op),
        getSelectedOperations: () => getSelectedOperations(),
        isSelectionOp: (op) => formOpsWithSelectionFields.has(op),
        isRangeOp: (op) => formOpsWithRangeFields.has(op),
        isKeyOp: (op) => formOpsWithKeyFields.has(op),
        isValueOp: (op) => formOpsWithValueFields.has(op),
        getCharacterSets: () => [...characterSetEnum],
        getRangeFormats: () => getRangeFormatValues(),
        getSelectionDistributions: () => getSelectionDistributionValues(),
        getSelectionParamsForDistribution: (distributionName) => getSelectionParamsForDistribution(distributionName),
        getSelectionParamDefaults: () => ({ ...SELECTION_PARAM_DEFAULTS }),
        getOperationDefaults: (op) => ({ ...(OPERATION_DEFAULTS[op] || {}) }),
        readTopField: (fieldName) => {
          if (fieldName === 'character_set') {
            return formCharacterSet ? formCharacterSet.value : '';
          }
          if (fieldName === 'sections_count') {
            return formSections ? formSections.value : '';
          }
          if (fieldName === 'groups_per_section') {
            return formGroups ? formGroups.value : '';
          }
          return '';
        },
        writeTopField: (fieldName, value) => {
          if (fieldName === 'character_set' && formCharacterSet) {
            formCharacterSet.value = String(value);
          } else if (fieldName === 'sections_count' && formSections) {
            formSections.value = String(value);
          } else if (fieldName === 'groups_per_section' && formGroups) {
            formGroups.value = String(value);
          }
        },
        readOperationField: (op, fieldName) => readOperationField(op, fieldName),
        writeOperationField: (op, fieldName, value) => setOperationInputValue(op, fieldName, value),
        setOperationChecked: (op, checked) => setOperationChecked(op, checked),
        ensureOperationDefaultsIfEmpty: (op) => ensureOperationDefaultsIfEmpty(op),
        refreshSelectionParamVisibility: (op) => refreshSelectionParamVisibility(op),
        updateJson: () => updateJsonFromForm()
      });
    }

    function clearAssistantFeedback() {
      if (assistantSummary) {
        assistantSummary.textContent = '';
      }
      if (assistantQuestions) {
        assistantQuestions.innerHTML = '';
      }
      if (assistantFollowups) {
        assistantFollowups.clear();
      } else if (assistantQuestionInputs) {
        assistantQuestionInputs.innerHTML = '';
      }
      setAssistantRawOutput(null);
    }

    function setAssistantStatus(text, tone) {
      if (!assistantStatus) {
        return;
      }
      assistantStatus.textContent = text || 'Ready';
      assistantStatus.className = 'assistant-status';
      if (tone === 'loading') {
        assistantStatus.classList.add('loading');
      } else if (tone === 'error') {
        assistantStatus.classList.add('error');
      } else if (tone === 'warn') {
        assistantStatus.classList.add('warn');
      }
    }

    function setAssistantSummary(text) {
      if (!assistantSummary) {
        return;
      }
      assistantSummary.textContent = text || '';
    }

    function setAssistantQuestions(questions) {
      if (!assistantQuestions) {
        return;
      }
      assistantQuestions.innerHTML = '';
      const list = Array.isArray(questions) ? questions : [];
      list.forEach((question) => {
        const cleaned = String(question || '').trim();
        if (!cleaned) {
          return;
        }
        const item = document.createElement('li');
        item.textContent = cleaned;
        assistantQuestions.appendChild(item);
      });
    }

    function setAssistantRawOutput(rawOutputText) {
      if (!assistantRawWrap || !assistantRawOutput) {
        return;
      }
      const text = typeof rawOutputText === 'string' ? rawOutputText.trim() : '';
      assistantRawOutput.textContent = text;
      assistantRawWrap.classList.toggle('show', text.length > 0);
      if (text.length === 0) {
        assistantRawWrap.removeAttribute('open');
      }
    }

    function formatAssistantDebugInfo(debug) {
      if (!debug || typeof debug !== 'object') {
        return '';
      }
      const pieces = [];
      if (debug.reason) {
        pieces.push('reason=' + String(debug.reason));
      }
      if (debug.model) {
        pieces.push('model=' + String(debug.model));
      }
      if (debug.max_tokens !== undefined && debug.max_tokens !== null) {
        pieces.push('max_tokens=' + String(debug.max_tokens));
      }
      if (debug.timeout_ms !== undefined && debug.timeout_ms !== null) {
        pieces.push('timeout_ms=' + String(debug.timeout_ms));
      }
      if (debug.retry_attempts !== undefined && debug.retry_attempts !== null) {
        pieces.push('retries=' + String(debug.retry_attempts));
      }
      if (Array.isArray(debug.attempts) && debug.attempts.length > 0) {
        const attemptSummary = debug.attempts
          .map((entry) => {
            const attempt = entry && entry.attempt !== undefined ? '#' + entry.attempt : '#?';
            const model = entry && entry.model ? '[' + String(entry.model) + ']' : '';
            const message = entry && entry.message ? String(entry.message) : 'unknown';
            return attempt + model + ':' + message;
          })
          .join(' | ');
        pieces.push('attempts=' + attemptSummary);
      }
      if (debug.error && typeof debug.error === 'object' && debug.error.message) {
        pieces.push('error=' + String(debug.error.message));
      }
      return pieces.join('; ');
    }

    function extractAssistantAiOutput(result) {
      if (!result || typeof result !== 'object') {
        return '';
      }
      if (typeof result.ai_output === 'string' && result.ai_output.trim()) {
        return result.ai_output.trim();
      }
      const debug = result.debug && typeof result.debug === 'object' ? result.debug : null;
      if (!debug) {
        return '';
      }
      if (typeof debug.last_ai_output === 'string' && debug.last_ai_output.trim()) {
        return debug.last_ai_output.trim();
      }
      if (Array.isArray(debug.attempts)) {
        let lastMessage = '';
        for (let index = debug.attempts.length - 1; index >= 0; index -= 1) {
          const attempt = debug.attempts[index];
          if (attempt && typeof attempt.ai_output === 'string' && attempt.ai_output.trim()) {
            return attempt.ai_output.trim();
          }
          if (attempt && typeof attempt.message === 'string' && attempt.message.trim()) {
            lastMessage = attempt.message.trim();
          }
        }
        if (lastMessage) {
          return 'No Workers AI output captured. Last attempt error: ' + lastMessage;
        }
      }
      return '';
    }

    function setAssistantBusy(isBusy) {
      if (assistantApplyBtn) {
        assistantApplyBtn.disabled = !!isBusy;
        assistantApplyBtn.textContent = isBusy ? 'Applying...' : 'Apply to Form';
      }
      if (assistantClearBtn) {
        assistantClearBtn.disabled = !!isBusy;
      }
      if (assistantInput) {
        assistantInput.disabled = !!isBusy;
      }
    }

    function toFiniteNumber(value) {
      if (value === null || value === undefined || value === '') {
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
        [
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
        ].forEach((field) => {
          const value = toFiniteNumber(readOperationField(op, field));
          if (value !== null) {
            opState[field] = value;
          }
        });
        const selectionDistribution = readOperationField(op, 'selection_distribution');
        if (selectionDistribution) {
          opState.selection_distribution = selectionDistribution;
        }
        const rangeFormatValue = readOperationField(op, 'range_format');
        if (rangeFormatValue) {
          opState.range_format = rangeFormatValue;
        }
        operations[op] = opState;
      });

      return {
        character_set: formCharacterSet && formCharacterSet.value ? formCharacterSet.value : null,
        sections_count: parsePositiveInt(formSections ? formSections.value : '') || null,
        groups_per_section: parsePositiveInt(formGroups ? formGroups.value : '') || null,
        operations
      };
    }

    function getSchemaHintsForAssist() {
      const capabilities = {};
      operationOrder.forEach((op) => {
        capabilities[op] = {
          has_key: formOpsWithKeyFields.has(op),
          has_val: formOpsWithValueFields.has(op),
          has_selection: formOpsWithSelectionFields.has(op),
          has_range: formOpsWithRangeFields.has(op)
        };
      });
      return {
        operation_order: operationOrder,
        operation_labels: operationLabels,
        character_sets: characterSetEnum,
        range_formats: getRangeFormatValues(),
        selection_distributions: getSelectionDistributionValues(),
        capabilities
      };
    }

    function applyAssistantPatch(patch) {
      if (!patch || typeof patch !== 'object') {
        return;
      }

      if (typeof patch.character_set === 'string' && formCharacterSet && !isTopFieldLocked('character_set')) {
        const optionValues = Array.from(formCharacterSet.options || []).map((option) => option.value);
        if (optionValues.includes(patch.character_set)) {
          formCharacterSet.value = patch.character_set;
        }
      }

      if (
        Number.isFinite(patch.sections_count)
        && patch.sections_count > 0
        && formSections
        && !isTopFieldLocked('sections_count')
      ) {
        formSections.value = String(Math.floor(patch.sections_count));
      }

      if (
        Number.isFinite(patch.groups_per_section)
        && patch.groups_per_section > 0
        && formGroups
        && !isTopFieldLocked('groups_per_section')
      ) {
        formGroups.value = String(Math.floor(patch.groups_per_section));
      }

      if (patch.clear_operations === true) {
        operationOrder.forEach((op) => {
          if (!isOperationFieldLocked(op, 'enabled')) {
            setOperationChecked(op, false);
          }
        });
      }

      const operationsPatch = patch.operations && typeof patch.operations === 'object'
        ? patch.operations
        : {};

      Object.entries(operationsPatch).forEach(([op, opPatch]) => {
        if (!operationOrder.includes(op) || !opPatch || typeof opPatch !== 'object') {
          return;
        }
        if (typeof opPatch.enabled === 'boolean' && !isOperationFieldLocked(op, 'enabled')) {
          setOperationChecked(op, opPatch.enabled);
          if (opPatch.enabled) {
            ensureOperationDefaultsIfEmpty(op);
          }
        }

        ['op_count', 'key_len', 'val_len', 'selection_min', 'selection_max', 'selectivity'].forEach((field) => {
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
          setOperationInputValue(op, field, numericValue);
        });

        [
          'selection_mean',
          'selection_std_dev',
          'selection_alpha',
          'selection_beta',
          'selection_n',
          'selection_s',
          'selection_lambda',
          'selection_scale',
          'selection_shape'
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
          setOperationInputValue(op, field, numericValue);
        });

        if (typeof opPatch.selection_distribution === 'string' && !isOperationFieldLocked(op, 'selection_distribution')) {
          const validDistributions = getSelectionDistributionValues();
          if (validDistributions.includes(opPatch.selection_distribution)) {
            setOperationInputValue(op, 'selection_distribution', opPatch.selection_distribution);
            refreshSelectionParamVisibility(op);
          }
        }

        if (typeof opPatch.range_format === 'string' && !isOperationFieldLocked(op, 'range_format')) {
          const validRangeFormats = getRangeFormatValues();
          if (validRangeFormats.includes(opPatch.range_format)) {
            setOperationInputValue(op, 'range_format', opPatch.range_format);
          }
        }
      });
    }

    async function requestAssistantPatch(promptText) {
      const currentJson = buildJsonFromForm();
      const response = await fetch(ASSIST_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          form_state: getCurrentFormState(),
          schema_hints: getSchemaHintsForAssist(),
          current_json: currentJson
        })
      });

      let data = null;
      try {
        data = await response.json();
      } catch (parseError) {
        throw new Error('Assistant returned an unreadable response.');
      }

      if (!response.ok) {
        const message = data && data.error ? data.error : 'Assistant request failed.';
        throw new Error(message);
      }
      if (!data || typeof data !== 'object') {
        throw new Error('Assistant returned an empty response.');
      }
      return data;
    }

    async function handleAssistantApply() {
      const promptText = assistantInput ? assistantInput.value.trim() : '';
      if (!promptText) {
        setAssistantStatus('Enter details to apply', 'warn');
        setAssistantSummary('Describe your workload in plain English, then click Apply to Form.');
        setAssistantQuestions([]);
        if (assistantFollowups) {
          assistantFollowups.clear();
        }
        return;
      }

      setAssistantBusy(true);
      clearAssistantFeedback();
      setAssistantStatus('Interpreting...', 'loading');

      try {
        const result = await requestAssistantPatch(promptText);
        applyAssistantPatch(result.patch);
        updateJsonFromForm();

        const summaryText = typeof result.summary === 'string' && result.summary.trim()
          ? result.summary.trim()
          : 'Applied your request to the form.';
        const warnings = Array.isArray(result.warnings)
          ? result.warnings.map((item) => String(item || '').trim()).filter(Boolean)
          : [];
        const warningSuffix = warnings.length > 0 ? ' Note: ' + warnings.join(' ') : '';
        const debugText = formatAssistantDebugInfo(result.debug);
        const debugSuffix = debugText ? ' Debug: ' + debugText : '';
        setAssistantSummary(summaryText + warningSuffix + debugSuffix);
        setAssistantRawOutput(extractAssistantAiOutput(result));
        if (debugText) {
          console.warn('Assistant debug:', result.debug);
        }
        const followupQuestions = Array.isArray(result.questions) ? result.questions : [];
        setAssistantQuestions(followupQuestions);
        if (assistantFollowups) {
          assistantFollowups.render(followupQuestions, {
            patch: result.patch && typeof result.patch === 'object' ? result.patch : null,
            prompt: promptText
          });
        } else if (assistantQuestionInputs) {
          assistantQuestionInputs.innerHTML = '';
        }

        if (followupQuestions.length > 0) {
          setAssistantStatus('Needs details', 'warn');
        } else if (result.source === 'fallback') {
          setAssistantStatus('Applied (fallback)', 'warn');
        } else {
          setAssistantStatus('Applied', 'default');
        }
      } catch (e) {
        setAssistantStatus('Assistant failed', 'error');
        setAssistantSummary(e && e.message ? e.message : 'Failed to apply assistant suggestion.');
        setAssistantQuestions([]);
        if (assistantFollowups) {
          assistantFollowups.clear();
        } else if (assistantQuestionInputs) {
          assistantQuestionInputs.innerHTML = '';
        }
        setAssistantRawOutput(null);
      } finally {
        setAssistantBusy(false);
      }
    }

    function resetFormInterface() {
      workloadForm.reset();
      clearFieldLocks();
      operationOrder.forEach((op) => setOperationCardVisibility(op, false));
      formSections.value = '';
      formGroups.value = '';
      clearAssistantFeedback();
      setAssistantStatus('Ready', 'default');
      const initial = JSON.parse(INITIAL_JSON_TEXT);
      renderGeneratedJson(initial);
      updateInteractiveStats(initial);
      validationResult.className = 'validation-result';
      validationResult.textContent = '';
    }

    function downloadGeneratedJson() {
      const text = jsonOutput.value;
      if (!text) return;
      const blob = new Blob([text], { type: 'application/json' });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = 'tectonic-generated-' + timestamp + '.json';
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
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
      const properties = schemaDoc && typeof schemaDoc === 'object' ? schemaDoc.properties : null;
      const required = schemaDoc && Array.isArray(schemaDoc.required) ? schemaDoc.required : [];
      if (properties && properties.sections && required.includes('sections')) {
        return { sections: json };
      }
      return json;
    }

    function setValidationStatus(message, status) {
      validationResult.textContent = message;
      validationResult.className = 'validation-result show ' + status;
    }
