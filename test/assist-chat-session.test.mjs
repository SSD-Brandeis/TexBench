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
        section.groups.some(
          (group) => group && Object.keys(group).length > 0,
        ),
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

test(
  "continuous chat session: generate, update, then refine query behavior with assumptions",
  { skip: !LIVE_PROVIDER.binding, timeout: 240000 },
  async () => {
    let state = createFormState({});
    let conversation = [];

    const first = await applyAssistTurn({
      prompt: "Generate an insert-only workload with 250k inserts",
      state,
      conversation,
    });
    state = first.nextState;
    conversation = first.nextConversation;

    const second = await applyAssistTurn({
      prompt: "interleave 5k point queries with the inserts",
      state,
      conversation,
    });
    state = second.nextState;
    conversation = second.nextConversation;

    const third = await applyAssistTurn({
      prompt: "change point queries distribution to normal",
      state,
      conversation,
    });
    state = third.nextState;
    conversation = third.nextConversation;

    assert.equal(conversation.length, 6);
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
    assert.equal(
      state.operations.point_queries.selection_distribution,
      "normal",
    );
    assert.equal(typeof state.operations.point_queries.selection_mean, "number");
    assert.equal(
      typeof state.operations.point_queries.selection_std_dev,
      "number",
    );
    assert.ok(
      third.result.assumptions.some((entry) =>
        String(entry && entry.text ? entry.text : "")
          .toLowerCase()
          .includes("normal"),
      ),
    );

    const finalJson = buildCurrentJson(state);
    assert.ok(finalJson);
    assert.equal(finalJson.sections.length, 1);
    assert.deepEqual(
      configuredOperations(finalJson.sections[0].groups[0]),
      ["inserts", "point_queries"],
    );
  },
);

test(
  "continuous chat session: generate workload then append a later phase",
  { skip: !LIVE_PROVIDER.binding, timeout: 180000 },
  async () => {
    let state = createFormState({});
    let conversation = [];

    const first = await applyAssistTurn({
      prompt: "Generate an insert-only workload with 250k inserts",
      state,
      conversation,
    });
    state = first.nextState;
    conversation = first.nextConversation;

    const second = await applyAssistTurn({
      prompt: "then add a second phase with 5k point queries",
      state,
      conversation,
    });
    state = second.nextState;

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

    const finalJson = buildCurrentJson(state);
    assert.ok(finalJson);
    assert.equal(finalJson.sections[0].groups.length, 2);
  },
);

test(
  "continuous chat session: append another group after an interleaved group",
  { skip: !LIVE_PROVIDER.binding, timeout: 240000 },
  async () => {
    let state = createFormState({});
    let conversation = [];

    const first = await applyAssistTurn({
      prompt: "Generate a insert only workload with 1 million entries",
      state,
      conversation,
    });
    state = first.nextState;
    conversation = first.nextConversation;

    const second = await applyAssistTurn({
      prompt: "Add 5k point queries",
      state,
      conversation,
    });
    state = second.nextState;
    conversation = second.nextConversation;

    const third = await requestLiveAssist({
      prompt: "Add another group with all deletes",
      formState: state,
      currentJson: buildCurrentJson(state),
      conversation,
      answers: {
        clarify_delete_ops: [
          "point_deletes",
          "range_deletes",
          "empty_point_deletes",
        ],
      },
      provider: LIVE_PROVIDER,
    });
    state = applyPatchToState(state, third.patch);

    assert.equal(state.sections_count, 1);
    assert.equal(state.groups_per_section, 2);
    assert.deepEqual(
      configuredOperations(state.sections[0].groups[0]),
      ["inserts", "point_queries"],
    );
    assert.deepEqual(
      configuredOperations(state.sections[0].groups[1]),
      ["empty_point_deletes", "point_deletes", "range_deletes"],
    );
    assert.equal(state.sections[0].groups[0].inserts.op_count, 1000000);
    assert.equal(state.sections[0].groups[0].point_queries.op_count, 5000);
  },
);

