import {
  getOllamaModel,
  isOllamaAssistProvider,
} from "./ollama-assist-provider.mjs";

const DEFAULT_BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_TIMEOUT_MS = 300000;
const DEFAULT_ENDPOINT_PATH = "/api/chat";

export function createOllamaAiBindingFromEnv(envLike = process.env) {
  const env = envLike && typeof envLike === "object" ? envLike : {};
  if (!shouldEnableOllamaBinding(env)) {
    return null;
  }

  const baseUrl = normalizeBaseUrl(
    readString(env.OLLAMA_BASE_URL || env.OLLAMA_HOST) || DEFAULT_BASE_URL,
  );
  const endpointPath = normalizeEndpointPath(
    readString(env.OLLAMA_API_ENDPOINT) || DEFAULT_ENDPOINT_PATH,
  );
  const defaultModel = getOllamaModel(env);
  const timeoutMs = resolveOllamaTimeoutMs(env);

  return {
    async run(modelName, payload) {
      const selectedModel = readString(modelName) || defaultModel;
      if (!selectedModel) {
        throw new Error("Ollama model name is required.");
      }

      const requestPayload = buildRequestPayload(
        selectedModel,
        payload,
        endpointPath,
      );
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(new Error("ollama_timeout")),
        timeoutMs,
      );

      try {
        const response = await fetch(baseUrl + endpointPath, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestPayload),
          signal: controller.signal,
        });
        const rawText = await safeText(response);
        const json = safeJson(rawText);
        if (!response.ok) {
          const error = new Error(
            extractErrorMessage(json) ||
              rawText.trim() ||
              "Ollama request failed with HTTP " + response.status + ".",
          );
          error.ai_output = rawText.trim();
          throw error;
        }
        if (json && typeof json === "object" && typeof json.error === "string") {
          const error = new Error(json.error.trim() || "Ollama request failed.");
          error.ai_output = rawText.trim();
          throw error;
        }
        const text = extractOllamaText(json);
        if (!text) {
          const error = new Error("Ollama returned no assistant text.");
          error.ai_output = rawText.trim();
          throw error;
        }
        return { response: text };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

export function resolveOllamaTimeoutMs(envLike = process.env) {
  const env = envLike && typeof envLike === "object" ? envLike : {};
  return clampInteger(
    readInteger(env.OLLAMA_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    1000,
    600000,
  );
}

function shouldEnableOllamaBinding(env) {
  return (
    isOllamaAssistProvider(env.AI_PROVIDER) ||
    !!readString(env.OLLAMA_BASE_URL || env.OLLAMA_HOST) ||
    !!readString(env.OLLAMA_MODEL) ||
    !!readString(env.OLLAMA_MODELS) ||
    !!readString(env.OLLAMA_API_ENDPOINT)
  );
}

function buildRequestPayload(model, payload, endpointPath) {
  const body = payload && typeof payload === "object" ? payload : {};
  const messages = normalizeMessages(body.messages);
  const format = normalizeFormat(body.response_format);
  const options = {};
  const temperature = normalizeFiniteNumber(body.temperature);
  const maxTokens = normalizePositiveInteger(body.max_tokens);

  if (Number.isFinite(temperature)) {
    options.temperature = temperature;
  }
  if (Number.isFinite(maxTokens)) {
    options.num_predict = maxTokens;
  }

  const requestPayload = {
    model,
    stream: false,
  };
  if (Object.keys(options).length > 0) {
    requestPayload.options = options;
  }
  if (format) {
    requestPayload.format = format;
  }

  if (endpointPath === "/api/chat") {
    requestPayload.messages = messages;
    return requestPayload;
  }

  requestPayload.prompt = buildPrompt(messages);
  return requestPayload;
}

function normalizeMessages(rawMessages) {
  if (!Array.isArray(rawMessages)) {
    return [];
  }
  return rawMessages
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const role = readString(entry.role);
      const content = typeof entry.content === "string" ? entry.content : "";
      if (!role || !content.trim()) {
        return null;
      }
      return { role, content };
    })
    .filter(Boolean);
}

function buildPrompt(messages) {
  const normalizedMessages = Array.isArray(messages) ? messages : [];
  return (
    normalizedMessages
      .map((entry) => entry.role.toUpperCase() + ":\n" + entry.content.trim())
      .join("\n\n") + "\n\nASSISTANT:\n"
  );
}

function normalizeFormat(rawFormat) {
  if (!rawFormat || typeof rawFormat !== "object") {
    return "";
  }
  const type = readString(rawFormat.type).toLowerCase();
  if (type === "json_object" || type === "json_schema") {
    return "json";
  }
  return "";
}

function extractOllamaText(json) {
  if (!json || typeof json !== "object") {
    return "";
  }
  if (typeof json.response === "string" && json.response.trim()) {
    return json.response.trim();
  }
  const message =
    json.message && typeof json.message === "object" ? json.message : null;
  if (message && typeof message.content === "string" && message.content.trim()) {
    return message.content.trim();
  }
  return "";
}

function extractErrorMessage(json) {
  if (!json || typeof json !== "object") {
    return "";
  }
  if (typeof json.error === "string" && json.error.trim()) {
    return json.error.trim();
  }
  return "";
}

function normalizeBaseUrl(value) {
  const trimmed = readString(value) || DEFAULT_BASE_URL;
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

function normalizeEndpointPath(value) {
  const trimmed = readString(value) || DEFAULT_ENDPOINT_PATH;
  if (!trimmed.startsWith("/")) {
    return "/" + trimmed;
  }
  return trimmed;
}

function normalizeFiniteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizePositiveInteger(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  return Math.max(1, Math.floor(numeric));
}

function readInteger(value, fallback) {
  const numeric = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clampInteger(value, min, max) {
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function safeJson(rawText) {
  if (typeof rawText !== "string" || !rawText.trim()) {
    return null;
  }
  try {
    return JSON.parse(rawText);
  } catch {
    return null;
  }
}

async function safeText(response) {
  if (!response || typeof response.text !== "function") {
    return "";
  }
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function readString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}
