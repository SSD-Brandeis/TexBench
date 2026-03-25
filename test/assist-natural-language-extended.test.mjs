import assert from "node:assert/strict";
import test from "node:test";

import {
  applyPatchToState,
  configuredOperations,
  createFormState,
  getSelectedProviderConfig,
  requestLiveAssist,
} from "./live-assist-test-helpers.mjs";

const LIVE_PROVIDER = getSelectedProviderConfig();

const TWO_PHASE_EQUIVALENT_PROMPTS = [
  "Preload the DB with 1M inserts, then interleave 80% point queries and 20% updates for 500k operations",
  "Please preload the DB with 1M inserts, then interleave 80% point queries and 20% updates for 500k operations.",
  "Can you preload the DB with 1M inserts, then interleave 80% point queries and 20% updates for 500k operations?",
  "Seed the database with 1M inserts, then interleave 80% point queries and 20% updates for 500k operations",
  "Load the database with 1M inserts, then interleave 80% point queries and 20% updates for 500k operations",
];

function createInsertSeed() {
  return {
    enabled: true,
    character_set: "alphanumeric",
    op_count: 1000000,
    key: "id",
    val: { uniform: { len: 16 } },
  };
}

function createWorkloadEStyleState() {
  return applyPatchToState(createFormState({}), {
    sections: [
      {
        groups: [
          {
            inserts: {
              enabled: true,
              op_count: 1000000,
            },
          },
          {
            range_queries: {
              enabled: true,
              op_count: 950000,
              selectivity: 0.001,
              selection_distribution: "beta",
              selection_alpha: 0.1,
              selection_beta: 5,
            },
            inserts: {
              enabled: true,
              op_count: 50000,
            },
          },
        ],
      },
    ],
    sections_count: 1,
    groups_per_section: 2,
    clear_operations: false,
    operations: {},
  });
}

async function requestAssist(prompt, formState = createFormState({})) {
  return requestLiveAssist({ prompt, formState, provider: LIVE_PROVIDER });
}

test(
  "ambiguity prompts keep required clarifications and suppress guessed operations",
  { skip: !LIVE_PROVIDER.binding, timeout: 120000 },
  async (t) => {
    const cases = [
      {
        name: "generic workload",
        prompt: "Generate a workload",
        expectedBindingType: "operations_set",
      },
      {
        name: "queries",
        prompt: "Add queries",
        expectedBindingType: "operations_set",
      },
      {
        name: "deletes",
        prompt: "Add deletes",
        expectedBindingType: "operations_set",
      },
    ];

    for (const testCase of cases) {
      await t.test(testCase.name, { timeout: 60000 }, async () => {
        const result = await requestAssist(
          testCase.prompt,
          createFormState({ inserts: createInsertSeed() }),
        );

        assert.equal(result.clarifications.length, 1);
        assert.equal(
          result.clarifications[0].binding.type,
          testCase.expectedBindingType,
        );
        assert.deepEqual(result.patch.operations || {}, {});
        assert.equal(result.patch.clear_operations, false);
      });
    }
  },
);

test(
  "synonym and filler variants normalize to the same two-phase structure",
  { skip: !LIVE_PROVIDER.binding, timeout: 300000 },
  async (t) => {
    for (const prompt of TWO_PHASE_EQUIVALENT_PROMPTS) {
      await t.test(prompt, { timeout: 60000 }, async () => {
        const result = await requestAssist(prompt);

        assert.equal(result.patch.sections.length, 1);
        assert.equal(result.patch.sections[0].groups.length, 2);
        assert.deepEqual(
          configuredOperations(result.patch.sections[0].groups[0]),
          ["inserts"],
        );
        assert.deepEqual(
          configuredOperations(result.patch.sections[0].groups[1]),
          ["point_queries", "updates"],
        );
        assert.equal(result.patch.sections[0].groups[0].inserts.op_count, 1000000);
        assert.equal(
          result.patch.sections[0].groups[1].point_queries.op_count,
          400000,
        );
        assert.equal(result.patch.sections[0].groups[1].updates.op_count, 100000);
      });
    }
  },
);

