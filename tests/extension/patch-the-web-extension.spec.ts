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
  await popup.locator("#install-button").click();

  await expect(popup.locator("#progress-verify")).toHaveClass(/complete/);
  await expect(popup.locator("#progress-access")).toHaveClass(/complete/);
  await expect(popup.locator("#progress-install")).toHaveClass(/complete/);
  await expect(popup.locator("#progress-confirm")).toHaveClass(/complete/);
  await expect(popup.locator("#import-status")).toHaveText("Done — the repair is active on this page.");
  await expect(popup.locator("#install-button")).toHaveText("View repaired page");

  await expect.poll(async () => worker.evaluate(async () => {
    const stored = await chrome.storage.local.get(["installedPatches", "installedPatchMeta", "enabledPatches"]);
    const id = "org.patchtheweb.metrocare-service-navigator";
    return {
      installed: Boolean((stored.installedPatches as Record<string, unknown> | undefined)?.[id]),
      source: ((stored.installedPatchMeta as Record<string, { source?: string }> | undefined)?.[id])?.source,
      enabled: Boolean((stored.enabledPatches as Record<string, boolean> | undefined)?.[id])
    };
  })).toEqual({ installed: true, source: "public-registry", enabled: true });

  await expect(page.locator(".patch-the-web-navigator")).toBeVisible();
  await page.locator("select[id$='-access']").selectOption("wheelchair");
  await page.locator("select[id$='-language']").selectOption("urdu");
  await page.locator("select[id$='-availability']").selectOption("new-patients");
  await expect(page.locator(".care-service:visible h3")).toHaveText("Harbor Family Clinic");
  await expect(page.locator("html")).toHaveAttribute("data-patch-the-web-applied", /org\.patchtheweb\.metrocare-service-navigator@1\.1\.1/);
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

test("an unmatched website offers both a one-click brief and the guided request flow", async () => {
  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent("serviceworker");
  const extensionId = new URL(worker.url()).host;
  const page = await context.newPage();
  await page.goto(homeUrl);
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.locator("#empty-state")).toBeVisible();
  await expect(popup.locator("#author-button")).toHaveText(/Continue to private request/);
  await expect(popup.locator("#copy-brief")).toHaveText("Author it now with Codex");
  await expect(popup.locator(".guided-author-link")).toHaveAttribute("href", "https://patch-the-web.vercel.app/authors/");
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
