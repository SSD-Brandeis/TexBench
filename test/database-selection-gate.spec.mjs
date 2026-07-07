import { test, expect } from "@playwright/test";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const APP_URL = "http://texbench.test/";
const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(CURRENT_DIR, "../public");

function contentTypeForPath(filePath) {
  if (filePath.endsWith(".html")) {
    return "text/html";
  }
  if (filePath.endsWith(".js")) {
    return "application/javascript";
  }
  if (filePath.endsWith(".css")) {
    return "text/css";
  }
  if (filePath.endsWith(".json")) {
    return "application/json";
  }
  return "text/plain";
}

async function loadFreshApp(page) {
  await page.addInitScript(() => {
    window.__TECTONIC_FORCE_INIT__ = true;
  });
  await page.route("https://esm.sh/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      headers: {
        "access-control-allow-origin": "*",
      },
      body:
        "export default class Ajv2020 { compile() { return () => true; } }",
    });
  });
  await page.route("http://texbench.test/**", async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const filePath = path.resolve(PUBLIC_DIR, "." + pathname);
    if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
      await route.abort();
      return;
    }
    try {
      await route.fulfill({
        status: 200,
        contentType: contentTypeForPath(filePath),
        body: await readFile(filePath),
      });
    } catch {
      await route.fulfill({
        status: 404,
        contentType: "text/plain",
        body: "not found",
      });
    }
  });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForFunction(
    () =>
      typeof window.__hasValidGeneratedJson === "function" &&
      typeof window.__canSelectDatabases === "function",
  );
}

test("database selection stays locked until generated JSON validates", async ({
  page,
}) => {
  await loadFreshApp(page);

  const inlineDatabase = page.locator(
    '#dbInlineOptions input[name="benchmarkDatabaseInline"]',
  ).first();
  const tabDatabase = page.locator(
    '#dbOptionList input[name="benchmarkDatabase"]',
  ).first();
  const menuDatabase = page.locator(
    '.run-db-menu input[name="benchmarkDatabase"]',
  ).first();
  const databaseAccordion = page.locator("#accordDatabases");
  const databaseAccordionTitle = page.locator(
    '.spec-accord-title-row[data-accord="accordDatabases"]',
  );
  const databaseMenu = page.locator(".run-db-menu");
  const databaseMenuSummary = page.locator(".run-db-menu-summary");

  await expect(inlineDatabase).toBeDisabled();
  await expect(tabDatabase).toBeDisabled();
  await expect(menuDatabase).toBeDisabled();
  await expect(databaseMenu).toHaveAttribute("aria-disabled", "true");
  await expect(databaseAccordionTitle).toHaveAttribute(
    "data-disabled-tooltip",
    /Generate a schema-valid JSON spec/,
  );
  await expect(databaseAccordionTitle).not.toHaveAttribute("title", /.+/);

  await databaseAccordion.evaluate((element) => {
    element.classList.remove("open");
  });
  await databaseAccordionTitle.evaluate((element) => {
    element.click();
  });
  await expect(databaseAccordion).not.toHaveClass(/open/);

  await databaseMenuSummary.evaluate((element) => {
    element.click();
  });
  await expect(databaseMenu).not.toHaveAttribute("open", "");

  const noOperationShellState = await page.evaluate(async () => {
    return window.__validateGeneratedJsonForTest({
      character_set: "alphanumeric",
      sections: [
        {
          groups: [
            {
              enable_granular_stats: true,
            },
          ],
          name: "Section 1",
          enable_granular_stats: true,
        },
      ],
    });
  });
  expect(noOperationShellState).toEqual({
    schemaValid: true,
    canSelectDatabases: false,
  });
  await expect(page.locator("#validationResult")).toContainText("Valid");
  await expect(inlineDatabase).toBeDisabled();
  await expect(tabDatabase).toBeDisabled();
  await expect(menuDatabase).toBeDisabled();
  await expect(databaseMenu).toHaveAttribute("aria-disabled", "true");
  await expect(databaseAccordionTitle).toHaveAttribute(
    "data-disabled-tooltip",
    "Add at least one operation before selecting databases.",
  );
  await expect(databaseMenuSummary).toHaveAttribute(
    "data-disabled-tooltip",
    "Add at least one operation before selecting databases.",
  );
  await expect(databaseMenuSummary).not.toHaveAttribute("title", /.+/);
  const disabledTooltipContent = await databaseMenuSummary.evaluate((element) =>
    getComputedStyle(element, "::after").content,
  );
  expect(disabledTooltipContent).toContain(
    "Add at least one operation before selecting databases.",
  );

  const runnableState = await page.evaluate(async () => {
    return window.__validateGeneratedJsonForTest({
      character_set: "alphanumeric",
      sections: [
        {
          groups: [
            {
              inserts: {
                op_count: 1000,
              },
            },
          ],
          name: "Section 1",
          enable_granular_stats: true,
        },
      ],
    });
  });
  expect(runnableState).toEqual({
    schemaValid: true,
    canSelectDatabases: true,
  });
  await page.waitForFunction(() => window.__canSelectDatabases() === true);

  await expect(inlineDatabase).toBeEnabled();
  await expect(tabDatabase).toBeEnabled();
  await expect(menuDatabase).toBeEnabled();
  await expect(databaseMenu).toHaveAttribute("aria-disabled", "false");
  await expect(databaseAccordionTitle).not.toHaveAttribute(
    "data-disabled-tooltip",
    /.+/,
  );

  await databaseAccordionTitle.evaluate((element) => {
    element.click();
  });
  await expect(databaseAccordion).toHaveClass(/open/);

  await databaseMenuSummary.evaluate((element) => {
    element.click();
  });
  await expect(databaseMenu).toHaveAttribute("open", "");
});
