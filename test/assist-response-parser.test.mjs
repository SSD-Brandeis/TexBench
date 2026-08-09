import assert from "node:assert/strict";
import test from "node:test";

import { __test } from "../src/index.js";

function payload(count, summary = "Applied workload change.") {
  return {
    summary,
    program: [
      {
        kind: "set_operation_fields",
        operation: "inserts",
        fields: [
          {
            field: "op_count",
            number_value: count,
            string_value: null,
            boolean_value: null,
            json_value: null,
          },
        ],
      },
    ],
    clarifications: [],
    assumptions: [],
    questions: [],
    assumption_texts: [],
  };
}

test("response parser accepts direct, fenced, and prose-wrapped payloads", () => {
  const expected = payload(123);
  const serialized = JSON.stringify(expected);
  for (const response of [
    serialized,
    "```json\n" + serialized + "\n```",
    "Here is the result:\n" + serialized + "\nDone.",
  ]) {
    assert.deepEqual(__test.parseJsonFromText(response), expected);
  }
});

test("response parser ignores unrelated JSON before the assist payload", () => {
  const expected = payload(123);
  const response =
    '{"example":true}\nSome explanation.\n' + JSON.stringify(expected);
  assert.deepEqual(__test.parseJsonFromText(response), expected);
});

test("response parser chooses the final valid assist payload", () => {
  const draft = payload(1, "Draft response.");
  const expected = payload(123, "Final response with a brace: {done}.");
  const responses = [
    JSON.stringify(draft) + "\n" + JSON.stringify(expected),
    "```json\n" +
      JSON.stringify(draft) +
      "\n```\n```json\n" +
      JSON.stringify(expected) +
      "\n```",
  ];
  for (const response of responses) {
    const parsed = __test.parseJsonFromText(response);
    assert.deepEqual(parsed, expected);
    const normalized = __test.normalizeAssistPayload(
      parsed,
      __test.normalizeSchemaHints({}),
      {},
      "Apply the workload change.",
    );
    assert.equal(normalized.patch.operations.inserts.op_count, 123);
  }
});

test("response parser skips malformed balanced objects before a valid payload", () => {
  const expected = payload(123);
  const response = '{not-json: true}\n' + JSON.stringify(expected);
  assert.deepEqual(__test.parseJsonFromText(response), expected);
});

test("response parser recovers a root object truncated after a complete program", () => {
  const serialized = JSON.stringify(payload(123));
  const endOfProgram = serialized.indexOf('],"clarifications"') + 1;
  const parsed = __test.parseJsonFromText(serialized.slice(0, endOfProgram));
  assert.equal(parsed.program[0].fields[0].number_value, 123);
});

test("response parser rejects truncation inside an incomplete command", () => {
  const serialized = JSON.stringify(payload(123));
  const truncated = serialized.slice(0, serialized.indexOf("number_value") + 18);
  assert.equal(__test.parseJsonFromText(truncated), null);
});
