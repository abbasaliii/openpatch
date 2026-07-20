import { chromium, expect, test, type BrowserContext } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { validatePatch } from "../../src/core/validator";
import type { OpenPatch } from "../../src/core/types";

const extensionPath = resolve(import.meta.dirname, "../../dist/extension");
const tempPrefix = join(tmpdir(), "openpatch-extension-test-");
const patchId = "org.openpatch.extension-installed-test";
let context: BrowserContext;
let profilePath: string;

const importedPatch: OpenPatch = {
  schemaVersion: 1,
  id: patchId,
  name: "Extension-installed test repair",
  summary: "Proves that a validated locally installed patch is loaded by the production extension runtime.",
  version: "1.0.0",
  author: { name: "OpenPatch test" },
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
  const validation = validatePatch(importedPatch);
  expect(validation.ok).toBe(true);

  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent("serviceworker");
  await worker.evaluate(async ({ importedPatch, patchId }) => {
    const stored = await chrome.storage.local.get(["installedPatches", "enabledPatches"]);
    const installedPatches = (stored.installedPatches ?? {}) as Record<string, unknown>;
    const enabledPatches = (stored.enabledPatches ?? {}) as Record<string, boolean>;
    installedPatches[patchId] = importedPatch;
    enabledPatches[patchId] = true;
    enabledPatches["org.openpatch.civicapply-accessible-draft"] = true;
    await chrome.storage.local.set({ installedPatches, enabledPatches });
  }, { importedPatch, patchId });

  await expect.poll(async () => worker.evaluate(async () => (await chrome.scripting.getRegisteredContentScripts()).length)).toBe(1);

  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4174/demo/");
  await expect(page.locator(".survey-wall")).toBeHidden();
  await expect(page.locator("#benefits-form")).toHaveAttribute("title", "Community repair runtime active");
  await expect(page.locator(".openpatch-save-status")).toContainText("Draft saved");
  const markers = await page.locator("html").getAttribute("data-openpatch-applied");
  expect(markers).toContain("org.openpatch.civicapply-accessible-draft@1.2.0");
  expect(markers).toContain(`${patchId}@1.0.0`);

});

test("the packaged extension repairs the real public demo domain", async () => {
  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent("serviceworker");
  await worker.evaluate(async () => {
    const stored = await chrome.storage.local.get("enabledPatches");
    const enabledPatches = (stored.enabledPatches ?? {}) as Record<string, boolean>;
    enabledPatches["org.openpatch.civicapply-accessible-draft"] = true;
    await chrome.storage.local.set({ enabledPatches });
  });

  const publicMatches = "*://openpatch-tau.vercel.app/demo/*";
  await expect.poll(async () => worker.evaluate(async (match) =>
    (await chrome.scripting.getRegisteredContentScripts()).some((script) => script.matches?.includes(match)), publicMatches
  )).toBe(true);

  const page = await context.newPage();
  await page.goto("https://openpatch-tau.vercel.app/demo/");
  await expect(page.locator(".survey-wall")).toBeHidden();
  await expect(page.locator(".openpatch-save-status")).toContainText("Draft saved");
  await expect(page.locator("html")).toHaveAttribute("data-openpatch-applied", /org\.openpatch\.civicapply-accessible-draft@1\.2\.0/);
});

test("the production extension discovers and installs MetroCare from the verified public registry", async () => {
  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent("serviceworker");

  const popup = await context.newPage();
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4174/care/");
  await expect(page.locator(".openpatch-navigator")).toHaveCount(0);

  const extensionId = new URL(worker.url()).host;
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.locator("#registry-match")).toBeVisible();
  await expect(popup.locator("#registry-match-name")).toContainText("MetroCare: personal service navigator");
  await expect(popup.locator("#registry-match-proof")).toContainText("live compatibility 10/10");
  await expect(popup.locator("#import-health")).toHaveText("10/10 operation targets healthy");
  await expect(popup.locator("#import-status")).toContainText("Verified and healthy");
  await popup.locator("body").screenshot({
    path: resolve(import.meta.dirname, "../../submission-assets/openpatch-registry-discovery.png")
  });
  await popup.locator("#install-button").click();

  await expect.poll(async () => worker.evaluate(async () => {
    const stored = await chrome.storage.local.get(["installedPatches", "installedPatchMeta", "enabledPatches"]);
    const id = "org.openpatch.metrocare-service-navigator";
    return {
      installed: Boolean((stored.installedPatches as Record<string, unknown> | undefined)?.[id]),
      source: ((stored.installedPatchMeta as Record<string, { source?: string }> | undefined)?.[id])?.source,
      enabled: Boolean((stored.enabledPatches as Record<string, boolean> | undefined)?.[id])
    };
  })).toEqual({ installed: true, source: "public-registry", enabled: true });

  await expect(page.locator(".openpatch-navigator")).toBeVisible();
  await page.locator("select[id$='-access']").selectOption("wheelchair");
  await page.locator("select[id$='-language']").selectOption("urdu");
  await page.locator("select[id$='-availability']").selectOption("new-patients");
  await expect(page.locator(".care-service:visible h3")).toHaveText("Harbor Family Clinic");
  await expect(page.locator("html")).toHaveAttribute("data-openpatch-applied", /org\.openpatch\.metrocare-service-navigator@1\.0\.0/);
});

test("the registry-installed feature also runs on the real public MetroCare domain", async () => {
  const page = await context.newPage();
  await page.goto("https://openpatch-tau.vercel.app/care/");
  await expect(page.locator(".openpatch-navigator")).toBeVisible();
  await page.locator("select[id$='-access']").selectOption("wheelchair");
  await page.locator("select[id$='-language']").selectOption("urdu");
  await page.locator("select[id$='-availability']").selectOption("new-patients");
  await expect(page.locator(".openpatch-navigator__status")).toHaveText("1 of 12 services match");
  await expect(page.locator(".care-service:visible h3")).toHaveText("Harbor Family Clinic");
});
