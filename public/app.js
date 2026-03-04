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
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
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
    const operationsDescription = document.getElementById('operationsDescription');
    const validateBtn = document.getElementById('validateBtn');
    const downloadJsonBtn = document.getElementById('downloadJsonBtn');
    const copyBtn = document.getElementById('copyBtn');
    const validationResult = document.getElementById('validationResult');
    const newWorkloadBtn = document.getElementById('newWorkloadBtn');
    const downloadLogBtn = document.getElementById('downloadLogBtn');

    const INITIAL_JSON_TEXT = '{}';
    const OPERATION_ORDER = [
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
    const OPERATION_LABELS = {
      inserts: 'Inserts',
      updates: 'Updates',
      merges: 'Merges',
      point_queries: 'Point Queries',
      range_queries: 'Range Queries',
      point_deletes: 'Point Deletes',
      range_deletes: 'Range Deletes',
      empty_point_queries: 'Empty Point Queries',
      empty_point_deletes: 'Empty Point Deletes'
    };
    const OPERATION_DEFAULTS = {
      inserts: { op_count: 500000, key_len: 20, val_len: 1024 },
      updates: { op_count: 500000, val_len: 1024, selection_min: 0, selection_max: 1 },
      merges: { op_count: 500000, val_len: 256, selection_min: 0, selection_max: 1 },
      point_queries: { op_count: 500000, selection_min: 0, selection_max: 1 },
      range_queries: { op_count: 500000, selectivity: 0.01, selection_min: 0, selection_max: 1, range_format: 'StartCount' },
      point_deletes: { op_count: 500000, selection_min: 0, selection_max: 1 },
      range_deletes: { op_count: 500000, selectivity: 0.01, selection_min: 0, selection_max: 1, range_format: 'StartCount' },
      empty_point_queries: { op_count: 500000, key_len: 20 },
      empty_point_deletes: { op_count: 500000, key_len: 20 }
    };
    const FORM_OPS_WITH_KEY_FIELDS = new Set(['inserts', 'empty_point_queries', 'empty_point_deletes']);
    const FORM_OPS_WITH_VALUE_FIELDS = new Set(['inserts', 'updates', 'merges']);
    const FORM_OPS_WITH_SELECTION_FIELDS = new Set([
      'updates',
      'merges',
      'point_queries',
      'point_deletes',
      'range_queries',
      'range_deletes'
    ]);
    const FORM_OPS_WITH_RANGE_FIELDS = new Set(['range_queries', 'range_deletes']);

    let schema = null;
    let formChangeLog = [];

    const schemaDraftUrl = 'https://json-schema.org/draft/2020-12/schema';
    const defaultSchema = {
      "$schema": schemaDraftUrl,
      "title": "WorkloadSpec",
      "type": "object",
      "properties": {
        "character_set": {
          "description": "The domain from which the keys will be created from.",
          "anyOf": [{ "$ref": "#/$defs/CharacterSet" }, { "type": "null" }]
        },
        "sections": {
          "description": "Sections of a workload where a key from one will (probably) not appear in another.",
          "type": "array",
          "items": { "$ref": "#/$defs/WorkloadSpecSection" }
        }
      },
      "required": ["sections"],
      "$defs": {
        "CharacterSet": { "type": "string", "enum": ["alphanumeric", "alphabetic", "numeric"] },
        "Distribution": {
          "oneOf": [
            {
              "type": "object",
              "properties": { "uniform": { "type": "object", "properties": { "max": { "type": "number", "format": "double" }, "min": { "type": "number", "format": "double" } }, "required": ["min", "max"] } },
              "additionalProperties": false,
              "required": ["uniform"]
            },
            {
              "type": "object",
              "properties": { "normal": { "type": "object", "properties": { "mean": { "type": "number", "format": "double" }, "std_dev": { "type": "number", "format": "double" } }, "required": ["mean", "std_dev"] } },
              "additionalProperties": false,
              "required": ["normal"]
            },
            {
              "type": "object",
              "properties": { "beta": { "type": "object", "properties": { "alpha": { "type": "number", "format": "double" }, "beta": { "type": "number", "format": "double" } }, "required": ["alpha", "beta"] } },
              "additionalProperties": false,
              "required": ["beta"]
            },
            {
              "type": "object",
              "properties": { "zipf": { "type": "object", "properties": { "n": { "type": "integer", "format": "uint", "minimum": 0 }, "s": { "type": "number", "format": "double" } }, "required": ["n", "s"] } },
              "additionalProperties": false,
              "required": ["zipf"]
            },
            {
              "type": "object",
              "properties": { "exponential": { "type": "object", "properties": { "lambda": { "type": "number", "format": "double" } }, "required": ["lambda"] } },
              "additionalProperties": false,
              "required": ["exponential"]
            },
            {
              "type": "object",
              "properties": { "log_normal": { "type": "object", "properties": { "mean": { "type": "number", "format": "double" }, "std_dev": { "type": "number", "format": "double" } }, "required": ["mean", "std_dev"] } },
              "additionalProperties": false,
              "required": ["log_normal"]
            },
            {
              "type": "object",
              "properties": { "poisson": { "type": "object", "properties": { "lambda": { "type": "number", "format": "double" } }, "required": ["lambda"] } },
              "additionalProperties": false,
              "required": ["poisson"]
            },
            {
              "type": "object",
              "properties": { "weibull": { "type": "object", "properties": { "scale": { "type": "number", "format": "double" }, "shape": { "type": "number", "format": "double" } }, "required": ["scale", "shape"] } },
              "additionalProperties": false,
              "required": ["weibull"]
            },
            {
              "type": "object",
              "properties": { "pareto": { "type": "object", "properties": { "scale": { "type": "number", "format": "double" }, "shape": { "type": "number", "format": "double" } }, "required": ["scale", "shape"] } },
              "additionalProperties": false,
              "required": ["pareto"]
            }
          ]
        },
        "EmptyPointDeletes": { "description": "Empty point deletes specification.", "type": "object", "properties": { "character_set": { "anyOf": [{ "$ref": "#/$defs/CharacterSet" }, { "type": "null" }] }, "key": { "description": "Key", "$ref": "#/$defs/StringExpr" }, "op_count": { "description": "Number of empty point deletes", "$ref": "#/$defs/NumberExpr" } }, "required": ["op_count", "key"] },
        "EmptyPointQueries": { "description": "Empty point queries specification.", "type": "object", "properties": { "character_set": { "anyOf": [{ "$ref": "#/$defs/CharacterSet" }, { "type": "null" }] }, "key": { "description": "Key", "$ref": "#/$defs/StringExpr" }, "op_count": { "description": "Number of point queries", "$ref": "#/$defs/NumberExpr" } }, "required": ["op_count", "key"] },
        "Inserts": { "description": "Inserts specification.", "type": "object", "properties": { "character_set": { "anyOf": [{ "$ref": "#/$defs/CharacterSet" }, { "type": "null" }] }, "key": { "description": "Key", "$ref": "#/$defs/StringExpr" }, "op_count": { "description": "Number of inserts", "$ref": "#/$defs/NumberExpr" }, "val": { "description": "Value", "$ref": "#/$defs/StringExpr" } }, "required": ["op_count", "key", "val"] },
        "Merges": { "description": "Merges (read-modify-write) specification.", "type": "object", "properties": { "character_set": { "anyOf": [{ "$ref": "#/$defs/CharacterSet" }, { "type": "null" }] }, "op_count": { "description": "Number of merges", "$ref": "#/$defs/NumberExpr" }, "selection": { "description": "Key selection strategy", "$ref": "#/$defs/Distribution" }, "val": { "description": "Value", "$ref": "#/$defs/StringExpr" } }, "required": ["op_count", "val"] },
        "NumberExpr": { "anyOf": [{ "type": "number", "format": "double" }, { "$ref": "#/$defs/Distribution" }] },
        "PointDeletes": { "description": "Non-empty point deletes specification.", "type": "object", "properties": { "op_count": { "description": "Number of non-empty point deletes", "$ref": "#/$defs/NumberExpr" }, "selection": { "description": "Key selection strategy", "$ref": "#/$defs/Distribution" } }, "required": ["op_count"] },
        "PointQueries": { "description": "Non-empty point queries specification.", "type": "object", "properties": { "op_count": { "description": "Number of point queries", "$ref": "#/$defs/NumberExpr" }, "selection": { "description": "Key selection strategy of the start key", "$ref": "#/$defs/Distribution" } }, "required": ["op_count"] },
        "RangeDeletes": { "description": "Range deletes specification.", "type": "object", "properties": { "character_set": { "anyOf": [{ "$ref": "#/$defs/CharacterSet" }, { "type": "null" }] }, "op_count": { "description": "Number of range deletes", "$ref": "#/$defs/NumberExpr" }, "range_format": { "description": "The format for the range", "$ref": "#/$defs/RangeFormat" }, "selection": { "description": "Key selection strategy of the start key", "$ref": "#/$defs/Distribution" }, "selectivity": { "description": "Selectivity of range deletes. Based off of the range of valid keys, not the full key space.", "$ref": "#/$defs/NumberExpr" } }, "required": ["op_count", "selectivity"] },
        "RangeFormat": { "oneOf": [{ "description": "The start key and the number of keys to scan", "type": "string", "const": "StartCount" }, { "description": "The start key and end key", "type": "string", "const": "StartEnd" }] },
        "RangeQueries": { "description": "Range queries specification.", "type": "object", "properties": { "character_set": { "anyOf": [{ "$ref": "#/$defs/CharacterSet" }, { "type": "null" }] }, "op_count": { "description": "Number of range queries", "$ref": "#/$defs/NumberExpr" }, "range_format": { "description": "The format for the range", "$ref": "#/$defs/RangeFormat" }, "selection": { "description": "Key selection strategy of the start key", "$ref": "#/$defs/Distribution" }, "selectivity": { "description": "Selectivity of range queries. Based off of the range of valid keys, not the full key-space.", "$ref": "#/$defs/NumberExpr" } }, "required": ["op_count", "selectivity"] },
        "Sorted": { "type": "object", "properties": { "k": { "description": "The number of displaced operations.", "$ref": "#/$defs/NumberExpr" }, "l": { "description": "The distance between swapped elements.", "$ref": "#/$defs/NumberExpr" } }, "required": ["k", "l"] },
        "StringExpr": { "anyOf": [{ "type": "string" }, { "$ref": "#/$defs/StringExprInner" }] },
        "StringExprInner": {
          "oneOf": [
            { "type": "object", "properties": { "uniform": { "type": "object", "properties": { "character_set": { "anyOf": [{ "$ref": "#/$defs/CharacterSet" }, { "type": "null" }] }, "len": { "description": "The length of the string to sample.", "$ref": "#/$defs/NumberExpr" } }, "required": ["len"] } }, "additionalProperties": false, "required": ["uniform"] },
            { "type": "object", "properties": { "weighted": { "type": "array", "items": { "$ref": "#/$defs/Weight" } } }, "additionalProperties": false, "required": ["weighted"] },
            { "type": "object", "properties": { "segmented": { "type": "object", "properties": { "segments": { "description": "The segments to use for the string.", "type": "array", "items": { "$ref": "#/$defs/StringExpr" } }, "separator": { "type": "string" } }, "required": ["separator", "segments"] } }, "additionalProperties": false, "required": ["segmented"] },
            { "type": "object", "properties": { "hot_range": { "type": "object", "properties": { "amount": { "type": "integer", "format": "uint", "minimum": 0 }, "len": { "type": "integer", "format": "uint", "minimum": 0 }, "probability": { "type": "number", "format": "double" } }, "required": ["len", "amount", "probability"] } }, "additionalProperties": false, "required": ["hot_range"] }
          ]
        },
        "Updates": { "description": "Updates specification.", "type": "object", "properties": { "character_set": { "anyOf": [{ "$ref": "#/$defs/CharacterSet" }, { "type": "null" }] }, "op_count": { "description": "Number of updates", "$ref": "#/$defs/NumberExpr" }, "selection": { "description": "Key selection strategy", "$ref": "#/$defs/Distribution" }, "val": { "description": "Value", "$ref": "#/$defs/StringExpr" } }, "required": ["op_count", "val"] },
        "Weight": { "type": "object", "properties": { "value": { "description": "The value of the item.", "$ref": "#/$defs/StringExpr" }, "weight": { "description": "The weight of the item.", "type": "number", "format": "double" } }, "required": ["weight", "value"] },
        "WorkloadSpecGroup": {
          "type": "object",
          "properties": {
            "character_set": { "anyOf": [{ "$ref": "#/$defs/CharacterSet" }, { "type": "null" }] },
            "empty_point_deletes": { "anyOf": [{ "$ref": "#/$defs/EmptyPointDeletes" }, { "type": "null" }] },
            "empty_point_queries": { "anyOf": [{ "$ref": "#/$defs/EmptyPointQueries" }, { "type": "null" }] },
            "inserts": { "anyOf": [{ "$ref": "#/$defs/Inserts" }, { "type": "null" }] },
            "merges": { "anyOf": [{ "$ref": "#/$defs/Merges" }, { "type": "null" }] },
            "point_deletes": { "anyOf": [{ "$ref": "#/$defs/PointDeletes" }, { "type": "null" }] },
            "point_queries": { "anyOf": [{ "$ref": "#/$defs/PointQueries" }, { "type": "null" }] },
            "range_deletes": { "anyOf": [{ "$ref": "#/$defs/RangeDeletes" }, { "type": "null" }] },
            "range_queries": { "anyOf": [{ "$ref": "#/$defs/RangeQueries" }, { "type": "null" }] },
            "sorted": { "anyOf": [{ "$ref": "#/$defs/Sorted" }, { "type": "null" }] },
            "updates": { "anyOf": [{ "$ref": "#/$defs/Updates" }, { "type": "null" }] }
          }
        },
        "WorkloadSpecSection": { "type": "object", "properties": { "character_set": { "description": "The domain from which the keys will be created from.", "anyOf": [{ "$ref": "#/$defs/CharacterSet" }, { "type": "null" }] }, "groups": { "description": "A list of groups. Groups share valid keys between operations.\\n\\nE.g., non-empty point queries will use a key from an insert in this group.", "type": "array", "items": { "$ref": "#/$defs/WorkloadSpecGroup" } }, "skip_key_contains_check": { "description": "Whether to skip the check that a generated key is in the valid key set for inserts and empty point queries/deletes.", "type": "boolean", "default": false } }, "required": ["groups"] }
      }
    };

    function reportUiIssue(prefix, errorLike) {
      const message = prefix + ': ' + (errorLike && errorLike.message ? errorLike.message : String(errorLike || 'Unknown error'));
      console.error(message, errorLike);
      setValidationStatus(message, 'invalid');
    }

    function initApp() {
      schema = defaultSchema;

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
        resetFormInterface();
      } catch (e) {
        reportUiIssue('Failed to reset form interface', e);
      }

      if (workloadForm) {
        workloadForm.addEventListener('input', onFormChange);
        workloadForm.addEventListener('change', onFormChange);
      }
      if (downloadLogBtn) {
        downloadLogBtn.addEventListener('click', downloadChatLog);
      }
      if (downloadJsonBtn) {
        downloadJsonBtn.addEventListener('click', downloadGeneratedJson);
      }
      if (newWorkloadBtn) {
        newWorkloadBtn.addEventListener('click', resetFormInterface);
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

    try {
      initApp();
    } catch (initError) {
      reportUiIssue('UI init failed', initError);
      if (jsonOutput && !jsonOutput.value) {
        jsonOutput.value = '{}';
      }
    }

    function onFormChange(event) {
      const eventTarget = event && event.target ? event.target : null;
      if (eventTarget && eventTarget.classList && eventTarget.classList.contains('operation-toggle')) {
        const op = eventTarget.value;
        const isEnabled = eventTarget.checked;
        setOperationCardVisibility(op, isEnabled);
        if (isEnabled) {
          ensureOperationDefaultsIfEmpty(op);
        }
      }
      updateJsonFromForm();
      trackFormChange();
    }

    function getOperationToggle(op) {
      return operationToggles.querySelector('.operation-toggle[value="' + op + '"]');
    }

    function setOperationChecked(op, checked) {
      const toggle = getOperationToggle(op);
      if (!toggle) return;
      toggle.checked = checked;
      setOperationCardVisibility(op, checked);
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
    }

    function ensureOperationDefaultsIfEmpty(op) {
      const defaults = OPERATION_DEFAULTS[op] || {};
      Object.entries(defaults).forEach(([field, value]) => {
        if (readOperationField(op, field) === '') {
          setOperationInputValue(op, field, value);
        }
      });
    }

    function applyPreset(presetName) {
      resetFormInterface();
      formCharacterSet.value = 'alphanumeric';
      formSections.value = '1';
      formGroups.value = '1';

      const presets = {
        insert_only: ['inserts'],
        read_heavy: ['point_queries', 'range_queries'],
        mixed_crud: ['inserts', 'updates', 'point_queries', 'point_deletes'],
        baseline: ['inserts', 'point_queries']
      };
      const ops = presets[presetName] || presets.baseline;

      OPERATION_ORDER.forEach((op) => {
        const enabled = ops.includes(op);
        setOperationChecked(op, enabled);
        if (enabled) {
          applyDefaultsToOperation(op);
        }
      });

      if (presetName === 'read_heavy') {
        setOperationInputValue('point_queries', 'op_count', 700000);
        setOperationInputValue('range_queries', 'op_count', 150000);
      }
      if (presetName === 'mixed_crud') {
        setOperationInputValue('inserts', 'op_count', 400000);
        setOperationInputValue('updates', 'op_count', 300000);
        setOperationInputValue('point_queries', 'op_count', 350000);
        setOperationInputValue('point_deletes', 'op_count', 80000);
      }

      updateJsonFromForm();
      trackFormChange();
    }

    function normalizeDescription(text) {
      if (typeof text !== 'string') {
        return '';
      }
      return text.replace(/\s+/g, ' ').trim();
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
      if (field === 'selection_min') {
        return combineDescriptions([selectionDescription, 'Uniform distribution minimum value.']);
      }
      if (field === 'selection_max') {
        return combineDescriptions([selectionDescription, 'Uniform distribution maximum value.']);
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
      setDescriptionText(
        operationsDescription,
        combineDescriptions([
          groupsHelp,
          'Select one or more operation blocks to include in each group.'
        ])
      );
    }

    function buildOperationControls() {
      if (!operationToggles || !operationConfigContainer) {
        reportUiIssue('Operation controls container missing', 'operationToggles/operationConfigContainer not found');
        return;
      }
      operationToggles.innerHTML = '';
      operationConfigContainer.innerHTML = '';
      OPERATION_ORDER.forEach((op) => {
        let toggle = null;
        let card = null;
        try {
          toggle = createOperationToggle(op);
        } catch (e) {
          reportUiIssue('Failed to build operation toggle for ' + op, e);
          toggle = createOperationToggleFallback(op);
        }
        try {
          card = createOperationConfigCard(op);
        } catch (e) {
          reportUiIssue('Failed to build operation config for ' + op, e);
          card = createOperationConfigCardFallback(op);
        }
        if (toggle) {
          operationToggles.appendChild(toggle);
        }
        if (card) {
          operationConfigContainer.appendChild(card);
        }
      });
    }

    function createOperationToggleFallback(op) {
      const label = document.createElement('label');
      label.className = 'checkbox-item';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.className = 'operation-toggle';
      input.value = op;
      label.appendChild(input);
      const text = document.createElement('span');
      text.className = 'checkbox-label-text';
      text.textContent = OPERATION_LABELS[op] || op;
      label.appendChild(text);
      return label;
    }

    function createOperationConfigCardFallback(op) {
      const defaults = OPERATION_DEFAULTS[op] || {};
      const card = document.createElement('section');
      card.className = 'op-config hidden';
      card.id = getOperationCardId(op);

      const head = document.createElement('div');
      head.className = 'op-config-head';
      const title = document.createElement('div');
      title.className = 'op-config-title';
      title.textContent = (OPERATION_LABELS[op] || op) + ' settings';
      head.appendChild(title);
      const defaultsBtn = document.createElement('button');
      defaultsBtn.type = 'button';
      defaultsBtn.className = 'op-default-btn';
      defaultsBtn.textContent = 'Apply defaults';
      defaultsBtn.addEventListener('click', () => {
        applyDefaultsToOperation(op);
        updateJsonFromForm();
        trackFormChange();
      });
      head.appendChild(defaultsBtn);
      card.appendChild(head);

      const grid = document.createElement('div');
      grid.className = 'form-grid';
      grid.appendChild(createNumberField(op, 'op_count', 'Op Count', defaults.op_count || 500000, '1', '0', ''));

      if (FORM_OPS_WITH_KEY_FIELDS.has(op)) {
        grid.appendChild(createNumberField(op, 'key_len', 'Key Length', defaults.key_len || 20, '1', '1', ''));
      }
      if (FORM_OPS_WITH_VALUE_FIELDS.has(op)) {
        grid.appendChild(createNumberField(op, 'val_len', 'Value Length', defaults.val_len || 256, '1', '1', ''));
      }
      if (FORM_OPS_WITH_SELECTION_FIELDS.has(op)) {
        const minDefault = defaults.selection_min === undefined || defaults.selection_min === null ? 0 : defaults.selection_min;
        const maxDefault = defaults.selection_max === undefined || defaults.selection_max === null ? 1 : defaults.selection_max;
        grid.appendChild(createNumberField(op, 'selection_min', 'Selection Min', minDefault, 'any', null, ''));
        grid.appendChild(createNumberField(op, 'selection_max', 'Selection Max', maxDefault, 'any', null, ''));
      }
      if (FORM_OPS_WITH_RANGE_FIELDS.has(op)) {
        const selectivityDefault = defaults.selectivity === undefined || defaults.selectivity === null ? 0.01 : defaults.selectivity;
        grid.appendChild(createNumberField(op, 'selectivity', 'Selectivity', selectivityDefault, 'any', '0', ''));
        grid.appendChild(createRangeFormatField(op, defaults.range_format || 'StartCount', ''));
      }

      card.appendChild(grid);
      return card;
    }

    function createOperationToggle(op) {
      const label = document.createElement('label');
      label.className = 'checkbox-item';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.className = 'operation-toggle';
      input.value = op;
      label.appendChild(input);
      const textWrap = document.createElement('span');
      textWrap.className = 'checkbox-label-text';
      const titleRow = document.createElement('span');
      titleRow.className = 'field-row';
      const text = document.createElement('span');
      text.textContent = OPERATION_LABELS[op] || op;
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

    function createOperationConfigCard(op) {
      const defaults = OPERATION_DEFAULTS[op] || {};
      const card = document.createElement('section');
      card.className = 'op-config hidden';
      card.id = getOperationCardId(op);

      const head = document.createElement('div');
      head.className = 'op-config-head';
      const title = document.createElement('div');
      title.className = 'op-config-title';
      title.textContent = (OPERATION_LABELS[op] || op) + ' settings';
      head.appendChild(title);
      const defaultsBtn = document.createElement('button');
      defaultsBtn.type = 'button';
      defaultsBtn.className = 'op-default-btn';
      defaultsBtn.textContent = 'Apply defaults';
      defaultsBtn.addEventListener('click', () => {
        applyDefaultsToOperation(op);
        updateJsonFromForm();
        trackFormChange();
      });
      head.appendChild(defaultsBtn);
      card.appendChild(head);
      const opDescription = getOperationDescription(op);
      if (opDescription) {
        const opDesc = document.createElement('p');
        opDesc.className = 'field-description';
        opDesc.textContent = opDescription;
        card.appendChild(opDesc);
      }

      const grid = document.createElement('div');
      grid.className = 'form-grid';
      grid.appendChild(
        createNumberField(
          op,
          'op_count',
          'Op Count',
          defaults.op_count,
          '1',
          '0',
          getUiFieldDescription(op, 'op_count')
        )
      );

      if (FORM_OPS_WITH_KEY_FIELDS.has(op)) {
        grid.appendChild(
          createNumberField(
            op,
            'key_len',
            'Key Length',
            defaults.key_len,
            '1',
            '1',
            getUiFieldDescription(op, 'key_len')
          )
        );
      }
      if (FORM_OPS_WITH_VALUE_FIELDS.has(op)) {
        grid.appendChild(
          createNumberField(
            op,
            'val_len',
            'Value Length',
            defaults.val_len,
            '1',
            '1',
            getUiFieldDescription(op, 'val_len')
          )
        );
      }
      if (FORM_OPS_WITH_SELECTION_FIELDS.has(op)) {
        grid.appendChild(
          createNumberField(
            op,
            'selection_min',
            'Selection Min',
            defaults.selection_min,
            'any',
            null,
            getUiFieldDescription(op, 'selection_min')
          )
        );
        grid.appendChild(
          createNumberField(
            op,
            'selection_max',
            'Selection Max',
            defaults.selection_max,
            'any',
            null,
            getUiFieldDescription(op, 'selection_max')
          )
        );
      }
      if (FORM_OPS_WITH_RANGE_FIELDS.has(op)) {
        grid.appendChild(
          createNumberField(
            op,
            'selectivity',
            'Selectivity',
            defaults.selectivity,
            'any',
            '0',
            getUiFieldDescription(op, 'selectivity')
          )
        );
        grid.appendChild(
          createRangeFormatField(
            op,
            defaults.range_format || 'StartCount',
            getUiFieldDescription(op, 'range_format')
          )
        );
      }

      card.appendChild(grid);
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

      const startCount = document.createElement('option');
      startCount.value = 'StartCount';
      startCount.textContent = 'StartCount';
      select.appendChild(startCount);

      const startEnd = document.createElement('option');
      startEnd.value = 'StartEnd';
      startEnd.textContent = 'StartEnd';
      select.appendChild(startEnd);

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

    function buildOperationSpec(op, characterSet) {
      const defaults = OPERATION_DEFAULTS[op] || {};
      const config = {
        op_count: numberOrDefault(readOperationField(op, 'op_count'), defaults.op_count || 500000)
      };

      if (FORM_OPS_WITH_KEY_FIELDS.has(op)) {
        config.key = buildStringExpr(
          intOrDefault(readOperationField(op, 'key_len'), defaults.key_len || 20),
          characterSet
        );
      }

      if (FORM_OPS_WITH_VALUE_FIELDS.has(op)) {
        config.val = buildStringExpr(
          intOrDefault(readOperationField(op, 'val_len'), defaults.val_len || 256),
          characterSet
        );
      }

      if (FORM_OPS_WITH_SELECTION_FIELDS.has(op)) {
        const selectionMinDefault = defaults.selection_min === undefined || defaults.selection_min === null
          ? 0
          : defaults.selection_min;
        const selectionMaxDefault = defaults.selection_max === undefined || defaults.selection_max === null
          ? 1
          : defaults.selection_max;
        config.selection = {
          uniform: {
            min: numberOrDefault(readOperationField(op, 'selection_min'), selectionMinDefault),
            max: numberOrDefault(readOperationField(op, 'selection_max'), selectionMaxDefault)
          }
        };
      }

      if (FORM_OPS_WITH_RANGE_FIELDS.has(op)) {
        const selectivityDefault = defaults.selectivity === undefined || defaults.selectivity === null
          ? 0.01
          : defaults.selectivity;
        config.selectivity = numberOrDefault(readOperationField(op, 'selectivity'), selectivityDefault);
        config.range_format = readOperationField(op, 'range_format') || defaults.range_format || 'StartCount';
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

    function computeCompletionState() {
      const selectedOps = getSelectedOperations();
      const requiredTop = [
        formCharacterSet.value.trim() !== '',
        parsePositiveInt(formSections.value) !== null,
        parsePositiveInt(formGroups.value) !== null,
        selectedOps.length > 0
      ];
      const opChecks = selectedOps.map((op) => {
        const value = readOperationField(op, 'op_count');
        return value !== '';
      });

      const total = requiredTop.length + opChecks.length;
      const completed = requiredTop.filter(Boolean).length + opChecks.filter(Boolean).length;
      const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

      return { total, completed, percent };
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

      const completion = computeCompletionState();
      progressFill.style.width = completion.percent + '%';
      progressText.textContent = completion.percent + '%';
    }

    function updateJsonFromForm() {
      const generated = buildJsonFromForm();
      renderGeneratedJson(generated);
      updateInteractiveStats(generated);
      validationResult.className = 'validation-result';
      validationResult.textContent = '';
    }

    function collectFormState() {
      const operations = {};
      const selectedOps = getSelectedOperations();
      selectedOps.forEach((op) => {
        operations[op] = {};
        const selector = '[data-op="' + op + '"]';
        operationConfigContainer.querySelectorAll(selector).forEach((el) => {
          if (el.dataset && el.dataset.field) {
            operations[op][el.dataset.field] = el.value;
          }
        });
      });

      return {
        character_set: formCharacterSet.value || '',
        sections: formSections.value || '',
        groups_per_section: formGroups.value || '',
        selected_operations: selectedOps,
        operation_config: operations
      };
    }

    function trackFormChange() {
      formChangeLog.push({
        at: new Date().toISOString(),
        state: collectFormState()
      });
      if (formChangeLog.length > 200) {
        formChangeLog = formChangeLog.slice(formChangeLog.length - 200);
      }
    }

    function resetFormInterface() {
      workloadForm.reset();
      OPERATION_ORDER.forEach((op) => setOperationCardVisibility(op, false));
      formSections.value = '';
      formGroups.value = '';
      formChangeLog = [];
      const initial = JSON.parse(INITIAL_JSON_TEXT);
      renderGeneratedJson(initial);
      updateInteractiveStats(initial);
      validationResult.className = 'validation-result';
      validationResult.textContent = '';
      trackFormChange();
    }

    function downloadChatLog() {
      const payload = {
        exported_at: new Date().toISOString(),
        app: 'tectonic-json',
        schema_status: schema ? 'Fixed internal schema' : 'Schema unavailable',
        schema_text: schema ? JSON.stringify(schema, null, 2) : '',
        generated_json: jsonOutput.value || '',
        validation_text: validationResult.textContent || '',
        validation_class: validationResult.className || '',
        form_state: collectFormState(),
        form_change_log: formChangeLog
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json'
      });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = 'tectonic-chat-log-' + timestamp + '.json';
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
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

