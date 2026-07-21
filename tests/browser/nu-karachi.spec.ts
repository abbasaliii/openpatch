import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const runtimePath = resolve(import.meta.dirname, "../../dist/test/apply-demo-patch.js");
const fixture = readFileSync(resolve(import.meta.dirname, "../fixtures/nu-degree-programs.html"), "utf8");
const evidenceDir = resolve(import.meta.dirname, "../../submission-assets/repairs");

test("the Karachi repair removes irrelevant programs and campus columns", async ({ page }, testInfo) => {
  const project = testInfo.project.name;
  await page.goto("/");
  await page.setContent(fixture);
  await page.screenshot({ path: resolve(evidenceDir, `nu-karachi-${project}-before.png`), fullPage: true });

  const dataRows = page.locator("table.edu-table-responsive tr:has(td:nth-child(7))");
  await expect(dataRows).toHaveCount(6);
  await expect(page.locator("tr.heading-table > th:visible")).toHaveCount(7);
  if (project === "mobile-chromium") {
    const originalScrolls = await page.locator(".table-responsive").evaluate((element) => element.scrollWidth > element.clientWidth);
    expect(originalScrolls).toBe(true);
  }

  await page.addScriptTag({ path: runtimePath });
  const health = await page.evaluate(() => (window as Window & { __applyNuKarachiPatch: () => { healthy: number; total: number } }).__applyNuKarachiPatch());
  expect(health).toMatchObject({ healthy: 4, total: 4 });

  await expect(page.locator("table.edu-table-responsive tr[data-patch-the-web-table-row-match='true']:visible")).toHaveCount(4);
  await expect(page.locator("table.edu-table-responsive tr[data-patch-the-web-table-row-hidden='true']")).toHaveCount(2);
  await expect(page.locator("tr.heading-table > th:visible")).toHaveCount(2);
  await expect(page.locator("table.edu-table-responsive")).toHaveAttribute("aria-label", "Degree programs offered at the Karachi campus");
  await expect(page.locator("tr.heading-table > th:nth-child(4)")).toHaveAttribute("aria-label", "Karachi campus availability");
  const markers = page.locator("tr > td:nth-child(4) > .fa-check");
  await expect(markers).toHaveCount(4);
  expect(await markers.evaluateAll((elements) => elements.every((element) => element.getAttribute("aria-label") === "Offered at Karachi campus"))).toBe(true);
  const focusedTableFits = await page.locator(".table-responsive").evaluate((element) => element.scrollWidth <= element.clientWidth + 2);
  expect(focusedTableFits).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true);

  await page.screenshot({ path: resolve(evidenceDir, `nu-karachi-${project}-after.png`), fullPage: true });
});
