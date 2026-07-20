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
  const health = await page.evaluate(() => (window as Window & { __applyPatchTheWebDemo: () => { healthy: number; total: number } }).__applyPatchTheWebDemo());

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
  await page.locator("#phone").fill("555-0142");
  await page.locator("#household-size").selectOption("2");
  await page.locator("#address").fill("12 Green Street");
  await page.locator("input[name='textUpdates']").check();
  await page.reload();
  await page.addScriptTag({ path: runtimePath });
  await page.evaluate(() => (window as Window & { __applyPatchTheWebDemo: () => unknown }).__applyPatchTheWebDemo());
  await expect(page.locator("#full-name")).toHaveValue("Alex Morgan");
  await expect(page.locator("#email")).toHaveValue("alex@example.com");
  await expect(page.locator("#phone")).toHaveValue("555-0142");
  await expect(page.locator("#household-size")).toHaveValue("2");
  await expect(page.locator("#address")).toHaveValue("12 Green Street");
  await expect(page.locator("input[name='textUpdates']")).toBeChecked();
  await expect(page.locator(".patch-the-web-save-status")).toContainText("Draft restored");

  await page.locator("#full-name").fill("");
  await page.locator("#email").fill("");
  await page.locator("#household-size").selectOption("");
  await page.locator("#address").fill("");
  await page.locator("#benefits-form").evaluate((element) => (element as HTMLFormElement).requestSubmit());
  await expect(page.getByRole("alert")).toHaveCount(4);
  await expect(page.locator("#full-name")).toBeFocused();
  await expect(page.locator("#full-name")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("alert").nth(0)).toContainText("full name");
  await expect(page.getByRole("alert").nth(1)).toContainText("email address");
  await expect(page.getByRole("alert").nth(2)).toContainText("number of people");
  await expect(page.getByRole("alert").nth(3)).toContainText("street address");

  await page.locator("#full-name").fill("Al");
  await expect(page.getByRole("alert").nth(0)).toContainText("at least 3 characters");
  await page.locator("#full-name").fill("Alex Morgan");
  await expect(page.locator("#full-name")).not.toHaveAttribute("aria-invalid", "true");
  await page.locator("#email").fill("not-an-email");
  await expect(page.getByRole("alert").first()).toContainText("name@example.com");
  await page.locator("#email").fill("alex@example.com");
  await page.locator("#household-size").selectOption("2");
  await page.locator("#address").fill("12 Green Street");
  await expect(page.getByRole("alert")).toHaveCount(0);

  const firstStep = page.locator("#progress-steps button").nth(0);
  const secondStep = page.locator("#progress-steps button").nth(1);
  const lastStep = page.locator("#progress-steps button").nth(2);
  await firstStep.focus();
  await firstStep.press("ArrowLeft");
  await expect(lastStep).toBeFocused();
  await lastStep.press("Home");
  await expect(firstStep).toBeFocused();
  await firstStep.press("ArrowRight");
  await expect(secondStep).toBeFocused();
  await secondStep.press("End");
  await expect(lastStep).toBeFocused();
  await lastStep.press("ArrowRight");
  await expect(firstStep).toBeFocused();
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
  expect(registry.patches[0].id).toBe("org.patchtheweb.civicapply-accessible-draft");
  expect(registry.patches[0].sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(registry.patches[0].verification).toEqual({ status: "verified", operations: 19, assertions: 10 });
  await expect(page.locator("#registry-receipt")).toContainText("SHA-256");
  const download = page.getByRole("link", { name: "Download safe patch ↓" });
  await expect(download).toHaveAttribute("download", "");
  const patchResponse = await page.request.get("/registry/patches/civic-apply.patch-the-web.json");
  expect(patchResponse.ok()).toBe(true);
  expect((await patchResponse.json()).schemaVersion).toBe(1);
  const navigator = registry.patches.find((patch) => patch.id === "org.patchtheweb.metrocare-service-navigator");
  expect(navigator?.verification).toEqual({ status: "verified", operations: 11, assertions: 10 });
  expect(navigator?.compatibility).toMatchObject({ status: "healthy", healthy: 11, total: 11 });
  expect(navigator?.compatibility.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  await expect(page.locator("#compatibility-receipt")).toContainText("Compatibility Sentinel: healthy");
  const compatibilityResponse = await page.request.get("/registry/compatibility.json");
  expect(compatibilityResponse.ok()).toBe(true);
  expect((await compatibilityResponse.json()).summary).toEqual({ healthy: 2, drifted: 0, unreachable: 0, total: 2 });
  const navigatorResponse = await page.request.get("/registry/patches/metrocare-service-navigator.patch-the-web.json");
  expect(navigatorResponse.ok()).toBe(true);
});

