import assert from "node:assert/strict";
import test from "node:test";

import { __test } from "../src/index.js";
import {
  SCHEMA_HINTS,
  applyPatchToState,
  configuredOperations,
  createFormState,
} from "./live-assist-test-helpers.mjs";

const NORMALIZED_SCHEMA_HINTS = __test.normalizeSchemaHints(SCHEMA_HINTS);
const OPERATION_ORDER = NORMALIZED_SCHEMA_HINTS.operation_order;

function operationCapabilities(operationName) {
  return NORMALIZED_SCHEMA_HINTS.capabilities[operationName] || {};
}

function buildCoverageFields(operationName) {
  const caps = operationCapabilities(operationName);
  const fields = [];

  if (caps.has_op_count !== false) {
    fields.push({ field: "op_count", number_value: 7 });
  }
  if (caps.has_key) {
    fields.push({ field: "key_len", number_value: 32 });
    fields.push({ field: "key_pattern", string_value: "uniform" });
  }
  if (caps.has_val) {
    fields.push({ field: "val_len", number_value: 64 });
    fields.push({ field: "val_pattern", string_value: "uniform" });
  }
  if (caps.has_selection) {
    fields.push({ field: "selection_distribution", string_value: "uniform" });
    fields.push({ field: "selection_min", number_value: 0 });
    fields.push({ field: "selection_max", number_value: 1 });
  }
  if (caps.has_range) {
    fields.push({ field: "range_format", string_value: "StartCount" });
    fields.push({ field: "selectivity", number_value: 0.01 });
  }
  if (caps.has_sorted) {
    fields.push({ field: "k", number_value: 10 });
    fields.push({ field: "l", number_value: 2 });
  }

  return fields;
}

function buildExpectedAssertions(operationName, stateLike) {
  const caps = operationCapabilities(operationName);
  const location =
    stateLike &&
    stateLike.sections &&
    stateLike.sections[0] &&
    stateLike.sections[0].groups &&
    stateLike.sections[0].groups[0] &&
    stateLike.sections[0].groups[0][operationName]
      ? stateLike.sections[0].groups[0][operationName]
      : stateLike.operations
        ? stateLike.operations[operationName]
        : null;

  assert.ok(location, operationName);
  if (stateLike.operations && stateLike.operations[operationName]) {
    assert.equal(stateLike.operations[operationName].enabled, true, operationName);
  }
  if (caps.has_op_count !== false) {
    assert.equal(location.op_count, 7, operationName);
  }
  if (caps.has_key) {
    assert.equal(location.key_len, 32, operationName);
    assert.equal(location.key_pattern, "uniform", operationName);
  }
  if (caps.has_val) {
    assert.equal(location.val_len, 64, operationName);
    assert.equal(location.val_pattern, "uniform", operationName);
  }
  if (caps.has_selection) {
    assert.equal(location.selection_distribution, "uniform", operationName);
    assert.equal(location.selection_min, 0, operationName);
    assert.equal(location.selection_max, 1, operationName);
  }
  if (caps.has_range) {
    assert.equal(location.range_format, "StartCount", operationName);
    assert.equal(location.selectivity, 0.01, operationName);
  }
  if (caps.has_sorted) {
    assert.equal(location.k, 10, operationName);
    assert.equal(location.l, 2, operationName);
  }
}

function createStructuredStateForOperation(operationName) {
  const fields = buildCoverageFields(operationName);
  const operationPatch = Object.fromEntries(
    fields.map((entry) => {
      if (entry.number_value !== undefined) {
        return [entry.field, entry.number_value];
      }
      if (entry.string_value !== undefined) {
        return [entry.field, entry.string_value];
      }
      if (entry.boolean_value !== undefined) {
        return [entry.field, entry.boolean_value];
      }
      return [entry.field, entry.json_value];
    }),
  );
  return applyPatchToState(createFormState({}), {
    sections: [
      {
        groups: [
          {
            [operationName]: {
              enabled: true,
              ...operationPatch,
            },
          },
        ],
      },
    ],
    sections_count: 1,
    groups_per_section: 1,
    clear_operations: false,
    operations: {},
  });
}

