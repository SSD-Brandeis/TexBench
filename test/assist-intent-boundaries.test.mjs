import assert from "node:assert/strict";
import test from "node:test";

import { __test } from "../src/index.js";
import {
  SCHEMA_HINTS,
  applyPatchToState,
  configuredOperations,
  createFormState,
  getSelectedProviderConfig,
  requestLiveAssist,
} from "./live-assist-test-helpers.mjs";

const LIVE_PROVIDER = getSelectedProviderConfig();
const NORMALIZED_SCHEMA_HINTS = __test.normalizeSchemaHints(SCHEMA_HINTS);

function buildCurrentJson(state) {
  if (
    !state ||
    !Array.isArray(state.sections) ||
    !state.sections.some(
      (section) =>
        section &&
        Array.isArray(section.groups) &&
        section.groups.some((group) => group && Object.keys(group).length > 0),
    )
  ) {
    return null;
  }
  return {
    character_set: state.character_set,
    sections: JSON.parse(JSON.stringify(state.sections)),
  };
}

function appendConversation(conversation, prompt, result) {
  return [
    ...conversation,
    { role: "user", text: prompt },
    { role: "assistant", text: result.summary || "" },
  ];
}

async function applyAssistTurn({ prompt, state, conversation, answers = {} }) {
  const result = await requestLiveAssist({
    prompt,
    formState: state,
    currentJson: buildCurrentJson(state),
    conversation,
    answers,
    provider: LIVE_PROVIDER,
  });
  return {
    result,
    nextState: applyPatchToState(state, result.patch),
    nextConversation: appendConversation(conversation, prompt, result),
  };
}

function createStructuredState(groups) {
  return applyPatchToState(createFormState({}), {
    sections: [
      {
        character_set: "alphanumeric",
        skip_key_contains_check: true,
        groups,
      },
    ],
    sections_count: 1,
    groups_per_section: groups.length,
    clear_operations: false,
    operations: {},
  });
}

function createFlatState(
  operations,
  {
    characterSet = "alphanumeric",
    sectionsCount = 1,
    groupsPerSection = 1,
    skipKeyContainsCheck = true,
  } = {},
) {
  return {
    ...createFormState({}),
    character_set: characterSet,
    sections_count: sectionsCount,
    groups_per_section: groupsPerSection,
    skip_key_contains_check: skipKeyContainsCheck,
    sections: [],
    operations: JSON.parse(JSON.stringify(operations)),
  };
}

function createInsertOnlyState(count = 250000) {
  return createStructuredState([
    {
      inserts: {
        enabled: true,
        op_count: count,
      },
    },
  ]);
}

function createInterleavedInsertQueryState() {
  return createStructuredState([
    {
      inserts: {
        enabled: true,
        op_count: 250000,
      },
      point_queries: {
        enabled: true,
        op_count: 5000,
      },
    },
  ]);
}

function createFlatInterleavedInsertQueryState() {
  return createFlatState({
    inserts: {
      enabled: true,
      op_count: 250000,
    },
    point_queries: {
      enabled: true,
      op_count: 5000,
    },
  });
}

function createTwoGroupWriteDeleteState() {
  return createStructuredState([
    {
      inserts: {
        enabled: true,
        op_count: 250000,
      },
    },
    {
      updates: {
        enabled: true,
        op_count: 5000,
      },
      range_deletes: {
        enabled: true,
        op_count: 5000,
      },
    },
  ]);
}

function applyNormalizedPrompt({
  prompt,
  state,
  rawPatch = {},
  rawProgram = null,
}) {
  const normalized = __test.normalizeAssistPayload(
    {
      summary: "Applied prompt.",
      patch: rawPatch,
      ...(Array.isArray(rawProgram) ? { program: rawProgram } : {}),
      clarifications: [],
      assumptions: [],
    },
    NORMALIZED_SCHEMA_HINTS,
    state,
    prompt,
  );
  return applyPatchToState(state, normalized.patch);
}

