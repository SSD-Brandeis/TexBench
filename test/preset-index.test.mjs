import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const workspaceRoot = process.cwd();
const presetIndexPath = path.join(workspaceRoot, "public/presets/index.json");

test("preset index only references files that exist", () => {
  const entries = JSON.parse(fs.readFileSync(presetIndexPath, "utf8"));
  assert.ok(Array.isArray(entries));

  for (const entry of entries) {
    assert.equal(typeof entry.id, "string");
    assert.equal(typeof entry.path, "string");
    assert.match(entry.path, /^\/presets\/.+\.spec\.json$/);

    const localPath = path.join(workspaceRoot, "public", entry.path);
    assert.equal(
      fs.existsSync(localPath),
      true,
      `Missing preset file for ${entry.id}: ${entry.path}`,
    );
  }
});

test("preset index ids and paths are unique", () => {
  const entries = JSON.parse(fs.readFileSync(presetIndexPath, "utf8"));
  const seenIds = new Set();
  const seenPaths = new Set();

  for (const entry of entries) {
    assert.equal(seenIds.has(entry.id), false, `Duplicate preset id: ${entry.id}`);
    assert.equal(
      seenPaths.has(entry.path),
      false,
      `Duplicate preset path: ${entry.path}`,
    );
    seenIds.add(entry.id);
    seenPaths.add(entry.path);
  }
});
