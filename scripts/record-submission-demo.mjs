import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const outputDir = resolve(root, "dist/video");
const rawDir = resolve(outputDir, `raw-${Date.now()}`);
const finalPath = resolve(root, "submission-assets/openpatch-demo-silent.webm");
const timingPath = resolve(outputDir, "demo-timings.json");
const timings = JSON.parse((await readFile(timingPath, "utf8")).replace(/^\uFEFF/, ""));
if (!Array.isArray(timings.sections) || timings.sections.length !== 9) {
  throw new Error("Run scripts/synthesize-demo-narration.ps1 before recording the nine-section demo.");
}
await mkdir(rawDir, { recursive: true });

const server = await createServer({
  configFile: resolve(root, "vite.config.ts"),
  server: { host: "127.0.0.1", port: 4175, strictPort: true }
});
await server.listen();

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1600, height: 900 },
  deviceScaleFactor: 1,
  recordVideo: { dir: rawDir, size: { width: 1600, height: 900 } },
  colorScheme: "light"
});
const page = await context.newPage();
const video = page.video();

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

async function hold(milliseconds) {
  await page.waitForTimeout(Math.max(20, Math.round(milliseconds)));
}

async function runSection(index, action) {
  const durationMs = Number(timings.sections[index].durationMs);
  const started = Date.now();
  await action(durationMs);
  const remaining = durationMs + 350 - (Date.now() - started);
  if (remaining > 0) await hold(remaining);
}

async function showCard({ eyebrow, title, copy, footer = "OpenPatch · The public feature layer for the web" }) {
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;overflow:hidden;background:radial-gradient(circle at 76% 18%,rgba(65,221,157,.22),transparent 34%),linear-gradient(145deg,#071b15,#123f30);color:#fff;font-family:Inter,Segoe UI,Arial,sans-serif}.shell{width:min(1320px,88vw);animation:enter .55s ease both}.eyebrow{display:inline-flex;align-items:center;gap:9px;padding:9px 14px;border:1px solid rgba(121,229,183,.35);border-radius:999px;color:#79e5b7;background:rgba(121,229,183,.08);font-size:14px;font-weight:850;letter-spacing:.12em;text-transform:uppercase}.eyebrow:before{content:"";width:8px;height:8px;border-radius:50%;background:#79e5b7;box-shadow:0 0 0 5px rgba(121,229,183,.12)}h1{max-width:1180px;margin:28px 0 24px;font-size:86px;line-height:.98;letter-spacing:-.06em}p{max-width:950px;margin:0;color:#c8ded5;font-size:27px;line-height:1.5}.footer{position:fixed;left:6vw;bottom:40px;color:#86a99b;font-size:14px;font-weight:750;letter-spacing:.04em}@keyframes enter{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
  </style></head><body><main class="shell"><span class="eyebrow">${escapeHtml(eyebrow)}</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(copy)}</p></main><div class="footer">${escapeHtml(footer)}</div></body></html>`);
}

async function showFlow() {
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;min-height:100vh;padding:64px 76px;background:linear-gradient(145deg,#f2faf6,#e6f5ee);color:#102c22;font-family:Inter,Segoe UI,Arial,sans-serif}.top{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:54px}.eyebrow{color:#087755;font-size:14px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.top h1{margin:10px 0 0;font-size:62px;letter-spacing:-.055em}.promise{max-width:430px;color:#526a61;font-size:19px;line-height:1.45}.flow{display:grid;grid-template-columns:1fr 100px 1fr 100px 1fr;align-items:center}.step{height:430px;padding:38px;border:1px solid #cbe2d7;border-radius:28px;background:#fff;box-shadow:0 22px 65px rgba(16,44,34,.1)}.number{display:grid;place-items:center;width:54px;height:54px;border-radius:18px;color:white;background:#0b966b;font-size:22px;font-weight:900}.step h2{margin:74px 0 17px;font-size:34px;letter-spacing:-.04em}.step p{margin:0;color:#5b7067;font-size:19px;line-height:1.55}.arrow{color:#0b966b;font-size:58px;font-weight:300;text-align:center}.receipt{display:inline-flex;margin-top:38px;padding:9px 12px;border-radius:999px;color:#087755;background:#e7f8f0;font-size:13px;font-weight:850}
  </style></head><body><header class="top"><div><span class="eyebrow">The entire product in three steps</span><h1>Fix it once. Share it safely.</h1></div><p class="promise">AI handles the ambiguous authoring work once. The installed repair is deterministic, reviewable, and free for everyone downstream.</p></header><main class="flow"><article class="step"><span class="number">1</span><h2>Describe the problem</h2><p>One person tells Codex what the website should do better.</p><span class="receipt">Natural-language request</span></article><div class="arrow">→</div><article class="step"><span class="number">2</span><h2>Codex builds and tests</h2><p>A constrained, domain-scoped patch is validated against the live page.</p><span class="receipt">Safe operations only</span></article><div class="arrow">→</div><article class="step"><span class="number">3</span><h2>Everyone installs</h2><p>The community gets the repair without AI, an account, or an API key.</p><span class="receipt">Verified community patch</span></article></main></body></html>`);
}

