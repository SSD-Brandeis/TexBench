import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";

import { validateWorkloadSpec } from "./workload-spec-validation.mjs";

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.resolve(CURRENT_DIR, "../public/workload-schema.json");

const schema = JSON.parse(await fs.readFile(SCHEMA_PATH, "utf8"));
const sampleSpecs = [buildComprehensiveCoverageSpec()];
const coverage = {
  operations: new Set(),
  operationCharacterSets: new Set(),
  distributions: new Set(),
  stringVariants: new Set(),
  numberExprKinds: new Set(),
  topFields: new Set(),
  sectionFields: new Set(),
  groupFields: new Set(),
};

sampleSpecs.forEach((spec, index) => {
  const errors = validateWorkloadSpec(spec);
  if (errors.length > 0) {
    throw new Error(
      "Coverage sample #" +
        (index + 1) +
        " failed validation:\n" +
        errors.join("\n"),
    );
  }
  collectCoverage(spec, coverage);
});

const schemaDistributions = extractOneOfVariantNames(
  schema.$defs.Distribution.oneOf,
);
const schemaStringVariants = extractOneOfVariantNames(
  schema.$defs.StringExprInner.oneOf,
);
const schemaOperations = Object.keys(
  schema.$defs.WorkloadSpecGroup.properties,
).filter((name) => name !== "character_set");
const schemaOpsWithCharacterSet = schemaOperations.filter((name) => {
  const operationSchema = unwrapSchemaNode(
    schema.$defs.WorkloadSpecGroup.properties[name],
  );
  return !!(
    operationSchema &&
    operationSchema.properties &&
    Object.prototype.hasOwnProperty.call(
      operationSchema.properties,
      "character_set",
    )
  );
});

assertCovered(schemaDistributions, coverage.distributions, "distribution");
assertCovered(
  schemaStringVariants,
  coverage.stringVariants,
  "StringExpr variant",
);
assertCovered(schemaOperations, coverage.operations, "operation");
assertCovered(
  schemaOpsWithCharacterSet,
  coverage.operationCharacterSets,
  "operation-level character_set",
);
assertCovered(["character_set"], coverage.topFields, "top-level field");
assertCovered(
  ["character_set", "skip_key_contains_check"],
  coverage.sectionFields,
  "section field",
);
assertCovered(["character_set"], coverage.groupFields, "group field");
assertCovered(
  ["number", "distribution"],
  coverage.numberExprKinds,
  "NumberExpr kind",
);

console.log("Schema coverage passed.");
console.log("Operations:", Array.from(coverage.operations).sort().join(", "));
console.log(
  "Operation character_set:",
  Array.from(coverage.operationCharacterSets).sort().join(", "),
);
console.log(
  "Distributions:",
  Array.from(coverage.distributions).sort().join(", "),
);
console.log(
  "StringExpr variants:",
  Array.from(coverage.stringVariants).sort().join(", "),
);
console.log(
  "NumberExpr kinds:",
  Array.from(coverage.numberExprKinds).sort().join(", "),
);

function buildComprehensiveCoverageSpec() {
  return {
    character_set: "alphanumeric",
    sections: [
      {
        character_set: "alphabetic",
        skip_key_contains_check: true,
        groups: [
          {
            character_set: "numeric",
            inserts: {
              character_set: "numeric",
              op_count: { uniform: { min: 100, max: 250 } },
              key: {
                uniform: {
                  len: { normal: { mean: 16, std_dev: 2 } },
                  character_set: "numeric",
                },
              },
              val: {
                weighted: [
                  {
                    weight: 0.7,
                    value: "fixed-prefix",
                  },
                  {
                    weight: 0.3,
                    value: {
                      uniform: {
                        len: 32,
                        character_set: "alphabetic",
                      },
                    },
                  },
                ],
              },
            },
            updates: {
              character_set: "alphabetic",
              op_count: 1000,
              selection: { normal: { mean: 0.45, std_dev: 0.12 } },
              val: {
                segmented: {
                  separator: "-",
                  segments: [
                    "user",
                    {
                      uniform: {
                        len: 8,
                        character_set: "alphanumeric",
                      },
                    },
                  ],
                },
              },
            },
            merges: {
              character_set: "numeric",
              op_count: { beta: { alpha: 0.4, beta: 2.2 } },
              selection: { beta: { alpha: 0.5, beta: 3.4 } },
              val: {
                hot_range: {
                  len: 64,
                  amount: 25,
                  probability: 0.85,
                },
              },
            },
            point_queries: {
              op_count: { zipf: { n: 10000, s: 1.08 } },
              selection: { zipf: { n: 10000, s: 1.12 } },
            },
            range_queries: {
              character_set: "alphanumeric",
              op_count: { exponential: { lambda: 1.5 } },
              range_format: "StartCount",
              selection: { exponential: { lambda: 0.9 } },
              selectivity: { log_normal: { mean: 0.2, std_dev: 0.05 } },
            },
            point_deletes: {
              op_count: { poisson: { lambda: 7 } },
              selection: { poisson: { lambda: 4 } },
            },
            range_deletes: {
              character_set: "alphabetic",
              op_count: { weibull: { scale: 5, shape: 1.5 } },
              range_format: "StartEnd",
              selection: { weibull: { scale: 3, shape: 1.2 } },
              selectivity: { pareto: { scale: 1.5, shape: 2.8 } },
            },
            empty_point_queries: {
              character_set: "numeric",
              op_count: 150,
              key: "missing-key",
            },
            empty_point_deletes: {
              character_set: "alphabetic",
              op_count: 80,
              key: {
                uniform: {
                  len: { uniform: { min: 6, max: 12 } },
                  character_set: "alphabetic",
                },
              },
            },
            sorted: {
              k: { normal: { mean: 5, std_dev: 1 } },
              l: { uniform: { min: 1, max: 3 } },
            },
          },
        ],
      },
    ],
  };
}

