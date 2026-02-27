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
    <h1>JSON Schema Chat</h1>
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

    let schema = null;
    let chatHistory = [];
    let currentQuestionKey = null;
    let selectedOperations = new Set();

    const s = "https://json-schema.org/draft/2020-12/schema";
    const defaultSchema = {
      "$schema": s,
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

    function debounce(fn, ms) {
      let timeout;
      return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), ms);
      };
    }

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
            jsonOutput.value = JSON.stringify(json, null, 2);
            validationResult.className = 'validation-result';
          } catch (e) {
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

    function getCurrentAnswer() {
      if (currentQuestionKey === 'operations' && operationControls.classList.contains('show')) {
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
        clearAnswerOptions();
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
      answerControls.classList.remove('show');
      answerSelect.innerHTML = '';
      operationControls.classList.remove('show');
      operationChips.innerHTML = '';
      selectedOperations = new Set();
      if (chatInput.disabled) {
        chatInput.disabled = false;
      }
      if (!chatInput.value) {
        chatInput.placeholder = 'e.g., Create a user profile with name, email, and age...';
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
      return typeof key === 'string' &&
        (key.startsWith('op_count_') || key.startsWith('selection_') || key.startsWith('selectivity_'));
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
        const valid = validate(json);
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

    const safeHistory = history
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant'));
    const last = safeHistory[safeHistory.length - 1];
    const fullConversation = (last && last.role === 'user' && last.content === message)
      ? safeHistory
      : [...safeHistory, { role: 'user', content: message }];
    const resolvedClarifications = extractClarificationAnswers(fullConversation);
    const conversation = fullConversation.slice(-20);
    const askedClarifications = fullConversation.filter(
      (m) => m.role === 'assistant' &&
        typeof m.content === 'string' &&
        m.content.startsWith('Clarification ')
    ).length;

    const ai = env.AI;
    const modelName = env.AI_NAME || '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
    const maxAttempts = Math.max(1, Number(env.AI_RETRY_ATTEMPTS || 2));

    if (!ai || typeof ai.run !== 'function') {
      return Response.json({ 
        error: 'Workers AI binding is not available. Ensure `[ai] binding = "AI"` is configured and redeploy.' 
      }, { status: 503 });
    }

    const aiInputBase = {
      max_tokens: 1600,
      temperature: 0.3
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
      const clarificationSteps = buildSchemaDrivenClarificationSteps(parsedSchema, resolvedClarifications);
      const unresolvedStep = clarificationSteps.find((step) => {
        const resolvedValue = resolvedClarifications[step.assumptionKey];
        return !(typeof resolvedValue === 'string' && resolvedValue.trim());
      });

      // Phase 1: exhaust all schema-derived clarification steps before any JSON generation.
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
3. This is Phase 2. Phase 1 has already collected all schema-derived clarifications.
4. You MUST use the resolved clarifications exactly as provided in the "Resolved clarifications" message.
5. Treat user replies after clarifying questions as overrides to assumptions.
6. If the user says "use assumption" (or "use assumptions"), apply the assumption from the prior assistant clarification message.
7. If the user asks for something that cannot be represented by the schema, return empty JSON object {} or the closest valid representation
8. Never wrap the JSON in code blocks or markdown`
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
      ...conversation
    ];

    let attemptMessages = baseGenerationMessages;
    let didSchemaRepair = false;
    let lastError = 'Model returned invalid JSON (often due to truncation). Please try a shorter request and retry.';

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const result = await ai.run(
        modelName,
        {
          ...aiInputBase,
          messages: attemptMessages
        }
      );

      const responseText = extractResponseText(result);

      try {
        const parsedJson = JSON.parse(responseText);

        if (parsedSchema && !didSchemaRepair && attempt < maxAttempts) {
          // One repair pass to improve conformance on complex schemas.
          didSchemaRepair = true;
          attemptMessages = [
            ...baseGenerationMessages,
            {
              role: 'user',
              content: 'Regenerate the JSON and self-check it strictly against the provided response schema before returning. Return JSON only.'
            }
          ];
          continue;
        }

        return Response.json({ mode: 'json', response: JSON.stringify(parsedJson, null, 2) });
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

function extractClarificationAnswers(conversation) {
  const resolved = {};
  for (let i = 0; i < conversation.length; i += 1) {
    const msg = conversation[i];
    if (!msg || msg.role !== 'assistant' || typeof msg.content !== 'string') {
      continue;
    }

    const keyMatch = msg.content.match(/Assumption \(if you skip\):\s*([a-zA-Z0-9_]+)\s*=\s*(.+)/);
    if (!keyMatch) {
      continue;
    }

    const key = keyMatch[1].trim();
    const assumedValue = keyMatch[2].split('\n')[0].trim();
    let chosenValue = assumedValue;

    const nextUser = conversation[i + 1];
    if (nextUser && nextUser.role === 'user' && typeof nextUser.content === 'string') {
      const answer = nextUser.content.trim();
      const useAssumption = /^use assumptions?$/i.test(answer);
      if (answer && !useAssumption) {
        chosenValue = answer;
      }
    }

    resolved[key] = chosenValue;
  }
  return resolved;
}

function buildSchemaDrivenClarificationSteps(schema, resolvedClarifications) {
  const meta = extractSchemaMeta(schema);
  const selectedOps = parseOperationsAnswer(
    resolvedClarifications.operations || (meta.operations.slice(0, 2).join(' + ') || 'inserts + point_queries')
  );

  const steps = [];
  steps.push({
    assumptionKey: 'operations',
    question: `What operations should be included (${meta.operations.join(', ')})?`,
    assumedValue: meta.operations.includes('inserts') && meta.operations.includes('point_queries')
      ? 'inserts + point_queries'
      : (meta.operations.join(' + ') || 'inserts + point_queries'),
    reason: 'Operation set determines which operation schemas are active.',
    extra: 'You can list multiple operations separated by "+" or commas.',
    options: meta.operations
  });

  if (meta.characterSets.length) {
    steps.push({
      assumptionKey: 'character_set',
      question: `Which character_set should keys use (${meta.characterSets.join(', ')})?`,
      assumedValue: meta.characterSets.includes('alphanumeric') ? 'alphanumeric' : meta.characterSets[0],
      reason: 'This enum comes directly from schema character set choices.',
      options: meta.characterSets
    });
  }

  steps.push({
    assumptionKey: 'sections_count',
    question: 'How many sections/phases should the workload have?',
    assumedValue: '1',
    reason: 'Sections are the top-level array in the schema and define phase shifts.'
  });

  for (const op of selectedOps) {
    const opInfo = getOperationFieldInfo(schema, op, meta);
    for (const field of opInfo) {
      steps.push({
        assumptionKey: `${field.name}_${op}`,
        question: `How should ${op}.${field.name} be set?`,
        assumedValue: field.defaultValue,
        reason: field.reason,
        extra: field.extra,
        options: field.options
      });
    }
  }

  if (meta.rangeFormats.length) {
    steps.push({
      assumptionKey: 'range_format_global',
      question: `If range operations are used, what range_format should apply (${meta.rangeFormats.join(', ')})?`,
      assumedValue: meta.rangeFormats[0],
      reason: 'Range format options are defined in schema enum.'
      ,
      extra: `Range format defaults:
- ${meta.rangeFormats[0]} (default)
${meta.rangeFormats.slice(1).map((v) => `- ${v}`).join('\n')}`,
      options: meta.rangeFormats
    });
  }

  if (meta.hasSorted) {
    steps.push({
      assumptionKey: 'sorted_settings',
      question: 'Do you want sorted insert behavior (sorted.k and sorted.l)?',
      assumedValue: 'none',
      reason: 'Schema includes an optional sorted tuning block.'
    });
  }

  steps.push({
    assumptionKey: 'special_requirements',
    question: 'Any additional schema-relevant constraints I should apply?',
    assumedValue: 'none',
    reason: 'Captures any remaining user constraints before generation.'
  });

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

  return { operations, characterSets, stringExprTypes, distributionTypes, rangeFormats, hasSorted };
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

function getOperationFieldInfo(schema, op, meta) {
  const defs = schema?.$defs || {};
  const groupProps = defs?.WorkloadSpecGroup?.properties || {};
  const opProp = groupProps?.[op];
  const opSchema = resolveOperationSchema(opProp, defs);
  if (!opSchema || typeof opSchema !== 'object') {
    return [];
  }

  const fields = [];
  const required = Array.isArray(opSchema.required) ? opSchema.required : [];
  const props = opSchema.properties || {};
  const candidateNames = [...new Set([...required, ...Object.keys(props)])];

  for (const name of candidateNames) {
    if (name === 'character_set') {
      continue;
    }
    const fieldSchema = props[name];
    fields.push({
      name,
      defaultValue: inferDefaultFromField(name, fieldSchema, meta),
      reason: inferReasonForField(name),
      extra: inferExtraForField(name, meta),
      options: inferOptionsForField(name, fieldSchema, meta)
    });
  }

  return fields;
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

function inferDefaultFromField(name, fieldSchema, meta) {
  if (name === 'op_count') {
    return 'constant(500000)';
  }
  if (name === 'selection') {
    return 'uniform(min=0, max=1)';
  }
  if (name === 'selectivity') {
    return 'uniform(min=0.001, max=0.1)';
  }
  if (name === 'range_format' && meta.rangeFormats.length) {
    return meta.rangeFormats[0];
  }
  if (name === 'key') {
    return 'uniform(len=20)';
  }
  if (name === 'val') {
    return 'uniform(len=256)';
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

function inferExtraForField(name, meta) {
  if (name === 'selection' || name === 'selectivity' || name === 'op_count') {
    return buildDistributionHelp(meta);
  }
  if (name === 'range_format' && meta.rangeFormats.length) {
    return `Range format defaults:
- ${meta.rangeFormats[0]} (default)
${meta.rangeFormats.slice(1).map((v) => `- ${v}`).join('\n')}`;
  }
  if (name === 'key' || name === 'val') {
    const defaultsByType = {
      uniform: 'uniform(len=20, character_set=alphanumeric)',
      weighted: 'weighted([{weight:1,value:"user"},{weight:1,value:"post"}])',
      segmented: 'segmented(separator=":", segments=["usertable", "user", uniform(len=20)])',
      hot_range: 'hot_range(len=32, amount=100, probability=0.8)'
    };
    const lines = meta.stringExprTypes.map((t) => `- ${defaultsByType[t] || `${t}(schema-compatible defaults)`}`);
    return `StringExpr defaults by variant:\n${lines.join('\n')}`;
  }
  return '';
}

function inferOptionsForField(name, fieldSchema, meta) {
  if (name === 'range_format' && meta.rangeFormats.length) {
    return meta.rangeFormats;
  }
  if (name === 'character_set' && meta.characterSets.length) {
    return meta.characterSets;
  }
  if (name === 'selection' || name === 'selectivity' || name === 'op_count') {
    return distributionTemplateOptions(meta, name);
  }
  if (name === 'key' || name === 'val') {
    return meta.stringExprTypes;
  }
  if (Array.isArray(fieldSchema?.enum)) {
    return fieldSchema.enum.map((v) => String(v));
  }
  return null;
}

function distributionTemplateOptions(meta, fieldName) {
  const options = [];
  if (fieldName === 'op_count') {
    options.push('constant(500000)');
  }
  for (const d of meta.distributionTypes) {
    const defaults = distributionDefaults(d.name);
    const params = orderDistributionParams(d.params).map((p) => {
      const v = defaults[p];
      return v !== undefined ? `${p}=${v}` : `${p}=<value>`;
    });
    options.push(`${d.name}(${params.join(', ')})`);
  }
  return options;
}

function parseOperationsAnswer(value) {
  const knownOps = [
    'inserts',
    'updates',
    'point_queries',
    'range_queries',
    'point_deletes',
    'range_deletes',
    'empty_point_queries',
    'empty_point_deletes',
    'merges'
  ];
  if (!value || typeof value !== 'string') {
    return ['inserts', 'point_queries'];
  }
  const normalized = value.toLowerCase();
  const picked = knownOps.filter((op) => normalized.includes(op));
  if (picked.length) {
    return picked;
  }
  if (/\bdeletes?\b/.test(normalized)) {
    return ['inserts', 'point_queries', 'point_deletes'];
  }
  return ['inserts', 'point_queries'];
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
    throw new Error(`Workers AI returned an unexpected response shape: ${JSON.stringify(result)}`);
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
