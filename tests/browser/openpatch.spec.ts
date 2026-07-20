import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

const runtimePath = resolve(import.meta.dirname, "../../dist/test/apply-demo-patch.js");

test("the unpatched portal is visibly broken", async ({ page }, testInfo) => {
  await page.goto("/demo/");
  await expect(page.locator(".survey-wall")).toBeVisible();
  if (testInfo.project.name === "mobile-chromium") {
    const brokenShellIsWiderThanViewport = await page.locator(".application-shell").evaluate((element) => element.getBoundingClientRect().width > window.innerWidth * 2);
    expect(brokenShellIsWiderThanViewport).toBe(true);
  }
});

test("the safe patch repairs layout, accessibility, autosave, and keyboard behavior", async ({ page }, testInfo) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") runtimeErrors.push(message.text()); });
  await page.goto("/demo/");
  await page.addScriptTag({ path: runtimePath });
  const health = await page.evaluate(() => (window as Window & { __applyOpenPatchDemo: () => { healthy: number; total: number } }).__applyOpenPatchDemo());

  expect(health.healthy).toBe(health.total);
  await expect(page.locator(".survey-wall")).toBeHidden();
  await expect(page.locator(".application-main > .help-card")).toBeVisible();
  await expect(page.locator("#progress-steps")).toHaveAttribute("role", "group");

  if (testInfo.project.name === "mobile-chromium") {
    const documentFits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2);
    expect(documentFits).toBe(true);
  }

  await page.locator("#full-name").fill("Alex Morgan");
  await page.locator("#email").fill("alex@example.com");
  await page.locator("#household-size").selectOption("2");
  await page.locator("#address").fill("12 Green Street");
  await page.reload();
  await page.addScriptTag({ path: runtimePath });
  await page.evaluate(() => (window as Window & { __applyOpenPatchDemo: () => unknown }).__applyOpenPatchDemo());
  await expect(page.locator("#full-name")).toHaveValue("Alex Morgan");
  await expect(page.locator(".openpatch-save-status")).toContainText("Draft restored");

  await page.locator("#email").fill("not-an-email");
  await page.locator("#benefits-form").evaluate((element) => (element as HTMLFormElement).requestSubmit());
  await expect(page.getByRole("alert")).toContainText("name@example.com");

  const firstStep = page.locator("#progress-steps button").nth(0);
  const secondStep = page.locator("#progress-steps button").nth(1);
  await firstStep.focus();
  await firstStep.press("ArrowRight");
  await expect(secondStep).toBeFocused();
  expect(runtimeErrors).toEqual([]);
});

