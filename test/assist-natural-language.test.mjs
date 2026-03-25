import assert from "node:assert/strict";
import test from "node:test";

import workerEntrypoint, { __test } from "../src/index.js";

const {
  normalizeSchemaHints,
  normalizeFormState,
  normalizeAssistPayload,
  buildEffectiveState,
} = __test;

const OPERATION_ORDER = [
  "inserts",
  "updates",
  "merges",
  "point_queries",
  "range_queries",
  "point_deletes",
  "range_deletes",
  "empty_point_queries",
  "empty_point_deletes",
  "sorted",
];

const OPERATION_LABELS = {
  inserts: "inserts",
  updates: "updates",
  merges: "merges",
  point_queries: "point queries",
  range_queries: "range queries",
  point_deletes: "point deletes",
  range_deletes: "range deletes",
  empty_point_queries: "empty point queries",
  empty_point_deletes: "empty point deletes",
  sorted: "sorted",
};

const CAPABILITIES = {
  inserts: {
    has_op_count: true,
    has_key: true,
    has_val: true,
    has_selection: false,
    has_range: false,
    has_sorted: false,
    has_character_set: true,
  },
  updates: {
    has_op_count: true,
    has_key: false,
    has_val: true,
    has_selection: true,
    has_range: false,
    has_sorted: false,
    has_character_set: true,
  },
  merges: {
    has_op_count: true,
    has_key: false,
    has_val: true,
    has_selection: true,
    has_range: false,
    has_sorted: false,
    has_character_set: true,
  },
  point_queries: {
    has_op_count: true,
    has_key: false,
    has_val: false,
    has_selection: true,
    has_range: false,
    has_sorted: false,
    has_character_set: false,
  },
  range_queries: {
    has_op_count: true,
    has_key: false,
    has_val: false,
    has_selection: true,
    has_range: true,
    has_sorted: false,
    has_character_set: false,
  },
  point_deletes: {
    has_op_count: true,
    has_key: false,
    has_val: false,
    has_selection: true,
    has_range: false,
    has_sorted: false,
    has_character_set: false,
  },
  range_deletes: {
    has_op_count: true,
    has_key: false,
    has_val: false,
    has_selection: true,
    has_range: true,
    has_sorted: false,
    has_character_set: false,
  },
  empty_point_queries: {
    has_op_count: true,
    has_key: true,
    has_val: false,
    has_selection: false,
    has_range: false,
    has_sorted: false,
    has_character_set: true,
  },
  empty_point_deletes: {
    has_op_count: true,
    has_key: true,
    has_val: false,
    has_selection: false,
    has_range: false,
    has_sorted: false,
    has_character_set: true,
  },
  sorted: {
    has_op_count: true,
    has_key: false,
    has_val: false,
    has_selection: false,
    has_range: false,
    has_sorted: true,
    has_character_set: false,
  },
};

const SCHEMA_HINTS = normalizeSchemaHints({
  operation_order: OPERATION_ORDER,
  operation_labels: OPERATION_LABELS,
  capabilities: CAPABILITIES,
});

const SELECTION_OPS = [
  "updates",
  "merges",
  "point_queries",
  "range_queries",
  "point_deletes",
  "range_deletes",
];

const ADD_CASES = [
  { operation: "inserts", prompt: "Add 50k inserts" },
  { operation: "updates", prompt: "Add 50k updates" },
  { operation: "merges", prompt: "Add 50k merges" },
  { operation: "point_queries", prompt: "Add 50k point querie" },
  { operation: "range_queries", prompt: "Add 50k range queries" },
  { operation: "point_deletes", prompt: "Add 50k point deletes" },
  { operation: "range_deletes", prompt: "Add 50k range deletes" },
  { operation: "empty_point_queries", prompt: "Add 50k empty point queries" },
  { operation: "empty_point_deletes", prompt: "Add 50k empty point deletes" },
  { operation: "sorted", prompt: "Add 50k sorted operations" },
];

const REMOVE_CASES = [
  { operation: "inserts", prompt: "Remove inserts" },
  { operation: "updates", prompt: "Remove updates" },
  { operation: "merges", prompt: "Remove merges" },
  { operation: "point_queries", prompt: "Remove point queries" },
  { operation: "range_queries", prompt: "Remove range queries" },
  { operation: "point_deletes", prompt: "Remove point deletes" },
  { operation: "range_deletes", prompt: "Remove range deletes" },
  { operation: "empty_point_queries", prompt: "Remove empty point queries" },
  { operation: "empty_point_deletes", prompt: "Remove empty point deletes" },
  { operation: "sorted", prompt: "Remove sorted" },
];