function collectCoverage(spec, target) {
  if (spec.character_set !== undefined) {
    target.topFields.add("character_set");
  }
  (spec.sections || []).forEach((section) => {
    if (section.character_set !== undefined) {
      target.sectionFields.add("character_set");
    }
    if (section.skip_key_contains_check !== undefined) {
      target.sectionFields.add("skip_key_contains_check");
    }
    (section.groups || []).forEach((group) => {
      if (group.character_set !== undefined) {
        target.groupFields.add("character_set");
      }
      Object.entries(group).forEach(([operationName, operationValue]) => {
        if (
          operationName === "character_set" ||
          operationValue === null ||
          operationValue === undefined
        ) {
          return;
        }
        target.operations.add(operationName);
        if (operationValue.character_set !== undefined) {
          target.operationCharacterSets.add(operationName);
        }
        ["op_count", "k", "l", "selectivity"].forEach((fieldName) => {
          if (operationValue[fieldName] !== undefined) {
            collectNumberExpr(operationValue[fieldName], target);
          }
        });
        ["selection"].forEach((fieldName) => {
          if (operationValue[fieldName] !== undefined) {
            collectDistribution(operationValue[fieldName], target);
          }
        });
        ["key", "val"].forEach((fieldName) => {
          if (operationValue[fieldName] !== undefined) {
            collectStringExpr(operationValue[fieldName], target);
          }
        });
      });
    });
  });
}

function collectNumberExpr(value, target) {
  if (Number.isFinite(value)) {
    target.numberExprKinds.add("number");
    return;
  }
  if (isPlainObject(value)) {
    target.numberExprKinds.add("distribution");
    collectDistribution(value, target);
  }
}

function collectDistribution(value, target) {
  if (!isPlainObject(value)) {
    return;
  }
  const keys = Object.keys(value);
  if (keys.length !== 1) {
    return;
  }
  target.distributions.add(keys[0]);
}

function collectStringExpr(value, target) {
  if (typeof value === "string") {
    target.stringVariants.add("string");
    return;
  }
  if (!isPlainObject(value)) {
    return;
  }
  const keys = Object.keys(value);
  if (keys.length !== 1) {
    return;
  }
  const variant = keys[0];
  target.stringVariants.add(variant);
  const inner = value[variant];
  if (
    variant === "uniform" &&
    isPlainObject(inner) &&
    inner.len !== undefined
  ) {
    collectNumberExpr(inner.len, target);
    return;
  }
  if (variant === "weighted" && Array.isArray(inner)) {
    inner.forEach((entry) => {
      if (entry && entry.value !== undefined) {
        collectStringExpr(entry.value, target);
      }
    });
    return;
  }
  if (
    variant === "segmented" &&
    isPlainObject(inner) &&
    Array.isArray(inner.segments)
  ) {
    inner.segments.forEach((entry) => collectStringExpr(entry, target));
  }
}

function extractOneOfVariantNames(entries) {
  return (entries || [])
    .map((entry) => {
      if (
        !entry ||
        typeof entry !== "object" ||
        !entry.properties ||
        typeof entry.properties !== "object"
      ) {
        return null;
      }
      const keys = Object.keys(entry.properties);
      return keys.length === 1 ? keys[0] : null;
    })
    .filter(Boolean);
}

function unwrapSchemaNode(node) {
  if (!node || typeof node !== "object") {
    return null;
  }
  if (
    node.$ref &&
    typeof node.$ref === "string" &&
    node.$ref.startsWith("#/$defs/")
  ) {
    const key = node.$ref.slice("#/$defs/".length);
    return schema.$defs[key] || null;
  }
  if (Array.isArray(node.anyOf)) {
    const candidate = node.anyOf.find(
      (entry) => entry && typeof entry === "object" && entry.$ref,
    );
    return candidate ? unwrapSchemaNode(candidate) : node;
  }
  return node;
}

function assertCovered(expectedValues, actualSet, label) {
  const missing = expectedValues.filter((value) => !actualSet.has(value));
  if (missing.length > 0) {
    throw new Error(
      "Missing " + label + " coverage for: " + missing.join(", "),
    );
  }
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