test("the Compatibility Console explains live evidence and quarantines simulated drift", async ({ page }) => {
  await page.goto("/sentinel/");
  await expect(page.locator("#hero-status")).toHaveText("All 2 patches compatible");
  await expect(page.locator("#metric-healthy")).toHaveText("2/2");
  await expect(page.locator("#metric-operations")).toHaveText("30");
  await expect(page.locator(".patch-row")).toHaveCount(2);
  await expect(page.locator(".patch-score")).toHaveText(["19/19 live", "11/11 live"]);
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
  await expect(page.locator(".patch-the-web-compare")).toHaveCount(0);
  await expect(page.locator(".care-community-promo")).toBeVisible();
  await expect(page.locator("#judge-preview")).toHaveText(/Preview Patch the Web instantly/);
});

test("the instant judge preview invokes the same constrained runtime", async ({ page }) => {
  await page.goto("/care/");
  await page.locator("#judge-preview").click();
  await expect(page.locator(".patch-the-web-navigator")).toBeVisible();
  await expect(page.locator(".patch-the-web-compare")).toBeVisible();
  await expect(page.locator("#judge-preview")).toHaveAttribute("data-healthy", "11");
  await expect(page.locator("#judge-preview")).toHaveAttribute("data-total", "11");
  await expect(page.locator("#judge-preview")).toHaveText("✓ Patch the Web active · 11/11 healthy");
});

test("the feature patch privately combines access needs, persists them, and supports the keyboard", async ({ page }, testInfo) => {
  const runtimeErrors: string[] = [];
  const postPatchRequests: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") runtimeErrors.push(message.text()); });
  await page.goto("/care/");
  await page.addScriptTag({ path: runtimePath });
  const health = await page.evaluate(() => (window as Window & { __applyMetroCarePatch: () => { healthy: number; total: number } }).__applyMetroCarePatch());
  expect(health).toMatchObject({ healthy: 11, total: 11 });
  await expect(page.locator(".patch-the-web-navigator")).toBeVisible();
  await expect(page.locator(".care-community-promo")).toBeHidden();
  page.on("request", (request) => postPatchRequests.push(request.url()));

  await page.getByRole("button", { name: "Add Harbor Family Clinic to comparison" }).click();
  await page.getByRole("button", { name: "Add Northside Community Health to comparison" }).click();
  await page.locator(".patch-the-web-compare__select").nth(1).click();
  await expect(page.locator(".patch-the-web-compare__status")).toContainText("3 items selected");
  await expect(page.locator(".patch-the-web-compare__select").nth(3)).toBeDisabled();
  await page.getByRole("button", { name: "Compare selected" }).click();
  await expect(page.locator(".patch-the-web-compare table")).toBeVisible();
  await expect(page.locator(".patch-the-web-compare table")).toContainText("Harbor Family Clinic");
  await expect(page.locator(".patch-the-web-compare table")).toContainText("Northside Community Health");
  await expect(page.locator(".patch-the-web-compare table")).toContainText("Urdu");
  await expect(page.locator(".patch-the-web-compare__result h3")).toBeFocused();
  await expect(page.locator(".patch-the-web-compare__table-wrap")).toHaveAttribute("role", "region");
  await expect(page.locator(".patch-the-web-compare__table-wrap")).toHaveAttribute("aria-label", "Scrollable service comparison");
  await page.locator(".patch-the-web-compare__table-wrap").focus();
  await expect(page.locator(".patch-the-web-compare__table-wrap")).toBeFocused();
  if (testInfo.project.name === "mobile-chromium") {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true);
  }
  await page.getByRole("button", { name: "Close comparison" }).click();
  await page.getByRole("button", { name: "Clear", exact: true }).click();

  await page.locator("select[id$='-access']").selectOption("wheelchair");
  await page.locator("select[id$='-language']").selectOption("urdu");
  await page.locator("select[id$='-availability']").selectOption("new-patients");
  await expect(page.locator(".care-service:visible")).toHaveCount(1);
  await expect(page.locator(".care-service:visible h3")).toHaveText("Harbor Family Clinic");
  await expect(page.locator(".patch-the-web-navigator__status")).toHaveText("1 of 12 services match");
  expect(postPatchRequests).toEqual([]);

  await page.reload();
  await page.addScriptTag({ path: runtimePath });
  await page.evaluate(() => (window as Window & { __applyMetroCarePatch: () => unknown }).__applyMetroCarePatch());
  await expect(page.locator("select[id$='-language']")).toHaveValue("urdu");
  await expect(page.locator(".care-service:visible h3")).toHaveText("Harbor Family Clinic");

  await page.locator(".patch-the-web-navigator__clear").click();
  await page.locator(".care-hero h1").click();
  await page.keyboard.press("/");
  const search = page.locator(".patch-the-web-navigator input[type='search']");
  await expect(search).toBeFocused();
  await search.fill("therapy");
  await expect(page.locator(".care-service:visible")).toHaveCount(2);
  await expect(page.locator(".patch-the-web-navigator__status")).toHaveText("2 of 12 services match");
  await search.press("Escape");
  await expect(search).toHaveValue("");
  await expect(page.locator(".care-service:visible")).toHaveCount(12);
  if (testInfo.project.name === "mobile-chromium") {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true);
  }
  expect(runtimeErrors).toEqual([]);
});