test(
  "continuous chat session: append a second group after an interleaved group",
  { skip: !LIVE_PROVIDER.binding, timeout: 240000 },
  async () => {
    let state = createFormState({});
    let conversation = [];

    const first = await applyAssistTurn({
      prompt: "Generate a insert only workload with 1 million entries",
      state,
      conversation,
    });
    state = first.nextState;
    conversation = first.nextConversation;

    const second = await applyAssistTurn({
      prompt: "Add 5k point queries",
      state,
      conversation,
    });
    state = second.nextState;
    conversation = second.nextConversation;

    const third = await requestLiveAssist({
      prompt: "Add a second group with all deletes",
      formState: state,
      currentJson: buildCurrentJson(state),
      conversation,
      answers: {
        clarify_delete_ops: [
          "point_deletes",
          "range_deletes",
          "empty_point_deletes",
        ],
      },
      provider: LIVE_PROVIDER,
    });
    state = applyPatchToState(state, third.patch);

    assert.equal(state.sections_count, 1);
    assert.equal(state.groups_per_section, 2);
    assert.deepEqual(
      configuredOperations(state.sections[0].groups[1]),
      ["empty_point_deletes", "point_deletes", "range_deletes"],
    );
  },
);

test(
  "continuous chat session: append a third group after a second phase exists",
  { skip: !LIVE_PROVIDER.binding, timeout: 240000 },
  async () => {
    let state = createFormState({});
    let conversation = [];

    const first = await applyAssistTurn({
      prompt: "Generate an insert-only workload with 250k inserts",
      state,
      conversation,
    });
    state = first.nextState;
    conversation = first.nextConversation;

    const second = await applyAssistTurn({
      prompt: "then add a second phase with 5k point queries",
      state,
      conversation,
    });
    state = second.nextState;
    conversation = second.nextConversation;

    const third = await requestLiveAssist({
      prompt: "Add a third group with all deletes",
      formState: state,
      currentJson: buildCurrentJson(state),
      conversation,
      answers: {
        clarify_delete_ops: [
          "point_deletes",
          "range_deletes",
          "empty_point_deletes",
        ],
      },
      provider: LIVE_PROVIDER,
    });
    state = applyPatchToState(state, third.patch);

    assert.equal(state.sections_count, 1);
    assert.equal(state.groups_per_section, 3);
    assert.deepEqual(
      configuredOperations(state.sections[0].groups[0]),
      ["inserts"],
    );
    assert.deepEqual(
      configuredOperations(state.sections[0].groups[1]),
      ["point_queries"],
    );
    assert.deepEqual(
      configuredOperations(state.sections[0].groups[2]),
      ["empty_point_deletes", "point_deletes", "range_deletes"],
    );
  },
);

test(
  "continuous chat session: change one operation into another inside group 2",
  { skip: !LIVE_PROVIDER.binding, timeout: 240000 },
  async () => {
    let state = createFormState({});
    let conversation = [];

    const first = await applyAssistTurn({
      prompt: "Generate an insert-only workload with 250k inserts",
      state,
      conversation,
    });
    state = first.nextState;
    conversation = first.nextConversation;

    const second = await applyAssistTurn({
      prompt:
        "then add a second phase with 5k updates and 5k range deletes",
      state,
      conversation,
    });
    state = second.nextState;
    conversation = second.nextConversation;

    const third = await applyAssistTurn({
      prompt: "Change updates in group 2 to merges",
      state,
      conversation,
    });
    state = third.nextState;

    assert.equal(state.sections_count, 1);
    assert.equal(state.groups_per_section, 2);
    assert.deepEqual(
      configuredOperations(state.sections[0].groups[0]),
      ["inserts"],
    );
    assert.deepEqual(
      configuredOperations(state.sections[0].groups[1]),
      ["merges", "range_deletes"],
    );
    assert.equal(
      state.sections[0].groups[1].merges.op_count,
      5000,
    );
    assert.equal(
      state.sections[0].groups[1].range_deletes.op_count,
      5000,
    );
    assert.equal(state.sections[0].groups[1].updates, undefined);
    assert.ok(
      third.result.assumptions.every(
        (entry) =>
          !String(entry && entry.text ? entry.text : "")
            .toLowerCase()
            .includes("group 1"),
      ),
    );
  },
);