const EXCLUSIVE_CASES = [
  { operation: "inserts", prompt: "Generate only inserts" },
  { operation: "updates", prompt: "Generate only updates" },
  { operation: "merges", prompt: "Generate only merges" },
  { operation: "point_queries", prompt: "Generate only point queries" },
  { operation: "range_queries", prompt: "Generate only range queries" },
  { operation: "point_deletes", prompt: "Generate only point deletes" },
  { operation: "range_deletes", prompt: "Generate only range deletes" },
  {
    operation: "empty_point_queries",
    prompt: "Generate only empty point queries",
  },
  {
    operation: "empty_point_deletes",
    prompt: "Generate only empty point deletes",
  },
  { operation: "sorted", prompt: "Generate only sorted" },
];

function createFormState(operationOverrides = {}) {
  return normalizeFormState(
    {
      character_set: "alphanumeric",
      sections_count: 1,
      groups_per_section: 1,
      skip_key_contains_check: true,
      operations: operationOverrides,
    },
    SCHEMA_HINTS,
  );
}

function createInsertSeed() {
  return {
    enabled: true,
    character_set: "alphanumeric",
    op_count: 1000000,
    key: "id",
    val: { uniform: { len: 16 } },
  };
}

function createSelectionSeed(operationName) {
  const base = {
    enabled: true,
    op_count: 50000,
    selection_distribution: "uniform",
    selection_min: 0,
    selection_max: 1,
  };
  if (operationName === "range_queries" || operationName === "range_deletes") {
    base.selectivity = 0.01;
    base.range_format = "StartCount";
  }
  return base;
}

function getDistractorOperation(operationName) {
  return (
    OPERATION_ORDER.find((candidate) => candidate !== operationName) || "merges"
  );
}

function applyPrompt({
  prompt,
  formState,
  rawPatch = {},
  clarifications = [],
}) {
  return normalizeAssistPayload(
    {
      summary: "Applied prompt.",
      patch: rawPatch,
      clarifications,
      assumptions: [],
    },
    SCHEMA_HINTS,
    formState,
    prompt,
  );
}

function applyPatchToState(formState, patch) {
  return normalizeFormState(
    buildEffectiveState(patch, formState, SCHEMA_HINTS),
    SCHEMA_HINTS,
  );
}

function sortedKeys(value) {
  return Object.keys(value || {}).sort();
}

test("add prompts only patch the named operation across all operations", async (t) => {
  for (const testCase of ADD_CASES) {
    await t.test(testCase.operation, () => {
      const distractor = getDistractorOperation(testCase.operation);
      const formState = createFormState({
        inserts: createInsertSeed(),
      });
      const result = applyPrompt({
        prompt: testCase.prompt,
        formState,
        rawPatch: {
          operations: {
            [distractor]: {
              enabled: true,
              op_count: 123,
            },
          },
        },
      });

      assert.equal(result.patch.clear_operations, false);
      assert.deepEqual(sortedKeys(result.patch.operations), [
        testCase.operation,
      ]);
      assert.equal(result.patch.operations[testCase.operation].enabled, true);
      assert.equal(result.patch.operations[testCase.operation].op_count, 50000);
      assert.equal(
        Object.prototype.hasOwnProperty.call(
          result.patch.operations,
          distractor,
        ),
        false,
      );
    });
  }
});

test("remove prompts only disable the named operation across all operations", async (t) => {
  for (const testCase of REMOVE_CASES) {
    await t.test(testCase.operation, () => {
      const distractor = getDistractorOperation(testCase.operation);
      const formState = createFormState({
        inserts: createInsertSeed(),
        [testCase.operation]: {
          enabled: true,
          op_count: 25000,
        },
      });
      const result = applyPrompt({
        prompt: testCase.prompt,
        formState,
        rawPatch: {
          operations: {
            [distractor]: {
              enabled: true,
              op_count: 999,
            },
          },
        },
      });

      assert.equal(result.patch.clear_operations, false);
      assert.deepEqual(sortedKeys(result.patch.operations), [
        testCase.operation,
      ]);
      assert.equal(result.patch.operations[testCase.operation].enabled, false);
      assert.equal(
        Object.prototype.hasOwnProperty.call(
          result.patch.operations,
          distractor,
        ),
        false,
      );
    });
  }
});

