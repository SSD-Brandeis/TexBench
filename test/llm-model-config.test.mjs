import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  isSupportedLlmModel,
  loadLlmModelConfig,
} from "../src/llm-model-config.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

test("LLM model config exposes only the configured supported models", () => {
  const config = loadLlmModelConfig();
  assert.equal(config.defaultModel, "llama3:8b");
  assert.deepEqual(
    config.models.map((model) => model.id),
    ["llama3:8b", "mixtral:8x7b", "qwen2.5:72b", "qwen2.5:14b"],
  );
  assert.equal(isSupportedLlmModel(config, "qwen2.5:14b"), true);
  assert.equal(isSupportedLlmModel(config, "unconfigured:model"), false);
});

test("local setup reads every Ollama download from the shared model config", () => {
  const script = [
    "set -euo pipefail",
    "export RUN_LOCAL_DEV_SOURCE_ONLY=1",
    "source scripts/run-local-dev.sh",
    `BOOTSTRAP_NODE_BIN=${JSON.stringify(process.execPath)}`,
    "bootstrap_configured_ollama_models",
  ].join("\n");
  const result = spawnSync("bash", ["-c", script], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.stdout.trim().split("\n"), [
    "llama3:8b",
    "mixtral:8x7b",
    "qwen2.5:72b",
    "qwen2.5:14b",
  ]);
});

test("local setup can select only llama3 for download", () => {
  const script = [
    "set -euo pipefail",
    "export RUN_LOCAL_DEV_SOURCE_ONLY=1",
    "source scripts/run-local-dev.sh",
    `BOOTSTRAP_NODE_BIN=${JSON.stringify(process.execPath)}`,
    "bootstrap_parse_local_dev_args --llama3-only",
    "bootstrap_configured_ollama_models",
  ].join("\n");
  const result = spawnSync("bash", ["-c", script], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "llama3:8b");
});

test("npm dev uses the model-installing bootstrap script", () => {
  const packageJson = JSON.parse(
    readFileSync(path.join(repoRoot, "package.json"), "utf8"),
  );
  assert.equal(packageJson.scripts.dev, "bash scripts/run-assistant-dev.sh");
  assert.equal(packageJson.scripts["dev:server"], "node src/server.mjs");

  const devScript = readFileSync(
    path.join(repoRoot, "scripts", "run-assistant-dev.sh"),
    "utf8",
  );
  assert.match(devScript, /bootstrap_ensure_ollama_models/);
  assert.doesNotMatch(devScript, /bootstrap_start_cassandra_for_session/);
  assert.doesNotMatch(devScript, /bootstrap_start_redis_for_session/);
});

test("make dev uses the full local benchmark bootstrap", () => {
  const makefile = readFileSync(path.join(repoRoot, "Makefile"), "utf8");
  assert.match(
    makefile,
    /dev:\n\tbash scripts\/run-local-dev\.sh/,
  );
});

test("local setup rejects an Ollama inventory missing a configured model", () => {
  const fixtureDir = mkdtempSync(path.join(os.tmpdir(), "texbench-ollama-tags-"));
  const fakeCurl = path.join(fixtureDir, "curl");
  writeFileSync(
    fakeCurl,
    "#!/usr/bin/env bash\nprintf '%s\\n' '{\"models\":[{\"name\":\"llama3:8b\"}]}'\n",
  );
  chmodSync(fakeCurl, 0o755);

  try {
    const script = [
      "set -euo pipefail",
      "export RUN_LOCAL_DEV_SOURCE_ONLY=1",
      "source scripts/run-local-dev.sh",
      `BOOTSTRAP_NODE_BIN=${JSON.stringify(process.execPath)}`,
      `PATH=${JSON.stringify(fixtureDir)}:$PATH`,
      "bootstrap_verify_configured_ollama_models",
    ].join("\n");
    const result = spawnSync("bash", ["-c", script], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Missing: mixtral:8x7b qwen2\.5:72b qwen2\.5:14b/);
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true });
  }
});

test("llama3-only setup accepts an inventory without the optional models", () => {
  const fixtureDir = mkdtempSync(
    path.join(os.tmpdir(), "texbench-ollama-tags-"),
  );
  const fakeCurl = path.join(fixtureDir, "curl");
  writeFileSync(
    fakeCurl,
    "#!/usr/bin/env bash\nprintf '%s\\n' '{\"models\":[{\"name\":\"llama3:8b\"}]}'\n",
  );
  chmodSync(fakeCurl, 0o755);

  try {
    const script = [
      "set -euo pipefail",
      "export RUN_LOCAL_DEV_SOURCE_ONLY=1",
      "source scripts/run-local-dev.sh",
      `BOOTSTRAP_NODE_BIN=${JSON.stringify(process.execPath)}`,
      `PATH=${JSON.stringify(fixtureDir)}:$PATH`,
      "bootstrap_parse_local_dev_args --llama3-only",
      "bootstrap_verify_configured_ollama_models",
    ].join("\n");
    const result = spawnSync("bash", ["-c", script], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(
      result.stdout,
      /Verified every selected Ollama model is installed/,
    );
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true });
  }
});