async function showSafetyCard() {
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;min-height:100vh;padding:62px 72px;background:#071b15;color:#fff;font-family:Inter,Segoe UI,Arial,sans-serif}.grid{display:grid;grid-template-columns:.9fr 1.1fr;gap:56px;align-items:center;height:100%}.eyebrow{color:#79e5b7;font-size:14px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}h1{margin:18px 0;font-size:64px;line-height:1.02;letter-spacing:-.055em}.lede{color:#c8ded5;font-size:22px;line-height:1.5}.rules{display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-top:34px}.rule{padding:18px;border:1px solid rgba(255,255,255,.12);border-radius:15px;font-size:16px;font-weight:750}.yes{color:#9aefc9;background:rgba(54,199,138,.09)}.no{color:#ffc1b7;background:rgba(220,88,70,.08)}pre{margin:0;padding:32px;border:1px solid #31594a;border-radius:24px;background:#0d2b21;box-shadow:0 28px 75px rgba(0,0,0,.28);font:18px/1.7 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap}.key{color:#79e5b7}.value{color:#ffe9a6}.receipt{display:flex;justify-content:space-between;margin-top:18px;padding:18px 22px;border-radius:15px;color:#bcebd7;background:#123b2d;font-size:16px;font-weight:850}
  </style></head><body><main class="grid"><section><span class="eyebrow">Power without arbitrary code</span><h1>A patch is data, not a userscript.</h1><p class="lede">Codex chooses from trusted building blocks. The extension validates the policy, scope, selectors, and exact bytes before anything runs.</p><div class="rules"><div class="rule yes">✓ Layout & accessibility</div><div class="rule yes">✓ Search, filters & compare</div><div class="rule yes">✓ Local autosave</div><div class="rule no">× No JavaScript or fetch</div><div class="rule no">× No cookies or page dump</div><div class="rule no">× No arbitrary HTML</div></div></section><section><pre>{
  <span class="key">"type"</span>: <span class="value">"collectionFilter"</span>,
  <span class="key">"selector"</span>: <span class="value">"#care-directory"</span>,
  <span class="key">"attributes"</span>: [
    <span class="value">"data-access"</span>,
    <span class="value">"data-languages"</span>,
    <span class="value">"data-availability"</span>
  ],
  <span class="key">"persist"</span>: { <span class="key">"ttlMinutes"</span>: 1440 }
}</pre><div class="receipt"><span>✓ Policy passed</span><span>11/11 operations healthy</span></div></section></main></body></html>`);
}

async function showImage(relativePath, eyebrow, title, copy) {
  const bytes = await readFile(resolve(root, relativePath));
  const source = `data:image/png;base64,${bytes.toString("base64")}`;
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;grid-template-columns:.82fr 1.18fr;gap:56px;align-items:center;padding:54px 68px;background:radial-gradient(circle at 22% 15%,#d9f8eb 0,transparent 34%),#f4faf7;color:#102c22;font-family:Inter,Segoe UI,Arial,sans-serif}.copy{max-width:540px}.eyebrow{display:inline-flex;padding:8px 12px;border-radius:999px;background:#dff7ed;color:#087755;font-size:13px;font-weight:900;letter-spacing:.09em;text-transform:uppercase}.copy h1{margin:22px 0;font-size:59px;line-height:1.02;letter-spacing:-.055em}.copy p{margin:0;color:#526a61;font-size:21px;line-height:1.55}.frame{justify-self:center;max-width:760px;max-height:790px;padding:14px;border:1px solid #cde1d8;border-radius:24px;background:#fff;box-shadow:0 30px 80px rgba(16,44,34,.18)}img{display:block;max-width:100%;max-height:760px;border-radius:14px;object-fit:contain}
  </style></head><body><section class="copy"><span class="eyebrow">${escapeHtml(eyebrow)}</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(copy)}</p></section><div class="frame"><img src="${source}" alt=""></div></body></html>`);
}

