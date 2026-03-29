import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "..");
const scriptPath = path.join(repoRoot, "scripts", "bootstrap-info.sh");

function runInfo(key, extraEnv = {}) {
  return spawnSync("bash", [scriptPath, key], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      ...extraEnv,
    },
  });
}

test("bootstrap info resolves darwin arm64 platform", () => {
  const result = runInfo("platform", {
    BOOTSTRAP_UNAME_S: "Darwin",
    BOOTSTRAP_UNAME_M: "arm64",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "darwin-arm64");
});

test("bootstrap info resolves linux x64 platform", () => {
  const result = runInfo("platform", {
    BOOTSTRAP_UNAME_S: "Linux",
    BOOTSTRAP_UNAME_M: "x86_64",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "linux-x64");
});

test("bootstrap info resolves node archive for linux arm64", () => {
  const result = runInfo("node-archive", {
    BOOTSTRAP_UNAME_S: "Linux",
    BOOTSTRAP_UNAME_M: "aarch64",
    BOOTSTRAP_NODE_VERSION: "24.14.0",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "node-v24.14.0-linux-arm64.tar.xz");
});

test("bootstrap info resolves tectonic asset naming for darwin x64", () => {
  const result = runInfo("tectonic-asset", {
    BOOTSTRAP_UNAME_S: "Darwin",
    BOOTSTRAP_UNAME_M: "x86_64",
    BOOTSTRAP_TECTONIC_CLI_VERSION: "0.3.1",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "tectonic-cli-v0.3.1-darwin-x64.tar.gz");
});

test("bootstrap info resolves Rust target for darwin arm64", () => {
  const result = runInfo("rust-target", {
    BOOTSTRAP_UNAME_S: "Darwin",
    BOOTSTRAP_UNAME_M: "arm64",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "aarch64-apple-darwin");
});

test("bootstrap info resolves Rust target for linux x64", () => {
  const result = runInfo("rust-target", {
    BOOTSTRAP_TARGET_PLATFORM: "linux-x64",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "x86_64-unknown-linux-gnu");
});

test("bootstrap info resolves docker packaging strategy for Linux on macOS hosts", () => {
  const result = runInfo("package-strategy", {
    BOOTSTRAP_HOST_PLATFORM: "darwin-arm64",
    BOOTSTRAP_TARGET_PLATFORM: "linux-arm64",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "docker-linux");
});

test("bootstrap info resolves Docker platform for linux x64 packaging", () => {
  const result = runInfo("docker-platform", {
    BOOTSTRAP_TARGET_PLATFORM: "linux-x64",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "linux/amd64");
});

test("bootstrap info exposes the managed Tectonic checkout branch", () => {
  const result = runInfo("tectonic-branch");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "no-marker-array");
});

test("bootstrap info exposes the Tectonic Rust toolchain pin", () => {
  const result = runInfo("tectonic-rust-toolchain");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "nightly");
});

test("bootstrap info exposes the managed Tectonic repository url", () => {
  const result = runInfo("tectonic-repository-url");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "https://github.com/SSD-Brandeis/Tectonic.git");
});

test("bootstrap info exposes the pinned Cassandra C++ driver ref", () => {
  const result = runInfo("cassandra-cpp-driver-ref");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "2.17.1");
});

test("bootstrap info exposes conservative Docker build parallelism defaults", () => {
  const cppJobs = runInfo("tectonic-docker-cpp-jobs");
  assert.equal(cppJobs.status, 0, cppJobs.stderr);
  assert.equal(cppJobs.stdout.trim(), "2");

  const cargoJobs = runInfo("tectonic-docker-cargo-jobs");
  assert.equal(cargoJobs.status, 0, cargoJobs.stderr);
  assert.equal(cargoJobs.stdout.trim(), "2");
});

test("bootstrap info prefers Homebrew cassandra-cpp-driver lib path on macOS", () => {
  const binDir = mkdtempSync(path.join(os.tmpdir(), "bootstrap-info-brew-bin-"));
  try {
    mkdirSync(binDir, { recursive: true });
    writeFileSync(
    path.join(binDir, "brew"),
    "#!/usr/bin/env bash\nif [ \"$1\" = \"--prefix\" ] && [ \"$2\" = \"cassandra-cpp-driver\" ]; then\n  echo /opt/homebrew/opt/cassandra-cpp-driver\n  exit 0\nfi\nexit 1\n",
    { mode: 0o755 },
  );
    const result = runInfo("cassandra-sys-lib-path", {
      BOOTSTRAP_UNAME_S: "Darwin",
      BOOTSTRAP_UNAME_M: "arm64",
      PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "/opt/homebrew/opt/cassandra-cpp-driver/lib");
  } finally {
    rmSync(binDir, { recursive: true, force: true });
  }
});

test("bootstrap info exposes default Cassandra library path for apple silicon", () => {
  const result = runInfo("cassandra-sys-lib-path", {
    BOOTSTRAP_UNAME_S: "Darwin",
    BOOTSTRAP_UNAME_M: "arm64",
    PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "/opt/homebrew/lib");
});

test("bootstrap info exposes the pinned Ollama model digest", () => {
  const result = runInfo("ollama-digest");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "365c0bd3c000");
});

test("bootstrap info exposes the pinned Cassandra version", () => {
  const result = runInfo("cassandra-version");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "5.0.7");
});

test("bootstrap info fails on unsupported operating systems", () => {
  const result = runInfo("platform", {
    BOOTSTRAP_UNAME_S: "FreeBSD",
    BOOTSTRAP_UNAME_M: "x86_64",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unsupported operating system: FreeBSD/);
});