test("dsl coverage: set_operation_fields covers every supported operation", () => {
  for (const operationName of OPERATION_ORDER) {
    const patch = __test.patchFromAssistProgram(
      [
        {
          kind: "set_operation_fields",
          operation: operationName,
          fields: buildCoverageFields(operationName),
        },
      ],
      NORMALIZED_SCHEMA_HINTS,
      createFormState({}),
    );
    const effective = __test.buildEffectiveState(
      patch,
      createFormState({}),
      NORMALIZED_SCHEMA_HINTS,
    );

    buildExpectedAssertions(operationName, effective);
  }
});

test("dsl coverage: append_group covers every supported operation", () => {
  for (const operationName of OPERATION_ORDER) {
    const patch = __test.patchFromAssistProgram(
      [
        {
          kind: "append_group",
          section_index: 1,
          group: {
            [operationName]: Object.fromEntries(
              buildCoverageFields(operationName).map((entry) => {
                if (entry.number_value !== undefined) {
                  return [entry.field, entry.number_value];
                }
                if (entry.string_value !== undefined) {
                  return [entry.field, entry.string_value];
                }
                if (entry.boolean_value !== undefined) {
                  return [entry.field, entry.boolean_value];
                }
                return [entry.field, entry.json_value];
              }),
            ),
          },
        },
      ],
      NORMALIZED_SCHEMA_HINTS,
      createFormState({}),
    );
    const effective = __test.buildEffectiveState(
      patch,
      createFormState({}),
      NORMALIZED_SCHEMA_HINTS,
    );

    assert.equal(effective.sections_count, 1, operationName);
    assert.equal(effective.groups_per_section, 1, operationName);
    assert.deepEqual(
      configuredOperations(effective.sections[0].groups[0]),
      [operationName],
      operationName,
    );
    buildExpectedAssertions(operationName, effective);
  }
});

test("dsl coverage: set_group_operation_fields covers every supported operation", () => {
  for (const operationName of OPERATION_ORDER) {
    const formState = createStructuredStateForOperation(operationName);
    const patch = __test.patchFromAssistProgram(
      [
        {
          kind: "set_group_operation_fields",
          section_index: 1,
          group_index: 1,
          operation: operationName,
          fields: buildCoverageFields(operationName),
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

    assert.equal(effective.sections_count, 1, operationName);
    assert.equal(effective.groups_per_section, 1, operationName);
    assert.deepEqual(
      configuredOperations(effective.sections[0].groups[0]),
      [operationName],
      operationName,
    );
    buildExpectedAssertions(operationName, effective);
  }
});

test("dsl coverage: scale_all_op_counts scales every counted operation", () => {
  const countedOperations = OPERATION_ORDER.filter(
    (operationName) => operationCapabilities(operationName).has_op_count !== false,
  );
  const formState = applyPatchToState(createFormState({}), {
    sections: [
      {
        groups: countedOperations.map((operationName) => ({
          [operationName]: {
            enabled: true,
            op_count: 100,
          },
        })),
      },
    ],
    sections_count: 1,
    groups_per_section: countedOperations.length,
    clear_operations: false,
    operations: {},
  });
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
  assert.equal(effective.groups_per_section, countedOperations.length);
  countedOperations.forEach((operationName, index) => {
    assert.equal(
      effective.sections[0].groups[index][operationName].op_count,
      10,
      operationName,
    );
  });
});

test("dsl coverage: set_range_scan_length is accepted for both range operations", () => {
  const rangeOperations = ["range_queries", "range_deletes"];
  for (const operationName of rangeOperations) {
    const formState = applyPatchToState(createFormState({}), {
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
              [operationName]: {
                enabled: true,
                op_count: 5000,
                selectivity: 0.01,
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
    const patch = __test.patchFromAssistProgram(
      [
        {
          kind: "set_range_scan_length",
          operation: operationName,
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

    assert.equal(
      effective.sections[0].groups[1][operationName].range_format,
      "StartCount",
      operationName,
    );
    assert.equal(
      effective.sections[0].groups[1][operationName].selectivity,
      100 / 1000000,
      operationName,
    );
  }
});