test("exclusive prompts disable every unmentioned operation", async (t) => {
  for (const testCase of EXCLUSIVE_CASES) {
    await t.test(testCase.operation, () => {
      const formState = createFormState({
        inserts: createInsertSeed(),
        updates: {
          enabled: true,
          op_count: 10000,
        },
      });
      const result = applyPrompt({
        prompt: testCase.prompt,
        formState,
        rawPatch: {
          operations: {
            [getDistractorOperation(testCase.operation)]: {
              enabled: true,
              op_count: 321,
            },
          },
        },
      });

      assert.equal(result.patch.clear_operations, true);
      assert.deepEqual(
        sortedKeys(result.patch.operations),
        [...OPERATION_ORDER].sort(),
      );
      OPERATION_ORDER.forEach((operationName) => {
        const expectedEnabled = operationName === testCase.operation;
        assert.equal(
          result.patch.operations[operationName].enabled,
          expectedEnabled,
          operationName + " enabled state",
        );
      });
    });
  }
});

test("distribution edit prompts replace stale selection config for selection operations", async (t) => {
  for (const operationName of SELECTION_OPS) {
    await t.test(operationName, () => {
      const distractor = getDistractorOperation(operationName);
      const formState = createFormState({
        inserts: createInsertSeed(),
        [operationName]: createSelectionSeed(operationName),
      });
      const result = applyPrompt({
        prompt:
          "Change " +
          OPERATION_LABELS[operationName] +
          " distribution to normal",
        formState,
        rawPatch: {
          operations: {
            [operationName]: {
              enabled: true,
              selection: {
                uniform: {
                  min: 0,
                  max: 1,
                },
              },
              selection_distribution: "uniform",
            },
            [distractor]: {
              enabled: true,
              op_count: 77,
            },
          },
        },
      });

      assert.deepEqual(sortedKeys(result.patch.operations), [operationName]);
      assert.equal(result.patch.operations[operationName].selection, null);
      assert.equal(
        result.patch.operations[operationName].selection_distribution,
        "normal",
      );
      assert.equal(result.patch.operations[operationName].selection_mean, 0.5);
      assert.equal(
        result.patch.operations[operationName].selection_std_dev,
        0.15,
      );
      assert.equal(
        Object.prototype.hasOwnProperty.call(
          result.patch.operations,
          distractor,
        ),
        false,
      );
    });
  }
});

test("multi-turn regression flow preserves inserts and applies range delete edits deterministically", () => {
  let state = createFormState({});

  const insertOnly = applyPrompt({
    prompt: "Generate an insert-only workload with 1M operations",
    formState: state,
    rawPatch: {
      operations: {},
    },
  });
  assert.equal(insertOnly.patch.clear_operations, true);
  assert.equal(insertOnly.patch.operations.inserts.enabled, true);
  assert.equal(insertOnly.patch.operations.inserts.op_count, 1000000);
  state = applyPatchToState(state, insertOnly.patch);

  const addRangeDeletes = applyPrompt({
    prompt: "Add 50k range deletes",
    formState: state,
    rawPatch: {
      operations: {
        empty_point_deletes: {
          enabled: true,
          op_count: 500000,
        },
      },
    },
  });
  assert.deepEqual(sortedKeys(addRangeDeletes.patch.operations), [
    "range_deletes",
  ]);
  assert.equal(addRangeDeletes.patch.operations.range_deletes.enabled, true);
  assert.equal(addRangeDeletes.patch.operations.range_deletes.op_count, 50000);
  state = applyPatchToState(state, addRangeDeletes.patch);
  assert.equal(state.operations.inserts.enabled, true);
  assert.equal(state.operations.range_deletes.enabled, true);
  assert.equal(state.operations.range_deletes.op_count, 50000);

  const editDistribution = applyPrompt({
    prompt: "change range deletes distribution to normal",
    formState: state,
    rawPatch: {
      operations: {
        range_deletes: {
          enabled: true,
          selection: {
            uniform: {
              min: 0,
              max: 1,
            },
          },
          selection_distribution: "uniform",
        },
      },
    },
  });
  assert.deepEqual(sortedKeys(editDistribution.patch.operations), [
    "range_deletes",
  ]);
  assert.equal(
    editDistribution.patch.operations.range_deletes.selection_distribution,
    "normal",
  );
  assert.equal(editDistribution.patch.operations.range_deletes.selection, null);
  state = applyPatchToState(state, editDistribution.patch);
  assert.equal(state.operations.range_deletes.selection_distribution, "normal");
  assert.equal(state.operations.range_deletes.selection_mean, 0.5);
  assert.equal(state.operations.range_deletes.selection_std_dev, 0.15);

  const removeRangeDeletes = applyPrompt({
    prompt: "remove range deletes",
    formState: state,
    rawPatch: {
      operations: {},
    },
  });
  assert.deepEqual(sortedKeys(removeRangeDeletes.patch.operations), [
    "range_deletes",
  ]);
  assert.equal(
    removeRangeDeletes.patch.operations.range_deletes.enabled,
    false,
  );
  state = applyPatchToState(state, removeRangeDeletes.patch);
  assert.equal(state.operations.inserts.enabled, true);
  assert.equal(state.operations.range_deletes.enabled, false);
});

