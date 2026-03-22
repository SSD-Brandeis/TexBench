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

function createTwoGroupScopeState() {
  return createStructuredState([
    {
      inserts: {
        enabled: true,
        op_count: 1000000,
      },
    },
    {
      empty_point_queries: {
        enabled: true,
        op_count: 1000,
      },
      inserts: {
        enabled: true,
        op_count: 1000,
      },
      point_deletes: {
        enabled: true,
        op_count: 1000,
      },
    },
  ]);
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

test(
  "intent matrix: insert-only creation variants stay single-group inserts",
  { skip: !LIVE_PROVIDER.binding, timeout: 240000 },
  async () => {
    const prompts = [
      "Generate an insert-only workload with 250k inserts",
      "Generate a insert only workload with 250k inserts",
      "Generate a workload with 250k insert operations",
    ];

    for (const prompt of prompts) {
      const result = await requestLiveAssist({
        prompt,
        formState: createFormState({}),
        provider: LIVE_PROVIDER,
      });
      const state = applyPatchToState(createFormState({}), result.patch);

      assert.equal(state.sections_count, 1, prompt);
      assert.equal(state.groups_per_section, 1, prompt);
      assert.deepEqual(
        configuredOperations(state.sections[0].groups[0]),
        ["inserts"],
        prompt,
      );
      assert.equal(state.operations.inserts.enabled, true, prompt);
      assert.equal(state.operations.inserts.op_count, 250000, prompt);
    }
  },
);

test(
  "intent matrix: later-phase paraphrases append a second group",
  { skip: !LIVE_PROVIDER.binding, timeout: 240000 },
  async () => {
    const prompts = [
      "then add a second phase with 5k point queries",
      "add a later phase with 5k point queries",
      "next phase should run 5k point queries",
    ];

    for (const prompt of prompts) {
      let state = createInsertOnlyState();
      let conversation = [];

      const result = await applyAssistTurn({
        prompt,
        state,
        conversation,
      });
      state = result.nextState;

      assert.equal(state.sections_count, 1, prompt);
      assert.equal(state.groups_per_section, 2, prompt);
      assert.deepEqual(
        configuredOperations(state.sections[0].groups[0]),
        ["inserts"],
        prompt,
      );
      assert.deepEqual(
        configuredOperations(state.sections[0].groups[1]),
        ["point_queries"],
        prompt,
      );
      assert.equal(state.sections[0].groups[0].inserts.op_count, 250000, prompt);
      assert.equal(
        state.sections[0].groups[1].point_queries.op_count,
        5000,
        prompt,
      );
    }
  },
);

test(
  "intent matrix: in-place query refinements never append layout",
  { skip: !LIVE_PROVIDER.binding, timeout: 240000 },
  async () => {
    const prompts = [
      "change point queries distribution to normal",
      "make the point queries use a normal distribution",
      "use normal distribution for point queries",
    ];

    for (const prompt of prompts) {
      let state = createInterleavedInsertQueryState();
      let conversation = [];

      const result = await applyAssistTurn({
        prompt,
        state,
        conversation,
      });
      state = result.nextState;

      assert.equal(state.sections_count, 1, prompt);
      assert.equal(state.groups_per_section, 1, prompt);
      assert.deepEqual(
        configuredOperations(state.sections[0].groups[0]),
        ["inserts", "point_queries"],
        prompt,
      );
      assert.equal(
        state.sections[0].groups[0].point_queries.selection_distribution,
        "normal",
        prompt,
      );
    }
  },
);

test(
  "intent matrix: targeted add-op paraphrases only mutate the referenced first group",
  { skip: !LIVE_PROVIDER.binding, timeout: 240000 },
  async () => {
    const prompts = [
      "Add updates to group 1",
      "In group 1, add updates",
      "Put updates in the first group",
    ];

    for (const prompt of prompts) {
      let state = createTwoGroupScopeState();
      let conversation = [];

      const result = await applyAssistTurn({
        prompt,
        state,
        conversation,
      });
      state = result.nextState;

      assert.equal(state.sections_count, 1, prompt);
      assert.equal(state.groups_per_section, 2, prompt);
      assert.deepEqual(
        configuredOperations(state.sections[0].groups[0]),
        ["inserts", "updates"],
        prompt,
      );
      assert.deepEqual(
        configuredOperations(state.sections[0].groups[1]),
        ["empty_point_queries", "inserts", "point_deletes"],
        prompt,
      );
    }
  },
);

test(
  "intent matrix: targeted rename paraphrases only rewrite the referenced second group",
  { skip: !LIVE_PROVIDER.binding, timeout: 240000 },
  async () => {
    const prompts = [
      "Change updates in group 2 to merges",
      "Convert the second group's updates into merges",
      "In group 2, replace updates with merges",
    ];

    for (const prompt of prompts) {
      let state = createTwoGroupWriteDeleteState();
      let conversation = [];

      const result = await applyAssistTurn({
        prompt,
        state,
        conversation,
      });
      state = result.nextState;

      assert.equal(state.sections_count, 1, prompt);
      assert.equal(state.groups_per_section, 2, prompt);
      assert.deepEqual(
        configuredOperations(state.sections[0].groups[0]),
        ["inserts"],
        prompt,
      );
      assert.deepEqual(
        configuredOperations(state.sections[0].groups[1]),
        ["merges", "range_deletes"],
        prompt,
      );
      assert.equal(state.sections[0].groups[1].updates, undefined, prompt);
    }
  },
);

test(
  "intent matrix: explicit delete-group append paraphrases append a second group",
  { skip: !LIVE_PROVIDER.binding, timeout: 240000 },
  async () => {
    const prompts = [
      "Add another group with all deletes",
      "Create a new group with all deletes",
      "Append a next group with all deletes",
    ];

    for (const prompt of prompts) {
      let state = createInterleavedInsertQueryState();
      let conversation = [];

      const result = await applyAssistTurn({
        prompt,
        state,
        conversation,
        answers: {
          clarify_delete_ops: [
            "point_deletes",
            "range_deletes",
            "empty_point_deletes",
          ],
        },
      });
      state = result.nextState;

      assert.equal(state.sections_count, 1, prompt);
      assert.equal(state.groups_per_section, 2, prompt);
      assert.deepEqual(
        configuredOperations(state.sections[0].groups[0]),
        ["inserts", "point_queries"],
        prompt,
      );
      assert.deepEqual(
        configuredOperations(state.sections[0].groups[1]),
        ["empty_point_deletes", "point_deletes", "range_deletes"],
        prompt,
      );
    }
  },
);