function canonicalGroupProjection(group) {
  const operationNames = configuredOperations(group);
  const counts = Object.fromEntries(
    operationNames.map((operationName) => [
      operationName,
      group[operationName]?.op_count ?? null,
    ]),
  );
  const distributions = Object.fromEntries(
    operationNames
      .filter(
        (operationName) =>
          typeof group[operationName]?.selection_distribution === "string",
      )
      .map((operationName) => [
        operationName,
        group[operationName].selection_distribution,
      ]),
  );
  return {
    operations: operationNames,
    counts,
    distributions,
  };
}

test(
  "intent boundaries: flat-only and structured one-group states stay semantically aligned",
  { skip: !LIVE_PROVIDER.binding, timeout: 240000 },
  async () => {
    const prompt = "change point queries distribution to normal";
    const scenarios = [
      {
        label: "structured",
        state: createInterleavedInsertQueryState(),
      },
      {
        label: "flat-only",
        state: createFlatInterleavedInsertQueryState(),
      },
    ];
    const projections = [];

    for (const scenario of scenarios) {
      const turn = await applyAssistTurn({
        prompt,
        state: scenario.state,
        conversation: [],
      });
      const nextState = turn.nextState;

      assert.equal(nextState.sections_count, 1, scenario.label);
      assert.equal(nextState.groups_per_section, 1, scenario.label);
      assert.equal(
        nextState.operations.point_queries.selection_distribution,
        "normal",
        scenario.label,
      );
      assert.equal(
        nextState.sections[0].groups[0].point_queries.selection_distribution,
        "normal",
        scenario.label,
      );
      projections.push(canonicalGroupProjection(nextState.sections[0].groups[0]));
    }

    assert.deepEqual(projections[0], projections[1]);
  },
);

test(
  "intent boundaries: append and edit paraphrases stay separated",
  { skip: !LIVE_PROVIDER.binding, timeout: 240000 },
  async () => {
    const appendTurn = await applyAssistTurn({
      prompt:
        "Put point deletes, range deletes, and empty point deletes into a second group",
      state: createInsertOnlyState(),
      conversation: [],
    });
    const appendState = appendTurn.nextState;

    assert.equal(appendState.sections_count, 1);
    assert.equal(appendState.groups_per_section, 2);
    assert.deepEqual(
      configuredOperations(appendState.sections[0].groups[0]),
      ["inserts"],
    );
    assert.deepEqual(
      configuredOperations(appendState.sections[0].groups[1]),
      ["empty_point_deletes", "point_deletes", "range_deletes"],
    );

    const editTurn = await applyAssistTurn({
      prompt: "Convert the second group's updates into merges",
      state: createTwoGroupWriteDeleteState(),
      conversation: [],
    });
    const editState = editTurn.nextState;

    assert.equal(editState.sections_count, 1);
    assert.equal(editState.groups_per_section, 2);
    assert.deepEqual(
      configuredOperations(editState.sections[0].groups[0]),
      ["inserts"],
    );
    assert.deepEqual(
      configuredOperations(editState.sections[0].groups[1]),
      ["merges", "range_deletes"],
    );
  },
);

test("intent boundaries: one-group refinements project into structured state", () => {
  const formState = createInterleavedInsertQueryState();
  const effective = __test.buildEffectiveState(
    {
      clear_operations: false,
      operations: {
        point_queries: {
          enabled: true,
          selection_distribution: "normal",
        },
      },
    },
    formState,
    NORMALIZED_SCHEMA_HINTS,
  );

  assert.equal(effective.sections_count, 1);
  assert.equal(effective.groups_per_section, 1);
  assert.equal(effective.operations.point_queries.selection_distribution, "normal");
  assert.equal(
    effective.sections[0].groups[0].point_queries.selection_distribution,
    "normal",
  );
});