test("single shot prompts resolve to a single group structure", () => {
  const result = applyPrompt({
    prompt: "Generate a single shot workload with 1M inserts",
    formState: createFormState({}),
    rawPatch: {
      operations: {},
    },
  });

  assert.equal(Array.isArray(result.patch.sections), true);
  assert.equal(result.patch.sections.length, 1);
  assert.equal(result.patch.sections[0].groups.length, 1);
  assert.equal(result.patch.sections[0].groups[0].inserts.op_count, 1000000);
});

test("two phase interleaved prompts create preload and mixed groups from raw counts", () => {
  const result = applyPrompt({
    prompt:
      "Preload the DB with 1M inserts, then interleave 300k updates and 200k short range queries",
    formState: createFormState({}),
    rawPatch: {
      operations: {},
    },
  });

  assert.equal(Array.isArray(result.patch.sections), true);
  assert.equal(result.patch.sections.length, 1);
  assert.equal(result.patch.sections[0].groups.length, 2);
  assert.equal(result.patch.sections[0].groups[0].inserts.op_count, 1000000);
  assert.equal(result.patch.sections[0].groups[1].updates.op_count, 300000);
  assert.equal(
    result.patch.sections[0].groups[1].range_queries.op_count,
    200000,
  );
  assert.equal(
    result.patch.sections[0].groups[1].range_queries.selectivity,
    0.001,
  );
});

test("two phase interleaved prompts convert percentage mixes using the phase total", () => {
  const result = applyPrompt({
    prompt:
      "Preload the DB with 1M inserts, then interleave 80% point queries and 20% updates for 500k operations",
    formState: createFormState({}),
    rawPatch: {
      operations: {},
    },
  });

  assert.equal(result.patch.sections[0].groups.length, 2);
  assert.equal(
    result.patch.sections[0].groups[1].point_queries.op_count,
    400000,
  );
  assert.equal(result.patch.sections[0].groups[1].updates.op_count, 100000);
});

test("write only phrasing defaults the follow-up phase to updates", () => {
  const result = applyPrompt({
    prompt:
      "Preload the DB with 1M inserts, then write only for 250k operations",
    formState: createFormState({}),
    rawPatch: {
      operations: {},
    },
  });

  assert.equal(result.patch.sections[0].groups.length, 2);
  assert.equal(result.patch.sections[0].groups[1].updates.op_count, 250000);
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      result.patch.sections[0].groups[1],
      "point_queries",
    ),
    false,
  );
});

test("three phase prompts keep each interleaved phase in its own group", () => {
  const result = applyPrompt({
    prompt:
      "Build a three phase workload: preload the DB with 1M inserts, then interleave a write heavy phase with 70% updates and 30% point queries for 400k operations, then interleave 60% point queries and 40% long range queries for 600k operations",
    formState: createFormState({}),
    rawPatch: {
      operations: {},
    },
  });

  assert.equal(result.patch.sections.length, 1);
  assert.equal(result.patch.sections[0].groups.length, 3);
  assert.equal(result.patch.sections[0].groups[0].inserts.op_count, 1000000);
  assert.equal(result.patch.sections[0].groups[1].updates.op_count, 280000);
  assert.equal(
    result.patch.sections[0].groups[1].point_queries.op_count,
    120000,
  );
  assert.equal(
    result.patch.sections[0].groups[2].point_queries.op_count,
    360000,
  );
  assert.equal(
    result.patch.sections[0].groups[2].range_queries.op_count,
    240000,
  );
  assert.equal(
    result.patch.sections[0].groups[2].range_queries.selectivity,
    0.1,
  );
});