test(
  "operation synonym prompts map to the intended operation",
  { skip: !LIVE_PROVIDER.binding, timeout: 180000 },
  async (t) => {
    const cases = [
      {
        name: "point reads",
        prompt: "Add 50k point reads",
        expectedOperation: "point_queries",
      },
      {
        name: "read modify write",
        prompt: "Add 50k read-modify-write operations",
        expectedOperation: "merges",
      },
      {
        name: "rmw shorthand",
        prompt: "Add 50k rmw operations",
        expectedOperation: "merges",
      },
    ];

    for (const testCase of cases) {
      await t.test(testCase.name, { timeout: 60000 }, async () => {
        const result = await requestAssist(
          testCase.prompt,
          createFormState({ inserts: createInsertSeed() }),
        );

        assert.deepEqual(Object.keys(result.patch.operations).sort(), [
          testCase.expectedOperation,
        ]);
        assert.equal(
          result.patch.operations[testCase.expectedOperation].enabled,
          true,
        );
        assert.equal(
          result.patch.operations[testCase.expectedOperation].op_count,
          50000,
        );
      });
    }
  },
);

test(
  "single-turn regression: insert-only with spelled-out million entries",
  { skip: !LIVE_PROVIDER.binding, timeout: 120000 },
  async () => {
    const result = await requestAssist(
      "Generate a insert only workload with 1 million entries",
      createFormState({}),
    );

    const enabledOps = Object.entries(result.patch.operations || {})
      .filter(([, operationPatch]) => operationPatch && operationPatch.enabled)
      .map(([operationName]) => operationName)
      .sort();
    assert.deepEqual(enabledOps, ["inserts"]);
    assert.equal(result.patch.operations.inserts.enabled, true);
    assert.equal(result.patch.operations.inserts.op_count, 1000000);
  },
);

test(
  "multi-turn regression: insert-only then add point reads then change distribution",
  { skip: !LIVE_PROVIDER.binding, timeout: 180000 },
  async () => {
    let state = createFormState({});

    const first = await requestAssist(
      "Generate an insert-only workload with 1M operations",
      state,
    );
    state = applyPatchToState(state, first.patch);

    const second = await requestAssist("Add 50k point reads", state);
    state = applyPatchToState(state, second.patch);

    const third = await requestAssist(
      "change point queries distribution to zipf",
      state,
    );

    assert.equal(state.sections_count, 1);
    assert.equal(state.groups_per_section, 1);
    assert.equal(state.operations.inserts.enabled, true);
    assert.equal(state.operations.inserts.op_count, 1000000);
    assert.deepEqual(Object.keys(second.patch.operations).sort(), ["point_queries"]);
    assert.equal(second.patch.operations.point_queries.op_count, 50000);
    assert.deepEqual(Object.keys(third.patch.operations).sort(), ["point_queries"]);
    assert.equal(
      third.patch.operations.point_queries.selection_distribution,
      "zipf",
    );
  },
);

test(
  "multi-turn regression: workload e fixed scan length prompt updates range queries",
  { skip: !LIVE_PROVIDER.binding, timeout: 180000 },
  async () => {
    const state = createWorkloadEStyleState();
    assert.equal(state.sections[0].groups[1].range_queries.selectivity, 0.001);
    assert.notEqual(
      state.sections[0].groups[1].range_queries.selectivity,
      100 / 1000000,
    );
    const result = await requestAssist(
      "set the scan length to exactly 100",
      state,
    );
    const nextState = applyPatchToState(state, result.patch);

    assert.equal(nextState.sections_count, 1);
    assert.equal(nextState.groups_per_section, 2);
    assert.equal(
      nextState.sections[0].groups[1].range_queries.range_format,
      "StartCount",
    );
    assert.equal(
      nextState.sections[0].groups[1].range_queries.selectivity,
      100 / 1000000,
    );
  },
);

