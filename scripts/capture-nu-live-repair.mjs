import { chromium } from "@playwright/test";
import { resolve } from "node:path";

const target = "https://nu.edu.pk/Degree-Programs";
const runtimePath = resolve("dist/test/apply-demo-patch.js");
const evidenceDir = resolve("submission-assets/repairs");
const viewports = [
  { name: "desktop-live", width: 1536, height: 730 },
  { name: "mobile-live", width: 390, height: 844 }
];

const browser = await chromium.launch({ headless: true });
const receipt = [];
try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.locator("table.edu-table-responsive").waitFor({ state: "visible", timeout: 30_000 });
    await page.screenshot({ path: resolve(evidenceDir, `nu-karachi-${viewport.name}-before.png`), fullPage: true });
    await page.addScriptTag({ path: runtimePath });
    const health = await page.evaluate(() => window.__applyNuKarachiPatch());
    const metrics = await page.evaluate(() => ({
      matchingRows: document.querySelectorAll("tr[data-patch-the-web-table-row-match='true']").length,
      hiddenRows: document.querySelectorAll("tr[data-patch-the-web-table-row-hidden='true']").length,
      visibleHeaders: [...document.querySelectorAll("tr.heading-table > th")].filter((cell) => !cell.hidden).length,
      pageFits: document.documentElement.scrollWidth <= window.innerWidth + 2,
      tableFits: (() => {
        const wrapper = document.querySelector(".table-responsive");
        return wrapper ? wrapper.scrollWidth <= wrapper.clientWidth + 2 : false;
      })()
    }));
    await page.screenshot({ path: resolve(evidenceDir, `nu-karachi-${viewport.name}-after.png`), fullPage: true });
    receipt.push({ viewport: viewport.name, health, ...metrics });
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({ target, receipt }, null, 2));
