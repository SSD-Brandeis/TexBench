const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JSON Schema Chat</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    
    :root {
      --bg: #0d1117;
      --surface: #161b22;
      --border: #30363d;
      --accent: #58a6ff;
      --accent-hover: #79b8ff;
      --success: #3fb950;
      --error: #f85149;
      --text: #e6edf3;
      --text-dim: #8b949e;
    }
    
    body {
      font-family: 'DM Sans', system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    
    header {
      height: 60px;
      padding: 0 20px;
      display: flex;
      align-items: center;
      border-bottom: 1px solid var(--border);
      background: var(--surface);
    }
    
    header h1 {
      font-size: 18px;
      font-weight: 600;
      color: var(--text);
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    header h1::before {
      content: '{ }';
      font-family: 'JetBrains Mono', monospace;
      color: var(--accent);
      font-size: 16px;
    }
    
    header .btn {
      margin-left: auto;
    }
    
    main {
      flex: 1;
      display: flex;
      gap: 16px;
      padding: 20px;
      overflow: hidden;
    }
    
    .panel {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    
    .panel-header {
      padding: 14px 16px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }
    
    .panel-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text);
    }
    
    .panel-body {
      flex: 1;
      overflow: auto;
      padding: 16px;
    }
    
    .left-panel { width: 40%; min-width: 300px; }
    .right-panel { flex: 1; min-width: 0; }
    
    textarea {
      width: 100%;
      height: 100%;
      background: transparent;
      border: none;
      color: var(--text);
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      line-height: 1.6;
      resize: none;
      outline: none;
    }
    
    textarea::placeholder { color: var(--text-dim); }
    
    .btn {
      padding: 8px 14px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
      border: none;
      font-family: inherit;
    }
    
    .btn-primary {
      background: var(--accent);
      color: #fff;
    }
    
    .btn-primary:hover { background: var(--accent-hover); }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    
    .btn-ghost {
      background: transparent;
      color: var(--text-dim);
      border: 1px solid var(--border);
    }
    
    .btn-ghost:hover { color: var(--text); border-color: var(--text-dim); }
    
    .status {
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    
    .status-valid .status-dot { background: var(--success); }
    .status-invalid .status-dot { background: var(--error); }
    .status-pending .status-dot { background: var(--text-dim); }
    
    .chat-messages {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-bottom: 12px;
    }
    
    .message {
      max-width: 85%;
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 14px;
      line-height: 1.5;
      white-space: pre-wrap;
    }
    
    .message-user {
      align-self: flex-end;
      background: var(--accent);
      color: #fff;
      border-bottom-right-radius: 4px;
    }
    
    .message-assistant {
      align-self: flex-start;
      background: var(--border);
      color: var(--text);
      border-bottom-left-radius: 4px;
    }
    
    .message-error {
      align-self: center;
      background: rgba(248, 81, 73, 0.15);
      color: var(--error);
      border: 1px solid var(--error);
    }
    
    .chat-input-area {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 16px;
      border-top: 1px solid var(--border);
      flex-shrink: 0;
    }

    .answer-controls {
      display: none;
      gap: 10px;
      align-items: center;
    }

    .answer-controls.show {
      display: flex;
    }

    .answer-select {
      flex: 1;
      padding: 10px 12px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text);
      font-family: inherit;
      font-size: 14px;
      outline: none;
    }

    .operation-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .op-chip {
      border: 1px solid var(--border);
      background: transparent;
      color: var(--text-dim);
      border-radius: 999px;
      padding: 6px 10px;
      font-size: 12px;
      cursor: pointer;
    }

    .op-chip.active {
      border-color: var(--accent);
      color: var(--text);
      background: rgba(88, 166, 255, 0.12);
    }
    
    .chat-input {
      flex: 1;
      padding: 12px 16px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text);
      font-family: inherit;
      font-size: 14px;
      outline: none;
      transition: border-color 0.15s;
    }
    
    .chat-input:focus { border-color: var(--accent); }
    
    .json-output {
      display: flex;
      flex-direction: column;
      gap: 12px;
      height: 100%;
    }
    
    .json-output textarea {
      flex: 1;
      background: var(--bg);
      border-radius: 8px;
      padding: 16px;
      border: 1px solid var(--border);
    }

    .json-actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    
    .validation-result {
      font-size: 12px;
      padding: 8px 12px;
      border-radius: 6px;
      display: none;
    }
    
    .validation-result.show { display: block; }
    .validation-result.valid { background: rgba(63, 185, 80, 0.15); color: var(--success); border: 1px solid var(--success); }
    .validation-result.invalid { background: rgba(248, 81, 73, 0.15); color: var(--error); border: 1px solid var(--error); }
    
    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid var(--text-dim);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }
    
    @keyframes spin { to { transform: rotate(360deg); } }
    
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--text-dim);
      text-align: center;
      padding: 40px;
    }
    
    .empty-state svg {
      width: 48px;
      height: 48px;
      margin-bottom: 16px;
      opacity: 0.5;
    }
    
    @media (max-width: 768px) {
      main { flex-direction: column; }
      .left-panel { width: 100%; min-height: 300px; }
    }
  </style>
