import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const runtimePath = resolve(import.meta.dirname, "../../dist/test/apply-demo-patch.js");
const fixture = readFileSync(resolve(import.meta.dirname, "../fixtures/pec-level-one-programs.html"), "utf8");
const evidenceDir = resolve(import.meta.dirname, "../../submission-assets/repairs");

test("the PEC repair makes the regional accreditation directory privately searchable", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.setContent(fixture);
  await page.screenshot({ path: resolve(evidenceDir, `pec-programs-${testInfo.project.name}-before.png`), fullPage: true });
  await page.addScriptTag({ path: runtimePath });
  const health = await page.evaluate(() => (window as Window & { __applyPecProgramPatch: () => { healthy: number; total: number } }).__applyPecProgramPatch());
  expect(health).toMatchObject({ healthy: 1, total: 1 });

  const search = page.getByRole("searchbox", { name: "Search accredited programs" });
  await expect(search).toBeVisible();
  await expect(page.locator(".patch-the-web-list-search__status")).toHaveText("14 public institutions available");
  await search.fill("Karachi");
  await expect(page.locator("[data-patch-the-web-list-search-match='true']:visible")).toHaveCount(2);
  await expect(page.locator("[data-patch-the-web-list-search-match='false']")).toHaveCount(12);
  await search.press("Escape");
  await expect(search).toHaveValue("");
  await page.keyboard.press("/");
  await expect(search).toBeFocused();
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations).toEqual([]);
  await page.screenshot({ path: resolve(evidenceDir, `pec-programs-${testInfo.project.name}-after.png`), fullPage: true });
});
