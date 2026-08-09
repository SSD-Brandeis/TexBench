import assert from "node:assert/strict";
import test from "node:test";

import { __test } from "../src/index.js";

const SCHEMA_HINTS = __test.normalizeSchemaHints({});
const OPERATION_NAMES = SCHEMA_HINTS.operation_order.slice();
const CHARACTER_SETS = ["alphanumeric", "binary"];
const DISTRIBUTIONS = ["uniform", "zipf", "normal"];

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(rng, maxExclusive) {
  return Math.floor(rng() * maxExclusive);
}

function randomChoice(rng, values) {
  return values[randomInt(rng, values.length)];
}

function randomBoolean(rng) {
  return rng() >= 0.5;
}

function maxGroupsPerSection(sections) {
  return sections.reduce((max, section) => {
    const groups = Array.isArray(section?.groups) ? section.groups.length : 0;
    return Math.max(max, groups);
  }, 0);
}

function randomFieldEntry(rng, operationName) {
  const fieldName = randomChoice(rng, [
    "op_count",
    "enabled",
    "selection_distribution",
    "character_set",
  ]);
  if (fieldName === "op_count") {
    return {
      field: fieldName,
      number_value: 1 + randomInt(rng, 500000),
      string_value: null,
      boolean_value: null,
      json_value: null,
    };
  }
  if (fieldName === "enabled") {
    return {
      field: fieldName,
      number_value: null,
      string_value: null,
      boolean_value: randomBoolean(rng),
      json_value: null,
    };
  }
  if (fieldName === "character_set") {
    return {
      field: fieldName,
      number_value: null,
      string_value: randomChoice(rng, CHARACTER_SETS),
      boolean_value: null,
      json_value: null,
    };
  }
  if (!operationName.includes("queries")) {
    return {
      field: "op_count",
      number_value: 1 + randomInt(rng, 500000),
      string_value: null,
      boolean_value: null,
      json_value: null,
    };
  }
  return {
    field: fieldName,
    number_value: null,
    string_value: randomChoice(rng, DISTRIBUTIONS),
    boolean_value: null,
    json_value: null,
  };
}

function randomGroup(rng) {
  const group = {};
  const opCount = 1 + randomInt(rng, Math.min(3, OPERATION_NAMES.length));
  const names = new Set();
  while (names.size < opCount) {
    names.add(randomChoice(rng, OPERATION_NAMES));
  }
  for (const operationName of names) {
    group[operationName] = {
      enabled: true,
      op_count: 1 + randomInt(rng, 100000),
    };
  }
  return group;
}

function randomSections(rng) {
  const sectionCount = 1 + randomInt(rng, 3);
  return Array.from({ length: sectionCount }, () => {
    const groupCount = 1 + randomInt(rng, 3);
    return {
      groups: Array.from({ length: groupCount }, () => randomGroup(rng)),
    };
  });
}

function randomProgram(seed) {
  const rng = mulberry32(seed);
  const commandCount = 1 + randomInt(rng, 8);
  const program = [];
  for (let index = 0; index < commandCount; index += 1) {
    const kind = randomChoice(rng, [
      "set_top_field",
      "set_operation_fields",
      "clear_operations",
      "replace_sections",
    ]);
    if (kind === "clear_operations") {
      program.push({ kind });
      continue;
    }
    if (kind === "replace_sections") {
      program.push({
        kind,
        sections: randomSections(rng),
      });
      continue;
    }
    if (kind === "set_top_field") {
      if (randomBoolean(rng)) {
        program.push({
          kind,
          field: "character_set",
          string_value: randomChoice(rng, CHARACTER_SETS),
          number_value: null,
          boolean_value: null,
        });
      } else {
        program.push({
          kind,
          field: "skip_key_contains_check",
          string_value: null,
          number_value: null,
          boolean_value: randomBoolean(rng),
        });
      }
      continue;
    }
    const operationName = randomChoice(rng, OPERATION_NAMES);
    const fieldCount = 1 + randomInt(rng, 3);
    const fields = Array.from({ length: fieldCount }, () =>
      randomFieldEntry(rng, operationName),
    );
    program.push({
      kind,
      operation: operationName,
      fields,
    });
  }
  return program;
}

