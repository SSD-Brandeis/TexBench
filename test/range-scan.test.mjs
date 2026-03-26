import assert from "node:assert/strict";
import test from "node:test";

await import("../public/range-scan.js");

test("range scan support estimates valid keys from prior and current section inserts", () => {
  const estimate = globalThis.TectonicRangeScan.estimateValidKeyCount({
    sections: [
      {
        groups: [
          { inserts: { op_count: 100000 } },
          { inserts: { op_count: 40000 }, range_queries: { selectivity: 0.1 } },
        ],
      },
    ],
    sectionIndex: 0,
    groupIndex: 1,
    fallbackInsertCount: null,
  });

  assert.equal(estimate, 100000);
});

test("range scan support falls back to section totals and converts both ways", () => {
  const estimate = globalThis.TectonicRangeScan.estimateValidKeyCount({
    sections: [
      {
        groups: [
          { range_queries: { selectivity: 0.1 } },
          { inserts: { op_count: 50000 } },
        ],
      },
    ],
    sectionIndex: 0,
    groupIndex: 0,
    fallbackInsertCount: null,
  });

  assert.equal(estimate, 50000);
  assert.equal(
    globalThis.TectonicRangeScan.scanLengthFromSelectivity(0.1, estimate),
    5000,
  );
  assert.equal(
    globalThis.TectonicRangeScan.selectivityFromScanLength(5000, estimate),
    0.1,
  );
});
