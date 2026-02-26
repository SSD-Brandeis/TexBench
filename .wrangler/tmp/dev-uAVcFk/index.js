var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JSON Schema Chat</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/ajv@8.17.1/dist/ajv7.min.js"><\/script>
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
      gap: 10px;
      padding: 16px;
      border-top: 1px solid var(--border);
      flex-shrink: 0;
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
          <input type="text" class="chat-input" id="chatInput" placeholder="e.g., Create a user profile with name, email, and age...">
          <button class="btn btn-primary" id="sendBtn">Send</button>
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
    const chatMessages = document.getElementById('chatMessages');
    const jsonOutput = document.getElementById('jsonOutput');
    const validateBtn = document.getElementById('validateBtn');
    const copyBtn = document.getElementById('copyBtn');
    const validationResult = document.getElementById('validationResult');

    let schema = null;
    let chatHistory = [];

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
        "WorkloadSpecSection": { "type": "object", "properties": { "character_set": { "description": "The domain from which the keys will be created from.", "anyOf": [{ "$ref": "#/$defs/CharacterSet" }, { "type": "null" }] }, "groups": { "description": "A list of groups. Groups share valid keys between operations.

E.g., non-empty point queries will use a key from an insert in this group.", "type": "array", "items": { "$ref": "#/$defs/WorkloadSpecGroup" } }, "skip_key_contains_check": { "description": "Whether to skip the check that a generated key is in the valid key set for inserts and empty point queries/deletes.", "type": "boolean", "default": false } }, "required": ["groups"] }
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
      const message = chatInput.value.trim();
      if (!message) return;

      chatInput.value = '';
      addMessage(message, 'user');
      chatHistory.push({ role: 'user', content: message });

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
          addMessage(data.response, 'assistant');
          chatHistory.push({ role: 'assistant', content: data.response });
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

    copyBtn.addEventListener('click', () => {
      const text = jsonOutput.value;
      if (!text) return;
      navigator.clipboard.writeText(text).then(() => {
        copyBtn.textContent = 'Copied!';
        setTimeout(() => copyBtn.textContent = 'Copy', 1500);
      });
    });

    validateBtn.addEventListener('click', () => {
      const jsonText = jsonOutput.value.trim();
      if (!jsonText || !schema) {
        validationResult.textContent = 'No JSON or schema to validate';
        validationResult.className = 'validation-result show invalid';
        return;
      }
      try {
        const json = JSON.parse(jsonText);
        const Ajv = window.ajv7;
        const ajv = new Ajv({ allErrors: true });
        const validate = ajv.compile(schema);
        const valid = validate(json);
        if (valid) {
          validationResult.textContent = 'Valid! JSON conforms to schema.';
          validationResult.className = 'validation-result show valid';
        } else {
          const errors = validate.errors.map(e => e.message).join(', ');
          validationResult.textContent = 'Invalid: ' + errors;
          validationResult.className = 'validation-result show invalid';
        }
      } catch (e) {
        validationResult.textContent = 'Parse error: ' + e.message;
        validationResult.className = 'validation-result show invalid';
      }
    });
  <\/script>
</body>
</html>`;
var src_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/") {
      return new Response(HTML, {
        headers: { "Content-Type": "text/html" }
      });
    }
    if (url.pathname === "/api/chat" && request.method === "POST") {
      return handleChat(request, env);
    }
    return new Response("Not Found", { status: 404 });
  }
};
async function handleChat(request, env) {
  try {
    const { schema, message, history } = await request.json();
    if (!message) {
      return Response.json({ error: "Message is required" }, { status: 400 });
    }
    const systemPrompt = schema ? `You are a JSON generator. Given a JSON Schema and user requests, respond with valid JSON that conforms to the schema.
      
Schema:
${schema}

Rules:
1. ALWAYS respond with valid JSON only - no explanations, no markdown, no text outside the JSON
2. The JSON must conform to the provided schema
3. If the user asks for something that cannot be represented by the schema, return empty JSON object {} or the closest valid representation
4. Never wrap the JSON in code blocks or markdown` : `You are a JSON generator. Given user requests, respond with valid JSON.
      
Rules:
1. ALWAYS respond with valid JSON only - no explanations, no markdown, no text outside the JSON
2. If asked to create a JSON document, create a reasonable one
3. Never wrap the JSON in code blocks or markdown`;
    const messages = [
      { role: "system", content: systemPrompt },
      ...history.slice(-10).filter((m) => m.role !== "system"),
      { role: "user", content: message }
    ];
    const ai = env.AI;
    if (!ai) {
      return Response.json({
        error: "Workers AI is not available. This feature requires deploying to Cloudflare with Workers AI enabled. Run: npm run deploy"
      }, { status: 503 });
    }
    const result = await ai.chat(
      env.AI_NAME || "@cf/meta/llama-3.1-8b-instruct",
      messages,
      {
        max_tokens: 2e3,
        temperature: 0.3,
        response_format: { type: "json_object" }
      }
    );
    let responseText = result.response.trim();
    if (responseText.startsWith("```json")) {
      responseText = responseText.slice(7);
    } else if (responseText.startsWith("```")) {
      responseText = responseText.slice(3);
    }
    if (responseText.endsWith("```")) {
      responseText = responseText.slice(0, -3);
    }
    responseText = responseText.trim();
    return Response.json({ response: responseText });
  } catch (error) {
    console.error("Chat error:", error);
    return Response.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
__name(handleChat, "handleChat");

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-n8QMUH/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-n8QMUH/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
