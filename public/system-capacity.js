(function initSystemCapacity(root) {
  "use strict";

  function formatMemory(bytes) {
    const value = Number(bytes);
    if (!Number.isFinite(value) || value <= 0) {
      return null;
    }
    const gibibytes = value / (1024 * 1024 * 1024);
    return (
      new Intl.NumberFormat(undefined, {
        maximumFractionDigits: gibibytes < 10 ? 1 : 0,
      }).format(gibibytes) + " GB"
    );
  }

  function formatSystemCapacity(info) {
    const logicalCores = Number(info && info.logical_cores);
    const totalMemory = formatMemory(info && info.total_memory_bytes);
    const availableMemory = formatMemory(info && info.available_memory_bytes);
    const parts = [];
    if (Number.isInteger(logicalCores) && logicalCores > 0) {
      parts.push(
        logicalCores + " logical " + (logicalCores === 1 ? "core" : "cores"),
      );
    }
    if (totalMemory) {
      parts.push(totalMemory + " memory");
    }
    if (availableMemory) {
      parts.push(availableMemory + " currently available");
    }
    return parts.join(" · ");
  }

  async function populate(options) {
    const config = options && typeof options === "object" ? options : {};
    const documentRef = config.document || root.document;
    const fetchImpl = config.fetch || root.fetch;
    const elements = documentRef
      ? Array.from(documentRef.querySelectorAll("[data-system-capacity]"))
      : [];
    if (elements.length === 0) {
      return null;
    }

    let description = "";
    try {
      const response = await fetchImpl(config.endpoint || "/api/system-info", {
        headers: { accept: "application/json" },
      });
      if (!response || !response.ok) {
        throw new Error("System information request failed.");
      }
      description = formatSystemCapacity(await response.json());
    } catch (_error) {
      const browserCores = Number(root.navigator && root.navigator.hardwareConcurrency);
      if (Number.isInteger(browserCores) && browserCores > 0) {
        description =
          browserCores +
          " logical " +
          (browserCores === 1 ? "core" : "cores") +
          " reported by this browser";
      }
    }

    const text = description
      ? "System capacity: " +
        description +
        ". Start at or below the logical core count; use fewer threads when running multiple databases."
      : "System capacity is unavailable. Start conservatively and increase threads while monitoring memory and CPU use.";
    elements.forEach(function updateElement(element) {
      element.textContent = text;
      element.classList.toggle("unavailable", !description);
    });
    return description || null;
  }

  root.TectonicSystemCapacity = {
    formatMemory: formatMemory,
    formatSystemCapacity: formatSystemCapacity,
    populate: populate,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