</head>
<body>
  <header>
    <h1>Tectonic Workload Generator</h1>
    <button class="btn btn-ghost" id="newWorkloadBtn">Clear Chat</button>
  </header>
  <main>
    <div class="panel left-panel">
      <div class="panel-header">
        <span class="panel-title">JSON Schema</span>
        <span class="status status-pending" id="schemaStatus">
          <span class="status-dot"></span>
          <span id="schemaStatusText">Fixed schema</span>
        </span>
      </div>
      <div class="panel-body">
        <textarea id="schemaInput" spellcheck="false" readonly></textarea>
      </div>
    </div>
    <div class="right-panel" style="display: flex; flex-direction: column; gap: 16px;">
      <div class="panel" style="flex: 1; display: flex; flex-direction: column; min-height: 0;">
        <div class="panel-header">
          <span class="panel-title">Chat</span>
        </div>
        <div class="chat-messages" id="chatMessages">
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
            </svg>
            <p>Describe what JSON you want to generate</p>
          </div>
        </div>
        <div class="chat-input-area">
          <div class="answer-controls" id="answerControls">
            <select id="answerSelect" class="answer-select"></select>
          </div>
          <div class="answer-controls" id="operationControls">
            <div class="operation-chips" id="operationChips"></div>
          </div>
          <div style="display: flex; gap: 10px;">
            <input type="text" class="chat-input" id="chatInput" value="generate a schema" placeholder="e.g., Create a user profile with name, email, and age...">
            <button class="btn btn-primary" id="sendBtn">Send</button>
          </div>
        </div>
      </div>
      <div class="panel" style="height: 280px; flex-shrink: 0;">
        <div class="panel-header">
          <span class="panel-title">Generated JSON</span>
          <div class="json-actions">
            <div class="validation-result" id="validationResult"></div>
            <button class="btn btn-ghost" id="validateBtn">Validate</button>
            <button class="btn btn-ghost" id="copyBtn">Copy</button>
          </div>
        </div>
        <div class="panel-body">
          <div class="json-output">
            <textarea id="jsonOutput" readonly placeholder="Generated JSON will appear here..."></textarea>
          </div>
        </div>
      </div>
    </div>
  </main>

  <script>
    const schemaInput = document.getElementById('schemaInput');
    const schemaStatus = document.getElementById('schemaStatus');
    const schemaStatusText = document.getElementById('schemaStatusText');
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const answerControls = document.getElementById('answerControls');
    const answerSelect = document.getElementById('answerSelect');
    const operationControls = document.getElementById('operationControls');
    const operationChips = document.getElementById('operationChips');
    const chatMessages = document.getElementById('chatMessages');
    const jsonOutput = document.getElementById('jsonOutput');
    const validateBtn = document.getElementById('validateBtn');
    const copyBtn = document.getElementById('copyBtn');
    const validationResult = document.getElementById('validationResult');
    const newWorkloadBtn = document.getElementById('newWorkloadBtn');

    let schema = null;
    let chatHistory = [];
    let currentQuestionKey = null;
    let selectedOperations = new Set();

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

    schemaInput.value = JSON.stringify(defaultSchema, null, 2);
    validateSchema();

    function validateSchema() {
      const value = schemaInput.value.trim();
      if (!value) {
        schema = null;
        setSchemaStatus('pending', 'Enter schema');
        return;
      }
      try {
        schema = JSON.parse(value);
        if (!schema.$schema && !schema.type) {
          setSchemaStatus('invalid', 'Invalid schema');
          return;
        }
        setSchemaStatus('valid', 'Valid schema');
      } catch (e) {
        schema = null;
        setSchemaStatus('invalid', 'Invalid JSON');
      }
    }

    function setSchemaStatus(status, text) {
      schemaStatus.className = 'status status-' + status;
      schemaStatusText.textContent = text;
    }

    sendBtn.addEventListener('click', sendMessage);
    
    newWorkloadBtn.addEventListener('click', () => {
      chatHistory = [];
      currentQuestionKey = null;
      selectedOperations = new Set();
      chatMessages.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg><p>Describe what JSON you want to generate</p></div>';
      jsonOutput.value = '';
      jsonViewer.innerHTML = '';
      validationResult.className = 'validation-result';
      hideAnswerOptionControls();
      chatInput.value = '';
      chatInput.placeholder = 'e.g., Create a user profile with name, email, and age...';
      chatInput.disabled = false;
    });

    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    async function sendMessage() {
      const message = getCurrentAnswer();
      if (!message) return;

      chatInput.value = '';
      addMessage(message, 'user');
      chatHistory.push({ role: 'user', content: message });
      clearAnswerOptions();

      const loading = addMessage('Thinking...', 'assistant', true);

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schema: schema ? schemaInput.value : null,
            message,
            history: chatHistory
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Request failed');
        }

        const data = await response.json();
        loading.remove();

        if (data.error) {
          addMessage(data.error, 'error');
        } else {
          if (data.phaseNotice) {
            addMessage(data.phaseNotice, 'assistant');
            chatHistory.push({ role: 'assistant', content: data.phaseNotice });
          }
          if (data.mode === 'question') {
            addMessage(data.response, 'assistant');
            chatHistory.push({ role: 'assistant', content: data.response });
            setAnswerOptions(data.options || null, data.questionKey || null);
            return;
          }

          if (data.mode === 'json') {
            chatHistory.push({ role: 'assistant', content: '[JSON generated]' });
            clearAnswerOptions();
          } else {
            addMessage(data.response, 'assistant');
            chatHistory.push({ role: 'assistant', content: data.response });
            clearAnswerOptions();
          }

          try {
            const json = JSON.parse(data.response);
            renderGeneratedJson(removeSectionsWrapper(json));
            validationResult.className = 'validation-result';
            if (data.mode === 'json') {
              const completionMessage = 'JSON generation is done.';
              addMessage(completionMessage, 'assistant');
              chatHistory.push({ role: 'assistant', content: completionMessage });
            }
          } catch (e) {
            jsonOutput.style.display = 'block';
            jsonOutput.value = data.response;
          }
        }
      } catch (e) {
        loading.remove();
        addMessage(e.message || 'Failed to get response', 'error');
      }
    }

    function addMessage(content, type, isLoading = false) {
      if (chatMessages.querySelector('.empty-state')) {
        chatMessages.innerHTML = '';
      }
      const div = document.createElement('div');
      div.className = 'message message-' + type;
      if (isLoading) {
        div.innerHTML = '<div class="spinner"></div>';
      } else {
        div.textContent = content;
      }
      chatMessages.appendChild(div);
      chatMessages.scrollTop = chatMessages.scrollHeight;
      return div;
    }

    function removeSectionsWrapper(json) {
      if (!json || typeof json !== 'object' || Array.isArray(json)) {
        return json;
      }
      if (Array.isArray(json.sections)) {
        return json.sections;
      }
      return json;
    }

    function renderGeneratedJson(json) {
      const pretty = JSON.stringify(json, null, 2);
      jsonOutput.value = pretty;
      jsonOutput.style.display = 'block';
    }

    function getCurrentAnswer() {
      if (
        currentQuestionKey === 'operations' &&
        operationControls.classList.contains('show')
      ) {
        const customSelected = selectedOperations.has('__custom__');
        const ops = [...selectedOperations].filter((v) => v !== '__custom__');
        if (ops.length > 0) {
          return ops.join(' + ');
        }
        if (customSelected) {
          return chatInput.value.trim();
        }
        return chatInput.value.trim();
      }
      if (!answerControls.classList.contains('show')) {
        return chatInput.value.trim();
      }
      if (isParametricQuestionKey(currentQuestionKey)) {
        const typed = chatInput.value.trim();
        if (typed) return typed;
      }
      const selected = answerSelect.value;
      if (!selected || selected === '__custom__') {
        return chatInput.value.trim();
      }
      return selected.trim();
    }

    function setAnswerOptions(options, questionKey) {
      currentQuestionKey = questionKey || null;
      if (!Array.isArray(options) || options.length === 0) {
        hideAnswerOptionControls();
        return;
      }
      if (currentQuestionKey === 'operations') {
        setOperationOptions(options);
        return;
      }
      answerSelect.innerHTML = '';
      for (const option of options) {
        const el = document.createElement('option');
        el.value = option;
        el.textContent = option;
        answerSelect.appendChild(el);
      }
      const custom = document.createElement('option');
      custom.value = '__custom__';
      custom.textContent = 'Custom input...';
      answerSelect.appendChild(custom);

      answerControls.classList.add('show');
      answerSelect.value = options[0];
      if (isParametricQuestionKey(currentQuestionKey)) {
        chatInput.disabled = false;
        chatInput.value = options[0] || '';
        chatInput.placeholder = 'Edit parameters, or pick another preset...';
      } else {
        chatInput.value = '';
        chatInput.placeholder = 'Type a custom value or use dropdown...';
        chatInput.disabled = true;
      }
    }

    function setOperationOptions(options) {
      operationChips.innerHTML = '';
      selectedOperations = new Set();
      options.forEach((op) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'op-chip';
        btn.textContent = op;
        btn.dataset.value = op;
        btn.addEventListener('click', () => {
          if (selectedOperations.has(op)) {
            selectedOperations.delete(op);
            btn.classList.remove('active');
          } else {
            selectedOperations.add(op);
            btn.classList.add('active');
          }
        });
        operationChips.appendChild(btn);
      });

      const customBtn = document.createElement('button');
      customBtn.type = 'button';
      customBtn.className = 'op-chip';
      customBtn.textContent = 'Custom input...';
      customBtn.dataset.value = '__custom__';
      customBtn.addEventListener('click', () => {
        if (selectedOperations.has('__custom__')) {
          selectedOperations.delete('__custom__');
          customBtn.classList.remove('active');
          chatInput.disabled = true;
          chatInput.value = '';
        } else {
          selectedOperations.add('__custom__');
          customBtn.classList.add('active');
          chatInput.disabled = false;
          chatInput.focus();
        }
      });
      operationChips.appendChild(customBtn);

      operationControls.classList.add('show');
      answerControls.classList.remove('show');
      chatInput.disabled = true;
      chatInput.value = '';
      chatInput.placeholder = 'Select one or more operations, or choose Custom input...';
    }

    function clearAnswerOptions() {
      currentQuestionKey = null;
      hideAnswerOptionControls();
      if (!chatInput.value) {
        chatInput.placeholder = 'e.g., Create a user profile with name, email, and age...';
      }
    }

    function hideAnswerOptionControls() {
      answerControls.classList.remove('show');
      answerSelect.innerHTML = '';
      operationControls.classList.remove('show');
      operationChips.innerHTML = '';
      selectedOperations = new Set();
      if (chatInput.disabled) {
        chatInput.disabled = false;
      }
    }

    answerSelect.addEventListener('change', () => {
      const customSelected = answerSelect.value === '__custom__';
      if (isParametricQuestionKey(currentQuestionKey)) {
        chatInput.disabled = false;
        if (!customSelected) {
          chatInput.value = answerSelect.value;
        }
      } else {
        chatInput.disabled = !customSelected;
      }
      if (customSelected) {
        chatInput.focus();
      } else {
        if (!isParametricQuestionKey(currentQuestionKey)) {
          chatInput.value = '';
        }
      }
    });

    function isParametricQuestionKey(key) {
      return (
        typeof key === 'string' &&
        (
          key.startsWith('op_count_') ||
          key.startsWith('selection_') ||
          key.startsWith('selectivity_')
        )
      );
    }

    function toSchemaValidationShape(json, schemaDoc) {
      if (!Array.isArray(json)) {
        return json;
      }
      const properties = schemaDoc && typeof schemaDoc === 'object' ? schemaDoc.properties : null;
      const required = Array.isArray(schemaDoc?.required) ? schemaDoc.required : [];
      if (properties && properties.sections && required.includes('sections')) {
        return { sections: json };
      }
      return json;
    }

    copyBtn.addEventListener('click', () => {
      const text = jsonOutput.value;
      if (!text) return;
      navigator.clipboard.writeText(text).then(() => {
        copyBtn.textContent = 'Copied!';
        setTimeout(() => copyBtn.textContent = 'Copy', 1500);
      });
    });

    validateBtn.addEventListener('click', async () => {
      const jsonText = jsonOutput.value.trim();
      if (!jsonText || !schema) {
        validationResult.textContent = 'No JSON or schema to validate';
        validationResult.className = 'validation-result show invalid';
        return;
      }
      try {
        const json = JSON.parse(jsonText);
        const { default: Ajv2020 } = await import('https://esm.sh/ajv@8.17.1/dist/2020?bundle');
        const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
        const validate = ajv.compile(schema);
        const valid = validate(toSchemaValidationShape(json, schema));
        if (valid) {
          validationResult.textContent = 'Valid! JSON conforms to schema.';
          validationResult.className = 'validation-result show valid';
        } else {
          const errors = (validate.errors || []).map((e) => {
            const path = e.instancePath || '/';
            return (path + ' ' + e.message).trim();
          }).join(', ');
          validationResult.textContent = 'Invalid: ' + errors;
          validationResult.className = 'validation-result show invalid';
        }
      } catch (e) {
        validationResult.textContent = 'Parse error: ' + e.message;
        validationResult.className = 'validation-result show invalid';
      }
    });
  </script>
