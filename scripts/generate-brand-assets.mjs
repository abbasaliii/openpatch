import { copyFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const previewDir = resolve(root, "dist/previews");
const assetDir = resolve(root, "submission-assets");

const previewCopies = [
  "civicapply-after-mobile-full.png",
  "civicapply-after-mobile.png",
  "civicapply-before-mobile.png",
  "compatibility-sentinel-quarantine.png",
  "compatibility-sentinel.png",
  "metrocare-after-desktop.png",
  "metrocare-after-mobile.png",
  "metrocare-before-desktop.png",
  "metrocare-before-mobile.png",
  "metrocare-compare-desktop.png",
  "patch-the-web-landing.png",
  "patch-the-web-repair-brief.png"
];

await Promise.all(previewCopies.map((fileName) =>
  copyFile(resolve(previewDir, fileName), resolve(assetDir, fileName))
));
await copyFile(
  resolve(previewDir, "patch-the-web-installed-controls.png"),
  resolve(assetDir, "patch-the-web-registry-discovery.png")
);

const comparison = await readFile(resolve(previewDir, "metrocare-compare-desktop.png"));
const comparisonSource = `data:image/png;base64,${comparison.toString("base64")}`;
const browser = await chromium.launch({ headless: true });

function artwork({ width, height, youtube = false }) {
  const title = youtube ? "FIX WEBSITES<br>YOU DON’T OWN." : "Patch the Web";
  const lead = youtube
    ? "A safe public repair layer for the web"
    : "Safe, shareable fixes for websites you don’t own.";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden}body{position:relative;background:radial-gradient(circle at 83% 12%,rgba(47,213,145,.24),transparent 34%),linear-gradient(145deg,#f8fcfa 0%,#edf8f3 62%,#e2f3eb 100%);color:#0b261d;font-family:Inter,"Segoe UI",Arial,sans-serif}.noise{position:absolute;inset:0;opacity:.18;background-image:linear-gradient(rgba(7,80,57,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(7,80,57,.025) 1px,transparent 1px);background-size:28px 28px}.shell{position:relative;z-index:1;display:grid;grid-template-columns:${youtube ? ".86fr 1.14fr" : ".9fr 1.1fr"};gap:${youtube ? 38 : 54}px;height:100%;padding:${youtube ? "52px 58px" : "76px 78px"};align-items:center}.brand{display:flex;align-items:center;gap:16px;margin-bottom:${youtube ? 34 : 44}px;font-size:${youtube ? 23 : 27}px;font-weight:900;letter-spacing:-.02em}.mark{display:grid;place-items:center;width:${youtube ? 58 : 68}px;height:${youtube ? 58 : 68}px;border-radius:19px;background:#07976a;box-shadow:0 13px 32px rgba(7,151,106,.25)}.mark i{position:absolute;width:${youtube ? 10 : 12}px;height:${youtube ? 35 : 42}px;border-radius:99px;background:white;transform:rotate(39deg)}.mark i:first-child{margin-left:-17px}.mark i:last-child{margin-left:17px}.eyebrow{display:inline-flex;align-items:center;gap:10px;padding:10px 14px;border:1px solid #8fd8bb;border-radius:999px;color:#087551;background:rgba(255,255,255,.72);font-size:${youtube ? 12 : 15}px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.eyebrow:before{content:"";width:8px;height:8px;border-radius:50%;background:#08a473;box-shadow:0 0 0 5px rgba(8,164,115,.11)}h1{margin:${youtube ? "22px 0 18px" : "28px 0 25px"};max-width:720px;font-size:${youtube ? 72 : 92}px;line-height:${youtube ? .92 : .95};letter-spacing:-.065em}p{max-width:650px;margin:0;color:#466359;font-size:${youtube ? 21 : 29}px;line-height:1.42}.chips{display:flex;gap:12px;flex-wrap:wrap;margin-top:${youtube ? 30 : 46}px}.chips span{display:flex;align-items:center;gap:9px;padding:${youtube ? "10px 13px" : "13px 16px"};border:1px solid #b8dfcf;border-radius:12px;color:#123d2f;background:rgba(255,255,255,.78);font-size:${youtube ? 12 : 15}px;font-weight:850}.chips b{display:grid;place-items:center;width:21px;height:21px;border-radius:50%;color:#087956;background:#d8f4e8}.visual{position:relative;min-width:0}.window{overflow:hidden;padding:${youtube ? 9 : 12}px;border:1px solid #c8dfd5;border-radius:${youtube ? 24 : 30}px;background:rgba(255,255,255,.86);box-shadow:0 32px 90px rgba(14,65,48,.19);transform:rotate(-1.2deg)}.window img{display:block;width:100%;height:${youtube ? 476 : 710}px;border-radius:${youtube ? 17 : 22}px;object-fit:cover;object-position:48% 24%}.receipt{position:absolute;right:${youtube ? -4 : -18}px;bottom:${youtube ? -18 : -24}px;min-width:${youtube ? 270 : 340}px;padding:${youtube ? 17 : 22}px;border-radius:${youtube ? 17 : 22}px;color:white;background:linear-gradient(135deg,#0b4b38,#087a56);box-shadow:0 22px 55px rgba(9,67,49,.28)}.receipt strong{display:block;font-size:${youtube ? 17 : 22}px}.receipt span{display:block;margin-top:8px;color:#9ceacb;font-size:${youtube ? 12 : 15}px;font-weight:800}.before{position:absolute;left:${youtube ? -16 : -34}px;top:${youtube ? 38 : 68}px;padding:10px 13px;border-radius:10px;color:#823c31;background:#ffe9e4;font-size:${youtube ? 11 : 14}px;font-weight:900;transform:rotate(-3deg)}
  </style></head><body><div class="noise"></div><main class="shell"><section><div class="brand"><span class="mark"><i></i><i></i></span>Patch the Web</div><span class="eyebrow">The public repair layer for the web</span><h1>${title}</h1><p>${lead}</p><div class="chips"><span><b>✓</b> NO API KEY</span><span><b>✓</b> SAFE DSL</span><span><b>✓</b> DOMAIN SCOPED</span></div></section><section class="visual"><div class="before">BEFORE: no search or comparison</div><div class="window"><img src="${comparisonSource}" alt=""></div><div class="receipt"><strong>Feature active</strong><span>✓ 11/11 operations healthy</span></div></section></main></body></html>`;
}

try {
  const devpost = await browser.newPage({ viewport: { width: 1536, height: 1024 }, deviceScaleFactor: 1 });
  await devpost.setContent(artwork({ width: 1536, height: 1024 }), { waitUntil: "load" });
  await devpost.screenshot({ path: resolve(assetDir, "patch-the-web-devpost-thumbnail.png") });

  const youtube = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await youtube.setContent(artwork({ width: 1280, height: 720, youtube: true }), { waitUntil: "load" });
  await youtube.screenshot({ path: resolve(assetDir, "patch-the-web-youtube-thumbnail.png") });
} finally {
  await browser.close();
}

console.log(`Generated Patch the Web brand assets in ${assetDir}`);