test(
  "single-turn regression: read-heavy scans prompt creates interleaved range and point queries",
  { skip: !LIVE_PROVIDER.binding, timeout: 180000 },
  async () => {
    const result = await requestAssist(
      "Generate a specification for a read-heavy workload that inserts 1M unique key-value pairs following a skewed distribution, and then perform 1K scans with a scan length of 1000 keys interleaved with 10K point queries.",
      createFormState({}),
    );
    const state = applyPatchToState(createFormState({}), result.patch);

    assert.equal(state.sections_count, 1);
    assert.equal(state.groups_per_section, 2);
    assert.deepEqual(configuredOperations(state.sections[0].groups[0]), ["inserts"]);
    assert.deepEqual(
      configuredOperations(state.sections[0].groups[1]),
      ["point_queries", "range_queries"],
    );
    assert.equal(state.sections[0].groups[0].inserts.op_count, 1000000);
    assert.equal(state.sections[0].groups[1].range_queries.op_count, 1000);
    assert.equal(state.sections[0].groups[1].point_queries.op_count, 10000);
    assert.equal(state.sections[0].groups[1].range_queries.range_format, "StartCount");
    assert.equal(state.sections[0].groups[1].range_queries.selectivity, 1000 / 1000000);
    assert.deepEqual(state.sections[0].groups[1].point_queries.selection, {
      zipf: {
        n: 1000000,
        s: 1.5,
      },
    });
    assert.deepEqual(state.sections[0].groups[1].range_queries.selection, {
      zipf: {
        n: 1000000,
        s: 1.5,
      },
    });
  },
);

test(
  "multi-turn regression: scale all operation counts by one order of magnitude",
  { skip: !LIVE_PROVIDER.binding, timeout: 240000 },
  async (t) => {
    const prompts = [
      "decrease the operation counts for all operations by a magnitude of 10",
      "reduce all operation counts by a factor of 10",
      "make every operation count 10x smaller",
    ];

    for (const prompt of prompts) {
      await t.test(prompt, { timeout: 60000 }, async () => {
        const state = createWorkloadEStyleState();
        assert.equal(state.sections[0].groups[0].inserts.op_count, 1000000);
        assert.equal(state.sections[0].groups[1].range_queries.op_count, 950000);
        assert.equal(state.sections[0].groups[1].inserts.op_count, 50000);
        const result = await requestAssist(prompt, state);
        const nextState = applyPatchToState(state, result.patch);

        assert.equal(nextState.sections_count, 1);
        assert.equal(nextState.groups_per_section, 2);
        assert.equal(nextState.sections[0].groups[0].inserts.op_count, 100000);
        assert.equal(
          nextState.sections[0].groups[1].range_queries.op_count,
          95000,
        );
        assert.equal(nextState.sections[0].groups[1].inserts.op_count, 5000);
      });
    }
  },
);

test(
  "multi-turn regression: insert-only then add point reads",
  { skip: !LIVE_PROVIDER.binding, timeout: 180000 },
  async () => {
    let state = createFormState({});

    const first = await requestAssist(
      "Generate an insert-only workload with 250k inserts",
      state,
    );
    state = applyPatchToState(state, first.patch);

    const second = await requestAssist("Add 5k point reads", state);
    state = applyPatchToState(state, second.patch);

    assert.equal(state.sections_count, 1);
    assert.equal(state.groups_per_section, 1);
    assert.deepEqual(
      configuredOperations(state.sections[0].groups[0]),
      ["inserts", "point_queries"],
    );
    assert.equal(state.operations.inserts.op_count, 250000);
    assert.equal(state.operations.point_queries.op_count, 5000);
  },
);

test(
  "multi-turn regression: insert-only then interleave point queries with inserts",
  { skip: !LIVE_PROVIDER.binding, timeout: 180000 },
  async () => {
    let state = createFormState({});

    const first = await requestAssist(
      "Generate a insert-only workload with 250k inserts",
      state,
    );
    state = applyPatchToState(state, first.patch);

    const second = await requestAssist(
      "interleave 5k point queries with the inserts",
      state,
    );
    state = applyPatchToState(state, second.patch);

    assert.equal(state.sections_count, 1);
    assert.equal(state.groups_per_section, 1);
    assert.deepEqual(
      configuredOperations(state.sections[0].groups[0]),
      ["inserts", "point_queries"],
    );
    assert.equal(state.operations.inserts.enabled, true);
    assert.equal(state.operations.inserts.op_count, 250000);
    assert.equal(state.operations.point_queries.enabled, true);
    assert.equal(state.operations.point_queries.op_count, 5000);
    assert.equal(second.patch.sections, null);
    assert.equal(second.patch.operations.point_queries.op_count, 5000);
  },
);

