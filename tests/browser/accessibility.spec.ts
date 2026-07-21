import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";

const runtimePath = resolve(import.meta.dirname, "../../dist/test/apply-demo-patch.js");
const wcagTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectNoWcagViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(wcagTags).analyze();
  const evidence = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    targets: violation.nodes.flatMap((node) => node.target)
  }));
  expect(evidence, JSON.stringify(evidence, null, 2)).toEqual([]);
}

test("the patched CivicApply workflow has no automated WCAG A/AA violations", async ({ page }) => {
  await page.goto("/demo/");
  await page.addScriptTag({ path: runtimePath });
  await page.evaluate(() => (window as Window & { __applyPatchTheWebDemo: () => unknown }).__applyPatchTheWebDemo());
  await expect(page.locator(".patch-the-web-save-status")).toBeVisible();
  await expectNoWcagViolations(page);
});

test("the patched MetroCare navigator and comparison have no automated WCAG A/AA violations", async ({ page }) => {
  await page.goto("/care/");
  await page.locator("#judge-preview").click();
  await page.getByRole("button", { name: "Add Harbor Family Clinic to comparison" }).click();
  await page.getByRole("button", { name: "Add Northside Community Health to comparison" }).click();
  await page.getByRole("button", { name: "Compare selected" }).click();
  await expect(page.locator(".patch-the-web-compare table")).toBeVisible();
  await expectNoWcagViolations(page);
});

test("the judge landing page, public registry, and Compatibility Sentinel have no automated WCAG A/AA violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#registry-receipt")).toContainText("SHA-256");
  await expectNoWcagViolations(page);

  await page.goto("/registry/");
  await expect(page.locator(".patch-card")).toHaveCount(4);
  await expectNoWcagViolations(page);

  await page.goto("/sentinel/");
  await expect(page.locator("#hero-status")).toHaveText("All 4 patches compatible");
  await expectNoWcagViolations(page);

  await page.goto("/authors/");
  await expect(page.getByRole("heading", { name: /Tell us the problem/ })).toBeVisible();
  await expectNoWcagViolations(page);

  await page.goto("/install/");
  await expect(page.getByRole("heading", { name: "Install the beta extension" })).toBeVisible();
  await expectNoWcagViolations(page);
});
