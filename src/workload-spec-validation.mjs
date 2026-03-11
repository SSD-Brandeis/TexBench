const CHARACTER_SETS = new Set(["alphanumeric", "alphabetic", "numeric"]);
const RANGE_FORMATS = new Set(["StartCount", "StartEnd"]);
const DISTRIBUTION_REQUIRED_KEYS = {
  uniform: ["min", "max"],
  normal: ["mean", "std_dev"],
  beta: ["alpha", "beta"],
  zipf: ["n", "s"],
  exponential: ["lambda"],
  log_normal: ["mean", "std_dev"],
  poisson: ["lambda"],
  weibull: ["scale", "shape"],
  pareto: ["scale", "shape"],
};
const OPERATION_VALIDATORS = {
  empty_point_deletes: validateEmptyPointDelete,
  empty_point_queries: validateEmptyPointQuery,
  inserts: validateInsert,
  merges: validateMerge,
  point_deletes: validatePointDelete,
  point_queries: validatePointQuery,
  range_deletes: validateRangeDelete,
  range_queries: validateRangeQuery,
  sorted: validateSorted,
  updates: validateUpdate,
};

export function validateWorkloadSpec(spec) {
  const errors = [];
  if (!isPlainObject(spec)) {
    return ["spec_json must be an object."];
  }

  if (!isNullableCharacterSet(spec.character_set)) {
    errors.push(
      "spec_json.character_set must be alphanumeric, alphabetic, numeric, null, or omitted.",
    );
  }
  if (!Array.isArray(spec.sections) || spec.sections.length === 0) {
    errors.push("spec_json.sections must be a non-empty array.");
    return errors;
  }

  spec.sections.forEach((section, sectionIndex) => {
    const sectionPath = "sections[" + sectionIndex + "]";
    if (!isPlainObject(section)) {
      errors.push(sectionPath + " must be an object.");
      return;
    }
    if (!isNullableCharacterSet(section.character_set)) {
      errors.push(
        sectionPath +
          ".character_set must be alphanumeric, alphabetic, numeric, null, or omitted.",
      );
    }
    if (
      section.skip_key_contains_check !== undefined &&
      typeof section.skip_key_contains_check !== "boolean"
    ) {
      errors.push(
        sectionPath + ".skip_key_contains_check must be boolean when provided.",
      );
    }
    if (!Array.isArray(section.groups) || section.groups.length === 0) {
      errors.push(sectionPath + ".groups must be a non-empty array.");
      return;
    }

    section.groups.forEach((group, groupIndex) => {
      const groupPath = sectionPath + ".groups[" + groupIndex + "]";
      if (!isPlainObject(group)) {
        errors.push(groupPath + " must be an object.");
        return;
      }
      if (!isNullableCharacterSet(group.character_set)) {
        errors.push(
          groupPath +
            ".character_set must be alphanumeric, alphabetic, numeric, null, or omitted.",
        );
      }

      const groupKeys = Object.keys(group);
      const unknownKeys = groupKeys.filter(
        (key) =>
          key !== "character_set" &&
          !Object.prototype.hasOwnProperty.call(OPERATION_VALIDATORS, key),
      );
      unknownKeys.forEach((key) => {
        errors.push(
          groupPath + "." + key + " is not a supported workload operation.",
        );
      });

      const presentOperations = groupKeys.filter((key) => {
        if (!Object.prototype.hasOwnProperty.call(OPERATION_VALIDATORS, key)) {
          return false;
        }
        return group[key] !== null && group[key] !== undefined;
      });
      if (presentOperations.length === 0) {
        errors.push(groupPath + " must include at least one operation object.");
        return;
      }

      presentOperations.forEach((operationName) => {
        const validator = OPERATION_VALIDATORS[operationName];
        if (typeof validator === "function") {
          validator(
            group[operationName],
            groupPath + "." + operationName,
            errors,
          );
        }
      });
    });
  });

  return errors.slice(0, 64);
}

function validateInsert(value, path, errors) {
  validateObjectShape(value, path, errors);
  validateNullableCharacterSetField(value, path, errors);
  validateNumberExprField(value, path, errors, "op_count", true);
  validateStringExprField(value, path, errors, "key", true);
  validateStringExprField(value, path, errors, "val", true);
}

function validateUpdate(value, path, errors) {
  validateObjectShape(value, path, errors);
  validateNullableCharacterSetField(value, path, errors);
  validateNumberExprField(value, path, errors, "op_count", true);
  validateDistributionField(value, path, errors, "selection", false);
  validateStringExprField(value, path, errors, "val", true);
}

function validateMerge(value, path, errors) {
  validateUpdate(value, path, errors);
}

function validatePointQuery(value, path, errors) {
  validateObjectShape(value, path, errors);
  validateNumberExprField(value, path, errors, "op_count", true);
  validateDistributionField(value, path, errors, "selection", false);
}

function validatePointDelete(value, path, errors) {
  validatePointQuery(value, path, errors);
}

