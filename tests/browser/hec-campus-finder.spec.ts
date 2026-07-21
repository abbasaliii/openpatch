import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const runtimePath = resolve(import.meta.dirname, "../../dist/test/apply-demo-patch.js");
const fixture = readFileSync(resolve(import.meta.dirname, "../fixtures/hec-recognized-campuses.html"), "utf8");
const evidenceDir = resolve(import.meta.dirname, "../../submission-assets/repairs");

test("the HEC repair adds fast local search and fixes the clipped mobile tables", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.setContent(fixture);
  await page.screenshot({ path: resolve(evidenceDir, `hec-campus-${testInfo.project.name}-before.png`), fullPage: true });

  if (testInfo.project.name === "mobile-chromium") {
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(true);
  }

  await page.addScriptTag({ path: runtimePath });
  const health = await page.evaluate(() => (window as Window & { __applyHecCampusPatch: () => { healthy: number; total: number } }).__applyHecCampusPatch());
  expect(health).toMatchObject({ healthy: 5, total: 5 });

  const search = page.getByRole("searchbox", { name: "Search recognized campuses" });
  await expect(search).toBeVisible();
  await expect(page.locator(".patch-the-web-table-search__status")).toHaveText("8 public rows available");
  await search.fill("Karachi");
  await expect(page.locator("[data-patch-the-web-table-search-match='true']:visible")).toHaveCount(5);
  await expect(page.locator("[data-patch-the-web-table-search-match='false']")).toHaveCount(3);
  await expect(page.locator(".patch-the-web-table-search__status")).toHaveText("5 of 8 rows match");
  await search.press("Escape");
  await expect(search).toHaveValue("");
  await expect(page.locator("[data-patch-the-web-table-search-match='true']:visible")).toHaveCount(8);
  await expect(page.locator("table.ms-rteTable-default")).toHaveCount(2);
  await expect(page.locator("[role='columnheader'][scope='col']")).toHaveCount(6);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true);

  await page.screenshot({ path: resolve(evidenceDir, `hec-campus-${testInfo.project.name}-after.png`), fullPage: true });
});
