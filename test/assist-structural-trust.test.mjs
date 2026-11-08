import assert from "node:assert/strict";
import test from "node:test";

import { __test } from "../src/index.js";
import { OPERATION_ORDER } from "./live-assist-test-helpers.mjs";

const { normalizeAssistPayload, normalizeFormState, normalizeSchemaHints } = __test;

const schemaHints = normalizeSchemaHints({
  operation_order: OPERATION_ORDER,
  character_sets: ["alphanumeric", "alphabetic", "numeric"],
  range_formats: ["StartCount", "StartEnd"],
  selection_distributions: ["uniform", "zipf", "normal"],
  string_patterns: ["uniform", "weighted", "segmented", "hot_range"],
  capabilities: Object.fromEntries(
    OPERATION_ORDER.map((op) => [op, { has_op_count: true, has_selection: true }]),
  ),
});

const field = (name, value) => ({
  field: name,
  string_value: typeof value === "string" ? value : null,
  number_value: typeof value === "number" ? value : null,
  boolean_value: null,
  json_value: null,
});

// A two-phase program, as an LLM returns it for a prompt that describes phases
// with "then" (no keyword from STRUCTURED_WORKLOAD_PATTERN).
const program = [
  {
    kind: "replace_sections",
    sections: [
      {
        groups: [
          { operations: [{ name: "inserts", fields: [field("op_count", 300000)] }] },
          {
            operations: [
              { name: "point_queries", fields: [field("op_count", 900000)] },
              { name: "updates", fields: [field("op_count", 100000)] },
            ],
          },
        ],
      },
    ],
  },
];

test("a structural program keeps its phases even without phase keywords in the prompt", () => {
  const formState = normalizeFormState({}, schemaHints);
  const prompt = "Store 300K records. Then run 900K reads and 100K rewrites.";
  const result = normalizeAssistPayload(
    { summary: "", program, clarifications: [], assumptions: [] },
    schemaHints,
    formState,
    prompt,
    { allowDeterministicStructureFallback: false, answers: {} },
  );
  const sections = result.patch.sections;
  assert.ok(Array.isArray(sections) && sections.length === 1, "layout kept");
  assert.equal(sections[0].groups.length, 2, "both phases kept");
  assert.equal(sections[0].groups[0].inserts.op_count, 300000);
  assert.equal(sections[0].groups[1].point_queries.op_count, 900000);
  assert.equal(sections[0].groups[1].updates.op_count, 100000);
});

test("with prompt heuristics off, the parsed program is applied as is", () => {
  const formState = normalizeFormState({}, schemaHints);
  // The prompt says "Load", not "insert", and mentions "1M" first; the regex
  // fallbacks used to drop the inserts and set the lookups to 1.
  const prompt = "Load the database with 1M keys. Then issue 2M point queries.";
  const flatProgram = [
    { kind: "set_operation_fields", operation: "inserts", fields: [field("op_count", 1000000)] },
    { kind: "set_operation_fields", operation: "point_queries", fields: [field("op_count", 2000000)] },
  ];
  const off = normalizeAssistPayload(
    { summary: "", program: flatProgram, clarifications: [], assumptions: [] },
    schemaHints,
    formState,
    prompt,
    { allowDeterministicStructureFallback: false, answers: {}, promptHeuristics: false },
  );
  assert.equal(off.patch.operations.inserts.op_count, 1000000);
  assert.equal(off.patch.operations.point_queries.op_count, 2000000);
});

test("set_operation_fields in a program that also appends a group edits the active group", () => {
  const formState = normalizeFormState({}, schemaHints);
  const mixed = [
    { kind: "set_operation_fields", operation: "inserts", fields: [field("op_count", 1000000)] },
    { kind: "append_group", group: { operations: [{ name: "point_queries", fields: [field("op_count", 5)] }] } },
  ];
  const result = normalizeAssistPayload(
    { summary: "", program: mixed, clarifications: [], assumptions: [] },
    schemaHints,
    formState,
    "Load 1M keys, then add a lookup phase.",
    { allowDeterministicStructureFallback: false, answers: {}, promptHeuristics: false },
  );
  const groups = result.patch.sections[0].groups;
  assert.equal(groups[0].inserts.op_count, 1000000, "flat edit kept in the first group");
  assert.equal(groups[groups.length - 1].point_queries.op_count, 5, "appended phase kept");
});

test("a key string expression passed as a json_value object survives inside a phase", () => {
  // As the UI sends them: inserts have a key.
  const keyHints = normalizeSchemaHints({
    ...schemaHints,
    capabilities: { ...schemaHints.capabilities, inserts: { has_op_count: true, has_key: true, has_val: true } },
  });
  const formState = normalizeFormState({}, keyHints);
  const key = {
    segmented: { separator: "", segments: ["usr:", { uniform: { len: 12, character_set: "numeric" } }] },
  };
  const program = [
    {
      kind: "replace_sections",
      sections: [
        {
          groups: [
            {
              operations: [
                { name: "inserts", fields: [field("op_count", 1000), { field: "key", json_value: key }] },
              ],
            },
          ],
        },
      ],
    },
  ];
  const result = normalizeAssistPayload(
    { summary: "", program, clarifications: [], assumptions: [] },
    keyHints,
    formState,
    "Load 1000 users.",
    { allowDeterministicStructureFallback: false, answers: {}, promptHeuristics: false },
  );
  assert.deepEqual(result.patch.sections[0].groups[0].inserts.key, key);
});
