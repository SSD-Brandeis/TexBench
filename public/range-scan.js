(function initRangeScanModule(global) {
  "use strict";

  function toPositiveFiniteNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
  }

  function sumInsertCountsInGroups(groups) {
    if (!Array.isArray(groups)) {
      return null;
    }
    let total = 0;
    let sawInsertCount = false;
    groups.forEach(function sumGroupInsertCount(group) {
      if (!group || typeof group !== "object") {
        return;
      }
      const inserts =
        group.inserts && typeof group.inserts === "object" ? group.inserts : null;
      const insertCount = toPositiveFiniteNumber(inserts && inserts.op_count);
      if (insertCount === null) {
        return;
      }
      total += insertCount;
      sawInsertCount = true;
    });
    return sawInsertCount ? total : null;
  }

  function sumInsertCountsInSections(sections) {
    if (!Array.isArray(sections)) {
      return null;
    }
    let total = 0;
    let sawInsertCount = false;
    sections.forEach(function sumSectionInsertCount(section) {
      if (!section || !Array.isArray(section.groups)) {
        return;
      }
      const sectionInsertCount = sumInsertCountsInGroups(section.groups);
      if (sectionInsertCount === null) {
        return;
      }
      total += sectionInsertCount;
      sawInsertCount = true;
    });
    return sawInsertCount ? total : null;
  }

  function estimateValidKeyCount(config) {
    const options = config && typeof config === "object" ? config : {};
    const sections = Array.isArray(options.sections) ? options.sections : [];
    const sectionIndex = Number.isInteger(options.sectionIndex)
      ? options.sectionIndex
      : null;
    const groupIndex = Number.isInteger(options.groupIndex)
      ? options.groupIndex
      : null;

    if (
      sectionIndex !== null &&
      groupIndex !== null &&
      sections[sectionIndex] &&
      Array.isArray(sections[sectionIndex].groups)
    ) {
      const sectionGroups = sections[sectionIndex].groups;
      const priorInsertCount = sumInsertCountsInGroups(
        sectionGroups.slice(0, groupIndex),
      );
      if (priorInsertCount !== null) {
        return priorInsertCount;
      }
      const sectionInsertCount = sumInsertCountsInGroups(sectionGroups);
      if (sectionInsertCount !== null) {
        return sectionInsertCount;
      }
    }

    const totalInsertCount = sumInsertCountsInSections(sections);
    if (totalInsertCount !== null) {
      return totalInsertCount;
    }

    return toPositiveFiniteNumber(options.fallbackInsertCount);
  }

  function selectivityFromScanLength(scanLength, validKeyCount) {
    const normalizedScanLength = toPositiveFiniteNumber(scanLength);
    const normalizedValidKeyCount = toPositiveFiniteNumber(validKeyCount);
    if (normalizedScanLength === null || normalizedValidKeyCount === null) {
      return null;
    }
    return Math.min(1, normalizedScanLength / normalizedValidKeyCount);
  }

  function scanLengthFromSelectivity(selectivity, validKeyCount) {
    const normalizedSelectivity = Number(selectivity);
    const normalizedValidKeyCount = toPositiveFiniteNumber(validKeyCount);
    if (
      !Number.isFinite(normalizedSelectivity) ||
      normalizedSelectivity < 0 ||
      normalizedValidKeyCount === null
    ) {
      return null;
    }
    if (normalizedSelectivity === 0) {
      return 0;
    }
    return Math.max(1, Math.round(normalizedValidKeyCount * normalizedSelectivity));
  }

  global.TectonicRangeScan = {
    estimateValidKeyCount: estimateValidKeyCount,
    scanLengthFromSelectivity: scanLengthFromSelectivity,
    selectivityFromScanLength: selectivityFromScanLength,
  };
})(globalThis);
