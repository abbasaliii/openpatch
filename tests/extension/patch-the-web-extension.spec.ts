import { chromium, expect, test, type BrowserContext } from "@playwright/test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { validatePatch } from "../../src/core/validator";
import type { CommunityPatch } from "../../src/core/types";

const storeBuild = Boolean(process.env.PATCH_THE_WEB_STORE_BUILD);
const extensionPath = resolve(import.meta.dirname, storeBuild ? "../../dist/extension-store" : "../../dist/extension");
const careUrl = "https://patch-the-web.vercel.app/care/";
const homeUrl = "https://patch-the-web.vercel.app/";
const metrocarePatchJson = JSON.parse(await readFile(resolve(import.meta.dirname, "../../src/registry/patches/metrocare-service-navigator.patch-the-web.json"), "utf8")) as CommunityPatch;
const tempPrefix = join(tmpdir(), "patch-the-web-extension-test-");
const patchId = "org.patchtheweb.extension-installed-test";
let context: BrowserContext;
let profilePath: string;

const importedPatch: CommunityPatch = {
  schemaVersion: 1,
  id: patchId,
  name: "Extension-installed test repair",
  summary: "Proves that a validated locally installed patch is loaded by the production extension runtime.",
  version: "1.0.0",
  author: { name: "Patch the Web test" },
  match: { hosts: ["127.0.0.1"], paths: ["/demo/*"] },
  capabilities: ["accessibility"],
  operations: [{
    id: "mark-installed-runtime",
    type: "attributes",
    selector: "#benefits-form",
    attributes: { title: "Community repair runtime active" }
  }],
  verify: [{ type: "attribute", selector: "#benefits-form", name: "title", value: "Community repair runtime active" }],
  changelog: "Initial extension integration fixture."
};

test.beforeAll(async () => {
  profilePath = await mkdtemp(tempPrefix);
  context = await chromium.launchPersistentContext(profilePath, {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
  });
});

test.afterAll(async () => {
  await context?.close();
  if (profilePath?.startsWith(tempPrefix)) await rm(profilePath, { recursive: true, force: true });
});

test("the welcome page explains both user paths on mobile", async () => {
  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent("serviceworker");
  const page = await context.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`chrome-extension://${new URL(worker.url()).host}/welcome.html`);
  await expect(page.getByRole("heading", { name: /Make a broken website/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Install it in one guided flow" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Describe the problem, not the code" })).toBeVisible();
  await expect(page.getByText(/keeps the verified installation ready for fifteen minutes/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true);
  await page.close();
});

test("the production extension loads validated local patches and the bundled repair", async () => {
  test.skip(storeBuild, "The store manifest intentionally has no pre-granted localhost access.");
  const validation = validatePatch(importedPatch);
  expect(validation.ok).toBe(true);

  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent("serviceworker");
  await expect.poll(async () => worker.evaluate(async () => {
    const stored = await chrome.storage.local.get("registryMeta");
    return (stored.registryMeta as { schemaVersion?: number } | undefined)?.schemaVersion;
  }), { timeout: 30_000, intervals: [250, 500, 1_000, 2_000] }).toBe(1);
  await worker.evaluate(async ({ importedPatch, patchId }) => {
    const stored = await chrome.storage.local.get(["installedPatches", "enabledPatches"]);
    const installedPatches = (stored.installedPatches ?? {}) as Record<string, unknown>;
    const enabledPatches = (stored.enabledPatches ?? {}) as Record<string, boolean>;
    installedPatches[patchId] = importedPatch;
    enabledPatches[patchId] = true;
    enabledPatches["org.patchtheweb.civicapply-accessible-draft"] = true;
    await chrome.storage.local.set({ installedPatches, enabledPatches });
  }, { importedPatch, patchId });

  const control = await context.newPage();
  const extensionId = new URL(worker.url()).host;
  await control.goto(`chrome-extension://${extensionId}/welcome.html`);
  await control.evaluate(async () => chrome.runtime.sendMessage({ type: "PATCH_THE_WEB_REFRESH_RUNTIME" }));
  await control.close();

  await expect.poll(async () => worker.evaluate(async () => (await chrome.scripting.getRegisteredContentScripts()).length)).toBe(1);

  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4174/demo/");
  await expect(page.locator("#benefits-form")).toHaveAttribute("title", "Community repair runtime active");
  const markers = await page.locator("html").getAttribute("data-patch-the-web-applied");
  expect(markers).toContain(`${patchId}@1.0.0`);

});

