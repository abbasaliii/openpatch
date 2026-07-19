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
  await desktop.screenshot({ path: resolve(previewDir, "openpatch-landing.png"), fullPage: true });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await mobile.goto("http://127.0.0.1:4173/demo/", { waitUntil: "networkidle" });
  await mobile.screenshot({ path: resolve(previewDir, "civicapply-before-mobile.png") });
  await mobile.addScriptTag({ path: runtimePath });
  await mobile.evaluate(() => window.__applyOpenPatchDemo());
  await mobile.screenshot({ path: resolve(previewDir, "civicapply-after-mobile.png"), fullPage: true });
} finally {
  await browser.close();
  await server.close();
}

console.log(`Captured submission previews in ${previewDir}`);
