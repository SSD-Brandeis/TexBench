export const DEFAULT_OLLAMA_MODEL = "llama3.2:3b";

export function isOllamaAssistProvider(value) {
  return readString(value).toLowerCase() === "ollama";
}

export function getOllamaModel(envLike = process.env) {
  const env = normalizeEnv(envLike);
  return (
    readString(env.OLLAMA_MODEL) ||
    firstModel(readString(env.OLLAMA_MODELS)) ||
    readString(env.AI_NAME) ||
    DEFAULT_OLLAMA_MODEL
  );
}

export function getOllamaModels(envLike = process.env) {
  const env = normalizeEnv(envLike);
  const explicitChain = readString(env.OLLAMA_MODELS) || readString(env.AI_MODELS);
  const fromChain = splitModels(explicitChain);
  if (fromChain.length > 0) {
    return uniqueStrings(fromChain);
  }
  return [getOllamaModel(env)];
}

export function buildOllamaAssistEnv(envLike = process.env) {
  const env = normalizeEnv(envLike);
  const model = getOllamaModel(env);
  const models = getOllamaModels(env).join(",");
  return {
    OLLAMA_MODEL: model,
    OLLAMA_MODELS: models,
    AI_NAME: model,
    AI_MODELS: models,
  };
}

function firstModel(value) {
  return splitModels(value)[0] || "";
}

function splitModels(value) {
  return readString(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeEnv(envLike) {
  return envLike && typeof envLike === "object" ? envLike : {};
}

function readString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function uniqueStrings(values) {
  return Array.from(new Set(values.filter(Boolean)));
}