test("the packaged extension repairs the real public demo domain", async () => {
  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent("serviceworker");
  await worker.evaluate(async () => {
    const stored = await chrome.storage.local.get("enabledPatches");
    const enabledPatches = (stored.enabledPatches ?? {}) as Record<string, boolean>;
    enabledPatches["org.patchtheweb.civicapply-accessible-draft"] = true;
    await chrome.storage.local.set({ enabledPatches });
  });

  const publicMatches = "https://patch-the-web.vercel.app/demo/*";
  await expect.poll(async () => worker.evaluate(async (match) =>
    (await chrome.scripting.getRegisteredContentScripts()).some((script) => script.matches?.includes(match)), publicMatches
  )).toBe(true);

  const page = await context.newPage();
  await page.goto("https://patch-the-web.vercel.app/demo/");
  await expect(page.locator(".survey-wall")).toBeHidden();
  await expect(page.locator(".patch-the-web-save-status")).toContainText("Draft saved");
  await expect(page.locator("html")).toHaveAttribute("data-patch-the-web-applied", /org\.patchtheweb\.civicapply-accessible-draft@1\.2\.1/);
});

test("the author workspace hands a Codex patch directly to the exact target and guided installer", async () => {
  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent("serviceworker");
  await worker.evaluate(async () => chrome.storage.session.remove("installWizardSession"));
  const wrongPath = await context.newPage();
  await wrongPath.goto(homeUrl);
  await wrongPath.evaluate(({ raw, target }) => window.postMessage({
    type: "PATCH_THE_WEB_AUTHOR_HANDOFF",
    requestId: "123e4567-e89b-12d3-a456-426614174001",
    raw,
    target
  }, location.origin), { raw: JSON.stringify(metrocarePatchJson), target: careUrl });
  await wrongPath.waitForTimeout(400);
  expect(await worker.evaluate(async () => Boolean((await chrome.storage.session.get("installWizardSession")).installWizardSession))).toBe(false);
  await wrongPath.close();
  const author = await context.newPage();
  await author.goto("https://patch-the-web.vercel.app/authors/");
  const wizardOpened = context.waitForEvent("page", { predicate: (candidate) => candidate.url().includes("/install.html") });
  await author.evaluate(({ raw, target }) => window.postMessage({
    type: "PATCH_THE_WEB_AUTHOR_HANDOFF",
    requestId: "123e4567-e89b-12d3-a456-426614174000",
    raw,
    target
  }, location.origin), { raw: JSON.stringify(metrocarePatchJson), target: careUrl });
  const wizard = await wizardOpened;
  await wizard.waitForLoadState("domcontentloaded");
  await expect(wizard.getByRole("heading", { name: "MetroCare: personal service navigator" })).toBeVisible();
  await expect(wizard.locator("#source-label")).toHaveText("Local author test repair");
  await expect(wizard.locator("#repair-domain")).toHaveText("patch-the-web.vercel.app");
  await expect(wizard.locator("#repair-health")).toHaveText("11/11 operation targets healthy now");
  await wizard.getByRole("button", { name: "Cancel safely" }).click();
  await expect.poll(async () => worker.evaluate(async () => !(await chrome.storage.session.get("installWizardSession")).installWizardSession)).toBe(true);
  const openedTargets = context.pages().filter((candidate) => candidate.url() === careUrl);
  await Promise.all(openedTargets.map((candidate) => candidate.close()));
  await author.close();
});

