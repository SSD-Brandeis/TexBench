import { getOpenAiModel } from "./openai-assist-provider.mjs";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_TIMEOUT_MS = 25000;
const DEFAULT_ENDPOINT_PATH = "/responses";

export function createOpenAiCompatibleBindingFromEnv(envLike = process.env) {
  const env = envLike && typeof envLike === "object" ? envLike : {};
  const apiKey = readString(env.OPENAI_API_KEY);
  if (!apiKey) {
    return null;
  }

  const baseUrl = normalizeBaseUrl(
    readString(env.OPENAI_BASE_URL) || DEFAULT_BASE_URL,
  );
  const endpointPath = normalizeEndpointPath(
    readString(env.OPENAI_API_ENDPOINT || env.OPENAI_CHAT_ENDPOINT) ||
      DEFAULT_ENDPOINT_PATH,
  );
  const defaultModel = getOpenAiModel(env);
  const timeoutMs = clampInteger(
    readInteger(env.OPENAI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    1000,
    120000,
  );

  return {
    async run(modelName, payload) {
      const body = payload && typeof payload === "object" ? payload : {};
      const selectedModel = readString(modelName) || defaultModel;
      const requestPayload = isResponsesEndpoint(endpointPath)
        ? buildResponsesRequestPayload(selectedModel, body)
        : buildChatCompletionsRequestPayload(selectedModel, body);

      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(new Error("openai_timeout")),
        timeoutMs,
      );
      try {
        const response = await fetch(baseUrl + endpointPath, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + apiKey,
          },
          body: JSON.stringify(requestPayload),
          signal: controller.signal,
        });
        const rawText = await safeText(response);
        const json = safeJson(rawText);
        if (!response.ok) {
          const message =
            extractErrorMessage(json) ||
            rawText.trim() ||
            "OpenAI API request failed with HTTP " + response.status + ".";
          const error = new Error(message);
          error.ai_output = rawText.trim();
          throw error;
        }
        const toolArguments = isResponsesEndpoint(endpointPath)
          ? extractResponsesToolArguments(json)
          : extractChatCompletionToolArguments(json);
        const text =
          toolArguments ||
          (isResponsesEndpoint(endpointPath)
            ? extractResponsesText(json)
            : extractChatCompletionText(json));
        if (!text) {
          const error = new Error("OpenAI API returned no assistant text.");
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

function buildChatCompletionsRequestPayload(model, body) {
  const requestPayload = {
    model,
    messages: normalizeMessages(body.messages),
    max_tokens: normalizePositiveInteger(body.max_tokens),
  };
  const temperature = normalizeFiniteNumber(body.temperature);
  if (Number.isFinite(temperature) && supportsTemperatureForModel(model)) {
    requestPayload.temperature = temperature;
  }
  if (!Number.isFinite(requestPayload.max_tokens)) {
    delete requestPayload.max_tokens;
  }
  const responseFormat = normalizeChatResponseFormat(body.response_format);
  if (responseFormat) {
    requestPayload.response_format = responseFormat;
  }
  const tools = normalizeChatTools(body.tools);
  if (tools) {
    requestPayload.tools = tools;
  }
  const toolChoice = normalizeChatToolChoice(body.tool_choice);
  if (toolChoice) {
    requestPayload.tool_choice = toolChoice;
  }
  applyGpt5OutputControls(requestPayload, model, false);
  return requestPayload;
}

function buildResponsesRequestPayload(model, body) {
  const requestPayload = {
    model,
    input: normalizeMessages(body.messages),
    max_output_tokens: normalizePositiveInteger(body.max_tokens),
  };
  const temperature = normalizeFiniteNumber(body.temperature);
  if (Number.isFinite(temperature) && supportsTemperatureForModel(model)) {
    requestPayload.temperature = temperature;
  }
  if (!Number.isFinite(requestPayload.max_output_tokens)) {
    delete requestPayload.max_output_tokens;
  }
  const textFormat = normalizeResponsesTextFormat(body.response_format);
  if (textFormat) {
    requestPayload.text = { format: textFormat };
  }
  const tools = normalizeResponsesTools(body.tools);
  if (tools) {
    requestPayload.tools = tools;
  }
  const toolChoice = normalizeResponsesToolChoice(body.tool_choice);
  if (toolChoice) {
    requestPayload.tool_choice = toolChoice;
  }
  applyGpt5OutputControls(requestPayload, model, true);
  return requestPayload;
}

function extractChatCompletionText(json) {
  if (!json || typeof json !== "object" || !Array.isArray(json.choices)) {
    return "";
  }
  const parts = [];
  json.choices.forEach((choice) => {
    if (!choice || typeof choice !== "object") {
      return;
    }
    const message = choice.message;
    if (!message || typeof message !== "object") {
      return;
    }
    const content = message.content;
    if (typeof content === "string" && content.trim()) {
      parts.push(content.trim());
      return;
    }
    if (Array.isArray(content)) {
      const joined = content
        .map((item) => {
          if (!item || typeof item !== "object") {
            return "";
          }
          if (typeof item.text === "string") {
            return item.text;
          }
          if (typeof item.content === "string") {
            return item.content;
          }
          return "";
        })
        .join("\n")
        .trim();
      if (joined) {
        parts.push(joined);
      }
    }
  });
  return parts.join("\n").trim();
}

function extractResponsesText(json) {
  if (!json || typeof json !== "object") {
    return "";
  }
  if (typeof json.output_text === "string" && json.output_text.trim()) {
    return json.output_text.trim();
  }
  if (!Array.isArray(json.output)) {
    return "";
  }
  return json.output
    .map((item) => {
      if (!item || typeof item !== "object") {
        return "";
      }
      if (!Array.isArray(item.content)) {
        return "";
      }
      return item.content
        .map((part) => {
          if (!part || typeof part !== "object") {
            return "";
          }
          if (typeof part.text === "string") {
            return part.text;
          }
          if (typeof part.content === "string") {
            return part.content;
          }
          return "";
        })
        .join("\n");
    })
    .join("\n")
    .trim();
}

function extractChatCompletionToolArguments(json) {
  if (!json || typeof json !== "object" || !Array.isArray(json.choices)) {
    return "";
  }
  for (const choice of json.choices) {
    if (!choice || typeof choice !== "object") {
      continue;
    }
    const message =
      choice.message && typeof choice.message === "object"
        ? choice.message
        : null;
    const toolCalls = Array.isArray(message && message.tool_calls)
      ? message.tool_calls
      : [];
    for (const toolCall of toolCalls) {
      const fn =
        toolCall && typeof toolCall === "object" && toolCall.function
          ? toolCall.function
          : null;
      if (fn && typeof fn.arguments === "string" && fn.arguments.trim()) {
        return fn.arguments.trim();
      }
    }
  }
  return "";
}

function extractResponsesToolArguments(json) {
  if (!json || typeof json !== "object" || !Array.isArray(json.output)) {
    return "";
  }
  for (const item of json.output) {
    if (!item || typeof item !== "object") {
      continue;
    }
    if (
      item.type === "function_call" &&
      typeof item.arguments === "string" &&
      item.arguments.trim()
    ) {
      return item.arguments.trim();
    }
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
  if (
    json.error &&
    typeof json.error === "object" &&
    typeof json.error.message === "string"
  ) {
    const message = json.error.message.trim();
    if (message) {
      return message;
    }
  }
  return "";
}

async function safeText(response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function readString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function readInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
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

function normalizeChatResponseFormat(rawFormat) {
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

function normalizeResponsesTextFormat(rawFormat) {
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
    const jsonSchema = rawFormat.json_schema;
    const format = {
      type: "json_schema",
      name: readString(jsonSchema.name) || "response",
      schema:
        jsonSchema.schema && typeof jsonSchema.schema === "object"
          ? jsonSchema.schema
          : {},
    };
    if (typeof jsonSchema.description === "string" && jsonSchema.description) {
      format.description = jsonSchema.description;
    }
    if (jsonSchema.strict === true) {
      format.strict = true;
    }
    return format;
  }
  return null;
}

function normalizeSharedFunctionTools(rawTools) {
  if (!Array.isArray(rawTools)) {
    return [];
  }
  return rawTools
    .map((tool) => {
      if (!tool || typeof tool !== "object" || Array.isArray(tool)) {
        return null;
      }
      const type = readString(tool.type).toLowerCase();
      const name = readString(tool.name);
      if (type !== "function" || !name) {
        return null;
      }
      return {
        type: "function",
        name,
        description: readString(tool.description),
        strict: tool.strict === true,
        parameters:
          tool.parameters && typeof tool.parameters === "object"
            ? tool.parameters
            : {},
      };
    })
    .filter(Boolean);
}

function normalizeResponsesTools(rawTools) {
  const tools = normalizeSharedFunctionTools(rawTools);
  return tools.length > 0 ? tools : null;
}

function normalizeChatTools(rawTools) {
  const tools = normalizeSharedFunctionTools(rawTools).map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      strict: tool.strict === true,
      parameters: tool.parameters,
    },
  }));
  return tools.length > 0 ? tools : null;
}

function normalizeResponsesToolChoice(rawChoice) {
  if (!rawChoice || typeof rawChoice !== "object" || Array.isArray(rawChoice)) {
    return null;
  }
  const type = readString(rawChoice.type).toLowerCase();
  const name = readString(rawChoice.name);
  if (type !== "function" || !name) {
    return null;
  }
  return { type: "function", name };
}

function normalizeChatToolChoice(rawChoice) {
  const shared = normalizeResponsesToolChoice(rawChoice);
  if (!shared) {
    return null;
  }
  return {
    type: "function",
    function: {
      name: shared.name,
    },
  };
}

function safeJson(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
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
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

function normalizeEndpointPath(pathValue) {
  const trimmed = readString(pathValue);
  if (!trimmed) {
    return DEFAULT_ENDPOINT_PATH;
  }
  return trimmed.startsWith("/") ? trimmed : "/" + trimmed;
}

function isResponsesEndpoint(pathValue) {
  return normalizeEndpointPath(pathValue).endsWith("/responses");
}

function supportsTemperatureForModel(modelName) {
  const model = readString(modelName).toLowerCase();
  return !model.startsWith("gpt-5");
}

function applyGpt5OutputControls(requestPayload, modelName, responsesApi) {
  const model = readString(modelName).toLowerCase();
  if (!model.startsWith("gpt-5")) {
    return;
  }

  const reasoningEffort = supportsReasoningNone(model) ? "none" : "minimal";
  if (responsesApi) {
    requestPayload.reasoning = { effort: reasoningEffort };
    requestPayload.text = {
      ...(requestPayload.text && typeof requestPayload.text === "object"
        ? requestPayload.text
        : {}),
      verbosity: "low",
    };
    return;
  }

  requestPayload.reasoning_effort = reasoningEffort;
  requestPayload.verbosity = "low";
}

function supportsReasoningNone(modelName) {
  return (
    modelName.startsWith("gpt-5.1") ||
    modelName.startsWith("gpt-5.2") ||
    modelName.startsWith("gpt-5.4") ||
    modelName.startsWith("gpt-5.5")
  );
}
