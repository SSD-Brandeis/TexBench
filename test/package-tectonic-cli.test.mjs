import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "..");
const scriptPath = path.join(repoRoot, "scripts", "package-tectonic-cli.sh");

function runPackage(env = {}) {
  return spawnSync("bash", [scriptPath], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      ...env,
    },
  });
}

test("package script dry-run uses a managed checkout and mixed host/docker strategies on macOS", () => {
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), "package-tectonic-cli-"));
  try {
    const managedDir = path.join(tempRoot, ".bootstrap", "src", "Tectonic");
    const result = runPackage({
      PACKAGE_DRY_RUN: "1",
      BOOTSTRAP_ROOT: path.join(tempRoot, ".bootstrap"),
      DIST_DIR: path.join(tempRoot, "dist"),
      PACKAGE_PLATFORMS: "darwin-arm64,linux-arm64",
      BOOTSTRAP_UNAME_S: "Darwin",
      BOOTSTRAP_UNAME_M: "arm64",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, new RegExp(`Cloning managed Tectonic checkout into ${managedDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    assert.match(result.stdout, /DRY_RUN git clone --branch no-marker-array --single-branch https:\/\/github\.com\/SSD-Brandeis\/Tectonic\.git/);
    assert.match(result.stdout, /DRY_RUN git -C .* fetch --depth 1 origin no-marker-array/);
    assert.match(result.stdout, /DRY_RUN git -C .* checkout -B no-marker-array origin\/no-marker-array/);
    assert.match(result.stdout, /Strategy for darwin-arm64: host/);
    assert.match(result.stdout, /DRY_RUN cargo \+nightly build --release --target aarch64-apple-darwin -p tectonic-cli --bin tectonic-cli --all-features/);
    assert.match(result.stdout, /Strategy for linux-arm64: docker-linux/);
    assert.match(result.stdout, /DRY_RUN docker buildx build --platform linux\/arm64/);
    assert.match(result.stdout, /--target export/);
    assert.match(result.stdout, /--build-arg RUST_TOOLCHAIN=nightly/);
    assert.match(result.stdout, /--build-arg CPP_BUILD_JOBS=2/);
    assert.match(result.stdout, /--build-arg CARGO_BUILD_JOBS=2/);
    assert.match(result.stdout, /Packaged platforms: darwin-arm64 linux-arm64/);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("package script rejects darwin targets on linux hosts", () => {
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), "package-tectonic-cli-host-"));
  try {
    const result = runPackage({
      PACKAGE_DRY_RUN: "1",
      BOOTSTRAP_ROOT: path.join(tempRoot, ".bootstrap"),
      DIST_DIR: path.join(tempRoot, "dist"),
      PACKAGE_PLATFORMS: "darwin-arm64",
      BOOTSTRAP_UNAME_S: "Linux",
      BOOTSTRAP_UNAME_M: "x86_64",
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Packaging darwin-arm64 requires a macOS host; current host platform is linux-x64/);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("package script skips an existing dist artifact before checkout/build work", () => {
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), "package-tectonic-cli-skip-"));
  try {
    const distDir = path.join(tempRoot, "dist");
    const assetPath = path.join(distDir, "tectonic-cli-v0.1.0-darwin-arm64.tar.gz");
    const resultEnv = {
      PACKAGE_DRY_RUN: "1",
      BOOTSTRAP_ROOT: path.join(tempRoot, ".bootstrap"),
      DIST_DIR: distDir,
      PACKAGE_PLATFORMS: "darwin-arm64",
      BOOTSTRAP_UNAME_S: "Darwin",
      BOOTSTRAP_UNAME_M: "arm64",
    };
    mkdirSync(distDir, { recursive: true });
    writeFileSync(assetPath, "already-built");
    const result = runPackage(resultEnv);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Skipping darwin-arm64 because .*tectonic-cli-v0\.1\.0-darwin-arm64\.tar\.gz already exists/);
    assert.doesNotMatch(result.stdout, /Cloning managed Tectonic checkout/);
    assert.doesNotMatch(result.stdout, /DRY_RUN cargo build/);
    assert.doesNotMatch(result.stdout, /DRY_RUN docker buildx build/);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