test("the production extension discovers and installs MetroCare from the verified public registry", async () => {
  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent("serviceworker");

  const popup = await context.newPage();
  const page = await context.newPage();
  await page.goto(careUrl);
  await expect(page.locator(".patch-the-web-navigator")).toHaveCount(0);

  const extensionId = new URL(worker.url()).host;
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.locator("#registry-match")).toBeVisible();
  await expect(popup.locator("#registry-match-name")).toContainText("MetroCare: personal service navigator");
  await expect(popup.locator("#registry-match-proof")).toContainText("live compatibility 11/11");
  await expect(popup.locator("#import-health")).toHaveText("11/11 operation targets healthy");
  await expect(popup.locator("#import-status")).toContainText("Verified and healthy");
  const wizardOpened = context.waitForEvent("page", { predicate: (candidate) => candidate.url().includes("/install.html") });
  await popup.locator("#install-button").click();
  const wizard = await wizardOpened;
  await wizard.waitForLoadState("domcontentloaded");
  await wizard.setViewportSize({ width: 390, height: 844 });

  await expect(wizard.getByRole("heading", { name: "MetroCare: personal service navigator" })).toBeVisible();
  await expect(wizard.locator("#repair-health")).toHaveText("11/11 operation targets healthy now");
  await expect(wizard.locator("#stage-verify")).toHaveClass(/complete/);
  await expect(wizard.locator("#status")).toContainText("Nothing changes until you approve access");
  expect(await wizard.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true);
  await wizard.screenshot({ path: resolve(import.meta.dirname, "../../submission-assets/patch-the-web-guided-install-mobile.png"), fullPage: true });
  await wizard.getByRole("button", { name: "Approve website and install" }).click();
  await expect(wizard.locator("#stage-access")).toHaveClass(/complete/);
  await expect(wizard.locator("#stage-install")).toHaveClass(/complete/);
  await expect(wizard.locator("#stage-confirm")).toHaveClass(/complete/);
  await expect(wizard.locator("#status")).toHaveText("Repair active and confirmed. You can return to the repaired website.");
  await expect(wizard.getByRole("button", { name: "View repaired website" })).toBeVisible();

  await expect.poll(async () => worker.evaluate(async () => {
    const stored = await chrome.storage.local.get(["installedPatches", "installedPatchMeta", "enabledPatches"]);
    const session = await chrome.storage.session.get("installWizardSession");
    const id = "org.patchtheweb.metrocare-service-navigator";
    return {
      installed: Boolean((stored.installedPatches as Record<string, unknown> | undefined)?.[id]),
      source: ((stored.installedPatchMeta as Record<string, { source?: string }> | undefined)?.[id])?.source,
      enabled: Boolean((stored.enabledPatches as Record<string, boolean> | undefined)?.[id]),
      sessionCleared: !session.installWizardSession
    };
  })).toEqual({ installed: true, source: "public-registry", enabled: true, sessionCleared: true });

  await expect(page.locator(".patch-the-web-navigator")).toBeVisible();
  await page.locator("select[id$='-access']").selectOption("wheelchair");
  await page.locator("select[id$='-language']").selectOption("urdu");
  await page.locator("select[id$='-availability']").selectOption("new-patients");
  await expect(page.locator(".care-service:visible h3")).toHaveText("Harbor Family Clinic");
  await expect(page.locator("html")).toHaveAttribute("data-patch-the-web-applied", /org\.patchtheweb\.metrocare-service-navigator@1\.1\.1/);
  await wizard.close();
});

test("the guided installer rejects expired attempts without requesting website access", async () => {
  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent("serviceworker");
  const extensionId = new URL(worker.url()).host;
  const target = await context.newPage();
  await target.goto(careUrl);
  const tabId = await worker.evaluate(async (url) => {
    const matches = await chrome.tabs.query({ url });
    return matches.sort((left, right) => (right.id ?? 0) - (left.id ?? 0))[0]?.id;
  }, careUrl);
  expect(tabId).toBeTruthy();
  const raw = JSON.stringify(metrocarePatchJson);
  const hash = createHash("sha256").update(raw).digest("hex");
  await worker.evaluate(async ({ raw, hash, tabId, tabUrl }) => {
    await chrome.storage.session.set({ installWizardSession: { raw, hash, source: "public-registry", tabId, tabUrl, createdAt: Date.now() - 16 * 60_000 } });
  }, { raw, hash, tabId: tabId as number, tabUrl: careUrl });
  const wizard = await context.newPage();
  await wizard.goto(`chrome-extension://${extensionId}/install.html`);
  await expect(wizard.getByRole("heading", { name: "Installation could not start" })).toBeVisible();
  await expect(wizard.locator("#fatal-message")).toContainText("missing or expired");
  await expect.poll(async () => worker.evaluate(async () => !(await chrome.storage.session.get("installWizardSession")).installWizardSession)).toBe(true);
  await wizard.close();
  await target.close();
});