function validateRangeQuery(value, path, errors) {
  validateObjectShape(value, path, errors);
  validateNullableCharacterSetField(value, path, errors);
  validateNumberExprField(value, path, errors, "op_count", true);
  validateDistributionField(value, path, errors, "selection", false);
  validateNumberExprField(value, path, errors, "selectivity", true);
  if (
    value.range_format !== undefined &&
    !RANGE_FORMATS.has(value.range_format)
  ) {
    errors.push(
      path + ".range_format must be StartCount or StartEnd when provided.",
    );
  }
}

function validateRangeDelete(value, path, errors) {
  validateRangeQuery(value, path, errors);
}

function validateEmptyPointQuery(value, path, errors) {
  validateObjectShape(value, path, errors);
  validateNullableCharacterSetField(value, path, errors);
  validateNumberExprField(value, path, errors, "op_count", true);
  validateStringExprField(value, path, errors, "key", true);
}

function validateEmptyPointDelete(value, path, errors) {
  validateEmptyPointQuery(value, path, errors);
}

function validateSorted(value, path, errors) {
  validateObjectShape(value, path, errors);
  validateNumberExprField(value, path, errors, "k", true);
  validateNumberExprField(value, path, errors, "l", true);
}

function validateObjectShape(value, path, errors) {
  if (!isPlainObject(value)) {
    errors.push(path + " must be an object.");
  }
}

function validateNullableCharacterSetField(value, path, errors) {
  if (
    value.character_set !== undefined &&
    !isNullableCharacterSet(value.character_set)
  ) {
    errors.push(
      path +
        ".character_set must be alphanumeric, alphabetic, numeric, null, or omitted.",
    );
  }
}

function validateNumberExprField(value, path, errors, fieldName, required) {
  if (value[fieldName] === undefined) {
    if (required) {
      errors.push(path + "." + fieldName + " is required.");
    }
    return;
  }
  if (!isNumberExpr(value[fieldName])) {
    errors.push(
      path + "." + fieldName + " must be a number or distribution object.",
    );
  }
}

function validateDistributionField(value, path, errors, fieldName, required) {
  if (value[fieldName] === undefined) {
    if (required) {
      errors.push(path + "." + fieldName + " is required.");
    }
    return;
  }
  if (!isDistribution(value[fieldName])) {
    errors.push(path + "." + fieldName + " must be a distribution object.");
  }
}

function validateStringExprField(value, path, errors, fieldName, required) {
  if (value[fieldName] === undefined) {
    if (required) {
      errors.push(path + "." + fieldName + " is required.");
    }
    return;
  }
  if (!isStringExpr(value[fieldName])) {
    errors.push(
      path + "." + fieldName + " must be a string or StringExpr object.",
    );
  }
}

function isNumberExpr(value) {
  return Number.isFinite(value) || isDistribution(value);
}

function isDistribution(value) {
  if (!isPlainObject(value)) {
    return false;
  }
  const keys = Object.keys(value);
  if (keys.length !== 1) {
    return false;
  }
  const name = keys[0];
  const requiredKeys = DISTRIBUTION_REQUIRED_KEYS[name];
  if (!requiredKeys) {
    return false;
  }
  const inner = value[name];
  if (!isPlainObject(inner)) {
    return false;
  }
  return requiredKeys.every((key) => {
    const rawValue = inner[key];
    if (key === "n") {
      return Number.isInteger(rawValue) && rawValue >= 0;
    }
    return Number.isFinite(rawValue);
  });
}

function isStringExpr(value) {
  if (typeof value === "string") {
    return true;
  }
  if (!isPlainObject(value)) {
    return false;
  }
  const keys = Object.keys(value);
  if (keys.length !== 1) {
    return false;
  }
  const variant = keys[0];
  const inner = value[variant];
  if (variant === "uniform") {
    return (
      isPlainObject(inner) &&
      isNumberExpr(inner.len) &&
      (inner.character_set === undefined ||
        isNullableCharacterSet(inner.character_set))
    );
  }
  if (variant === "weighted") {
    return (
      Array.isArray(inner) &&
      inner.length > 0 &&
      inner.every(
        (entry) =>
          isPlainObject(entry) &&
          Number.isFinite(entry.weight) &&
          isStringExpr(entry.value),
      )
    );
  }
  if (variant === "segmented") {
    return (
      isPlainObject(inner) &&
      typeof inner.separator === "string" &&
      Array.isArray(inner.segments) &&
      inner.segments.length > 0 &&
      inner.segments.every((entry) => isStringExpr(entry))
    );
  }
  if (variant === "hot_range") {
    return (
      isPlainObject(inner) &&
      Number.isInteger(inner.len) &&
      inner.len >= 0 &&
      Number.isInteger(inner.amount) &&
      inner.amount >= 0 &&
      Number.isFinite(inner.probability)
    );
  }
  return false;
}

function isNullableCharacterSet(value) {
  return value === undefined || value === null || CHARACTER_SETS.has(value);
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