test("high-level three phase workload prompt variants normalize to the expected groups", async (t) => {
  const scenarios = [
    {
      name: "write-heavy then long-range",
      prompt:
        "Build a three phase workload: preload the DB with 1M inserts, then interleave a write-heavy phase with 70% updates and 30% point queries for 400k operations, then interleave 60% point queries and 40% long range queries for 600k operations.",
      assertions(result) {
        assert.equal(
          result.patch.sections[0].groups[0].inserts.op_count,
          1000000,
        );
        assert.equal(
          result.patch.sections[0].groups[1].updates.op_count,
          280000,
        );
        assert.equal(
          result.patch.sections[0].groups[1].point_queries.op_count,
          120000,
        );
        assert.equal(
          result.patch.sections[0].groups[2].point_queries.op_count,
          360000,
        );
        assert.equal(
          result.patch.sections[0].groups[2].range_queries.op_count,
          240000,
        );
        assert.equal(
          result.patch.sections[0].groups[2].range_queries.selectivity,
          0.1,
        );
      },
    },
    {
      name: "mixed read-write then analytics",
      prompt:
        "Create a three phase workload with a preload phase, then a mixed read/write phase, then a query-heavy analytics phase. Preload 2M inserts, then interleave 500k updates and 500k point queries, then interleave 800k point queries and 200k long range queries.",
      assertions(result) {
        assert.equal(
          result.patch.sections[0].groups[0].inserts.op_count,
          2000000,
        );
        assert.equal(
          result.patch.sections[0].groups[1].updates.op_count,
          500000,
        );
        assert.equal(
          result.patch.sections[0].groups[1].point_queries.op_count,
          500000,
        );
        assert.equal(
          result.patch.sections[0].groups[2].point_queries.op_count,
          800000,
        );
        assert.equal(
          result.patch.sections[0].groups[2].range_queries.op_count,
          200000,
        );
        assert.equal(
          result.patch.sections[0].groups[2].range_queries.selectivity,
          0.1,
        );
      },
    },
    {
      name: "write-only then short-range read phase",
      prompt:
        "Generate a three phase workload: first load the database with 5M inserts, next run a write-only phase for 1M operations, then run an interleaved read phase with 80% point queries and 20% short range queries for 2M operations.",
      assertions(result) {
        assert.equal(
          result.patch.sections[0].groups[0].inserts.op_count,
          5000000,
        );
        assert.equal(
          result.patch.sections[0].groups[1].updates.op_count,
          1000000,
        );
        assert.equal(
          result.patch.sections[0].groups[2].point_queries.op_count,
          1600000,
        );
        assert.equal(
          result.patch.sections[0].groups[2].range_queries.op_count,
          400000,
        );
        assert.equal(
          result.patch.sections[0].groups[2].range_queries.selectivity,
          0.001,
        );
      },
    },
    {
      name: "hot serving then broader scan",
      prompt:
        "I want three phases: seed the database, then a hot serving phase, then a broader scan phase. Preload 1M inserts, then interleave 80% point queries and 20% updates for 500k operations, then interleave 70% point queries and 30% long range queries for 300k operations.",
      assertions(result) {
        assert.equal(
          result.patch.sections[0].groups[0].inserts.op_count,
          1000000,
        );
        assert.equal(
          result.patch.sections[0].groups[1].point_queries.op_count,
          400000,
        );
        assert.equal(
          result.patch.sections[0].groups[1].updates.op_count,
          100000,
        );
        assert.equal(
          result.patch.sections[0].groups[2].point_queries.op_count,
          210000,
        );
        assert.equal(
          result.patch.sections[0].groups[2].range_queries.op_count,
          90000,
        );
        assert.equal(
          result.patch.sections[0].groups[2].range_queries.selectivity,
          0.1,
        );
      },
    },
    {
      name: "preload then explicit percentage mixes",
      prompt:
        "Make a three phase workload where we first preload the DB, then do an interleaved write-heavy phase, then do an interleaved read-heavy phase. Use 1M inserts, then 600k operations at 75% updates and 25% point queries, then 900k operations at 90% point queries and 10% range queries.",
      assertions(result) {
        assert.equal(
          result.patch.sections[0].groups[0].inserts.op_count,
          1000000,
        );
        assert.equal(
          result.patch.sections[0].groups[1].updates.op_count,
          450000,
        );
        assert.equal(
          result.patch.sections[0].groups[1].point_queries.op_count,
          150000,
        );
        assert.equal(
          result.patch.sections[0].groups[2].point_queries.op_count,
          810000,
        );
        assert.equal(
          result.patch.sections[0].groups[2].range_queries.op_count,
          90000,
        );
      },
    },
  ];

  for (const scenario of scenarios) {
    await t.test(scenario.name, () => {
      const result = applyPrompt({
        prompt: scenario.prompt,
        formState: createFormState({}),
        rawPatch: {
          operations: {},
        },
      });

      assert.equal(result.patch.sections.length, 1);
      assert.equal(result.patch.sections[0].groups.length, 3);
      scenario.assertions(result);
    });
  }
});

