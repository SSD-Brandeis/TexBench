import { test, expect } from "@playwright/test";
import { spawn } from "node:child_process";

const APP_PORT = process.env.APP_PORT || "8792";
const APP_URL = `http://127.0.0.1:${APP_PORT}`;
const OLLAMA_ONLY =
  String(process.env.AI_PROVIDER || "ollama").toLowerCase() !== "ollama";

let serverProcess = null;

async function isOllamaAvailable() {
  try {
    const response = await fetch("http://127.0.0.1:11434/api/tags");
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer(url, timeoutMs = 60000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for server at ${url}`);
}

async function startServer() {
  serverProcess = spawn(process.execPath, ["src/server.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      AI_PROVIDER: "ollama",
      OLLAMA_MODEL: process.env.OLLAMA_MODEL || "llama3:8b",
      APP_HOST: "127.0.0.1",
      PORT: APP_PORT,
    },
    stdio: "pipe",
  });
  await waitForServer(APP_URL);
}

async function stopServer() {
  if (!serverProcess) {
    return;
  }
  serverProcess.kill("SIGINT");
  await new Promise((resolve) => {
    serverProcess.once("exit", () => resolve());
    setTimeout(resolve, 3000);
  });
  serverProcess = null;
}

async function hardReset(page) {
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
}

async function waitForIdle(page) {
  await page.waitForFunction(() => {
    const buttons = [...document.querySelectorAll("button")];
    const busy = buttons.some((button) =>
      /Applying|Interpreting/i.test(button.textContent || ""),
    );
    const apply = buttons.find((button) =>
      /^Apply$/i.test((button.textContent || "").trim()),
    );
    return !busy && !!apply && !apply.disabled;
  });
}

async function applyPrompt(page, prompt) {
  await page.locator("textarea").first().fill(prompt);
  await page.getByRole("button", { name: /^Apply$/ }).click();
  await waitForIdle(page);
  return await page.evaluate(() => window.getCurrentWorkloadJson?.());
}

async function loadPreset(page, scale = "1") {
  await hardReset(page);
  await page.selectOption("#presetFamilySelect", "KVBench");
  await page.locator("#presetScaleInput").fill(scale);
  await page.selectOption("#presetFileSelect", "kvbench-i");
  await page.waitForTimeout(400);
  return await page.evaluate(() => window.getCurrentWorkloadJson?.());
}

test.beforeAll(async () => {
  if (OLLAMA_ONLY || !(await isOllamaAvailable())) {
    return;
  }
  await startServer();
});

test.afterAll(async () => {
  await stopServer();
});

test.describe("ollama browser smoke", () => {
  test.skip(OLLAMA_ONLY, "This smoke suite is only intended for Ollama.");

  test("append phase then edit phase 2 in the browser", async ({ page }) => {
    test.skip(!(await isOllamaAvailable()), "Ollama is not available.");

    await hardReset(page);
    await applyPrompt(page, "Generate an insert-only workload with 1000 inserts");
    await applyPrompt(page, "Add a new phase with 5000 point queries");
    const state = await applyPrompt(
      page,
      "Change phase 2 point queries distribution to zipf",
    );

    await expect
      .poll(() => state.sections?.[0]?.groups?.length)
      .toBe(2);
    expect(Object.keys(state.sections[0].groups[0]).sort()).toEqual(["inserts"]);
    expect(Object.keys(state.sections[0].groups[1]).sort()).toEqual([
      "point_queries",
    ]);
    expect(state.sections[0].groups[1].point_queries.op_count).toBe(5000);
    expect(state.sections[0].groups[1].point_queries.selection.zipf).toBeTruthy();
  });

  test("interleaved follow-ups stay in one phase in the browser", async ({ page }) => {
    test.skip(!(await isOllamaAvailable()), "Ollama is not available.");

    await hardReset(page);
    await applyPrompt(page, "Generate an insert-only workload with 1000 inserts");
    await applyPrompt(page, "Interleave 500 point queries with the inserts");
    await applyPrompt(page, "Also add 100 updates");
    const state = await applyPrompt(
      page,
      "Change the point queries distribution to uniform",
    );

    expect(state.sections[0].groups).toHaveLength(1);
    expect(Object.keys(state.sections[0].groups[0]).sort()).toEqual([
      "inserts",
      "point_queries",
      "updates",
    ]);
    expect(state.sections[0].groups[0].point_queries.op_count).toBe(500);
  });

  test("scaled preset load survives a follow-up phase append in the browser", async ({
    page,
  }) => {
    test.skip(!(await isOllamaAvailable()), "Ollama is not available.");

    const loaded = await loadPreset(page, "0.01");
    expect(loaded.sections[0].groups[0].inserts.op_count).toBe(10000);
    expect(loaded.sections[0].groups[1].empty_point_queries.op_count).toBe(
      8000,
    );

    const state = await applyPrompt(page, "Add a new phase with 100 point queries");
    expect(state.sections[0].groups).toHaveLength(3);
    expect(state.sections[0].groups[2].point_queries.op_count).toBe(100);
  });
});
