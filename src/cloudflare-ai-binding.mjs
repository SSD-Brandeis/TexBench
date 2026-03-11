const DEFAULT_BASE_URL = "https://api.cloudflare.com/client/v4";
const DEFAULT_TIMEOUT_MS = 25000;

export function createCloudflareAiBindingFromEnv(envLike = process.env) {
  const env = envLike && typeof envLike === "object" ? envLike : {};
  const accountId = readString(env.CLOUDFLARE_ACCOUNT_ID || env.CF_ACCOUNT_ID);
  const apiToken = readString(env.CLOUDFLARE_API_TOKEN || env.CF_API_TOKEN);
  if (!accountId || !apiToken) {
    return null;
  }

  const baseUrl = normalizeBaseUrl(
    readString(env.CLOUDFLARE_AI_BASE_URL) || DEFAULT_BASE_URL,
  );
  const timeoutMs = clampInteger(
    readInteger(env.CLOUDFLARE_AI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    1000,
    120000,
  );

  return {
    async run(modelName, payload) {
      const selectedModel = readString(modelName);
      if (!selectedModel) {
        throw new Error("Cloudflare AI model name is required.");
      }

      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(new Error("cloudflare_ai_timeout")),
        timeoutMs,
      );
      try {
        const routePath =
          "/accounts/" +
          encodeURIComponent(accountId) +
          "/ai/run/" +
          normalizeModelPath(selectedModel);
        const response = await fetch(baseUrl + routePath, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + apiToken,
          },
          body: JSON.stringify(normalizePayload(payload)),
          signal: controller.signal,
        });
        const rawText = await response.text();
        const json = safeJsonText(rawText);
        if (!response.ok) {
          const message = buildCloudflareErrorMessage(json, response.status);
          const error = new Error(message);
          error.ai_output = normalizeAiOutputText(rawText, json);
          throw error;
        }
        if (json && typeof json === "object" && json.success === false) {
          const error = new Error(
            buildCloudflareErrorMessage(json, response.status),
          );
          error.ai_output = normalizeAiOutputText(rawText, json);
          throw error;
        }

        const result =
          json && typeof json === "object" && json.result ? json.result : json;
        const text = extractCloudflareText(result);
        if (!text) {
          const error = new Error("Cloudflare AI returned no assistant text.");
          error.ai_output = normalizeAiOutputText(rawText, result);
          throw error;
        }
        return result;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

function normalizePayload(payload) {
  if (!payload || typeof payload !== "object") {
    return {};
  }
  const normalized = {};
  if (Array.isArray(payload.messages)) {
    normalized.messages = payload.messages
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
  if (Number.isFinite(Number(payload.max_tokens))) {
    normalized.max_tokens = Math.max(1, Math.floor(Number(payload.max_tokens)));
  }
  if (Number.isFinite(Number(payload.temperature))) {
    normalized.temperature = Number(payload.temperature);
  }
  if (payload.response_format && typeof payload.response_format === "object") {
    const format = normalizeResponseFormat(payload.response_format);
    if (format) {
      normalized.response_format = format;
    }
  }
  return normalized;
}

function normalizeResponseFormat(rawFormat) {
  if (!rawFormat || typeof rawFormat !== "object") {
    return null;
  }
  const type = readString(rawFormat.type).toLowerCase();
  if (type === "json_object") {
    return { type: "json_object" };
  }
  if (
    type === "json_schema" &&
    rawFormat.json_schema &&
    typeof rawFormat.json_schema === "object"
  ) {
    return {
      type: "json_schema",
      json_schema: rawFormat.json_schema,
    };
  }
  return null;
}

function extractCloudflareText(result) {
  if (typeof result === "string" && result.trim()) {
    return result.trim();
  }
  if (!result || typeof result !== "object") {
    return "";
  }
  if (typeof result.response === "string" && result.response.trim()) {
    return result.response.trim();
  }
  if (result.response && typeof result.response === "object") {
    try {
      return JSON.stringify(result.response);
    } catch {
      return String(result.response);
    }
  }
  if (typeof result.output_text === "string" && result.output_text.trim()) {
    return result.output_text.trim();
  }
  if (Array.isArray(result.result) && result.result.length > 0) {
    const joined = result.result
      .map((entry) => (typeof entry === "string" ? entry : ""))
      .join("\n")
      .trim();
    if (joined) {
      return joined;
    }
  }
  if (Array.isArray(result.content) && result.content.length > 0) {
    const joined = result.content
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return "";
        }
        if (typeof entry.text === "string") {
          return entry.text;
        }
        return "";
      })
      .join("\n")
      .trim();
    if (joined) {
      return joined;
    }
  }
  return "";
}

function extractCloudflareErrorMessage(json) {
  if (!json || typeof json !== "object") {
    return "";
  }
  if (Array.isArray(json.errors) && json.errors.length > 0) {
    const first = json.errors[0];
    if (
      first &&
      typeof first === "object" &&
      typeof first.message === "string" &&
      first.message.trim()
    ) {
      return first.message.trim();
    }
  }
  if (typeof json.message === "string" && json.message.trim()) {
    return json.message.trim();
  }
  return "";
}

function buildCloudflareErrorMessage(json, statusCode) {
  const message =
    extractCloudflareErrorMessage(json) ||
    "Cloudflare AI request failed with HTTP " + statusCode + ".";
  const routeError = extractCloudflareErrorCode(json);
  if (routeError === 7000) {
    return (
      message +
      " Verify CLOUDFLARE_AI_BASE_URL includes /client/v4 and model id is valid (for example @cf/meta/llama-3.3-70b-instruct-fp8-fast)."
    );
  }
  return message;
}

function extractCloudflareErrorCode(json) {
  if (
    !json ||
    typeof json !== "object" ||
    !Array.isArray(json.errors) ||
    json.errors.length === 0
  ) {
    return null;
  }
  const first = json.errors[0];
  if (!first || typeof first !== "object") {
    return null;
  }
  const code = Number(first.code);
  return Number.isFinite(code) ? code : null;
}

function safeJsonText(rawText) {
  if (typeof rawText !== "string" || !rawText.trim()) {
    return null;
  }
  try {
    return JSON.parse(rawText);
  } catch {
    return null;
  }
}

function normalizeAiOutputText(rawText, fallbackValue) {
  if (typeof rawText === "string" && rawText.trim()) {
    return rawText;
  }
  if (fallbackValue === null || fallbackValue === undefined) {
    return "";
  }
  if (typeof fallbackValue === "string") {
    return fallbackValue;
  }
  try {
    return JSON.stringify(fallbackValue, null, 2);
  } catch {
    return String(fallbackValue);
  }
}

function readString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function readInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
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
  const withoutSlash = trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
  if (withoutSlash.endsWith("/client/v4")) {
    return withoutSlash;
  }
  if (withoutSlash === "https://api.cloudflare.com") {
    return withoutSlash + "/client/v4";
  }
  return withoutSlash;
}

function normalizeModelPath(modelName) {
  const raw = readString(modelName);
  if (!raw) {
    return "";
  }
  return raw
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment).replace(/%40/g, "@"))
    .join("/");
}