test("structured phased prompts suppress redundant section and group clarifications", () => {
  const result = applyPrompt({
    prompt:
      "Preload the DB with 1M inserts, then interleave 80% point queries and 20% updates for 500k operations.",
    formState: createFormState({}),
    rawPatch: {
      operations: {},
    },
    clarifications: [
      {
        id: "clarify.sections",
        text: "How many sections should be used?",
        required: true,
        binding: { type: "top_field", field: "sections_count" },
        input: "number",
      },
      {
        id: "clarify.groups",
        text: "How many groups should be used per section?",
        required: true,
        binding: { type: "top_field", field: "groups_per_section" },
        input: "number",
      },
    ],
  });

  assert.equal(result.clarifications.length, 0);
  assert.equal(result.patch.sections_count, 1);
  assert.equal(result.patch.groups_per_section, 2);
  assert.equal(result.patch.sections[0].groups[0].inserts.op_count, 1000000);
  assert.equal(
    result.patch.sections[0].groups[1].point_queries.op_count,
    400000,
  );
  assert.equal(result.patch.sections[0].groups[1].updates.op_count, 100000);
});

test("required operation clarifications suppress guessed operation patches for ambiguous prompts", () => {
  const formState = createFormState({
    inserts: createInsertSeed(),
  });
  const result = applyPrompt({
    prompt: "Add queries",
    formState,
    rawPatch: {
      operations: {
        point_queries: {
          enabled: true,
          op_count: 50000,
        },
      },
    },
    clarifications: [
      {
        id: "clarify.operations",
        text: "Which operations should be enabled?",
        required: true,
        binding: { type: "operations_set" },
        input: "multi_enum",
        options: ["point_queries", "range_queries"],
      },
    ],
  });

  assert.equal(result.clarifications.length, 1);
  assert.equal(result.clarifications[0].binding.type, "operations_set");
  assert.deepEqual(result.patch.operations, {});
  assert.equal(result.patch.clear_operations, false);
});

test("worker assist endpoint returns normalized patches for natural-language prompts", async () => {
  const request = new Request("https://example.com/api/assist", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      prompt: "Add 50k point querie",
      form_state: createFormState({
        inserts: createInsertSeed(),
      }),
      schema_hints: SCHEMA_HINTS,
      current_json: null,
      conversation: [],
      answers: {},
    }),
  });

  const response = await workerEntrypoint.fetch(request, {
    AI: {
      run: async () => ({
        response: JSON.stringify({
          summary: "Update the workload with 50k point queries.",
          patch: {
            operations: {
              empty_point_deletes: {
                enabled: true,
                op_count: 500000,
              },
            },
          },
          clarifications: [],
          assumptions: [],
        }),
      }),
    },
    ASSETS: {
      fetch: async () => new Response("not found", { status: 404 }),
    },
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(sortedKeys(body.patch.operations), ["point_queries"]);
  assert.equal(body.patch.operations.point_queries.enabled, true);
  assert.equal(body.patch.operations.point_queries.op_count, 50000);
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      body.patch.operations,
      "empty_point_deletes",
    ),
    false,
  );
});