</body>
</html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/') {
      return new Response(HTML, {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    if (url.pathname === '/api/chat' && request.method === 'POST') {
      return handleChat(request, env);
    }
    
    return new Response('Not Found', { status: 404 });
  }
};

async function handleChat(request, env) {
  try {
    const { schema, message, history = [] } = await request.json();

    if (!message) {
      return Response.json({ error: 'Message is required' }, { status: 400 });
    }

    const safeHistory = history.filter(
      (m) => m && (m.role === 'user' || m.role === 'assistant')
    );
    const last = safeHistory[safeHistory.length - 1];
    const fullConversation = (
      last &&
      last.role === 'user' &&
      last.content === message
    )
      ? safeHistory
      : [...safeHistory, { role: 'user', content: message }];
    let activeConversation = fullConversation;
    let cycleRequest = extractInitialUserRequest(fullConversation);
    let resolvedClarifications = {};
    let askedClarifications = 0;

    const ai = env.AI;
    const modelName = env.AI_NAME || '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
    const parsedAttempts = parseInt(String(env.AI_RETRY_ATTEMPTS || '3'), 10);
    const maxAttempts = Number.isFinite(parsedAttempts) ? Math.max(1, parsedAttempts) : 3;
    const parsedMaxTokens = parseInt(String(env.AI_MAX_TOKENS || '1200'), 10);
    const maxTokens = (
      Number.isFinite(parsedMaxTokens) &&
      parsedMaxTokens > 0
    )
      ? parsedMaxTokens
      : 1200;
    const parsedTemperature = Number(env.AI_TEMPERATURE ?? '0');
    const temperature = Number.isFinite(parsedTemperature)
      ? Math.min(1, Math.max(0, parsedTemperature))
      : 0;

    if (!ai || typeof ai.run !== 'function') {
      return Response.json({
        error: 'Workers AI binding is not available. Ensure `[ai] binding = "AI"` is configured and redeploy.'
      }, { status: 503 });
    }

    const aiInputBase = {
      max_tokens: maxTokens,
      temperature
    };

    let parsedSchema = null;
    if (schema) {
      try {
        parsedSchema = JSON.parse(schema);
        aiInputBase.response_format = {
          type: 'json_schema',
          json_schema: parsedSchema
        };
      } catch {
        // Schema is already validated client-side; if parsing fails here, fall back to prompt-only guidance.
      }
    }

    if (parsedSchema) {
      let inferredClarifications = inferClarificationsFromRequest(cycleRequest, parsedSchema);
      const planIndex = findLastAssistantIndex(fullConversation, (content) => content.startsWith('Plan Phase'));
      const generatedIndex = findLastAssistantIndex(fullConversation, (content) => content === '[JSON generated]');
      const hasActivePlan = planIndex !== -1 && planIndex > generatedIndex;

      const clarificationSteps = buildSchemaDrivenClarificationSteps(parsedSchema, inferredClarifications);
      const pendingPlanSteps = filterPendingClarificationSteps(
        clarificationSteps,
        inferredClarifications
      );

      // Phase 1a: plan pass. List all schema-derived questions first.
      if (!hasActivePlan) {
        return Response.json({
          mode: 'question',
          phaseNotice: 'Phase 1 started: planning all schema-derived questions.',
          response: formatPlanPhaseMessage(pendingPlanSteps)
        });
      }

      // Active question cycle starts after the latest plan message.
      activeConversation = fullConversation.slice(planIndex + 1);
      cycleRequest = extractRequestForPlan(fullConversation, planIndex);
      inferredClarifications = inferClarificationsFromRequest(cycleRequest, parsedSchema);
      const answeredClarifications = extractClarificationAnswers(activeConversation);
      resolvedClarifications = {
        ...inferredClarifications,
        ...answeredClarifications
      };
      askedClarifications = activeConversation.filter(
        (m) => m.role === 'assistant' &&
          typeof m.content === 'string' &&
          m.content.startsWith('Clarification ')
      ).length;

      const runtimeClarificationSteps = buildSchemaDrivenClarificationSteps(parsedSchema, resolvedClarifications);
      const pendingRuntimeSteps = filterPendingClarificationSteps(
        runtimeClarificationSteps,
        resolvedClarifications
      );
      const unresolvedStep = pendingRuntimeSteps[0] || null;

      // Phase 1b: ask each planned question one at a time.
      if (unresolvedStep) {
        const step = unresolvedStep;
        const questionNumber = askedClarifications + 1;
        let responseText = `Clarification ${questionNumber}
Question: ${step.question}

Assumption (if you skip): ${step.assumptionKey} = ${step.assumedValue}
Why: ${step.reason}`;
        if (step.extra) {
          responseText += `\n\n${step.extra}`;
        }
        responseText += '\n\nReply with your value to override, or say "use assumption".';
        return Response.json({
          mode: 'question',
          phaseNotice: askedClarifications === 0
            ? 'Phase 1 complete. Moving to Phase 2: clarification Q&A.'
            : null,
          response: responseText,
          questionKey: step.assumptionKey,
          options: step.options || null
        });
      }
    }

    const generationSystemPrompt = parsedSchema
      ? `You are a JSON generator. Respond with valid JSON that conforms to the provided response schema.

Rules:
1. ALWAYS respond with valid JSON only - no explanations, no markdown, no text outside the JSON
2. The JSON must conform to the provided response schema
3. This is Phase 3. Phase 1 planned clarifications and Phase 2 collected all answers.
4. You MUST use the resolved clarifications exactly as provided in the "Resolved clarifications" message.
5. Treat user replies after clarifying questions as overrides to assumptions.
6. If the user says "use assumption" (or "use assumptions"), apply the assumption from the prior assistant clarification message.
7. For any op_count_* clarification value using constant(N), output op_count as numeric literal N (not a distribution object).
8. If the user asks for something that cannot be represented by the schema, return empty JSON object {} or the closest valid representation
9. Never wrap the JSON in code blocks or markdown`
      : `You are a JSON generator. Given user requests, respond with valid JSON.

Rules:
1. ALWAYS respond with valid JSON only - no explanations, no markdown, no text outside the JSON
2. If asked to create a JSON document, create a reasonable one
3. Never wrap the JSON in code blocks or markdown`;

    const baseGenerationMessages = [
      { role: 'system', content: generationSystemPrompt },
      ...(parsedSchema
        ? [{
            role: 'system',
            content: `Resolved clarifications (apply these values when building JSON): ${JSON.stringify(resolvedClarifications)}`
          }]
        : []),
      {
        role: 'user',
        content: `Original request: ${cycleRequest}`
      }
    ];

    let attemptMessages = baseGenerationMessages;
    let lastError = 'Model returned invalid JSON (often due to truncation). Please try a shorter request and retry.';

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      let responseText = '';
      try {
        const result = await ai.run(
          modelName,
          {
            ...aiInputBase,
            messages: attemptMessages
          }
        );
        responseText = extractResponseText(result);
      } catch (runError) {
        lastError = `Model call failed (attempt ${attempt}/${maxAttempts}): ${runError?.message || 'Unknown error'}`;
        if (attempt < maxAttempts) {
          continue;
        }
      }

      if (!responseText) {
        if (attempt < maxAttempts) {
          continue;
        }
        break;
      }

      try {
        const parsedJson = JSON.parse(responseText);

        const withNormalizedOpCounts = applyResolvedConstantsToOpCounts(parsedJson, resolvedClarifications);
        const normalizedJson = applyResolvedSectionCount(withNormalizedOpCounts, resolvedClarifications);
        return Response.json({
          mode: 'json',
          phaseNotice: parsedSchema
            ? (askedClarifications > 0
                ? 'Phase 2 complete. Moving to Phase 3: final JSON generation.'
                : 'Phase 2 skipped (no missing clarifications). Moving to Phase 3: final JSON generation.')
            : null,
          response: JSON.stringify(normalizedJson, null, 2)
        });
      } catch {
        lastError = 'Model returned invalid JSON. Regenerating once more.';
        if (attempt < maxAttempts) {
          attemptMessages = [
            ...baseGenerationMessages,
            {
              role: 'user',
              content: 'Your previous response was not valid JSON. Return valid JSON only, with no markdown or extra text.'
            }
          ];
          continue;
        }
      }
    }

    if (parsedSchema) {
      const fallback = buildFallbackJsonFromClarifications(parsedSchema, resolvedClarifications);
      const normalizedFallback = applyResolvedSectionCount(fallback, resolvedClarifications);
      return Response.json({
        mode: 'json',
        phaseNotice: askedClarifications > 0
          ? 'Phase 2 complete. Moving to Phase 3: final JSON generation (fallback path).'
          : 'Phase 2 skipped (no missing clarifications). Moving to Phase 3: final JSON generation (fallback path).',
        response: JSON.stringify(normalizedFallback, null, 2)
      });
    }

    return Response.json(
      { error: lastError },
      { status: 502 }
    );

  } catch (error) {
    console.error('Chat error:', error);
    return Response.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

const KEY_MATCH_REGEX = /Assumption \(if you skip\):\s*([a-zA-Z0-9_]+)\s*=\s*(.+)/;
const USE_ASSUMPTION_REGEX = /^use assumptions?$/i;
const OP_ALIAS_REGEXES = {
  inserts: /\binsert(s)?\b/,
  updates: /\bupdate(s)?\b/,
  point_queries: /\bpoint_?quer(y|ies)\b/,
  range_queries: /\brange_?quer(y|ies)\b/,
  point_deletes: /\bpoint_?delete(s)?\b/,
  range_deletes: /\brange_?delete(s)?\b/,
  empty_point_queries: /\bempty_?point_?quer(y|ies)\b/,
  empty_point_deletes: /\bempty_?point_?delete(s)?\b/,
  merges: /\bmerge(s)?\b/
};
const OP_DELETE_REGEX = /\bdeletes?\b/;
const NUMBER_TOKEN_PATTERN = '\\d+(?:\\.\\d+)?(?:\\s*[kmb])?';
const SIZE_TOKEN_PATTERN = '\\d+(?:\\.\\d+)?\\s*(?:b|bytes?|kb|kib|mb|mib)';
const SIZE_UNIT_MULTIPLIERS = {
  b: 1,
  byte: 1,
  bytes: 1,
  kb: 1024,
  kib: 1024,
  mb: 1024 * 1024,
  mib: 1024 * 1024
};
const OPS_WITH_KEY_FIELDS = new Set(['inserts', 'empty_point_queries', 'empty_point_deletes']);
const OPS_WITH_VALUE_FIELDS = new Set(['inserts', 'updates', 'merges']);

function extractClarificationAnswers(conversation) {
  const resolved = {};
  for (let i = 0; i < conversation.length; i += 1) {
    const msg = conversation[i];
    if (!msg || msg.role !== 'assistant' || typeof msg.content !== 'string') continue;

    const keyMatch = msg.content.match(KEY_MATCH_REGEX);
    if (!keyMatch) continue;

    const key = keyMatch[1].trim();
    const assumedValue = keyMatch[2].split('\n')[0].trim();
    let chosenValue = assumedValue;

    const nextUser = conversation[i + 1];
    if (nextUser && nextUser.role === 'user' && typeof nextUser.content === 'string') {
      const answer = nextUser.content.trim();
      if (answer && !USE_ASSUMPTION_REGEX.test(answer)) chosenValue = answer;
    }

    resolved[key] = chosenValue;
  }
  return resolved;
}

function findLastAssistantIndex(conversation, predicate) {
  for (let i = (conversation || []).length - 1; i >= 0; i -= 1) {
    const msg = conversation[i];
    if (!msg || msg.role !== 'assistant' || typeof msg.content !== 'string') {
      continue;
    }
    if (predicate(msg.content)) {
      return i;
    }
  }
  return -1;
}

function formatPlanPhaseMessage(steps) {
  const all = Array.isArray(steps) ? steps : [];
  const mandatory = all.filter((step) => step?.questionType !== 'optional');
  const optional = all.filter((step) => step?.questionType === 'optional');
  const mandatoryLines = mandatory.map((step, idx) => `${idx + 1}. ${step.question}`);
  const optionalLines = optional.map((step, idx) => `${idx + 1}. ${step.question}`);
  return `Plan Phase
I read the schema and prepared the full question plan before generation.

Questions I will ask next:
Mandatory:
${mandatoryLines.join('\n') || 'None'}

Optional:
${optionalLines.join('\n') || 'None'}

Next: I will ask these one by one, collect your answers/overrides, then generate final JSON using the schema + all collected answers.`;
}

function hasResolvedClarificationValue(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function filterPendingClarificationSteps(steps, resolvedClarifications) {
  const all = Array.isArray(steps) ? steps : [];
  const resolved = resolvedClarifications || {};
  return all.filter((step) => !hasResolvedClarificationValue(resolved[step.assumptionKey]));
}

function applyResolvedConstantsToOpCounts(jsonDoc, resolvedClarifications) {
  const constantsByOp = {};
  const resolved = resolvedClarifications || {};
  const opCountPrefix = 'op_count_';
  const variantPrefix = 'variant_op_count_';
  
  for (const key of Object.keys(resolved)) {
    if (!key.startsWith(opCountPrefix) || typeof resolved[key] !== 'string') continue;
    
    const op = key.slice(opCountPrefix.length);
    const trimmedValue = resolved[key].trim();
    const variantKey = variantPrefix + op;
    const variant = typeof resolved[variantKey] === 'string' ? resolved[variantKey].trim().toLowerCase() : '';

    let parsed = null;
    const constantMatch = trimmedValue.match(CONSTANT_REGEX);
    if (constantMatch) {
      const constantNumber = Number(constantMatch[1]);
      if (Number.isFinite(constantNumber)) {
        parsed = constantNumber;
      }
    } else if (variant === 'constant') {
      const numeric = Number(trimmedValue);
      if (Number.isFinite(numeric)) {
        parsed = numeric;
      }
    }

    if (parsed !== null) {
      constantsByOp[op] = parsed;
    }
  }

  if (!Object.keys(constantsByOp).length) {
    return jsonDoc;
  }

  const sections = Array.isArray(jsonDoc?.sections) ? jsonDoc.sections : [];
  for (const section of sections) {
    const groups = Array.isArray(section?.groups) ? section.groups : [];
    for (const group of groups) {
      for (const [op, constantValue] of Object.entries(constantsByOp)) {
        const opConfig = group?.[op];
        if (opConfig && typeof opConfig === 'object') {
          opConfig.op_count = constantValue;
        }
      }
    }
  }

  return jsonDoc;
}

function applyResolvedSectionCount(jsonDoc, resolvedClarifications) {
  const targetCount = parseResolvedSectionCount(resolvedClarifications?.sections_count);
  if (!targetCount || !jsonDoc || typeof jsonDoc !== 'object' || Array.isArray(jsonDoc)) {
    return jsonDoc;
  }

  if (!Array.isArray(jsonDoc.sections)) {
    return jsonDoc;
  }

  if (jsonDoc.sections.length === targetCount) {
    return jsonDoc;
  }

  if (jsonDoc.sections.length > targetCount) {
    jsonDoc.sections = jsonDoc.sections.slice(0, targetCount);
    return jsonDoc;
  }

  if (jsonDoc.sections.length === 0) {
    jsonDoc.sections = Array.from({ length: targetCount }, () => ({ groups: [{}] }));
    return jsonDoc;
  }

  const template = clonePlainJson(jsonDoc.sections[jsonDoc.sections.length - 1]) || { groups: [{}] };
  while (jsonDoc.sections.length < targetCount) {
    jsonDoc.sections.push(clonePlainJson(template));
  }
  return jsonDoc;
}

function parseResolvedSectionCount(rawValue) {
  const parsed = parseInt(String(rawValue || '').trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return null;
  }
  return Math.min(parsed, 50);
}

function clonePlainJson(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

function extractInitialUserRequest(conversation) {
  const firstUser = (conversation || []).find(
    (m) => m && m.role === 'user' && typeof m.content === 'string' && m.content.trim()
  );
  return firstUser ? firstUser.content.trim() : 'Generate a valid JSON document.';
}

function extractRequestForPlan(conversation, planIndex) {
  if (!Array.isArray(conversation) || typeof planIndex !== 'number') {
    return extractInitialUserRequest(conversation);
  }

  for (let i = Math.min(planIndex - 1, conversation.length - 1); i >= 0; i -= 1) {
    const msg = conversation[i];
    if (msg && msg.role === 'user' && typeof msg.content === 'string' && msg.content.trim()) {
      return msg.content.trim();
    }
  }

  return extractInitialUserRequest(conversation);
}

function inferClarificationsFromRequest(requestText, schema) {
  const inferred = {
    configure_optional_fields: 'no'
  };
  if (typeof requestText !== 'string' || !requestText.trim()) {
    return inferred;
  }

  const text = requestText.trim();
  const lower = text.toLowerCase();
  const meta = extractSchemaMeta(schema);
  const explicitOps = parseExplicitOperationsFromText(text, meta.operations);
  if (explicitOps.length) {
    inferred.operations = explicitOps.join(' + ');
  }

  const sectionCount = parseSectionCountFromText(lower);
  if (sectionCount !== null) {
    inferred.sections_count = String(sectionCount);
  }

  const characterSet = parseCharacterSetFromText(lower, meta.characterSets);
  if (characterSet) {
    inferred.character_set = characterSet;
  }

  const opCounts = inferOpCountsFromText(text, meta.operations);
  for (const [op, count] of Object.entries(opCounts)) {
    inferred[`variant_op_count_${op}`] = 'constant';
    inferred[`op_count_${op}`] = `constant(${count})`;
  }

  const sizeHints = inferKeyValueSizesFromText(lower);
  const hintedOps = explicitOps.length ? explicitOps : Object.keys(opCounts);
  if (hintedOps.length) {
    for (const op of hintedOps) {
      if (sizeHints.keyLen !== null && OPS_WITH_KEY_FIELDS.has(op)) {
        inferred[`hint_key_len_${op}`] = String(sizeHints.keyLen);
      }
      if (sizeHints.valueLen !== null && OPS_WITH_VALUE_FIELDS.has(op)) {
        inferred[`hint_val_len_${op}`] = String(sizeHints.valueLen);
      }
    }
  }

  return inferred;
}

function parseExplicitOperationsFromText(value, allowedOps) {
  if (typeof value !== 'string' || !value.trim()) {
    return [];
  }
  const normalized = value.toLowerCase().replace(/[-\s]+/g, '_');
  const opsFilter = new Set(Array.isArray(allowedOps) && allowedOps.length ? allowedOps : KNOWN_OPS);
  const picked = KNOWN_OPS.filter((op) => hasWholeOperationMatch(normalized, op));

  for (const [op, re] of Object.entries(OP_ALIAS_REGEXES)) {
    if (re.test(normalized) && !picked.includes(op)) {
      picked.push(op);
    }
  }

  if (/(\bonly\s+insert(s)?\b)|(\binsert[_\s-]*only\b)/i.test(value)) {
    return ['inserts'].filter((op) => opsFilter.has(op));
  }
  if (/(\bonly\s+update(s)?\b)|(\bupdate[_\s-]*only\b)/i.test(value)) {
    return ['updates'].filter((op) => opsFilter.has(op));
  }
  if (/(\bonly\s+point[_\s-]*quer(y|ies)\b)|(\bpoint[_\s-]*quer(y|ies)[_\s-]*only\b)/i.test(value)) {
    return ['point_queries'].filter((op) => opsFilter.has(op));
  }

  return picked.filter((op) => opsFilter.has(op));
}

function parseSectionCountFromText(lowerText) {
  if (typeof lowerText !== 'string') {
    return null;
  }
  const match = lowerText.match(/\b(\d+)\s*(sections?|phases?)\b/i);
  if (!match) {
    return null;
  }
  const parsed = parseInt(match[1], 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return null;
  }
  return Math.min(parsed, 50);
}

function parseCharacterSetFromText(lowerText, allowedCharacterSets) {
  if (typeof lowerText !== 'string') {
    return null;
  }
  const allowed = new Set(Array.isArray(allowedCharacterSets) ? allowedCharacterSets : []);
  for (const candidate of ['alphanumeric', 'alphabetic', 'numeric']) {
    if (lowerText.includes(candidate) && (!allowed.size || allowed.has(candidate))) {
      return candidate;
    }
  }
  return null;
}

function inferOpCountsFromText(text, allowedOps) {
  const counts = {};
  const opsFilter = new Set(Array.isArray(allowedOps) && allowedOps.length ? allowedOps : KNOWN_OPS);

  for (const op of KNOWN_OPS) {
    if (!opsFilter.has(op)) {
      continue;
    }
    const labels = operationLabelsForCountParsing(op);
    let parsedCount = null;

    for (const label of labels) {
      const labelPattern = label.replace(/[-_\s]+/g, '[-_\\s]*');
      const patterns = [
        new RegExp(`(?:number|count|op[_\\s-]*count)\\s+of\\s+${labelPattern}(?:\\s+operations?)?\\s*(?:is|=|:)?\\s*(${NUMBER_TOKEN_PATTERN})\\b`, 'i'),
        new RegExp(`${labelPattern}(?:\\s+operations?)?\\s*(?:is|=|:)?\\s*(${NUMBER_TOKEN_PATTERN})\\b`, 'i'),
        new RegExp(`\\b(${NUMBER_TOKEN_PATTERN})\\s*${labelPattern}(?:\\s+operations?)?\\b`, 'i')
      ];

      for (const re of patterns) {
        const match = text.match(re);
        if (!match) {
          continue;
        }
        const scaled = parseScaledNumberToken(match[1]);
        if (scaled !== null) {
          parsedCount = scaled;
          break;
        }
      }
      if (parsedCount !== null) {
        break;
      }
    }

    if (parsedCount !== null) {
      counts[op] = parsedCount;
    }
  }

  return counts;
}

function operationLabelsForCountParsing(op) {
  const labels = {
    inserts: ['insert', 'inserts'],
    updates: ['update', 'updates'],
    point_queries: ['point query', 'point queries'],
    range_queries: ['range query', 'range queries'],
    point_deletes: ['point delete', 'point deletes'],
    range_deletes: ['range delete', 'range deletes'],
    empty_point_queries: ['empty point query', 'empty point queries'],
    empty_point_deletes: ['empty point delete', 'empty point deletes'],
    merges: ['merge', 'merges', 'read modify write', 'read-modify-write']
  };
  return labels[op] || [op];
}

function parseScaledNumberToken(token) {
  if (typeof token !== 'string') {
    return null;
  }
  const normalized = token.replace(/,/g, '').trim().toLowerCase();
  const match = normalized.match(/^([-+]?\d*\.?\d+)\s*([kmb])?$/);
  if (!match) {
    return null;
  }
  const value = Number(match[1]);
  if (!Number.isFinite(value)) {
    return null;
  }
  const suffix = match[2] || '';
  const multiplier = suffix === 'k' ? 1e3 : suffix === 'm' ? 1e6 : suffix === 'b' ? 1e9 : 1;
  const scaled = Math.round(value * multiplier);
  return scaled > 0 ? scaled : null;
}

function parseSizeTokenToBytes(token) {
  if (typeof token !== 'string') {
    return null;
  }
  const normalized = token.trim().toLowerCase();
  const match = normalized.match(/^(\d+(?:\.\d+)?)\s*(b|bytes?|kb|kib|mb|mib)$/);
  if (!match) {
    return null;
  }
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  const unit = match[2];
  const multiplier = SIZE_UNIT_MULTIPLIERS[unit];
  if (!multiplier) {
    return null;
  }
  return Math.max(1, Math.round(value * multiplier));
}

function inferKeyValueSizesFromText(lowerText) {
  let keyLen = null;
  let valueLen = null;
  if (typeof lowerText !== 'string') {
    return { keyLen, valueLen };
  }

  const bothPattern = new RegExp(
    `(${SIZE_TOKEN_PATTERN})\\s*(?:key\\s*(?:and|&)\\s*value|key\\s*value|key[-\\s]*value|kv)\\s*size`,
    'i'
  );
  const bothMatch = lowerText.match(bothPattern);
  if (bothMatch) {
    const bytes = parseSizeTokenToBytes(bothMatch[1]);
    if (bytes !== null) {
      keyLen = bytes;
      valueLen = bytes;
    }
  }

  if (keyLen === null) {
    const keyMatchA = lowerText.match(new RegExp(`key\\s*size\\s*(?:is|=|:)?\\s*(${SIZE_TOKEN_PATTERN})`, 'i'));
    const keyMatchB = lowerText.match(new RegExp(`(${SIZE_TOKEN_PATTERN})\\s*key\\s*size`, 'i'));
    const keyMatchC = lowerText.match(new RegExp(`(${SIZE_TOKEN_PATTERN})\\s*key\\b`, 'i'));
    const bytes = parseSizeTokenToBytes((keyMatchA || keyMatchB || keyMatchC || [])[1]);
    if (bytes !== null) {
      keyLen = bytes;
    }
  }

  if (valueLen === null) {
    const valMatchA = lowerText.match(new RegExp(`value\\s*size\\s*(?:is|=|:)?\\s*(${SIZE_TOKEN_PATTERN})`, 'i'));
    const valMatchB = lowerText.match(new RegExp(`(${SIZE_TOKEN_PATTERN})\\s*value\\s*size`, 'i'));
    const valMatchC = lowerText.match(new RegExp(`(${SIZE_TOKEN_PATTERN})\\s*value\\b`, 'i'));
    const bytes = parseSizeTokenToBytes((valMatchA || valMatchB || valMatchC || [])[1]);
    if (bytes !== null) {
      valueLen = bytes;
    }
  }

  return { keyLen, valueLen };
}

function buildFallbackJsonFromClarifications(schema, resolvedClarifications) {
  const meta = extractSchemaMeta(schema);
  const ops = parseOperationsAnswer(resolvedClarifications.operations || 'inserts + point_queries');
  const sectionsCount = Math.max(
    1,
    Math.min(10, parseInt(String(resolvedClarifications.sections_count || '1'), 10) || 1)
  );
  const rangeFormat = meta.rangeFormats[0] || 'StartCount';
  const characterSet = resolvedClarifications.character_set || (meta.characterSets[0] || 'alphanumeric');

  const sections = [];
  for (let i = 0; i < sectionsCount; i += 1) {
    const group = {};
    for (const op of ops) {
      const opSchema = resolveOperationSchema((schema?.$defs?.WorkloadSpecGroup?.properties || {})[op], schema?.$defs || {});
      if (!opSchema) continue;
      const required = Array.isArray(opSchema.required) ? opSchema.required : [];
      const opObj = {};
      for (const field of required) {
        if (field === 'op_count') {
          opObj.op_count = inferFallbackOpCount(resolvedClarifications[`op_count_${op}`]);
        } else if (field === 'key') {
          opObj.key = 'key';
        } else if (field === 'val') {
          opObj.val = 'value';
        } else if (field === 'selectivity') {
          opObj.selectivity = 0.1;
        } else if (field === 'selection') {
          opObj.selection = { uniform: { min: 0, max: 1 } };
        } else if (field === 'range_format') {
          opObj.range_format = rangeFormat;
        }
      }
      group[op] = opObj;
    }
    sections.push({ groups: [group] });
  }

  return {
    $schema: schema?.$schema || 'https://json-schema.org/draft/2020-12/schema',
    character_set: characterSet,
    sections
  };
}

const CONSTANT_REGEX = /^constant\(\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*\)$/i;

function inferFallbackOpCount(answer) {
  if (typeof answer === 'string') {
    const constant = answer.trim().match(CONSTANT_REGEX);
    if (constant) {
      const parsed = Number(constant[1]);
      if (Number.isFinite(parsed)) return parsed;
    }
    const numeric = Number(answer.trim());
    if (Number.isFinite(numeric)) return numeric;
  }
  return 500000;
}

function buildSchemaDrivenClarificationSteps(schema, resolvedClarifications) {
  const resolved = resolvedClarifications || {};
  const meta = extractSchemaMeta(schema);
  const isPlanning = Object.keys(resolved).length === 0;
  const configureOptional = resolveBooleanChoice(resolved.configure_optional_fields, false);
  const defaultOperationsAnswer = (
    meta.operations.includes('inserts') &&
    meta.operations.includes('point_queries')
  )
    ? 'inserts + point_queries'
    : (meta.operations.join(' + ') || 'inserts + point_queries');
  const selectedOps = parseOperationsAnswer(
    resolved.operations || defaultOperationsAnswer
  );

  const steps = [];
  steps.push({
    assumptionKey: 'operations',
    question: `What operations should be included (${meta.operations.join(', ')})?`,
    assumedValue: defaultOperationsAnswer,
    reason: 'Operation set determines which operation schemas are active.',
    extra: 'You can list multiple operations separated by "+" or commas.',
    options: meta.operations,
    questionType: 'mandatory'
  });

  if (meta.characterSets.length) {
    steps.push({
      assumptionKey: 'character_set',
      question: `What character set should generated keys use (${meta.characterSets.join(', ')})?`,
      assumedValue: meta.characterSets.includes('alphanumeric') ? 'alphanumeric' : meta.characterSets[0],
      reason: 'This enum comes directly from schema character set choices.',
      options: meta.characterSets,
      questionType: 'mandatory'
    });
  }

  steps.push({
    assumptionKey: 'sections_count',
    question: 'How many sections/phases should the workload have?',
    assumedValue: '1',
    reason: 'Sections are the top-level array in the schema and define phase shifts.',
    questionType: 'mandatory'
  });

  // Required field questions first.
  for (const op of selectedOps) {
    const opSteps = getOperationFieldInfo(schema, op, meta, resolved, isPlanning, 'required');
    for (const step of opSteps) {
      steps.push(step);
    }
  }

  // Optional gate: if user says "no", runtime skips all optional questions.
  steps.push({
    assumptionKey: 'configure_optional_fields',
    question: 'Do you want to tune advanced behavior, or keep defaults for everything optional?',
    assumedValue: 'no',
    reason: 'Skipping optional configuration moves directly to generation using defaults.',
    options: ['no', 'yes'],
    questionType: 'mandatory'
  });

  if (isPlanning || configureOptional) {
    for (const op of selectedOps) {
      const opSteps = getOperationFieldInfo(schema, op, meta, resolved, isPlanning, 'optional');
      for (const step of opSteps) {
        steps.push(step);
      }
    }

    if (meta.hasSorted) {
      steps.push({
        assumptionKey: 'sorted_settings',
        question: 'Do you want to configure near-sorted insert behavior, or keep default insert ordering?',
        assumedValue: 'none',
        reason: 'Schema includes an optional sorted tuning block.',
        questionType: 'optional'
      });
    }

    steps.push({
      assumptionKey: 'special_requirements',
      question: 'Any additional workload goals I should apply (for example: hot ranges, phase shifts, or stricter limits)?',
      assumedValue: 'none',
      reason: 'Captures remaining optional constraints before generation.',
      questionType: 'optional'
    });
  }

  return steps;
}

function extractSchemaMeta(schema) {
  const defs = schema?.$defs || {};
  const groupProps = defs?.WorkloadSpecGroup?.properties || {};
  const operations = Object.keys(groupProps).filter((k) => k !== 'character_set' && k !== 'sorted');
  const hasSorted = Boolean(groupProps.sorted);

  const characterSets = Array.isArray(defs?.CharacterSet?.enum)
    ? defs.CharacterSet.enum.map((v) => String(v))
    : ['alphanumeric', 'alphabetic', 'numeric'];

  const stringExprTypes = Array.isArray(defs?.StringExprInner?.oneOf)
    ? defs.StringExprInner.oneOf
        .map((variant) => Object.keys(variant?.properties || {})[0])
        .filter(Boolean)
    : ['uniform', 'weighted', 'segmented', 'hot_range'];

  const distributionTypes = Array.isArray(defs?.Distribution?.oneOf)
    ? defs.Distribution.oneOf
        .map((variant) => {
          const name = Object.keys(variant?.properties || {})[0];
          const params = variant?.properties?.[name]?.properties
            ? Object.keys(variant.properties[name].properties)
            : [];
          return name ? { name, params } : null;
        })
        .filter(Boolean)
    : [];

  const rangeFormats = Array.isArray(defs?.RangeFormat?.oneOf)
    ? defs.RangeFormat.oneOf
        .map((v) => v?.const)
        .filter((v) => typeof v === 'string')
    : [];

  return {
    operations,
    characterSets,
    stringExprTypes,
    distributionTypes,
    rangeFormats,
    hasSorted
  };
}

function buildDistributionHelp(meta) {
  if (!meta.distributionTypes.length) {
    return '';
  }
  const lines = meta.distributionTypes.map((d) => {
    const defaults = distributionDefaults(d.name);
    const orderedParams = orderDistributionParams(d.params);
    const rendered = orderedParams.map((p) => {
      const v = defaults[p];
      return v !== undefined ? `${p}=${v}` : p;
    });
    return `- ${d.name}(${rendered.join(', ')})`;
  });
  return `Valid distribution types from schema:\n${lines.join('\n')}`;
}

function orderDistributionParams(params) {
  const priority = ['min', 'max', 'mean', 'std_dev', 'alpha', 'beta', 'n', 's', 'lambda', 'scale', 'shape'];
  return [...params].sort((a, b) => {
    const ai = priority.indexOf(a);
    const bi = priority.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

function distributionDefaults(name) {
  const byName = {
    uniform: { min: 0, max: 1 },
    normal: { mean: 0.5, std_dev: 0.15 },
    beta: { alpha: 0.1, beta: 5 },
    zipf: { n: 1000000, s: 1.5 },
    exponential: { lambda: 1.0 },
    log_normal: { mean: 0.5, std_dev: 0.2 },
    poisson: { lambda: 10 },
    weibull: { scale: 1.0, shape: 2.0 },
    pareto: { scale: 1.0, shape: 2.0 }
  };
  return byName[name] || {};
}

function getOperationFieldInfo(schema, op, meta, resolvedClarifications, isPlanning, mode = 'all') {
  const defs = schema?.$defs || {};
  const groupProps = defs?.WorkloadSpecGroup?.properties || {};
  const opProp = groupProps?.[op];
  const opSchema = resolveOperationSchema(opProp, defs);
  if (!opSchema || typeof opSchema !== 'object') {
    return [];
  }

  const steps = [];
  const required = Array.isArray(opSchema.required) ? opSchema.required : [];
  const requiredSet = new Set(required);
  const props = opSchema.properties || {};
  const requiredNames = Object.keys(props).filter((name) => requiredSet.has(name) && name !== 'character_set');
  const optionalNames = Object.keys(props).filter((name) => !requiredSet.has(name) && name !== 'character_set');
  const candidateNames = mode === 'required'
    ? requiredNames
    : mode === 'optional'
      ? optionalNames
      : [...requiredNames, ...optionalNames];

  for (const name of candidateNames) {
    const questionType = mode === 'optional' ? 'optional' : 'mandatory';
    const fieldSchema = props[name];
    const suffix = `${name}_${op}`;
    const isRequired = requiredSet.has(name);

    if (!isRequired) {
      const includeKey = `include_${suffix}`;
      const includeByDefault = optionalIncludeDefaultForField(name);
      steps.push({
        assumptionKey: includeKey,
        question: buildOptionalIncludeQuestion(op, name),
        assumedValue: includeByDefault ? 'yes' : 'no',
        reason: inferOptionalIncludeReason(name),
        options: ['yes', 'no'],
        questionType: 'optional'
      });

      if (!isPlanning) {
        const includeChoice = resolveBooleanChoice(resolvedClarifications?.[includeKey], includeByDefault);
        if (!includeChoice) {
          continue;
        }
      }
    }

    const variants = inferFieldVariants(name, fieldSchema, meta);
    let selectedVariant = null;
    if (variants && variants.length > 1) {
      const variantKey = `variant_${suffix}`;
      const defaultVariant = inferDefaultVariantForField(name, variants);
      steps.push({
        assumptionKey: variantKey,
        question: buildVariantQuestion(op, name, variants),
        assumedValue: defaultVariant,
        reason: inferVariantReason(name),
        options: variants,
        questionType
      });
      selectedVariant = normalizeVariantChoice(
        resolvedClarifications?.[variantKey],
        variants,
        defaultVariant
      );
    } else if (variants && variants.length === 1) {
      selectedVariant = variants[0];
    }

    steps.push({
      assumptionKey: suffix,
      question: buildValueQuestion(op, name),
      assumedValue: inferDefaultFromField(
        name,
        fieldSchema,
        meta,
        selectedVariant,
        resolvedClarifications,
        op
      ),
      reason: inferReasonForField(name),
      extra: inferExtraForField(name, meta, selectedVariant),
      options: inferOptionsForField(
        name,
        fieldSchema,
        meta,
        selectedVariant,
        resolvedClarifications,
        op
      ),
      questionType
    });
  }

  return steps;
}

function resolveOperationSchema(opProp, defs) {
  if (!opProp) {
    return null;
  }
  const variants = [];
  if (opProp.$ref) {
    variants.push(resolveRef(opProp.$ref, defs));
  }
  if (Array.isArray(opProp.anyOf)) {
    for (const item of opProp.anyOf) {
      if (item.$ref) {
        variants.push(resolveRef(item.$ref, defs));
      } else if (item.type !== 'null') {
        variants.push(item);
      }
    }
  }
  return variants.find((v) => v && typeof v === 'object' && v.type === 'object') || null;
}

function resolveRef(ref, defs) {
  const prefix = '#/$defs/';
  if (typeof ref !== 'string' || !ref.startsWith(prefix)) {
    return null;
  }
  const key = ref.slice(prefix.length);
  return defs?.[key] || null;
}

function optionalIncludeDefaultForField(name) {
  if (name === 'selection') {
    return true;
  }
  return false;
}

function resolveBooleanChoice(value, fallback) {
  if (typeof value !== 'string') {
    return Boolean(fallback);
  }
  const normalized = value.trim().toLowerCase();
  if (/^(yes|y|true|1|include|included|on)$/.test(normalized)) {
    return true;
  }
  if (/^(no|n|false|0|skip|omit|off)$/.test(normalized)) {
    return false;
  }
  return Boolean(fallback);
}

function operationDisplayName(op) {
  const labels = {
    inserts: 'inserts',
    updates: 'updates',
    merges: 'read-modify-writes',
    point_queries: 'point queries',
    range_queries: 'range queries',
    point_deletes: 'point deletes',
    range_deletes: 'range deletes',
    empty_point_queries: 'empty point queries',
    empty_point_deletes: 'empty point deletes'
  };
  return labels[op] || op.replace(/_/g, ' ');
}

function buildOptionalIncludeQuestion(op, fieldName) {
  const opLabel = operationDisplayName(op);
  if (fieldName === 'selection') {
    return `For ${opLabel}, do you want to control which keys are targeted, or keep default targeting?`;
  }
  if (fieldName === 'range_format') {
    return `For ${opLabel}, do you want to pick a specific range format, or use the default format?`;
  }
  if (fieldName === 'character_set') {
    return `For ${opLabel}, do you want to override character set at operation level, or inherit the global character set?`;
  }
  return `For ${opLabel}, do you want to configure ${fieldName.replace(/_/g, ' ')} explicitly, or keep defaults?`;
}

function inferOptionalIncludeReason(fieldName) {
  if (fieldName === 'selection') {
    return 'This controls how keys are targeted during read/delete operations.';
  }
  if (fieldName === 'range_format') {
    return 'This controls whether ranges are represented as StartCount or StartEnd.';
  }
  return 'This setting is optional and can be left at defaults.';
}

function buildVariantQuestion(op, fieldName, variants) {
  const opLabel = operationDisplayName(op);
  if (fieldName === 'op_count') {
    return `For ${opLabel}, should the operation count be fixed or distribution-based (${variants.join(', ')})?`;
  }
  if (fieldName === 'key') {
    return `What key pattern should ${opLabel} use (${variants.join(', ')})?`;
  }
  if (fieldName === 'val') {
    return `What value pattern should ${opLabel} use (${variants.join(', ')})?`;
  }
  if (fieldName === 'selection') {
    return `How should ${opLabel} choose keys (${variants.join(', ')})?`;
  }
  if (fieldName === 'selectivity') {
    return `For ${opLabel}, should range width be fixed or distribution-based (${variants.join(', ')})?`;
  }
  return `For ${opLabel}, which style should ${fieldName.replace(/_/g, ' ')} use (${variants.join(', ')})?`;
}

function inferVariantReason(fieldName) {
  if (fieldName === 'op_count') {
    return 'Fixed counts are simpler; distributions model variability.';
  }
  if (fieldName === 'key' || fieldName === 'val') {
    return 'Pattern choice changes key/value structure and skew behavior.';
  }
  if (fieldName === 'selection') {
    return 'Selection choice controls hotspot and access-skew behavior.';
  }
  if (fieldName === 'selectivity') {
    return 'This controls whether range width stays constant or varies.';
  }
  return 'This setting has multiple supported styles and needs one choice.';
}

function buildValueQuestion(op, fieldName) {
  const opLabel = operationDisplayName(op);
  if (fieldName === 'op_count') {
    return `How many ${opLabel} should be generated?`;
  }
  if (fieldName === 'key') {
    return `What should ${opLabel} keys look like?`;
  }
  if (fieldName === 'val') {
    return `What should ${opLabel} values look like?`;
  }
  if (fieldName === 'selection') {
    return `How should ${opLabel} target keys during execution?`;
  }
  if (fieldName === 'selectivity') {
    return `What selectivity should ${opLabel} use?`;
  }
  if (fieldName === 'range_format') {
    return `How should ${opLabel} ranges be represented (StartCount or StartEnd)?`;
  }
  return `How should ${opLabel} ${fieldName.replace(/_/g, ' ')} be configured?`;
}

function inferFieldVariants(name, fieldSchema, meta) {
  if (name === 'op_count' || name === 'selectivity') {
    return ['constant', 'distribution'];
  }
  if (name === 'selection') {
    return meta.distributionTypes.map((d) => d.name);
  }
  if (name === 'key' || name === 'val') {
    return ['literal', ...meta.stringExprTypes];
  }
  if (Array.isArray(fieldSchema?.oneOf) || Array.isArray(fieldSchema?.anyOf)) {
    const variants = (fieldSchema.oneOf || fieldSchema.anyOf || [])
      .map((item) => item?.const || null)
      .filter((v) => typeof v === 'string');
    if (variants.length > 1) {
      return variants;
    }
  }
  return null;
}

function normalizeVariantChoice(rawValue, variants, fallback) {
  if (!Array.isArray(variants) || !variants.length) {
    return fallback || null;
  }
  if (typeof rawValue !== 'string' || !rawValue.trim()) {
    return fallback;
  }
  const normalized = rawValue.trim().toLowerCase().replace(/[-\s]+/g, '_');
  const match = variants.find(
    (v) => v.toLowerCase().replace(/[-\s]+/g, '_') === normalized
  );
  return match || fallback;
}

function inferDefaultVariantForField(name, variants) {
  if (name === 'op_count') {
    return variants.includes('constant') ? 'constant' : variants[0];
  }
  if (name === 'selectivity') {
    return variants.includes('distribution') ? 'distribution' : variants[0];
  }
  if (name === 'selection') {
    return variants.includes('uniform') ? 'uniform' : variants[0];
  }
  if (name === 'key' || name === 'val') {
    return variants.includes('uniform') ? 'uniform' : variants[0];
  }
  return variants[0];
}

function inferDefaultFromField(name, fieldSchema, meta, selectedVariant, resolvedClarifications, op) {
  if (name === 'op_count') {
    if (selectedVariant === 'distribution') {
      return 'uniform(min=1, max=1000000)';
    }
    return 'constant(500000)';
  }
  if (name === 'selection') {
    if (selectedVariant && selectedVariant !== 'distribution') {
      return distributionTemplateForName(meta, selectedVariant) || 'uniform(min=0, max=1)';
    }
    return 'uniform(min=0, max=1)';
  }
  if (name === 'selectivity') {
    if (selectedVariant === 'constant') {
      return '0.01';
    }
    return 'uniform(min=0.001, max=0.1)';
  }
  if (name === 'range_format' && meta.rangeFormats.length) {
    return meta.rangeFormats[0];
  }
  if (name === 'key') {
    const hintedLen = getHintedStringLength(resolvedClarifications, 'key', op);
    if ((selectedVariant === null || selectedVariant === 'uniform') && hintedLen !== null) {
      return `uniform(len=${hintedLen})`;
    }
    if (selectedVariant) {
      return stringExprTemplate(selectedVariant, 'key');
    }
    return stringExprTemplate('uniform', 'key');
  }
  if (name === 'val') {
    const hintedLen = getHintedStringLength(resolvedClarifications, 'val', op);
    if ((selectedVariant === null || selectedVariant === 'uniform') && hintedLen !== null) {
      return `uniform(len=${hintedLen})`;
    }
    if (selectedVariant) {
      return stringExprTemplate(selectedVariant, 'val');
    }
    return stringExprTemplate('uniform', 'val');
  }
  if (name === 'sorted') {
    return 'none';
  }
  if (fieldSchema?.default !== undefined) {
    return String(fieldSchema.default);
  }
  return 'use schema-compatible default';
}

function inferReasonForField(name) {
  if (name === 'op_count') {
    return 'Operation counts are required workload sizing inputs.';
  }
  if (name === 'selection') {
    return 'Selection strategy controls which keys get targeted.';
  }
  if (name === 'selectivity') {
    return 'Selectivity controls range width and scan impact.';
  }
  if (name === 'range_format') {
    return 'Range format changes how ranges are interpreted.';
  }
  if (name === 'key' || name === 'val') {
    return 'StringExpr fields define generated key/value shape.';
  }
  return 'This field is needed for schema-conformant generation.';
}

function getHintedStringLength(resolvedClarifications, fieldName, op) {
  const rawValue = resolvedClarifications?.[`hint_${fieldName}_len_${op}`];
  const parsed = parseInt(String(rawValue || '').trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return null;
  }
  return Math.min(parsed, 10 * 1024 * 1024);
}

function inferExtraForField(name, meta, selectedVariant) {
  if (name === 'selection' || name === 'selectivity' || name === 'op_count') {
    if (selectedVariant === 'constant') {
      return 'Use a numeric constant when you want a fixed value instead of a distribution.';
    }
    return buildDistributionHelp(meta);
  }
  if (name === 'range_format' && meta.rangeFormats.length) {
    return `Range format defaults:
- ${meta.rangeFormats[0]} (default)
${meta.rangeFormats.slice(1).map((v) => `- ${v}`).join('\n')}`;
  }
  if (name === 'key' || name === 'val') {
    if (selectedVariant && selectedVariant !== 'literal') {
      return `Selected variant default: ${stringExprTemplate(selectedVariant, name)}`;
    }
    const defaultsByType = {
      uniform: 'uniform(len=20, character_set=alphanumeric)',
      weighted: 'weighted([{weight:1,value:"user"},{weight:1,value:"post"}])',
      segmented: 'segmented(separator=":", segments=["usertable", "user", uniform(len=20)])',
      hot_range: 'hot_range(len=32, amount=100, probability=0.8)'
    };
    const lines = meta.stringExprTypes.map(
      (t) => `- ${defaultsByType[t] || `${t}(schema-compatible defaults)`}`
    );
    return `StringExpr defaults by variant:\n${lines.join('\n')}`;
  }
  return '';
}

function inferOptionsForField(name, fieldSchema, meta, selectedVariant, resolvedClarifications, op) {
  if (name === 'range_format' && meta.rangeFormats.length) {
    return meta.rangeFormats;
  }
  if (name === 'character_set' && meta.characterSets.length) {
    return meta.characterSets;
  }
  if (name === 'op_count') {
    if (selectedVariant === 'constant') {
      return ['constant(500000)'];
    }
    if (selectedVariant === 'distribution') {
      return distributionTemplateOptions(meta, name, { includeConstant: false });
    }
    return distributionTemplateOptions(meta, name);
  }
  if (name === 'selectivity') {
    if (selectedVariant === 'constant') {
      return ['0.01'];
    }
    return distributionTemplateOptions(meta, name, { includeConstant: false });
  }
  if (name === 'selection') {
    if (selectedVariant && selectedVariant !== 'distribution') {
      const template = distributionTemplateForName(meta, selectedVariant);
      return template
        ? [template]
        : distributionTemplateOptions(meta, name, { includeConstant: false });
    }
    return distributionTemplateOptions(meta, name, { includeConstant: false });
  }
  if (name === 'key' || name === 'val') {
    const hintedLen = getHintedStringLength(resolvedClarifications, name, op);
    if (selectedVariant === 'literal') {
      return [name === 'key' ? 'key' : 'value'];
    }
    if (selectedVariant) {
      if (selectedVariant === 'uniform' && hintedLen !== null) {
        return [`uniform(len=${hintedLen})`];
      }
      return [stringExprTemplate(selectedVariant, name)];
    }
    if (hintedLen !== null) {
      return [`uniform(len=${hintedLen})`];
    }
    return [stringExprTemplate('uniform', name)];
  }
  if (Array.isArray(fieldSchema?.enum)) {
    return fieldSchema.enum.map((v) => String(v));
  }
  return null;
}

function distributionTemplateOptions(meta, fieldName, config = {}) {
  const includeConstant = config.includeConstant !== false;
  const templates = [];
  if (fieldName === 'op_count' && includeConstant) {
    templates.push('constant(500000)');
  }
  for (const d of meta.distributionTypes) {
    const template = distributionTemplateForName(meta, d.name);
    if (template) {
      templates.push(template);
    }
  }
  return templates;
}

function distributionTemplateForName(meta, distName) {
  const dist = (meta?.distributionTypes || []).find((d) => d.name === distName);
  if (!distName) {
    return null;
  }
  const defaults = distributionDefaults(distName);
  const params = orderDistributionParams(dist?.params || Object.keys(defaults));
  if (!params.length) {
    return `${distName}(<value>)`;
  }
  const rendered = params.map((p) => {
    const v = defaults[p];
    return v !== undefined ? `${p}=${v}` : `${p}=<value>`;
  });
  return `${distName}(${rendered.join(', ')})`;
}

function stringExprTemplate(variant, fieldName) {
  const len = fieldName === 'key' ? 20 : 256;
  if (variant === 'literal') {
    return fieldName === 'key' ? 'key' : 'value';
  }
  if (variant === 'uniform') {
    return `uniform(len=${len})`;
  }
  if (variant === 'weighted') {
    return 'weighted([{weight=1,value="alpha"},{weight=1,value="beta"}])';
  }
  if (variant === 'segmented') {
    return 'segmented(separator=":", segments=["prefix", uniform(len=8)])';
  }
  if (variant === 'hot_range') {
    return `hot_range(len=${len}, amount=100, probability=0.8)`;
  }
  return `uniform(len=${len})`;
}

const KNOWN_OPS = ['inserts', 'updates', 'point_queries', 'range_queries', 'point_deletes', 'range_deletes', 'empty_point_queries', 'empty_point_deletes', 'merges'];
const DEFAULT_OPS = ['inserts', 'point_queries'];
const DELETE_DEFAULT_OPS = ['inserts', 'point_queries', 'point_deletes'];

function hasWholeOperationMatch(normalizedText, op) {
  const escaped = op.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z_])${escaped}($|[^a-z_])`).test(normalizedText);
}

function parseOperationsAnswer(value) {
  if (!value || typeof value !== 'string') return DEFAULT_OPS;
  
  const normalized = value.toLowerCase().replace(/[-\s]+/g, '_');
  const picked = KNOWN_OPS.filter((op) => hasWholeOperationMatch(normalized, op));
  
  for (const [op, re] of Object.entries(OP_ALIAS_REGEXES)) {
    if (re.test(normalized) && !picked.includes(op)) picked.push(op);
  }
  
  if (picked.length) return picked;
  if (OP_DELETE_REGEX.test(normalized)) return DELETE_DEFAULT_OPS;
  return DEFAULT_OPS;
}

function extractResponseText(result) {
  const rawResponse =
    result?.response ??
    result?.result?.response ??
    result?.choices?.[0]?.message?.content ??
    result?.choices?.[0]?.text ??
    result?.output_text ??
    result?.text;

  let responseText;
  if (typeof rawResponse === 'string') {
    responseText = rawResponse.trim();
  } else if (rawResponse && typeof rawResponse === 'object') {
    responseText = JSON.stringify(rawResponse);
  } else {
    throw new Error(
      `Workers AI returned an unexpected response shape: ${JSON.stringify(result)}`
    );
  }

  if (responseText.startsWith('```json')) {
    responseText = responseText.slice(7);
  } else if (responseText.startsWith('```')) {
    responseText = responseText.slice(3);
  }
  if (responseText.endsWith('```')) {
    responseText = responseText.slice(0, -3);
  }
  return responseText.trim();
}
