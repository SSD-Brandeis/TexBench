import { readFileSync } from "node:fs";

const CONFIG_URL = new URL("../config/llm-models.json", import.meta.url);

export function loadLlmModelConfig(configUrl = CONFIG_URL) {
  const parsed = JSON.parse(readFileSync(configUrl, "utf8"));
  const models = Array.isArray(parsed.models)
    ? parsed.models
        .map((entry) => ({
          id: readString(entry && entry.id),
          label: readString(entry && entry.label) || readString(entry && entry.id),
          // Entries without a provider are Ollama models (pulled by the bootstrap).
          provider: readString(entry && entry.provider).toLowerCase() || "ollama",
        }))
        .filter((entry) => entry.id)
    : [];
  const uniqueModels = Array.from(
    new Map(models.map((entry) => [entry.id, entry])).values(),
  );
  if (uniqueModels.length === 0) {
    throw new Error("config/llm-models.json must define at least one model.");
  }

  const configuredDefault = readString(parsed.defaultModel);
  const defaultModel = uniqueModels.some((entry) => entry.id === configuredDefault)
    ? configuredDefault
    : uniqueModels[0].id;
  return Object.freeze({
    defaultModel,
    models: Object.freeze(uniqueModels.map((entry) => Object.freeze(entry))),
  });
}

// The models served by one AI provider. If none are configured for it, the full
// list is kept, as before providers were recorded.
export function llmModelConfigForProvider(config, provider) {
  const wanted = readString(provider).toLowerCase();
  const models = config.models.filter((entry) => entry.provider === wanted);
  if (models.length === 0) {
    return config;
  }
  const defaultModel = models.some((entry) => entry.id === config.defaultModel)
    ? config.defaultModel
    : models[0].id;
  return Object.freeze({ defaultModel, models: Object.freeze(models) });
}

export function isSupportedLlmModel(config, modelName) {
  const selected = readString(modelName);
  return !!(
    selected &&
    config &&
    Array.isArray(config.models) &&
    config.models.some((entry) => entry.id === selected)
  );
}

function readString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}