test("worker assist endpoint returns structured patches for phased workload prompts", async () => {
  const request = new Request("https://example.com/api/assist", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      prompt:
        "Preload the DB with 1M inserts, then interleave 80% point queries and 20% updates for 500k operations",
      form_state: createFormState({}),
      schema_hints: SCHEMA_HINTS,
      current_json: null,
      conversation: [],
      answers: {},
    }),
  });

  let callCount = 0;
  const response = await workerEntrypoint.fetch(request, {
    AI: {
      run: async () => {
        callCount += 1;
        return {
          response: JSON.stringify({
            summary: "Create the workload.",
            patch: {
              clear_operations: false,
              sections: [
                {
                  groups: [
                    {
                      inserts: {
                        op_count: 1000000,
                      },
                    },
                    {
                      point_queries: {
                        op_count: 400000,
                        selection: {
                          uniform: {
                            min: 0,
                            max: 1,
                          },
                        },
                      },
                      updates: {
                        op_count: 100000,
                        selection: {
                          uniform: {
                            min: 0,
                            max: 1,
                          },
                        },
                        val: {
                          uniform: {
                            len: 1024,
                          },
                        },
                      },
                    },
                  ],
                },
              ],
            },
            clarifications: [],
            assumptions: [],
          }),
        };
      },
    },
    ASSETS: {
      fetch: async () => new Response("not found", { status: 404 }),
    },
  });

  assert.equal(callCount, 1);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.source, "ai");
  assert.equal(Array.isArray(body.patch.sections), true);
  assert.equal(body.patch.sections.length, 1);
  assert.equal(body.patch.sections[0].groups.length, 2);
  assert.equal(body.patch.sections[0].groups[0].inserts.op_count, 1000000);
  assert.equal(body.patch.sections[0].groups[1].point_queries.op_count, 400000);
  assert.equal(body.patch.sections[0].groups[1].updates.op_count, 100000);
});

test("worker assist endpoint defaults total count for fresh percentage-only workload mixes", async () => {
  const request = new Request("https://example.com/api/assist", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      prompt:
        "Create a workload consisting of 90% INSERT and 10% UPDATE operations with zero reads.",
      form_state: createFormState({}),
      schema_hints: SCHEMA_HINTS,
      current_json: null,
      conversation: [],
      answers: {},
    }),
  });

  const response = await workerEntrypoint.fetch(request, {
    ASSETS: {
      fetch: async () => new Response("not found", { status: 404 }),
    },
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.source, "deterministic");
  assert.equal(body.patch.sections_count, 1);
  assert.equal(body.patch.groups_per_section, 1);
  assert.deepEqual(
    sortedKeys(body.patch.sections[0].groups[0]),
    ["inserts", "updates"],
  );
  assert.equal(body.patch.sections[0].groups[0].inserts.op_count, 900000);
  assert.equal(body.patch.sections[0].groups[0].updates.op_count, 100000);
  assert.equal(
    body.assumption_texts.includes(
      "Assumed 1000000 total operations because the prompt specified percentages without an explicit total operation count.",
    ),
    true,
  );
});

test("worker assist endpoint maps GET to point queries in fresh percentage-only workload mixes", async () => {
  const request = new Request("https://example.com/api/assist", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      prompt:
        "Generate a balanced workload: 50% GET, 25% UPDATE, and 25% INSERT.",
      form_state: createFormState({}),
      schema_hints: SCHEMA_HINTS,
      current_json: null,
      conversation: [],
      answers: {},
    }),
  });

  const response = await workerEntrypoint.fetch(request, {
    ASSETS: {
      fetch: async () => new Response("not found", { status: 404 }),
    },
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.source, "deterministic");
  assert.equal(body.patch.sections_count, 1);
  assert.equal(body.patch.groups_per_section, 1);
  assert.deepEqual(
    sortedKeys(body.patch.sections[0].groups[0]),
    ["inserts", "point_queries", "updates"],
  );
  assert.equal(body.patch.sections[0].groups[0].point_queries.op_count, 500000);
  assert.equal(body.patch.sections[0].groups[0].updates.op_count, 250000);
  assert.equal(body.patch.sections[0].groups[0].inserts.op_count, 250000);
  assert.equal(
    body.assumption_texts.includes(
      "Assumed 1000000 total operations because the prompt specified percentages without an explicit total operation count.",
    ),
    true,
  );
});

test("worker assist endpoint preserves explicit beta distribution parameters in sequential fresh workloads", async () => {
  const request = new Request("https://example.com/api/assist", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      prompt:
        "Generate an insert-heavy workload with 1M writes followed by 100K point queries following a beta distribution with alpha as 0.5 and beta as 0.2.",
      form_state: createFormState({}),
      schema_hints: SCHEMA_HINTS,
      current_json: null,
      conversation: [],
      answers: {},
    }),
  });

  const response = await workerEntrypoint.fetch(request, {
    AI: {
      run: async () => ({
        response: JSON.stringify({
          summary: "Create the workload.",
          patch: {},
          clarifications: [],
          assumptions: [],
        }),
      }),
    },
    ASSETS: {
      fetch: async () => new Response("not found", { status: 404 }),
    },
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.source, "ai");
  assert.equal(body.patch.sections_count, 1);
  assert.equal(body.patch.groups_per_section, 2);
  assert.deepEqual(
    sortedKeys(body.patch.sections[0].groups[0]),
    ["inserts"],
  );
  assert.deepEqual(
    sortedKeys(body.patch.sections[0].groups[1]),
    ["point_queries"],
  );
  assert.equal(body.patch.sections[0].groups[0].inserts.op_count, 1000000);
  assert.equal(body.patch.sections[0].groups[1].point_queries.op_count, 100000);
  assert.deepEqual(body.patch.sections[0].groups[1].point_queries.selection, {
    beta: {
      alpha: 0.5,
      beta: 0.2,
    },
  });
});