test("patchFromAssistProgram merges repeated operation commands and clears accumulated flat ops", () => {
  const patch = __test.patchFromAssistProgram(
    [
      {
        kind: "set_operation_fields",
        operation: "inserts",
        fields: [
          {
            field: "op_count",
            number_value: 10,
            string_value: null,
            boolean_value: null,
            json_value: null,
          },
        ],
      },
      {
        kind: "set_operation_fields",
        operation: "updates",
        fields: [
          {
            field: "op_count",
            number_value: 20,
            string_value: null,
            boolean_value: null,
            json_value: null,
          },
        ],
      },
      { kind: "clear_operations" },
      {
        kind: "set_operation_fields",
        operation: "merges",
        fields: [
          {
            field: "op_count",
            number_value: 30,
            string_value: null,
            boolean_value: null,
            json_value: null,
          },
        ],
      },
    ],
    SCHEMA_HINTS,
  );

  assert.equal(patch.clear_operations, true);
  assert.deepEqual(Object.keys(patch.operations), ["merges"]);
  assert.equal(patch.operations.merges.enabled, true);
  assert.equal(patch.operations.merges.op_count, 30);
});

test("patchFromAssistProgram derives section metadata from replace_sections", () => {
  const sections = [
    { groups: [{ inserts: { op_count: 100 } }] },
    {
      groups: [
        { updates: { op_count: 200 } },
        { merges: { op_count: 300 } },
      ],
    },
  ];
  const patch = __test.patchFromAssistProgram(
    [
      {
        kind: "replace_sections",
        sections,
      },
    ],
    SCHEMA_HINTS,
  );

  assert.deepEqual(patch.sections, [
    {
      name: "Section 1",
      enable_granular_stats: true,
      groups: [
        {
          name: "Group 1",
          enable_granular_stats: true,
          inserts: { op_count: 100 },
        },
      ],
    },
    {
      name: "Section 2",
      enable_granular_stats: true,
      groups: [
        {
          name: "Group 1",
          enable_granular_stats: true,
          updates: { op_count: 200 },
        },
        {
          name: "Group 2",
          enable_granular_stats: true,
          merges: { op_count: 300 },
        },
      ],
    },
  ]);
  assert.equal(patch.sections_count, 2);
  assert.equal(patch.groups_per_section, 2);
});

test("interpretAssistProgram keeps normalized patch invariants for bounded random programs", () => {
  for (let seed = 1; seed <= 250; seed += 1) {
    const patch = __test.interpretAssistProgram(randomProgram(seed), SCHEMA_HINTS);
    assert.ok(patch && typeof patch === "object", `seed ${seed}: patch missing`);
    const operationNames = Object.keys(
      patch.operations && typeof patch.operations === "object" ? patch.operations : {},
    );
    for (const operationName of operationNames) {
      assert.ok(
        OPERATION_NAMES.includes(operationName),
        `seed ${seed}: unexpected operation ${operationName}`,
      );
      const operationPatch = patch.operations[operationName];
      assert.ok(
        operationPatch && typeof operationPatch === "object",
        `seed ${seed}: invalid patch for ${operationName}`,
      );
      if (Object.keys(operationPatch).length > 0) {
        assert.equal(
          typeof operationPatch.enabled,
          "boolean",
          `seed ${seed}: enabled missing for ${operationName}`,
        );
      }
    }
    if (Array.isArray(patch.sections)) {
      assert.equal(
        patch.sections_count,
        patch.sections.length,
        `seed ${seed}: sections_count mismatch`,
      );
      assert.equal(
        patch.groups_per_section,
        maxGroupsPerSection(patch.sections),
        `seed ${seed}: groups_per_section mismatch`,
      );
    }
  }
});
