import assert from "node:assert/strict";
import test from "node:test";

import { collectSystemInfo } from "../src/system-info.mjs";

test("system info reports logical cores and memory capacity", () => {
  const info = collectSystemInfo({
    availableParallelism: () => 12,
    cpus: () => Array.from({ length: 16 }),
    totalmem: () => 32 * 1024 ** 3,
    freemem: () => 9 * 1024 ** 3,
  });

  assert.deepEqual(info, {
    logical_cores: 12,
    total_memory_bytes: 32 * 1024 ** 3,
    available_memory_bytes: 9 * 1024 ** 3,
  });
});

test("system info falls back to the CPU inventory", () => {
  const info = collectSystemInfo({
    cpus: () => Array.from({ length: 8 }),
    totalmem: () => 16 * 1024 ** 3,
    freemem: () => 4 * 1024 ** 3,
  });

  assert.equal(info.logical_cores, 8);
});