test("worker assist endpoint falls back to deterministic phased parsing when AI output is truncated", async () => {
  const request = new Request("https://example.com/api/assist", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      prompt:
        "Preload the DB with 1M inserts, then interleave 80% point queries and 20% updates for 500k operations.",
      form_state: createFormState({}),
      schema_hints: SCHEMA_HINTS,
      current_json: null,
      conversation: [],
      answers: {},
    }),
  });

  let callCount = 0;
  const response = await workerEntrypoint.fetch(request, {
    AI: {
      run: async () => {
        callCount += 1;
        return {
          response:
            '{"summary":"Preload the DB with 1M inserts, then interleave 80% point queries and 20% updates for 500k operations.","patch":{"clear_operations":false,"operations":{"inserts":{"enabled":true,"op_count":1000000}}},"clarifications":[{"id":"clarify.sections"',
        };
      },
    },
    ASSETS: {
      fetch: async () => new Response("not found", { status: 404 }),
    },
  });

  assert.equal(callCount >= 1, true);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.source, "deterministic_fallback");
  assert.equal(Array.isArray(body.patch.sections), true);
  assert.equal(body.patch.sections.length, 1);
  assert.equal(body.patch.sections[0].groups.length, 2);
  assert.equal(body.patch.sections[0].groups[0].inserts.op_count, 1000000);
  assert.equal(body.patch.sections[0].groups[1].point_queries.op_count, 400000);
  assert.equal(body.patch.sections[0].groups[1].updates.op_count, 100000);
});

test("point query paraphrases normalize to the same operation patch", () => {
  const prompts = [
    "Add 50k point queries",
    "Include 50,000 point queries",
    "Use 50k point reads",
    "Please add 50k point querie",
  ];
  const formState = createFormState({
    inserts: createInsertSeed(),
  });

  prompts.forEach((prompt) => {
    const result = applyPrompt({
      prompt,
      formState,
      rawPatch: {
        operations: {
          empty_point_queries: {
            enabled: true,
            op_count: 999,
          },
        },
      },
    });

    assert.deepEqual(sortedKeys(result.patch.operations), ["point_queries"]);
    assert.equal(result.patch.operations.point_queries.enabled, true);
    assert.equal(result.patch.operations.point_queries.op_count, 50000);
  });
});

test("disable paraphrases normalize to the same remove patch", () => {
  const prompts = [
    "remove range deletes",
    "disable range deletes",
    "exclude range deletes",
    "without range deletes",
  ];
  const formState = createFormState({
    inserts: createInsertSeed(),
    range_deletes: createSelectionSeed("range_deletes"),
  });

  prompts.forEach((prompt) => {
    const result = applyPrompt({
      prompt,
      formState,
      rawPatch: {
        operations: {
          point_deletes: {
            enabled: true,
            op_count: 123,
          },
        },
      },
    });

    assert.deepEqual(sortedKeys(result.patch.operations), ["range_deletes"]);
    assert.equal(result.patch.operations.range_deletes.enabled, false);
  });
});

test("add prompts override mistaken disabled target operations from the model", () => {
  const formState = createFormState({
    inserts: createInsertSeed(),
  });
  const result = applyPrompt({
    prompt: "Add 50k range deletes",
    formState,
    rawPatch: {
      operations: {
        range_deletes: {
          enabled: false,
          op_count: 1,
        },
        empty_point_deletes: {
          enabled: true,
          op_count: 500000,
        },
      },
    },
  });

  assert.deepEqual(sortedKeys(result.patch.operations), ["range_deletes"]);
  assert.equal(result.patch.operations.range_deletes.enabled, true);
  assert.equal(result.patch.operations.range_deletes.op_count, 50000);
});
