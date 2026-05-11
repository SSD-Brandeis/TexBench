import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "..");
const scriptPath = path.join(repoRoot, "scripts", "bootstrap-probe.sh");

function createExecutable(dir, name, body) {
  const filePath = path.join(dir, name);
  writeFileSync(filePath, body, { mode: 0o755 });
  return filePath;
}

function runProbe(key, env = {}) {
  return spawnSync("/bin/bash", [scriptPath, key], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      ...env,
    },
  });
}

test("bootstrap probe prefers an existing supported node runtime", () => {
  const binDir = mkdtempSync(path.join(os.tmpdir(), "bootstrap-probe-node-"));
  try {
    const fakeNode = createExecutable(
      binDir,
      "node",
      "#!/usr/bin/env bash\nif [ \"$1\" = \"--version\" ]; then\n  echo v24.14.0\nelse\n  exit 0\nfi\n",
    );
    createExecutable(binDir, "npm", "#!/usr/bin/env bash\nexit 0\n");
    const result = runProbe("node-source", {
      PATH: binDir + path.delimiter + process.env.PATH,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "existing");

    const pathResult = runProbe("node-path", {
      PATH: binDir + path.delimiter + process.env.PATH,
    });
    assert.equal(pathResult.status, 0, pathResult.stderr);
    assert.equal(pathResult.stdout.trim(), fakeNode);
  } finally {
    rmSync(binDir, { recursive: true, force: true });
  }
});

test("bootstrap probe falls back to bootstrapped node when existing node is too old", () => {
  const binDir = mkdtempSync(path.join(os.tmpdir(), "bootstrap-probe-old-node-"));
  try {
    createExecutable(
      binDir,
      "node",
      "#!/usr/bin/env bash\nif [ \"$1\" = \"--version\" ]; then\n  echo v16.20.0\nelse\n  exit 0\nfi\n",
    );
    createExecutable(binDir, "npm", "#!/usr/bin/env bash\nexit 0\n");
    const result = runProbe("node-source", {
      PATH: binDir + path.delimiter + process.env.PATH,
      BOOTSTRAP_UNAME_S: "Darwin",
      BOOTSTRAP_UNAME_M: "arm64",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "bootstrap");
  } finally {
    rmSync(binDir, { recursive: true, force: true });
  }
});

test("bootstrap probe prefers an existing tectonic-cli when present", () => {
  const binDir = mkdtempSync(path.join(os.tmpdir(), "bootstrap-probe-tectonic-"));
  try {
    const fakeTectonic = createExecutable(
      binDir,
      "tectonic-cli",
      "#!/usr/bin/env bash\necho tectonic-cli\n",
    );
    const result = runProbe("tectonic-source", {
      PATH: binDir + path.delimiter + process.env.PATH,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "existing");

    const pathResult = runProbe("tectonic-path", {
      PATH: binDir + path.delimiter + process.env.PATH,
    });
    assert.equal(pathResult.status, 0, pathResult.stderr);
    assert.equal(pathResult.stdout.trim(), fakeTectonic);
  } finally {
    rmSync(binDir, { recursive: true, force: true });
  }
});

test("bootstrap probe prefers an existing supported Java runtime", () => {
  const binDir = mkdtempSync(path.join(os.tmpdir(), "bootstrap-probe-java-"));
  try {
    const fakeJava = createExecutable(
      binDir,
      "java",
      "#!/usr/bin/env bash\nif [ \"$1\" = \"-version\" ]; then\n  echo 'openjdk version \"17.0.16\"' 1>&2\nelse\n  exit 0\nfi\n",
    );
    const result = runProbe("java-source", {
      PATH: binDir + path.delimiter + process.env.PATH,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "existing");

    const pathResult = runProbe("java-path", {
      PATH: binDir + path.delimiter + process.env.PATH,
    });
    assert.equal(pathResult.status, 0, pathResult.stderr);
    assert.equal(pathResult.stdout.trim(), fakeJava);
  } finally {
    rmSync(binDir, { recursive: true, force: true });
  }
});

test("bootstrap probe prefers an existing Cassandra and cqlsh pair when present", () => {
  const binDir = mkdtempSync(path.join(os.tmpdir(), "bootstrap-probe-cassandra-"));
  try {
    const fakeCassandra = createExecutable(
      binDir,
      "cassandra",
      "#!/usr/bin/env bash\necho cassandra\n",
    );
    const fakeCqlsh = createExecutable(
      binDir,
      "cqlsh",
      "#!/usr/bin/env bash\necho cqlsh\n",
    );
    const result = runProbe("cassandra-source", {
      PATH: binDir + path.delimiter + process.env.PATH,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "existing");

    const cassandraPath = runProbe("cassandra-path", {
      PATH: binDir + path.delimiter + process.env.PATH,
    });
    assert.equal(cassandraPath.status, 0, cassandraPath.stderr);
    assert.equal(cassandraPath.stdout.trim(), fakeCassandra);

    const cqlshPath = runProbe("cqlsh-path", {
      PATH: binDir + path.delimiter + process.env.PATH,
    });
    assert.equal(cqlshPath.status, 0, cqlshPath.stderr);
    assert.equal(cqlshPath.stdout.trim(), fakeCqlsh);
  } finally {
    rmSync(binDir, { recursive: true, force: true });
  }
});

test("bootstrap probe prefers an existing Redis server and cli pair when present", () => {
  const binDir = mkdtempSync(path.join(os.tmpdir(), "bootstrap-probe-redis-"));
  try {
    const fakeRedisServer = createExecutable(
      binDir,
      "redis-server",
      "#!/usr/bin/env bash\necho redis-server\n",
    );
    const fakeRedisCli = createExecutable(
      binDir,
      "redis-cli",
      "#!/usr/bin/env bash\necho redis-cli\n",
    );
    const result = runProbe("redis-source", {
      PATH: binDir + path.delimiter + process.env.PATH,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "existing");

    const serverPath = runProbe("redis-server-path", {
      PATH: binDir + path.delimiter + process.env.PATH,
    });
    assert.equal(serverPath.status, 0, serverPath.stderr);
    assert.equal(serverPath.stdout.trim(), fakeRedisServer);

    const cliPath = runProbe("redis-cli-path", {
      PATH: binDir + path.delimiter + process.env.PATH,
    });
    assert.equal(cliPath.status, 0, cliPath.stderr);
    assert.equal(cliPath.stdout.trim(), fakeRedisCli);
  } finally {
    rmSync(binDir, { recursive: true, force: true });
  }
});

test("bootstrap probe prefers an existing ollama command when present", () => {
  const binDir = mkdtempSync(path.join(os.tmpdir(), "bootstrap-probe-ollama-"));
  try {
    const fakeOllama = createExecutable(
      binDir,
      "ollama",
      "#!/usr/bin/env bash\necho ollama\n",
    );
    const result = runProbe("ollama-source", {
      PATH: binDir + path.delimiter + process.env.PATH,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "existing");

    const pathResult = runProbe("ollama-path", {
      PATH: binDir + path.delimiter + process.env.PATH,
    });
    assert.equal(pathResult.status, 0, pathResult.stderr);
    assert.equal(pathResult.stdout.trim(), fakeOllama);
  } finally {
    rmSync(binDir, { recursive: true, force: true });
  }
});

test("bootstrap probe prefers an existing curl command when present", () => {
  const binDir = mkdtempSync(path.join(os.tmpdir(), "bootstrap-probe-curl-"));
  try {
    const fakeCurl = createExecutable(
      binDir,
      "curl",
      "#!/usr/bin/env bash\necho curl\n",
    );
    const result = runProbe("curl-source", {
      PATH: binDir + path.delimiter + process.env.PATH,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "existing");

    const pathResult = runProbe("curl-path", {
      PATH: binDir + path.delimiter + process.env.PATH,
    });
    assert.equal(pathResult.status, 0, pathResult.stderr);
    assert.equal(pathResult.stdout.trim(), fakeCurl);
  } finally {
    rmSync(binDir, { recursive: true, force: true });
  }
});

test("bootstrap probe marks curl for install when unavailable", () => {
  const binDir = mkdtempSync(path.join(os.tmpdir(), "bootstrap-probe-no-curl-"));
  try {
    createExecutable(
      binDir,
      "dirname",
      "#!/bin/sh\nexec /usr/bin/dirname \"$@\"\n",
    );
    const result = runProbe("curl-source", {
      PATH: binDir,
      BOOTSTRAP_UNAME_S: "Linux",
      BOOTSTRAP_UNAME_M: "x86_64",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "install");
  } finally {
    rmSync(binDir, { recursive: true, force: true });
  }
});
