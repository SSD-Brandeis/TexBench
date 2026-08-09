import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "..");

test("full dev bootstrap reuses a functional Cassandra with a different version", () => {
  const script = [
    "set -euo pipefail",
    "export RUN_LOCAL_DEV_SOURCE_ONLY=1",
    "source scripts/run-local-dev.sh",
    "bootstrap_existing_cqlsh_bin() { printf '/fake/cqlsh\\n'; }",
    "bootstrap_existing_cassandra_bin() { printf '/fake/cassandra\\n'; }",
    "bootstrap_cqlsh_show_version() { printf '[cqlsh 6.1.0 | Cassandra 4.1.7 | CQL spec 3.4.6]\\n'; }",
    "bootstrap_start_cassandra_for_session",
  ].join("\n");
  const result = spawnSync("bash", ["-c", script], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Reusing the functional Cassandra instance/);
  assert.match(result.stdout, /differs from the managed 5\.0\.7 pin/);
});

test("Cassandra discovery retries with the downloaded cqlsh before launching a node", () => {
  const script = [
    "set -euo pipefail",
    "export RUN_LOCAL_DEV_SOURCE_ONLY=1",
    "source scripts/run-local-dev.sh",
    "bootstrap_existing_cqlsh_bin() { return 1; }",
    "bootstrap_existing_cassandra_bin() { return 1; }",
    "bootstrap_select_java_runtime() { :; }",
    "bootstrap_install_cassandra() { :; }",
    "BOOTSTRAP_DOWNLOADED_CQLSH_BIN=/downloaded/cqlsh",
    "BOOTSTRAP_DOWNLOADED_CASSANDRA_BIN=/downloaded/cassandra",
    "bootstrap_cqlsh_show_version() { [ \"$1\" = /downloaded/cqlsh ] && printf '[cqlsh | Cassandra 4.1.7]\\n'; }",
    "bootstrap_prepare_cassandra_config() { echo should-not-start >&2; return 99; }",
    "bootstrap_start_cassandra_for_session",
  ].join("\n");
  const result = spawnSync("bash", ["-c", script], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Reusing the functional Cassandra instance/);
  assert.doesNotMatch(result.stderr, /should-not-start/);
});

test("Java bootstrap resolves the macOS Contents/Home executable after extraction", () => {
  const fixtureRoot = mkdtempSync(path.join(os.tmpdir(), "texbench-java-bootstrap-"));
  const archiveRoot = path.join(fixtureRoot, "archive", "jdk-17.jdk", "Contents", "Home", "bin");
  const cacheDir = path.join(fixtureRoot, "cache");
  const toolsDir = path.join(fixtureRoot, "tools");
  mkdirSync(archiveRoot, { recursive: true });
  mkdirSync(cacheDir, { recursive: true });
  const fixtureJava = path.join(archiveRoot, "java");
  writeFileSync(fixtureJava, "#!/usr/bin/env bash\necho fixture-java\n");
  chmodSync(fixtureJava, 0o755);
  const archivePath = path.join(cacheDir, "temurin-jdk-17-darwin-arm64.tar.gz");
  const tarResult = spawnSync(
    "tar",
    ["-czf", archivePath, "-C", path.join(fixtureRoot, "archive"), "jdk-17.jdk"],
    { encoding: "utf8" },
  );
  assert.equal(tarResult.status, 0, tarResult.stderr);

  try {
    const script = [
      "set -euo pipefail",
      `export BOOTSTRAP_ROOT=${JSON.stringify(fixtureRoot)}`,
      `export BOOTSTRAP_CACHE_DIR=${JSON.stringify(cacheDir)}`,
      `export BOOTSTRAP_TOOLS_DIR=${JSON.stringify(toolsDir)}`,
      "export BOOTSTRAP_PLATFORM=darwin-arm64",
      "export RUN_LOCAL_DEV_SOURCE_ONLY=1",
      "source scripts/run-local-dev.sh",
      "bootstrap_existing_java_bin() { return 1; }",
      "bootstrap_select_java_runtime",
      "printf '%s\\n' \"$BOOTSTRAP_DOWNLOADED_JAVA_BIN\"",
      "printf 'JAVA_HOME=%s\\n' \"$BOOTSTRAP_JAVA_HOME\"",
    ].join("\n");
    const result = spawnSync("bash", ["-c", script], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /latest\/Contents\/Home\/bin\/java/);
    assert.match(result.stdout, /JAVA_HOME=.*\/latest\/Contents\/Home/);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("bootstrap cleanup runs on errors and preserves the failing exit status", () => {
  const script = [
    "set -euo pipefail",
    "export RUN_LOCAL_DEV_SOURCE_ONLY=1",
    "source scripts/run-local-dev.sh",
    "bootstrap_cleanup() { printf 'cleanup-ran\\n'; }",
    "false",
  ].join("\n");
  const result = spawnSync("bash", ["-c", script], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert.equal(result.status, 1, result.stderr);
  assert.equal(result.stdout.trim(), "cleanup-ran");
});

test("bootstrap cleanup runs on termination signals", () => {
  const script = [
    "set -euo pipefail",
    "export RUN_LOCAL_DEV_SOURCE_ONLY=1",
    "source scripts/run-local-dev.sh",
    "bootstrap_cleanup() { printf 'cleanup-ran\\n'; }",
    "kill -TERM $$",
  ].join("\n");
  const result = spawnSync("bash", ["-c", script], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert.equal(result.status, 143, result.stderr);
  assert.equal(result.stdout.trim(), "cleanup-ran");
});