test(
  "continuous chat session: add updates to group 1 without mutating group 2",
  { skip: !LIVE_PROVIDER.binding, timeout: 240000 },
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
          ],
        },
      ],
      sections_count: 1,
      groups_per_section: 2,
      clear_operations: false,
      operations: {},
    });
    let conversation = [];

    const turn = await applyAssistTurn({
      prompt: "Add updates to group 1",
      state,
      conversation,
    });
    state = turn.nextState;

    assert.equal(state.sections_count, 1);
    assert.equal(state.groups_per_section, 2);
    assert.deepEqual(
      configuredOperations(state.sections[0].groups[0]),
      ["inserts", "updates"],
    );
    assert.deepEqual(
      configuredOperations(state.sections[0].groups[1]),
      ["empty_point_queries", "inserts", "point_deletes"],
    );
  },
);

test(
  "continuous chat session: repeated edits to the same interleaved group compose cleanly",
  { skip: !LIVE_PROVIDER.binding, timeout: 240000 },
  async () => {
    let state = createFormState({});
    let conversation = [];

    const first = await applyAssistTurn({
      prompt: "Generate an insert-only workload with 250k inserts",
      state,
      conversation,
    });
    state = first.nextState;
    conversation = first.nextConversation;

    const second = await applyAssistTurn({
      prompt: "interleave 5k point queries with the inserts",
      state,
      conversation,
    });
    state = second.nextState;
    conversation = second.nextConversation;

    const third = await applyAssistTurn({
      prompt: "change point queries distribution to normal",
      state,
      conversation,
    });
    state = third.nextState;
    conversation = third.nextConversation;

    const fourth = await applyAssistTurn({
      prompt: "Add updates to group 1",
      state,
      conversation,
    });
    state = fourth.nextState;

    assert.equal(state.sections_count, 1);
    assert.equal(state.groups_per_section, 1);
    assert.deepEqual(
      configuredOperations(state.sections[0].groups[0]),
      ["inserts", "point_queries", "updates"],
    );
    assert.equal(state.sections[0].groups[0].inserts.op_count, 250000);
    assert.equal(state.sections[0].groups[0].point_queries.op_count, 5000);
    assert.equal(
      state.sections[0].groups[0].point_queries.selection_distribution,
      "normal",
    );
    assert.ok(state.sections[0].groups[0].updates);
    assert.equal(state.operations.updates.enabled, true);
  },
);

test(
  "continuous chat session: repeated edits to group 2 preserve layout and prior changes",
  { skip: !LIVE_PROVIDER.binding, timeout: 240000 },
  async () => {
    let state = createFormState({});
    let conversation = [];

    const first = await applyAssistTurn({
      prompt: "Generate an insert-only workload with 250k inserts",
      state,
      conversation,
    });
    state = first.nextState;
    conversation = first.nextConversation;

    const second = await applyAssistTurn({
      prompt: "then add a second phase with 5k updates and 5k range deletes",
      state,
      conversation,
    });
    state = second.nextState;
    conversation = second.nextConversation;

    const third = await applyAssistTurn({
      prompt: "Change updates in group 2 to merges",
      state,
      conversation,
    });
    state = third.nextState;
    conversation = third.nextConversation;

    const fourth = await applyAssistTurn({
      prompt: "Change range deletes in group 2 to point deletes",
      state,
      conversation,
    });
    state = fourth.nextState;

    assert.equal(state.sections_count, 1);
    assert.equal(state.groups_per_section, 2);
    assert.deepEqual(
      configuredOperations(state.sections[0].groups[0]),
      ["inserts"],
    );
    assert.deepEqual(
      configuredOperations(state.sections[0].groups[1]),
      ["merges", "point_deletes"],
    );
    assert.equal(state.sections[0].groups[0].inserts.op_count, 250000);
    assert.equal(state.sections[0].groups[1].merges.op_count, 5000);
    assert.equal(state.sections[0].groups[1].point_deletes.op_count, 5000);
    assert.equal(state.sections[0].groups[1].updates, undefined);
    assert.equal(state.sections[0].groups[1].range_deletes, undefined);
  },
);

