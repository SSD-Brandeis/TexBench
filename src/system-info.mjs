import os from "node:os";

export function collectSystemInfo(system = os) {
  const logicalCores = readPositiveInteger(
    typeof system.availableParallelism === "function"
      ? system.availableParallelism()
      : typeof system.cpus === "function"
        ? system.cpus().length
        : null,
  );
  const totalMemoryBytes = readPositiveInteger(
    typeof system.totalmem === "function" ? system.totalmem() : null,
  );
  const availableMemoryBytes = readPositiveInteger(
    typeof system.freemem === "function" ? system.freemem() : null,
  );

  return {
    logical_cores: logicalCores,
    total_memory_bytes: totalMemoryBytes,
    available_memory_bytes: availableMemoryBytes,
  };
}

function readPositiveInteger(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}