async function showBeforeAfter() {
  const before = await readFile(resolve(root, "submission-assets/civicapply-before-mobile.png"));
  const after = await readFile(resolve(root, "submission-assets/civicapply-after-mobile-full.png"));
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;min-height:100vh;padding:45px 64px;background:#edf6f1;color:#102c22;font-family:Inter,Segoe UI,Arial,sans-serif}header{display:flex;align-items:end;justify-content:space-between;margin-bottom:24px}h1{margin:0;font-size:49px;letter-spacing:-.05em}header p{max-width:600px;margin:0;color:#536b61;font-size:18px;line-height:1.45}.pair{display:grid;grid-template-columns:1fr 1fr;gap:30px;height:710px}.panel{position:relative;display:grid;place-items:center;overflow:hidden;padding:18px;border:1px solid #c8ddd3;border-radius:24px;background:#fff;box-shadow:0 18px 55px rgba(16,44,34,.09)}.label{position:absolute;left:22px;top:20px;z-index:2;padding:9px 13px;border-radius:999px;color:#fff;font-size:13px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.before{background:#b94a3c}.after{background:#0b966b}.panel img{display:block;max-width:100%;max-height:660px;object-fit:contain}
  </style></head><body><header><h1>The same engine repairs broken forms.</h1><p>Mobile layout, accessible errors, keyboard navigation, and unfinished progress preserved locally.</p></header><main class="pair"><section class="panel"><span class="label before">Before</span><img src="data:image/png;base64,${before.toString("base64")}" alt=""></section><section class="panel"><span class="label after">After OpenPatch</span><img src="data:image/png;base64,${after.toString("base64")}" alt=""></section></main></body></html>`);
}

async function addCallout(text, tone = "green") {
  await page.evaluate(({ text, tone }) => {
    document.getElementById("openpatch-demo-callout")?.remove();
    const callout = document.createElement("div");
    callout.id = "openpatch-demo-callout";
    callout.textContent = text;
    Object.assign(callout.style, {
      position: "fixed", zIndex: "2147483647", left: "50%", top: "24px", transform: "translateX(-50%)",
      maxWidth: "1200px", padding: "15px 24px", border: `2px solid ${tone === "red" ? "#ffb8ae" : "#8de8c0"}`,
      borderRadius: "16px", color: "white", background: tone === "red" ? "rgba(126,37,28,.94)" : "rgba(7,91,64,.95)",
      boxShadow: "0 16px 45px rgba(0,0,0,.22)", font: "850 20px/1.3 Inter,Segoe UI,Arial,sans-serif",
      letterSpacing: ".01em", textAlign: "center", pointerEvents: "none"
    });
    document.body.append(callout);
  }, { text, tone });
}

async function smoothScroll(selector, position = "center") {
  await page.locator(selector).scrollIntoViewIfNeeded();
  await page.evaluate(({ selector, position }) => document.querySelector(selector)?.scrollIntoView({ behavior: "smooth", block: position }), { selector, position });
  await hold(900);
}

try {
  await runSection(0, async () => {
    await showCard({
      eyebrow: "The problem",
      title: "You depend on websites you cannot change.",
      copy: "Government forms. University portals. Health directories. When the owner will not fix the experience, users are usually stuck."
    });
  });

  await runSection(1, async () => {
    await showFlow();
  });

  await runSection(2, async () => {
    await page.goto("http://127.0.0.1:4175/care/", { waitUntil: "networkidle" });
    await smoothScroll("#care-directory", "start");
    await addCallout("BEFORE: 12 providers · no search · no filters · no comparison", "red");
  });

  await runSection(3, async () => {
    await showImage(
      "submission-assets/openpatch-repair-brief.png",
      "One person starts the repair",
      "Describe the problem. Copy a private brief to Codex.",
      "OpenPatch sends structure—not private content. Codex then inspects the live DOM and screenshots through the authoring skill."
    );
  });

  await runSection(4, async (durationMs) => {
    await showSafetyCard();
    await hold(durationMs * 0.56);
    await page.goto("http://127.0.0.1:4175/care/", { waitUntil: "networkidle" });
    await page.locator("#judge-preview").click();
    await smoothScroll(".openpatch-navigator", "center");
    await addCallout("AFTER OPENPATCH: 11/11 safe operations applied", "green");
  });

  await runSection(5, async () => {
    await page.locator("select[id$='-access']").selectOption("wheelchair");
    await hold(850);
    await page.locator("select[id$='-language']").selectOption("urdu");
    await hold(850);
    await page.locator("select[id$='-availability']").selectOption("new-patients");
    await hold(900);
    await smoothScroll(".care-service-grid", "start");
    await addCallout("Wheelchair + Urdu + new patients → 1 matching clinic", "green");
  });

  await runSection(6, async () => {
    await page.locator(".openpatch-navigator__clear").click();
    await page.getByRole("button", { name: "Add Harbor Family Clinic to comparison" }).click();
    await hold(650);
    await page.getByRole("button", { name: "Add Northside Community Health to comparison" }).click();
    await hold(650);
    await page.getByRole("button", { name: "Compare selected" }).click();
    await smoothScroll(".openpatch-compare", "center");
    await addCallout("A real feature: private, keyboard-accessible comparison", "green");
  });

  await runSection(7, async () => {
    await showImage(
      "submission-assets/openpatch-registry-discovery.png",
      "Everyone else skips the AI step",
      "A verified repair is ready to install.",
      "The extension checks the exact domain, declared permissions, SHA-256 receipt, scheduled compatibility, and current selectors before installation."
    );
  });

  await runSection(8, async (durationMs) => {
    await page.goto("http://127.0.0.1:4175/sentinel/", { waitUntil: "networkidle" });
    await smoothScroll(".drift-lab", "center");
    await page.locator("#simulate-drift").click();
    await addCallout("Website changed? The unsafe patch is quarantined.", "red");
    await hold(durationMs * 0.22);
    await showBeforeAfter();
    await hold(durationMs * 0.16);
    await showCard({
      eyebrow: "OpenPatch",
      title: "Fix the web you have.",
      copy: "One person authors a safe repair. Every other person gets the missing feature—without AI, an account, or an API key.",
      footer: "openpatch-tau.vercel.app · github.com/abbasaliii/openpatch"
    });
  });

  await hold(1200);
} finally {
  await page.close();
  if (video) await video.saveAs(finalPath);
  await context.close();
  await browser.close();
  await server.close();
}

if (!video) throw new Error("Playwright video recording was unavailable");
console.log(`Recorded silent submission demo at ${finalPath}`);
