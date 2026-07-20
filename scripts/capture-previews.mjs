import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const root = resolve(import.meta.dirname, "..");
const previewDir = resolve(root, "dist/previews");
const runtimePath = resolve(root, "dist/test/apply-demo-patch.js");
await mkdir(previewDir, { recursive: true });

const server = await createServer({
  configFile: resolve(root, "vite.config.ts"),
  server: { host: "127.0.0.1", port: 4173, strictPort: true }
});
await server.listen();

const browser = await chromium.launch();
try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
  await desktop.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
  for (const element of await desktop.locator(".proof-bar, .section, .impact-band").all()) {
    await element.scrollIntoViewIfNeeded();
  }
  await desktop.evaluate(() => window.scrollTo(0, 0));
  await desktop.waitForTimeout(250);
  await desktop.screenshot({ path: resolve(previewDir, "openpatch-landing.png"), fullPage: true });

  const sentinel = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
  await sentinel.goto("http://127.0.0.1:4173/sentinel/", { waitUntil: "networkidle" });
  await sentinel.screenshot({ path: resolve(previewDir, "compatibility-sentinel.png"), fullPage: true });
  await sentinel.locator("#simulate-drift").click();
  await sentinel.screenshot({ path: resolve(previewDir, "compatibility-sentinel-quarantine.png"), fullPage: true });

  const careDesktop = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
  await careDesktop.goto("http://127.0.0.1:4173/care/", { waitUntil: "networkidle" });
  await careDesktop.screenshot({ path: resolve(previewDir, "metrocare-before-desktop.png"), fullPage: true });
  await careDesktop.addScriptTag({ path: runtimePath });
  await careDesktop.evaluate(() => window.__applyMetroCarePatch());
  await careDesktop.locator("select[id$='-access']").selectOption("wheelchair");
  await careDesktop.locator("select[id$='-language']").selectOption("urdu");
  await careDesktop.locator("select[id$='-availability']").selectOption("new-patients");
  await careDesktop.screenshot({ path: resolve(previewDir, "metrocare-after-desktop.png"), fullPage: true });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await mobile.goto("http://127.0.0.1:4173/demo/", { waitUntil: "networkidle" });
  await mobile.screenshot({ path: resolve(previewDir, "civicapply-before-mobile.png") });
  await mobile.addScriptTag({ path: runtimePath });
  await mobile.evaluate(() => window.__applyOpenPatchDemo());
  await mobile.screenshot({ path: resolve(previewDir, "civicapply-after-mobile.png") });
  await mobile.screenshot({ path: resolve(previewDir, "civicapply-after-mobile-full.png"), fullPage: true });

  const careMobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await careMobile.goto("http://127.0.0.1:4173/care/", { waitUntil: "networkidle" });
  await careMobile.screenshot({ path: resolve(previewDir, "metrocare-before-mobile.png"), fullPage: true });
  await careMobile.addScriptTag({ path: runtimePath });
  await careMobile.evaluate(() => window.__applyMetroCarePatch());
  await careMobile.locator("select[id$='-access']").selectOption("wheelchair");
  await careMobile.locator("select[id$='-language']").selectOption("urdu");
  await careMobile.locator("select[id$='-availability']").selectOption("new-patients");
  await careMobile.screenshot({ path: resolve(previewDir, "metrocare-after-mobile.png"), fullPage: true });

  const popup = await browser.newPage({ viewport: { width: 430, height: 700 }, deviceScaleFactor: 1 });
  await popup.addInitScript(() => {
    Object.defineProperty(globalThis, "chrome", {
      value: {
        tabs: {
          query: async () => [{ id: 7, url: "https://forms.example.gov/apply" }],
          sendMessage: async () => { throw new Error("No repair installed"); },
          reload: async () => undefined
        },
        storage: { local: { get: async () => ({}), set: async () => undefined } },
        scripting: { executeScript: async () => [] }
      }
    });
  });
  await popup.goto(`file://${resolve(root, "dist/extension/popup.html").replaceAll("\\", "/")}`, { waitUntil: "load" });
  await popup.screenshot({ path: resolve(previewDir, "openpatch-repair-brief.png"), fullPage: true });
} finally {
  await browser.close();
  await server.close();
}

console.log(`Captured submission previews in ${previewDir}`);
