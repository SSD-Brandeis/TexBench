import assert from "node:assert/strict";
import test from "node:test";

await import("../public/system-capacity.js");

test("system capacity formats host resources for thread guidance", () => {
  const formatter = globalThis.TectonicSystemCapacity;
  assert.equal(formatter.formatMemory(32 * 1024 ** 3), "32 GB");
  assert.equal(
    formatter.formatSystemCapacity({
      logical_cores: 12,
      total_memory_bytes: 32 * 1024 ** 3,
      available_memory_bytes: 9.5 * 1024 ** 3,
    }),
    "12 logical cores · 32 GB memory · 9.5 GB currently available",
  );
});
