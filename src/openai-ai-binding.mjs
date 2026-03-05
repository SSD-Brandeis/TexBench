const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4.1-mini';
const DEFAULT_TIMEOUT_MS = 25000;

export function createOpenAiCompatibleBindingFromEnv(envLike = process.env) {
  const env = envLike && typeof envLike === 'object' ? envLike : {};
  const apiKey = readString(env.OPENAI_API_KEY);
  if (!apiKey) {
    return null;
  }

  const baseUrl = normalizeBaseUrl(readString(env.OPENAI_BASE_URL) || DEFAULT_BASE_URL);
  const endpointPath = normalizeEndpointPath(readString(env.OPENAI_CHAT_ENDPOINT) || '/chat/completions');
  const defaultModel = readString(env.OPENAI_MODEL) || readString(env.AI_NAME) || DEFAULT_MODEL;
  const timeoutMs = clampInteger(readInteger(env.OPENAI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS), 1000, 120000);

  return {
    async run(modelName, payload) {
      const body = payload && typeof payload === 'object' ? payload : {};
      const selectedModel = readString(modelName) || defaultModel;
      const requestPayload = {
        model: selectedModel,
        messages: normalizeMessages(body.messages),
        temperature: normalizeFiniteNumber(body.temperature),
        max_tokens: normalizePositiveInteger(body.max_tokens)
      };

      if (!Number.isFinite(requestPayload.temperature)) {
        delete requestPayload.temperature;
      }
      if (!Number.isFinite(requestPayload.max_tokens)) {
        delete requestPayload.max_tokens;
      }
      const responseFormat = normalizeResponseFormat(body.response_format);
      if (responseFormat) {
        requestPayload.response_format = responseFormat;
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(new Error('openai_timeout')), timeoutMs);
      try {
        const response = await fetch(baseUrl + endpointPath, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + apiKey
          },
          body: JSON.stringify(requestPayload),
          signal: controller.signal
        });
        const json = await safeJson(response);
        if (!response.ok) {
          const message = extractErrorMessage(json) || ('OpenAI API request failed with HTTP ' + response.status + '.');
          throw new Error(message);
        }
        const text = extractChatCompletionText(json);
        if (!text) {
          throw new Error('OpenAI API returned no assistant text.');
        }
        return { response: text };
      } finally {
        clearTimeout(timer);
      }
    }
  };
}

function normalizeMessages(rawMessages) {
  if (!Array.isArray(rawMessages)) {
    return [];
  }
  return rawMessages
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const role = readString(entry.role);
      const content = typeof entry.content === 'string' ? entry.content : '';
      if (!role || !content.trim()) {
        return null;
      }
      return { role, content };
    })
    .filter(Boolean);
}

function extractChatCompletionText(json) {
  if (!json || typeof json !== 'object' || !Array.isArray(json.choices)) {
    return '';
  }
  const parts = [];
  json.choices.forEach((choice) => {
    if (!choice || typeof choice !== 'object') {
      return;
    }
    const message = choice.message;
    if (!message || typeof message !== 'object') {
      return;
    }
    const content = message.content;
    if (typeof content === 'string' && content.trim()) {
      parts.push(content.trim());
      return;
    }
    if (Array.isArray(content)) {
      const joined = content
        .map((item) => {
          if (!item || typeof item !== 'object') {
            return '';
          }
          if (typeof item.text === 'string') {
            return item.text;
          }
          if (typeof item.content === 'string') {
            return item.content;
          }
          return '';
        })
        .join('\n')
        .trim();
      if (joined) {
        parts.push(joined);
      }
    }
  });
  return parts.join('\n').trim();
}

function extractErrorMessage(json) {
  if (!json || typeof json !== 'object') {
    return '';
  }
  if (typeof json.error === 'string' && json.error.trim()) {
    return json.error.trim();
  }
  if (json.error && typeof json.error === 'object' && typeof json.error.message === 'string') {
    const message = json.error.message.trim();
    if (message) {
      return message;
    }
  }
  return '';
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function readString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function readInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePositiveInteger(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.floor(parsed);
}

function normalizeFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeResponseFormat(rawFormat) {
  if (!rawFormat || typeof rawFormat !== 'object') {
    return null;
  }
  const type = readString(rawFormat.type).toLowerCase();
  if (type === 'json_object') {
    return { type: 'json_object' };
  }
  if (type === 'json_schema' && rawFormat.json_schema && typeof rawFormat.json_schema === 'object') {
    return {
      type: 'json_schema',
      json_schema: rawFormat.json_schema
    };
  }
  return null;
}

function clampInteger(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function normalizeBaseUrl(url) {
  const trimmed = readString(url);
  if (!trimmed) {
    return DEFAULT_BASE_URL;
  }
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

function normalizeEndpointPath(pathValue) {
  const trimmed = readString(pathValue);
  if (!trimmed) {
    return '/chat/completions';
  }
  return trimmed.startsWith('/') ? trimmed : ('/' + trimmed);
}
