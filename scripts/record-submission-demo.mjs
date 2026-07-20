import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const outputDir = resolve(root, "dist/video");
const rawDir = resolve(outputDir, `raw-${Date.now()}`);
const finalPath = resolve(root, "submission-assets/openpatch-demo-silent.webm");
const runtimePath = resolve(root, "dist/test/apply-demo-patch.js");
const timingScale = Number(process.env.OPENPATCH_DEMO_TIMING_SCALE ?? "1");
if (!Number.isFinite(timingScale) || timingScale < 0.02 || timingScale > 2) {
  throw new Error("OPENPATCH_DEMO_TIMING_SCALE must be between 0.02 and 2");
}
await mkdir(rawDir, { recursive: true });

const server = await createServer({
  configFile: resolve(root, "vite.config.ts"),
  server: { host: "127.0.0.1", port: 4175 }
});
await server.listen();

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  recordVideo: { dir: rawDir, size: { width: 1440, height: 900 } },
  colorScheme: "light"
});
const page = await context.newPage();
const video = page.video();

async function hold(milliseconds) {
  await page.waitForTimeout(Math.max(20, Math.round(milliseconds * timingScale)));
}

async function smoothScroll(selector, position = "center") {
  await page.locator(selector).scrollIntoViewIfNeeded();
  await page.evaluate(({ selector, position }) => {
    document.querySelector(selector)?.scrollIntoView({ behavior: "smooth", block: position });
  }, { selector, position });
  await hold(1300);
}

async function showImage(relativePath, eyebrow, title, copy) {
  const bytes = await readFile(resolve(root, relativePath));
  const source = `data:image/png;base64,${bytes.toString("base64")}`;
  await page.setContent(`<!doctype html>
    <html><head><meta charset="utf-8"><style>
      *{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 70% 15%,#d9f8eb 0,transparent 36%),#f4faf7;color:#102c22;font-family:Inter,Segoe UI,Arial,sans-serif;min-height:100vh;display:grid;grid-template-columns:0.86fr 1.14fr;gap:54px;align-items:center;padding:64px 76px}.copy{max-width:520px}.eyebrow{display:inline-flex;padding:8px 12px;border-radius:999px;background:#dff7ed;color:#087755;font-weight:800;font-size:13px;letter-spacing:.08em;text-transform:uppercase}.copy h1{font-size:58px;line-height:1.02;letter-spacing:-.055em;margin:22px 0}.copy p{font-size:21px;line-height:1.55;color:#526a61;margin:0}.frame{justify-self:center;max-height:780px;max-width:640px;padding:14px;background:#fff;border:1px solid #cde1d8;border-radius:24px;box-shadow:0 30px 80px rgba(16,44,34,.18)}img{display:block;max-width:100%;max-height:750px;border-radius:14px;object-fit:contain}
    </style></head><body><section class="copy"><span class="eyebrow">${eyebrow}</span><h1>${title}</h1><p>${copy}</p></section><div class="frame"><img src="${source}" alt=""></div></body></html>`);
  await hold(900);
}

try {
  await page.goto("http://127.0.0.1:4175/", { waitUntil: "networkidle" });
  await hold(6500);
  await smoothScroll("#repairs", "start");
  await hold(4500);

  await page.goto("http://127.0.0.1:4175/care/", { waitUntil: "networkidle" });
  await hold(6000);
  await smoothScroll(".care-service-grid", "start");
  await hold(6500);

  await showImage(
    "submission-assets/openpatch-repair-brief.png",
    "Private by construction",
    "A Repair Brief for Codex. Not a page dump.",
    "Only bounded structural signals leave the page. Field values, page text, cookies, storage, and query strings stay out."
  );
  await hold(8500);

  await page.goto("http://127.0.0.1:4175/", { waitUntil: "networkidle" });
  await smoothScroll("#safety", "center");
  await hold(11000);

  await page.goto("http://127.0.0.1:4175/care/", { waitUntil: "networkidle" });
  await page.locator("#judge-preview").click();
  await hold(3500);
  await page.getByRole("button", { name: "Add Harbor Family Clinic to comparison" }).click();
  await hold(1200);
  await page.getByRole("button", { name: "Add Northside Community Health to comparison" }).click();
  await hold(1800);
  await page.getByRole("button", { name: "Compare selected" }).click();
  await hold(10500);

  await page.getByRole("button", { name: "Close comparison" }).click();
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await page.locator("select[id$='-access']").selectOption("wheelchair");
  await hold(1100);
  await page.locator("select[id$='-language']").selectOption("urdu");
  await hold(1100);
  await page.locator("select[id$='-availability']").selectOption("new-patients");
  await hold(9500);

  await showImage(
    "submission-assets/openpatch-registry-discovery.png",
    "One author. Everyone benefits.",
    "Verified before install.",
    "Exact scope, declared permissions, SHA-256 integrity, scheduled compatibility, and a fresh live preflight—without an account or API key."
  );
  await hold(9500);

  await page.goto("http://127.0.0.1:4175/sentinel/", { waitUntil: "networkidle" });
  await hold(7500);
  await smoothScroll(".drift-lab", "center");
  await page.locator("#simulate-drift").click();
  await hold(9500);

  await page.goto("http://127.0.0.1:4175/", { waitUntil: "networkidle" });
  await smoothScroll(".impact-band", "center");
  await hold(8500);
} finally {
  await page.close();
  if (video) await video.saveAs(finalPath);
  await context.close();
  await browser.close();
  await server.close();
}

if (!video) throw new Error("Playwright video recording was unavailable");
console.log(`Recorded silent submission demo at ${finalPath}`);