test("a verified update can roll back and then restore the newer version", async () => {
  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent("serviceworker");
  const extensionId = new URL(worker.url()).host;
  const current = metrocarePatchJson as CommunityPatch;
  const previous: CommunityPatch = { ...current, version: "1.0.0", changelog: "Previous verified MetroCare release." };
  const previousJson = JSON.stringify(previous);
  const previousHash = createHash("sha256").update(previousJson).digest("hex");

  await worker.evaluate(async ({ id, previous, previousJson, previousHash }) => {
    const stored = await chrome.storage.local.get("patchHistory");
    const patchHistory = (stored.patchHistory ?? {}) as Record<string, unknown[]>;
    patchHistory[id] = [{ patch: previous, meta: { sha256: previousHash, installedAt: Date.now() - 10_000, source: "public-registry", sourceJson: previousJson }, archivedAt: Date.now() }];
    await chrome.storage.local.set({ patchHistory });
  }, { id: current.id, previous, previousJson, previousHash });

  const rollbackPopup = await context.newPage();
  const page = await context.newPage();
  await page.goto(careUrl);
  await expect(page.locator("html")).toHaveAttribute("data-patch-the-web-applied", /org\.patchtheweb\.metrocare-service-navigator@1\.1\.1/);

  await rollbackPopup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(rollbackPopup.locator("#restore-row")).toBeVisible();
  await expect(rollbackPopup.locator("#restore-patch")).toHaveText("Restore v1.0.0");
  await rollbackPopup.locator("#restore-patch").click();
  await expect.poll(async () => worker.evaluate(async (id) => ((await chrome.storage.local.get("installedPatches")).installedPatches as Record<string, CommunityPatch>)[id]?.version, current.id)).toBe("1.0.0");
  await expect(page.locator("html")).toHaveAttribute("data-patch-the-web-applied", /org\.patchtheweb\.metrocare-service-navigator@1\.0\.0/);

  const redoPopup = await context.newPage();
  await page.bringToFront();
  await redoPopup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(redoPopup.locator("#restore-patch")).toHaveText("Restore v1.1.1");
  await redoPopup.locator("#restore-patch").click();
  await expect.poll(async () => worker.evaluate(async (id) => ((await chrome.storage.local.get("installedPatches")).installedPatches as Record<string, CommunityPatch>)[id]?.version, current.id)).toBe("1.1.1");
  await expect(page.locator("html")).toHaveAttribute("data-patch-the-web-applied", /org\.patchtheweb\.metrocare-service-navigator@1\.1\.1/);
});

test("the registry-installed feature also runs on the real public MetroCare domain", async () => {
  const page = await context.newPage();
  await page.goto("https://patch-the-web.vercel.app/care/");
  await expect(page.locator(".patch-the-web-navigator")).toBeVisible();
  await page.locator("select[id$='-access']").selectOption("wheelchair");
  await page.locator("select[id$='-language']").selectOption("urdu");
  await page.locator("select[id$='-availability']").selectOption("new-patients");
  await expect(page.locator(".patch-the-web-navigator__status")).toHaveText("1 of 12 services match");
  await expect(page.locator(".care-service:visible h3")).toHaveText("Harbor Family Clinic");
});

test("My repairs manages installed features across domains without browsing-history access", async () => {
  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent("serviceworker");
  const extensionId = new URL(worker.url()).host;
  const manage = await context.newPage();
  await manage.setViewportSize({ width: 390, height: 844 });
  await manage.goto(`chrome-extension://${extensionId}/manage.html`);

  await expect(manage.getByRole("heading", { name: "My repairs" })).toBeVisible();
  const metroCare = manage.locator(".repair-card").filter({ hasText: "MetroCare: personal service navigator" });
  await expect(metroCare).toBeVisible();
  await expect(metroCare.locator(".source")).toHaveText("Verified public registry");
  await expect(metroCare.locator(".update")).toHaveText("Current verified version");
  await expect(metroCare.locator(".scope")).toContainText("patch-the-web.vercel.app");
  if (!storeBuild) await manage.screenshot({ path: resolve(import.meta.dirname, "../../submission-assets/patch-the-web-my-repairs-mobile.png"), fullPage: true });

  await metroCare.locator(".switch-row").click();
  await expect(metroCare.locator(".state")).toHaveText("PAUSED");
  await expect.poll(async () => worker.evaluate(async (id) => Boolean(((await chrome.storage.local.get("enabledPatches")).enabledPatches as Record<string, boolean>)[id]), metrocarePatchJson.id)).toBe(false);
  await metroCare.locator(".switch-row").click();
  await expect(metroCare.locator(".state")).toHaveText("ACTIVE");

  const localTest = manage.locator(".repair-card").filter({ hasText: "Extension-installed test repair" });
  if (storeBuild) {
    await expect(localTest).toHaveCount(0);
  } else {
    await expect(localTest.locator(".source")).toHaveText("Local author test");
    await localTest.getByRole("button", { name: "Remove repair" }).click();
    await expect(localTest).toHaveCount(0);
    await expect(manage.locator("#page-status")).toContainText("was removed with its local settings and version history");
    await expect.poll(async () => worker.evaluate(async (id) => !Boolean(((await chrome.storage.local.get("installedPatches")).installedPatches as Record<string, unknown>)[id]), patchId)).toBe(true);
  }

  const bundledCard = manage.locator(".repair-card").filter({ hasText: "CivicApply: accessible & autosaved" });
  await expect(bundledCard.locator(".source")).toHaveText("Built into the extension");
  await expect(bundledCard.locator(".remove")).toBeHidden();
  expect(await manage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true);
});

