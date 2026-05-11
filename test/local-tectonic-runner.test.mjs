import assert from "node:assert/strict";
import test from "node:test";

import { __test } from "../src/local-tectonic-runner.mjs";

const {
  buildTectonicBenchmarkArgs,
  parseBenchmarkStats,
  resolvePerRunDatabasePath,
  resolveDatabaseBenchmarkOptions,
} = __test;

function findMetric(metrics, key) {
  return (Array.isArray(metrics) ? metrics : []).find(
    (entry) => entry && entry.key === key,
  );
}

function findMetricByLabel(metrics, label) {
  return (Array.isArray(metrics) ? metrics : []).find(
    (entry) => entry && entry.label === label,
  );
}

test("runner builds benchmark args for rocksdb, cassandra, redis, and printdb", () => {
  assert.deepEqual(
    buildTectonicBenchmarkArgs({
      spec_path: "/tmp/spec.json",
      database: "rocksdb",
      database_path: "",
      config: "",
    }),
    ["benchmark", "-w", "/tmp/spec.json", "--database", "rocksdb"],
  );

  assert.deepEqual(
    buildTectonicBenchmarkArgs({
      spec_path: "/tmp/spec.json",
      database: "cassandra",
      database_path: "127.0.0.1",
      config: "",
    }),
    [
      "benchmark",
      "-w",
      "/tmp/spec.json",
      "--database",
      "cassandra",
      "-p",
      "127.0.0.1",
    ],
  );

  assert.deepEqual(
    buildTectonicBenchmarkArgs({
      spec_path: "/tmp/spec.json",
      database: "redis",
      database_path: "",
      config: "",
    }),
    ["benchmark", "-w", "/tmp/spec.json", "--database", "redis"],
  );

  assert.deepEqual(
    buildTectonicBenchmarkArgs({
      spec_path: "/tmp/spec.json",
      database: "printdb",
      database_path: "",
      config: "",
    }),
    ["benchmark", "-w", "/tmp/spec.json", "--database", "printdb"],
  );
});

test("runner resolves benchmark options with cassandra path defaults", () => {
  assert.deepEqual(resolveDatabaseBenchmarkOptions("rocksdb", {}, {}), {
    databasePath: "",
    config: "",
  });

  assert.deepEqual(resolveDatabaseBenchmarkOptions("cassandra", {}, {}), {
    databasePath: "127.0.0.1",
    config: "",
  });

  assert.deepEqual(resolveDatabaseBenchmarkOptions("printdb", {}, {}), {
    databasePath: "",
    config: "",
  });
});

test("runner assigns a per-run rocksdb data path when none is configured", () => {
  assert.equal(
    resolvePerRunDatabasePath("/tmp/run-123", "rocksdb", ""),
    "/tmp/run-123/db/rocksdb",
  );

  assert.equal(
    resolvePerRunDatabasePath("/tmp/run-123", "rocksdb", "/custom/rocks"),
    "/custom/rocks",
  );

  assert.equal(resolvePerRunDatabasePath("/tmp/run-123", "cassandra", ""), "");
  assert.equal(resolvePerRunDatabasePath("/tmp/run-123", "printdb", ""), "");
});

test("runner parses benchmark output into overall, phase, and operation stats", () => {
  const sample = `
tectonic-cli benchmark -w foo.json --database cassandra -p 127.0.0.1
[Executing]
████████████████████████████████████░░░░ 91% (20s)
[[***Stats for Load Phase***]]
[Insert] Count: 1000000
[Insert] Successful Operations Count: 0
[Insert] Total Latency: 207909004.71700us
[Insert] Average Latency: 207.90902us
[Overall] Total Operations: 1000000
[Overall] Average Latency: 207.90900us
[Overall] Throughput (using start and end time): 4771.65420ops/sec
[Overall] Aggregate Operation Time: 207.90900secs
███████████████████████████████████████░ 100% (0s)
[[***Stats for Execution Phase***]]
[Point Query] Count: 500000
[Point Query] Average Latency: 206.56584us
[Update] Count: 500000
[Update] Average Latency: 207.25022us
[Overall] Total Operations: 1000000
[Overall] Average Latency: 206.90802us
[Overall] Throughput (using start and end time): 4808.70723ops/sec
[[***Overall Stats***]]
[Insert] Count: 1000000
[Insert] Average Latency: 207.90902us
[Update] Count: 500000
[Update] Average Latency: 207.25022us
[Point Query] Count: 500000
[Point Query] Average Latency: 206.56584us
[Overall] Total Operations: 2000000
[Overall] Average Latency: 207.40851us
[Overall] Throughput (using start and end time): 4790.04003ops/sec
`;

  const stats = parseBenchmarkStats(sample);

  assert.deepEqual(
    stats.phases.map((entry) => entry.name),
    ["Load Phase", "Execution Phase"],
  );
  assert.equal(
    findMetric(stats.phases[0].metrics, "total_operations").value,
    "1000000",
  );
  assert.equal(
    findMetricByLabel(stats.phases[0].metrics, "Insert Count").value,
    "1000000",
  );
  assert.equal(
    findMetricByLabel(stats.phases[0].metrics, "Overall Average Latency").value,
    "207.90900us",
  );
  assert.equal(
    findMetric(stats.phases[1].metrics, "throughput_using_start_and_end_time")
      .value,
    "4808.70723ops/sec",
  );

  assert.equal(findMetric(stats.overall, "total_operations").value, "2000000");
  assert.equal(
    findMetric(stats.overall, "average_latency").value,
    "207.40851us",
  );

  assert.deepEqual(
    stats.operations.map((entry) => entry.name).sort(),
    ["Insert", "Point Query", "Update"],
  );
  assert.equal(
    findMetric(
      stats.operations.find((entry) => entry.name === "Point Query").metrics,
      "average_latency",
    ).value,
    "206.56584us",
  );
});