test("intent boundaries: an explicitly named next phase appends repeated inserts", () => {
  const formState = createStructuredState([
    {
      inserts: {
        enabled: true,
        op_count: 1000000,
      },
    },
    {
      point_queries: {
        enabled: true,
        op_count: 10000,
      },
    },
  ]);

  const nextState = applyNormalizedPrompt({
    prompt: "Add another 1M inserts in the 3rd phase",
    state: formState,
    rawProgram: [
      {
        kind: "set_operation_fields",
        operation: "inserts",
        fields: [
          {
            field: "op_count",
            number_value: 1000000,
          },
        ],
      },
    ],
  });

  assert.equal(nextState.groups_per_section, 3);
  assert.deepEqual(configuredOperations(nextState.sections[0].groups[0]), [
    "inserts",
  ]);
  assert.deepEqual(configuredOperations(nextState.sections[0].groups[1]), [
    "point_queries",
  ]);
  assert.deepEqual(configuredOperations(nextState.sections[0].groups[2]), [
    "inserts",
  ]);
  assert.equal(nextState.sections[0].groups[2].inserts.op_count, 1000000);
});

test("intent boundaries: an empty model-created phase infers inserts from counted entries", () => {
  const formState = createStructuredState([
    {
      inserts: {
        enabled: true,
        op_count: 1000000,
      },
    },
    {
      inserts: {
        enabled: true,
        op_count: 1000000,
      },
      point_queries: {
        enabled: true,
        op_count: 10000,
      },
    },
  ]);

  const nextState = applyNormalizedPrompt({
    prompt: "Add a new phase with 2M entries at the end.",
    state: formState,
    rawPatch: {
      sections: [
        {
          groups: [
            { inserts: { op_count: 1000000 } },
            {
              inserts: { op_count: 2000000 },
              point_queries: { op_count: 10000 },
            },
            { name: "Group 3" },
          ],
        },
      ],
      operations: {},
    },
  });

  assert.equal(nextState.groups_per_section, 3);
  assert.deepEqual(configuredOperations(nextState.sections[0].groups[2]), [
    "inserts",
  ]);
  assert.equal(nextState.sections[0].groups[1].inserts.op_count, 1000000);
  assert.equal(nextState.sections[0].groups[2].inserts.op_count, 2000000);
});

test("intent boundaries: unique matching multi-group refinements project without changing layout", () => {
  const formState = createStructuredState([
    {
      inserts: {
        enabled: true,
        op_count: 250000,
      },
    },
    {
      point_queries: {
        enabled: true,
        op_count: 5000,
      },
    },
  ]);
  const effective = __test.buildEffectiveState(
    {
      clear_operations: false,
      operations: {
        point_queries: {
          enabled: true,
          selection_distribution: "normal",
        },
      },
    },
    formState,
    NORMALIZED_SCHEMA_HINTS,
  );

  assert.equal(effective.sections_count, 1);
  assert.equal(effective.groups_per_section, 2);
  assert.deepEqual(configuredOperations(effective.sections[0].groups[0]), ["inserts"]);
  assert.deepEqual(
    configuredOperations(effective.sections[0].groups[1]),
    ["point_queries"],
  );
  assert.equal(
    effective.sections[0].groups[1].point_queries.selection_distribution,
    "normal",
  );
});