test("an unmatched website offers plain-language examples and the guided request flow", async () => {
  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent("serviceworker");
  const extensionId = new URL(worker.url()).host;
  const page = await context.newPage();
  await page.goto(homeUrl);
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.locator("#empty-state")).toBeVisible();
  await expect(popup.locator("#author-button")).toHaveText(/Review repair request/);
  await expect(popup.locator("#copy-brief")).toHaveText("Build it now with Codex");
  await expect(popup.locator("[data-complaint]")).toHaveCount(4);
  await popup.getByRole("button", { name: "Add search & filters" }).click();
  await expect(popup.locator("#repair-complaint")).toHaveValue(/private search and filters/);
  await expect(popup.locator("#brief-status")).toContainText("Example added");
  await expect(popup.locator(".guided-author-link")).toHaveAttribute("href", "https://patch-the-web.vercel.app/authors/");
  await expect(popup.getByRole("link", { name: "My repairs" })).toHaveAttribute("href", "manage.html");
});

test("an installed community feature can be removed with its local metadata", async () => {
  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent("serviceworker");
  const extensionId = new URL(worker.url()).host;
  const popup = await context.newPage();
  const page = await context.newPage();
  await page.goto(careUrl);
  await expect(page.locator(".patch-the-web-navigator")).toBeVisible();

  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.locator("#remove-patch")).toBeVisible();
  await popup.locator("#remove-patch").click();

  await expect.poll(async () => worker.evaluate(async () => {
    const stored = await chrome.storage.local.get(["installedPatches", "installedPatchMeta", "enabledPatches", "patchHistory"]);
    const id = "org.patchtheweb.metrocare-service-navigator";
    return {
      installed: Boolean((stored.installedPatches as Record<string, unknown> | undefined)?.[id]),
      metadata: Boolean((stored.installedPatchMeta as Record<string, unknown> | undefined)?.[id]),
      enabled: Object.prototype.hasOwnProperty.call((stored.enabledPatches as Record<string, boolean> | undefined) ?? {}, id),
      history: Object.prototype.hasOwnProperty.call((stored.patchHistory as Record<string, unknown> | undefined) ?? {}, id)
    };
  })).toEqual({ installed: false, metadata: false, enabled: false, history: false });
  await expect(page.locator(".patch-the-web-navigator")).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveAttribute("data-patch-the-web-applied", /org\.patchtheweb\.metrocare-service-navigator/);
});

test("a bundled repair can be disabled from the domain-scoped switch", async () => {
  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent("serviceworker");
  const extensionId = new URL(worker.url()).host;
  const popup = await context.newPage();
  const page = await context.newPage();
  await page.goto("https://patch-the-web.vercel.app/demo/");
  await expect(page.locator(".survey-wall")).toBeHidden();

  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.locator("#patch-toggle")).toBeChecked();
  await popup.locator("#patch-toggle").evaluate((element: HTMLInputElement) => element.click());

  await expect.poll(async () => worker.evaluate(async () => {
    const stored = await chrome.storage.local.get("enabledPatches");
    return (stored.enabledPatches as Record<string, boolean> | undefined)?.["org.patchtheweb.civicapply-accessible-draft"];
  })).toBe(false);
  await expect(page.locator(".survey-wall")).toBeVisible();
  await expect(page.locator("html")).not.toHaveAttribute("data-patch-the-web-applied", /org\.patchtheweb\.civicapply-accessible-draft/);
});