test("the public registry exposes a verifiable patch receipt", async ({ page }) => {
  await page.goto("/");
  const response = await page.request.get("/registry/index.json");
  expect(response.ok()).toBe(true);
  const registry = await response.json() as {
    patches: Array<{
      id: string;
      sha256: string;
      verification: { status: string; operations: number; assertions: number };
      compatibility: { status: string; healthy: number; total: number; fingerprint: string };
    }>;
  };
  expect(registry.patches).toHaveLength(2);
  expect(registry.patches[0].id).toBe("org.openpatch.civicapply-accessible-draft");
  expect(registry.patches[0].sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(registry.patches[0].verification).toEqual({ status: "verified", operations: 19, assertions: 10 });
  await expect(page.locator("#registry-receipt")).toContainText("SHA-256");
  const download = page.getByRole("link", { name: "Download safe patch ↓" });
  await expect(download).toHaveAttribute("download", "");
  const patchResponse = await page.request.get("/registry/patches/civic-apply.openpatch.json");
  expect(patchResponse.ok()).toBe(true);
  expect((await patchResponse.json()).schemaVersion).toBe(1);
  const navigator = registry.patches.find((patch) => patch.id === "org.openpatch.metrocare-service-navigator");
  expect(navigator?.verification).toEqual({ status: "verified", operations: 10, assertions: 8 });
  expect(navigator?.compatibility).toMatchObject({ status: "healthy", healthy: 10, total: 10 });
  expect(navigator?.compatibility.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  await expect(page.locator("#compatibility-receipt")).toContainText("Compatibility Sentinel: healthy");
  const compatibilityResponse = await page.request.get("/registry/compatibility.json");
  expect(compatibilityResponse.ok()).toBe(true);
  expect((await compatibilityResponse.json()).summary).toEqual({ healthy: 2, drifted: 0, unreachable: 0, total: 2 });
  const navigatorResponse = await page.request.get("/registry/patches/metrocare-service-navigator.openpatch.json");
  expect(navigatorResponse.ok()).toBe(true);
});

test("the Compatibility Console explains live evidence and quarantines simulated drift", async ({ page }) => {
  await page.goto("/sentinel/");
  await expect(page.locator("#hero-status")).toHaveText("All 2 patches compatible");
  await expect(page.locator("#metric-healthy")).toHaveText("2/2");
  await expect(page.locator("#metric-operations")).toHaveText("29");
  await expect(page.locator(".patch-row")).toHaveCount(2);
  await expect(page.locator(".patch-score")).toHaveText(["19/19 live", "10/10 live"]);
  await page.locator("#simulate-drift").click();
  await expect(page.locator("#simulation-state")).toHaveClass(/quarantined/);
  await expect(page.locator("#simulation-state strong")).toHaveText("Quarantined from discovery");
  await expect(page.locator("#simulation-note")).toContainText("until a maintainer publishes and verifies an updated version");
  await expect(page.getByRole("link", { name: "Raw receipt ↗" })).toHaveAttribute("href", "/registry/compatibility.json");
});

test("the original care directory is usable but forces people to inspect every service", async ({ page }) => {
  await page.goto("/care/");
  await expect(page.locator(".care-service:visible")).toHaveCount(12);
  await expect(page.locator("#care-directory input[type='search']")).toHaveCount(0);
  await expect(page.locator("#care-directory select")).toHaveCount(0);
  await expect(page.locator(".care-community-promo")).toBeVisible();
  await expect(page.locator("#judge-preview")).toHaveText(/Preview OpenPatch instantly/);
});

test("the instant judge preview invokes the same constrained runtime", async ({ page }) => {
  await page.goto("/care/");
  await page.locator("#judge-preview").click();
  await expect(page.locator(".openpatch-navigator")).toBeVisible();
  await expect(page.locator("#judge-preview")).toHaveAttribute("data-healthy", "10");
  await expect(page.locator("#judge-preview")).toHaveAttribute("data-total", "10");
  await expect(page.locator("#judge-preview")).toHaveText("✓ OpenPatch active · 10/10 healthy");
});

test("the feature patch privately combines access needs, persists them, and supports the keyboard", async ({ page }, testInfo) => {
  const runtimeErrors: string[] = [];
  const postPatchRequests: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") runtimeErrors.push(message.text()); });
  await page.goto("/care/");
  await page.addScriptTag({ path: runtimePath });
  const health = await page.evaluate(() => (window as Window & { __applyMetroCarePatch: () => { healthy: number; total: number } }).__applyMetroCarePatch());
  expect(health).toMatchObject({ healthy: 10, total: 10 });
  await expect(page.locator(".openpatch-navigator")).toBeVisible();
  await expect(page.locator(".care-community-promo")).toBeHidden();
  page.on("request", (request) => postPatchRequests.push(request.url()));

  await page.locator("select[id$='-access']").selectOption("wheelchair");
  await page.locator("select[id$='-language']").selectOption("urdu");
  await page.locator("select[id$='-availability']").selectOption("new-patients");
  await expect(page.locator(".care-service:visible")).toHaveCount(1);
  await expect(page.locator(".care-service:visible h3")).toHaveText("Harbor Family Clinic");
  await expect(page.locator(".openpatch-navigator__status")).toHaveText("1 of 12 services match");
  expect(postPatchRequests).toEqual([]);

  await page.reload();
  await page.addScriptTag({ path: runtimePath });
  await page.evaluate(() => (window as Window & { __applyMetroCarePatch: () => unknown }).__applyMetroCarePatch());
  await expect(page.locator("select[id$='-language']")).toHaveValue("urdu");
  await expect(page.locator(".care-service:visible h3")).toHaveText("Harbor Family Clinic");

  await page.locator(".openpatch-navigator__clear").click();
  await page.locator(".care-hero h1").click();
  await page.keyboard.press("/");
  await expect(page.locator(".openpatch-navigator input[type='search']")).toBeFocused();
  if (testInfo.project.name === "mobile-chromium") {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true);
  }
  expect(runtimeErrors).toEqual([]);
});