test("intent boundaries: phase-targeted distribution edits stay in the addressed phase", () => {
  const formState = createStructuredState([
    {
      inserts: {
        enabled: true,
        op_count: 1000,
      },
    },
    {
      point_queries: {
        enabled: true,
        op_count: 5000,
        selection_distribution: "uniform",
        selection_min: 0,
        selection_max: 1,
      },
    },
  ]);
  const nextState = applyNormalizedPrompt({
    prompt: "Change phase 2 point queries distribution to zipf",
    state: formState,
    rawPatch: {
      operations: {
        point_queries: {
          enabled: true,
          op_count: 500000,
          selection_distribution: "zipf",
          selection_n: 1000000,
          selection_s: 1.5,
        },
      },
    },
  });

  assert.equal(nextState.sections_count, 1);
  assert.equal(nextState.groups_per_section, 2);
  assert.deepEqual(configuredOperations(nextState.sections[0].groups[0]), ["inserts"]);
  assert.deepEqual(
    configuredOperations(nextState.sections[0].groups[1]),
    ["point_queries"],
  );
  assert.equal(nextState.sections[0].groups[0].inserts.op_count, 1000);
  assert.equal(nextState.sections[0].groups[1].point_queries.op_count, 5000);
  assert.equal(
    nextState.sections[0].groups[1].point_queries.selection_distribution,
    "zipf",
  );
  assert.equal(
    nextState.sections[0].groups[1].point_queries.selection_n,
    1000000,
  );
  assert.equal(
    nextState.sections[0].groups[1].point_queries.selection_s,
    1.5,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      nextState.sections[0].groups[0],
      "point_queries",
    ),
    false,
  );
});

test("intent boundaries: phase-targeted distribution edits still work when the AI patch is sparse", () => {
  const formState = createStructuredState([
    {
      inserts: {
        enabled: true,
        op_count: 1000,
      },
    },
    {
      point_queries: {
        enabled: true,
        op_count: 5000,
        selection_distribution: "uniform",
        selection_min: 0,
        selection_max: 1,
      },
    },
  ]);
  const nextState = applyNormalizedPrompt({
    prompt: "Change phase 2 point queries distribution to normal",
    state: formState,
    rawPatch: {
      operations: {
        point_queries: {
          enabled: true,
        },
      },
    },
  });

  assert.equal(nextState.sections_count, 1);
  assert.equal(nextState.groups_per_section, 2);
  assert.deepEqual(configuredOperations(nextState.sections[0].groups[0]), ["inserts"]);
  assert.deepEqual(
    configuredOperations(nextState.sections[0].groups[1]),
    ["point_queries"],
  );
  assert.equal(nextState.sections[0].groups[1].point_queries.op_count, 5000);
  assert.equal(
    nextState.sections[0].groups[1].point_queries.selection_distribution,
    "normal",
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      nextState.sections[0].groups[0],
      "point_queries",
    ),
    false,
  );
});

test("intent boundaries: targeted structural commands do not overreach unrelated groups", () => {
  const formState = createTwoGroupWriteDeleteState();
  const patch = __test.patchFromAssistProgram(
    [
      {
        kind: "rename_group_operation",
        section_index: 1,
        group_index: 2,
        from_operation: "updates",
        to_operation: "merges",
      },
    ],
    NORMALIZED_SCHEMA_HINTS,
    formState,
  );
  const effective = __test.buildEffectiveState(
    patch,
    formState,
    NORMALIZED_SCHEMA_HINTS,
  );

  assert.equal(effective.sections_count, 1);
  assert.equal(effective.groups_per_section, 2);
  assert.deepEqual(configuredOperations(effective.sections[0].groups[0]), ["inserts"]);
  assert.deepEqual(
    configuredOperations(effective.sections[0].groups[1]),
    ["merges", "range_deletes"],
  );
  assert.equal(effective.sections[0].groups[0].inserts.op_count, 250000);
  assert.equal(effective.sections[0].groups[1].range_deletes.op_count, 5000);
});

test(
  "intent boundaries: paraphrase-equivalent later-phase prompts converge to the same layout",
  { skip: !LIVE_PROVIDER.binding, timeout: 240000 },
  async () => {
    const prompts = [
      "then add a second phase with 5k point queries",
      "add a later phase with 5k point queries",
      "next phase should run 5k point queries",
    ];
    const projections = [];

    for (const prompt of prompts) {
      const turn = await applyAssistTurn({
        prompt,
        state: createInsertOnlyState(),
        conversation: [],
      });
      const nextState = turn.nextState;

      assert.equal(nextState.sections_count, 1, prompt);
      assert.equal(nextState.groups_per_section, 2, prompt);
      projections.push(
        nextState.sections[0].groups.map((group) => canonicalGroupProjection(group)),
      );
    }

    assert.deepEqual(projections[0], projections[1]);
    assert.deepEqual(projections[1], projections[2]);
  },
);