test(
  "multi-turn regression: insert-only then add a later phase",
  { skip: !LIVE_PROVIDER.binding, timeout: 180000 },
  async () => {
    let state = createFormState({});

    const first = await requestAssist(
      "Generate an insert-only workload with 250k inserts",
      state,
    );
    state = applyPatchToState(state, first.patch);

    const second = await requestAssist(
      "then add a second phase with 5k point queries",
      state,
    );
    state = applyPatchToState(state, second.patch);

    assert.equal(state.sections_count, 1);
    assert.equal(state.groups_per_section, 2);
    assert.deepEqual(
      configuredOperations(state.sections[0].groups[0]),
      ["inserts"],
    );
    assert.deepEqual(
      configuredOperations(state.sections[0].groups[1]),
      ["point_queries"],
    );
    assert.equal(state.sections[0].groups[0].inserts.op_count, 250000);
    assert.equal(state.sections[0].groups[1].point_queries.op_count, 5000);
  },
);

test(
  "multi-turn regression: add range deletes, edit distribution, then remove",
  { skip: !LIVE_PROVIDER.binding, timeout: 180000 },
  async () => {
    let state = createFormState({});

    const first = await requestAssist(
      "Generate an insert-only workload with 1M operations",
      state,
    );
    state = applyPatchToState(state, first.patch);

    const second = await requestAssist("Add 50k range deletes", state);
    state = applyPatchToState(state, second.patch);

    const third = await requestAssist(
      "change range deletes distribution to normal",
      state,
    );
    state = applyPatchToState(state, third.patch);

    const fourth = await requestAssist("remove range deletes", state);

    assert.equal(state.sections_count, 1);
    assert.equal(state.groups_per_section, 1);
    assert.equal(state.operations.inserts.enabled, true);
    assert.equal(state.operations.inserts.op_count, 1000000);
    assert.deepEqual(Object.keys(second.patch.operations).sort(), ["range_deletes"]);
    assert.equal(second.patch.operations.range_deletes.op_count, 50000);
    assert.deepEqual(Object.keys(third.patch.operations).sort(), ["range_deletes"]);
    assert.equal(
      third.patch.operations.range_deletes.selection_distribution,
      "normal",
    );
    assert.deepEqual(Object.keys(fourth.patch.operations).sort(), ["range_deletes"]);
    assert.equal(fourth.patch.operations.range_deletes.enabled, false);
  },
);

test(
  "group-targeted regression: change inserts in group 2 to updates",
  { skip: !LIVE_PROVIDER.binding, timeout: 120000 },
  async () => {
    let state = applyPatchToState(createFormState({}), {
      sections: [
        {
          character_set: "alphanumeric",
          skip_key_contains_check: true,
          groups: [
            {
              inserts: {
                enabled: true,
                op_count: 1000,
              },
            },
            {
              inserts: {
                enabled: true,
                op_count: 2000,
              },
            },
          ],
        },
      ],
      sections_count: 1,
      groups_per_section: 2,
      clear_operations: false,
      operations: {},
    });

    const result = await requestAssist(
      "Change inserts in group 2 to updates",
      state,
    );
    state = applyPatchToState(state, result.patch);

    assert.equal(state.sections_count, 1);
    assert.equal(state.groups_per_section, 2);
    assert.deepEqual(
      configuredOperations(state.sections[0].groups[0]),
      ["inserts"],
    );
    assert.deepEqual(
      configuredOperations(state.sections[0].groups[1]),
      ["updates"],
    );
    assert.equal(state.sections[0].groups[0].inserts.op_count, 1000);
    assert.equal(state.sections[0].groups[1].updates.op_count, 2000);
  },
);
