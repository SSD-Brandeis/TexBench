import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";

async function loadStructuredUiNormalizer() {
  const scriptPath = path.resolve(
    process.cwd(),
    "public/ui-structured-normalization.js",
  );
  const source = await fs.readFile(scriptPath, "utf8");
  const context = { globalThis: {} };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.globalThis.TectonicUiStructuredNormalization;
}

function createNormalizerConfig() {
  return {
    defaultCharacterSet: "alphanumeric",
    operationOrder: ["inserts"],
    operationDefaults: { inserts: {} },
    stringPatternDefaults: {
      key_pattern: "uniform",
      val_pattern: "uniform",
      key_hot_len: 20,
      key_hot_amount: 100,
      key_hot_probability: 0.8,
      val_hot_len: 256,
      val_hot_amount: 100,
      val_hot_probability: 0.8,
    },
    selectionParamDefaults: {},
    selectionDistributionParams: {},
    rangeFormats: ["StartCount", "StartEnd"],
    opsWithOpCount: ["inserts"],
    opsWithSorted: [],
    opsWithKey: ["inserts"],
    opsWithValue: ["inserts"],
    opsWithSelection: [],
    opsWithRange: [],
  };
}

test(
  "structured ui normalization preserves explicit section and group character_set",
  async () => {
    const normalizer = await loadStructuredUiNormalizer();
    const sections = normalizer.normalizePatchedStructureSections(
      [
        {
          character_set: "alphabetic",
          skip_key_contains_check: true,
          groups: [
            {
              character_set: "numeric",
              inserts: {
                op_count: 1,
                key: "key",
                val: "value",
              },
            },
          ],
        },
      ],
      createNormalizerConfig(),
    );

    assert.equal(sections[0].character_set, "alphabetic");
    assert.equal(sections[0].groups[0].character_set, "numeric");
    assert.equal(sections[0].skip_key_contains_check, true);
  },
);

test(
  "structured ui normalization preserves explicit section and group metadata",
  async () => {
    const normalizer = await loadStructuredUiNormalizer();
    const sections = normalizer.normalizePatchedStructureSections(
      [
        {
          name: "Load Phase",
          enable_granular_stats: false,
          groups: [
            {
              name: "Warmup Group",
              enable_granular_stats: false,
              inserts: {
                op_count: 1,
                key: "key",
                val: "value",
              },
            },
          ],
        },
      ],
      createNormalizerConfig(),
    );

    assert.equal(sections[0].name, "Load Phase");
    assert.equal(sections[0].enable_granular_stats, true);
    assert.equal(sections[0].groups[0].name, "Warmup Group");
    assert.equal(sections[0].groups[0].enable_granular_stats, true);
  },
);

test(
  "structured ui normalization injects default section and group metadata when missing",
  async () => {
    const normalizer = await loadStructuredUiNormalizer();
    const sections = normalizer.normalizePatchedStructureSections(
      [
        {
          groups: [
            {
              inserts: {
                op_count: 1,
                key: "key",
                val: "value",
              },
            },
          ],
        },
      ],
      createNormalizerConfig(),
    );

    assert.equal(sections[0].name, "Section 1");
    assert.equal(sections[0].enable_granular_stats, true);
    assert.equal(sections[0].groups[0].name, "Group 1");
    assert.equal(sections[0].groups[0].enable_granular_stats, true);
  },
);

test(
  "structured ui normalization does not synthesize section or group character_set from defaults",
  async () => {
    const normalizer = await loadStructuredUiNormalizer();
    const sections = normalizer.normalizePatchedStructureSections(
      [
        {
          groups: [
            {
              inserts: {
                op_count: 1,
                key: "key",
                val: "value",
              },
            },
          ],
        },
      ],
      createNormalizerConfig(),
    );

    assert.equal(
      Object.prototype.hasOwnProperty.call(sections[0], "character_set"),
      false,
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(
        sections[0].groups[0],
        "character_set",
      ),
      false,
    );
  },
);

test(
  "structured ui normalization derives selection controls from stored distribution expressions",
  async () => {
    const normalizer = await loadStructuredUiNormalizer();
    const config = {
      ...createNormalizerConfig(),
      operationOrder: ["point_queries"],
      operationDefaults: {
        point_queries: {
          op_count: 500000,
          selection_distribution: "uniform",
          selection_min: 0,
          selection_max: 1,
          selection_n: 1000000,
          selection_s: 1.5,
        },
      },
      selectionParamDefaults: {
        selection_min: 0,
        selection_max: 1,
        selection_n: 1000000,
        selection_s: 1.5,
      },
      selectionDistributionParams: {
        uniform: ["selection_min", "selection_max"],
        zipf: ["selection_n", "selection_s"],
      },
      opsWithOpCount: ["point_queries"],
      opsWithKey: [],
      opsWithValue: [],
      opsWithSelection: ["point_queries"],
    };
    const sections = normalizer.normalizePatchedStructureSections(
      [
        {
          groups: [
            {
              point_queries: {
                op_count: 100,
                selection: {
                  zipf: {
                    n: 12345,
                    s: 1.2,
                  },
                },
              },
            },
          ],
        },
      ],
      config,
    );

    const pointQueries = sections[0].groups[0].point_queries;
    assert.equal(pointQueries.selection_distribution, "zipf");
    assert.equal(pointQueries.selection_n, 12345);
    assert.equal(pointQueries.selection_s, 1.2);
    assert.deepEqual(JSON.parse(JSON.stringify(pointQueries.selection)), {
      zipf: {
        n: 12345,
        s: 1.2,
      },
    });
  },
);