test("intent boundaries: DSL structural commands conform to interpreter semantics", () => {
  const formState = createInsertOnlyState();
  const patch = __test.patchFromAssistProgram(
    [
      {
        kind: "append_group",
        section_index: 1,
        group: {
          point_queries: {
            enabled: true,
            op_count: 5000,
          },
        },
      },
      {
        kind: "set_group_operation_fields",
        section_index: 1,
        group_index: 2,
        operation: "point_queries",
        fields: [
          {
            field: "selection_distribution",
            string_value: "normal",
          },
        ],
      },
    ],
    NORMALIZED_SCHEMA_HINTS,
    formState,
  );
  const effective = __test.buildEffectiveState(
    patch,
    formState,
    NORMALIZED_SCHEMA_HINTS,
  );

  assert.equal(effective.sections_count, 1);
  assert.equal(effective.groups_per_section, 2);
  assert.deepEqual(configuredOperations(effective.sections[0].groups[0]), ["inserts"]);
  assert.deepEqual(
    configuredOperations(effective.sections[0].groups[1]),
    ["point_queries"],
  );
  assert.equal(effective.sections[0].groups[1].point_queries.op_count, 5000);
  assert.equal(
    effective.sections[0].groups[1].point_queries.selection_distribution,
    "normal",
  );
});

test("intent boundaries: scale_all_op_counts preserves layout while scaling counts", () => {
  const formState = createStructuredState([
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
      },
      inserts: {
        enabled: true,
        op_count: 50000,
      },
    },
  ]);
  assert.equal(formState.sections[0].groups[0].inserts.op_count, 1000000);
  assert.equal(formState.sections[0].groups[1].range_queries.op_count, 950000);
  assert.equal(formState.sections[0].groups[1].inserts.op_count, 50000);
  const patch = __test.patchFromAssistProgram(
    [{ kind: "scale_all_op_counts", factor: 0.1 }],
    NORMALIZED_SCHEMA_HINTS,
    formState,
  );
  const effective = __test.buildEffectiveState(
    patch,
    formState,
    NORMALIZED_SCHEMA_HINTS,
  );

  assert.equal(effective.sections_count, 1);
  assert.equal(effective.groups_per_section, 2);
  assert.equal(effective.sections[0].groups[0].inserts.op_count, 100000);
  assert.equal(effective.sections[0].groups[1].range_queries.op_count, 95000);
  assert.equal(effective.sections[0].groups[1].inserts.op_count, 5000);
});

test("intent boundaries: set_range_scan_length converts fixed length into selectivity", () => {
  const formState = createStructuredState([
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
      },
      inserts: {
        enabled: true,
        op_count: 50000,
      },
    },
  ]);
  assert.equal(formState.sections[0].groups[1].range_queries.selectivity, 0.001);
  assert.notEqual(
    formState.sections[0].groups[1].range_queries.selectivity,
    100 / 1000000,
  );
  const patch = __test.patchFromAssistProgram(
    [
      {
        kind: "set_range_scan_length",
        operation: "range_queries",
        section_index: 1,
        group_index: 2,
        scan_length: 100,
      },
    ],
    NORMALIZED_SCHEMA_HINTS,
    formState,
  );
  const effective = __test.buildEffectiveState(
    patch,
    formState,
    NORMALIZED_SCHEMA_HINTS,
  );

  assert.equal(effective.sections_count, 1);
  assert.equal(effective.groups_per_section, 2);
  assert.equal(
    effective.sections[0].groups[1].range_queries.range_format,
    "StartCount",
  );
  assert.equal(
    effective.sections[0].groups[1].range_queries.selectivity,
    100 / 1000000,
  );
});
