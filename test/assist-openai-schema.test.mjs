import assert from "node:assert/strict";
import test from "node:test";

import { __test } from "../src/index.js";

function assertStrictRequiredProperties(schema, path = "schema") {
  if (!schema || typeof schema !== "object") {
    return;
  }

  const properties =
    schema.properties && typeof schema.properties === "object"
      ? Object.keys(schema.properties)
      : [];
  if (schema.additionalProperties === false && properties.length > 0) {
    assert.equal(
      Array.isArray(schema.required),
      true,
      path + " must declare required properties",
    );
    properties.forEach((propertyName) => {
      assert.equal(
        schema.required.includes(propertyName),
        true,
        path + " required must include " + propertyName,
      );
    });
  }

  Object.entries(schema).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => {
        assertStrictRequiredProperties(entry, path + "." + key + "[" + index + "]");
      });
      return;
    }
    if (value && typeof value === "object") {
      assertStrictRequiredProperties(value, path + "." + key);
    }
  });
}

test("OpenAI assist tool schema marks nullable command fields as required", () => {
  assertStrictRequiredProperties(__test.openAiAssistResponseJsonSchema);
});