test(
  "continuous chat session: repeated structural and scoped edits preserve earlier groups",
  { skip: !LIVE_PROVIDER.binding, timeout: 240000 },
  async () => {
    let state = createFormState({});
    let conversation = [];

    const first = await applyAssistTurn({
      prompt: "Generate an insert-only workload with 250k inserts",
      state,
      conversation,
    });
    state = first.nextState;
    conversation = first.nextConversation;

    const second = await applyAssistTurn({
      prompt: "then add a second phase with 5k point queries",
      state,
      conversation,
    });
    state = second.nextState;
    conversation = second.nextConversation;

    const third = await applyAssistTurn({
      prompt: "change point queries distribution to normal",
      state,
      conversation,
    });
    state = third.nextState;
    conversation = third.nextConversation;

    const fourth = await applyAssistTurn({
      prompt: "Add a third group with all deletes",
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
    state = fourth.nextState;

    assert.equal(state.sections_count, 1);
    assert.equal(state.groups_per_section, 3);
    assert.deepEqual(
      configuredOperations(state.sections[0].groups[0]),
      ["inserts"],
    );
    assert.deepEqual(
      configuredOperations(state.sections[0].groups[1]),
      ["point_queries"],
    );
    assert.deepEqual(
      configuredOperations(state.sections[0].groups[2]),
      ["empty_point_deletes", "point_deletes", "range_deletes"],
    );
    assert.equal(state.sections[0].groups[1].point_queries.op_count, 5000);
    assert.equal(
      state.sections[0].groups[1].point_queries.selection_distribution,
      "normal",
    );
  },
);

test(
  "continuous chat session: generic deletes resolve to point deletes when inserted keys exist",
  { skip: !LIVE_PROVIDER.binding, timeout: 240000 },
  async () => {
    let state = createFormState({});
    let conversation = [];

    const first = await applyAssistTurn({
      prompt: "Generate a workload with 1M inserts",
      state,
      conversation,
    });
    state = first.nextState;
    conversation = first.nextConversation;

    const second = await applyAssistTurn({
      prompt: "Add 5k point queries",
      state,
      conversation,
    });
    state = second.nextState;
    conversation = second.nextConversation;

    const third = await applyAssistTurn({
      prompt: "Add 1k deletes",
      state,
      conversation,
    });
    state = third.nextState;

    assert.equal(third.result.clarifications.length, 0);
    assert.equal(state.sections_count, 1);
    assert.equal(state.groups_per_section, 1);
    assert.deepEqual(
      configuredOperations(state.sections[0].groups[0]),
      ["inserts", "point_deletes", "point_queries"],
    );
    assert.equal(state.sections[0].groups[0].inserts.op_count, 1000000);
    assert.equal(state.sections[0].groups[0].point_queries.op_count, 5000);
    assert.equal(state.sections[0].groups[0].point_deletes.op_count, 1000);
  },
);

test(
  "continuous chat session: delaying the first point query splits the phase after the requested inserts",
  { skip: !LIVE_PROVIDER.binding, timeout: 240000 },
  async () => {
    let state = createFormState({});
    let conversation = [];

    const first = await applyAssistTurn({
      prompt: "Generate 1M inserts",
      state,
      conversation,
    });
    state = first.nextState;
    conversation = first.nextConversation;

    const second = await applyAssistTurn({
      prompt: "Add 5k point queries",
      state,
      conversation,
    });
    state = second.nextState;
    conversation = second.nextConversation;

    const third = await applyAssistTurn({
      prompt: "Make the first point query appear after 10k inserts",
      state,
      conversation,
    });
    state = third.nextState;

    assert.equal(third.result.clarifications.length, 0);
    assert.equal(state.sections_count, 1);
    assert.equal(state.groups_per_section, 2);
    assert.deepEqual(
      configuredOperations(state.sections[0].groups[0]),
      ["inserts"],
    );
    assert.deepEqual(
      configuredOperations(state.sections[0].groups[1]),
      ["inserts", "point_queries"],
    );
    assert.equal(state.sections[0].groups[0].inserts.op_count, 10000);
    assert.equal(state.sections[0].groups[1].inserts.op_count, 990000);
    assert.equal(state.sections[0].groups[1].point_queries.op_count, 5000);
  },
);
