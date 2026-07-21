import { chromium } from "@playwright/test";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const extensionPath = resolve(root, "dist/extension");
const rawDir = resolve(root, `dist/video/continuous-raw-${Date.now()}`);
const mainVideoPath = resolve(root, "submission-assets/patch-the-web-continuous-main.webm");
const popupOnePath = resolve(root, "submission-assets/patch-the-web-continuous-popup-1.webm");
const popupTwoPath = resolve(root, "submission-assets/patch-the-web-continuous-popup-2.webm");
const manifestPath = resolve(root, "dist/video/continuous-recording-manifest.json");
const timingPath = resolve(root, "dist/video/live-demo-timings.json");
const timings = JSON.parse((await readFile(timingPath, "utf8")).replace(/^\uFEFF/, ""));
if (!Array.isArray(timings.sections) || timings.sections.length !== 10) {
  throw new Error("Generate the ten-section live narration before recording.");
}
await mkdir(rawDir, { recursive: true });
const profilePrefix = join(tmpdir(), "patch-the-web-continuous-recording-");
const profilePath = await mkdtemp(profilePrefix);

const homeUrl = "https://patch-the-web.vercel.app/";
const careUrl = "https://patch-the-web.vercel.app/care/";
const wait = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

async function addRecordingCursor(page) {
  await page.addInitScript(() => {
    const mount = () => {
      if (document.querySelector("[data-patch-the-web-recording-cursor]")) return;
      const cursor = document.createElement("div");
      cursor.setAttribute("data-patch-the-web-recording-cursor", "");
      Object.assign(cursor.style, {
        position: "fixed", zIndex: "2147483647", width: "22px", height: "22px",
        margin: "-11px 0 0 -11px", border: "3px solid white", borderRadius: "50%",
        background: "#0b9a6d", boxShadow: "0 2px 9px rgba(0,0,0,.4)",
        pointerEvents: "none", left: "28px", top: "28px", transition: "transform .08s ease"
      });
      document.documentElement.append(cursor);
      addEventListener("mousemove", (event) => {
        cursor.style.left = `${event.clientX}px`;
        cursor.style.top = `${event.clientY}px`;
      }, { passive: true });
      addEventListener("mousedown", () => { cursor.style.transform = "scale(.72)"; });
      addEventListener("mouseup", () => { cursor.style.transform = "scale(1)"; });
    };
    if (document.readyState === "loading") addEventListener("DOMContentLoaded", mount, { once: true });
    else mount();
  });
}

async function pointAt(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error("Could not locate a visible recording target.");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
  await wait(280);
}

async function visibleClick(page, locator) {
  await pointAt(page, locator);
  await locator.click();
}

const sectionEvents = [];
let recordingStartedAt = 0;
async function runSection(index, action) {
  const durationMs = Number(timings.sections[index].durationMs);
  const startedAt = Date.now();
  sectionEvents.push({ title: timings.sections[index].title, startMs: startedAt - recordingStartedAt });
  console.log(`[${index + 1}/10] ${timings.sections[index].title}`);
  await action(durationMs);
  const remaining = durationMs - (Date.now() - startedAt);
  if (remaining > 0) await wait(remaining);
  sectionEvents[index].endMs = Date.now() - recordingStartedAt;
}

const context = await chromium.launchPersistentContext(profilePath, {
  channel: "chromium",
  headless: true,
  viewport: { width: 1536, height: 864 },
  deviceScaleFactor: 1,
  colorScheme: "light",
  acceptDownloads: true,
  recordVideo: { dir: rawDir, size: { width: 1536, height: 864 } },
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`
  ]
});

let mainPage;
let popupOne;
let popupTwo;
let mainVideo;
let popupOneVideo;
let popupTwoVideo;
let mainRawVideoPath;
let popupOneRawVideoPath;
let popupTwoRawVideoPath;
let mainCreatedAt;
let popupOneCreatedAt;
let popupTwoCreatedAt;
const overlays = [];
try {
  await Promise.all(context.pages().map((page) => page.close().catch(() => undefined)));
  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent("serviceworker");
  const extensionId = new URL(worker.url()).host;

  popupOneCreatedAt = Date.now();
  popupOne = await context.newPage();
  popupOneVideo = popupOne.video();
  popupOneRawVideoPath = await popupOneVideo.path();
  await addRecordingCursor(popupOne);

  popupTwoCreatedAt = Date.now();
  popupTwo = await context.newPage();
  popupTwoVideo = popupTwo.video();
  popupTwoRawVideoPath = await popupTwoVideo.path();
  await addRecordingCursor(popupTwo);

  mainCreatedAt = Date.now();
  mainPage = await context.newPage();
  mainVideo = mainPage.video();
  mainRawVideoPath = await mainVideo.path();
  await addRecordingCursor(mainPage);
  await mainPage.goto(homeUrl, { waitUntil: "networkidle" });
  recordingStartedAt = Date.now();

  await runSection(0, async () => {
    await mainPage.locator(".hero-copy").waitFor({ state: "visible" });
    await pointAt(mainPage, mainPage.locator(".hero-copy h1"));
  });

  await runSection(1, async () => {
    const downloadLink = mainPage.locator('.hero-actions a[href="/downloads/patch-the-web-extension-v0.8.0.zip"]');
    if (await downloadLink.count() !== 1) throw new Error("The public v0.8.0 extension link is missing.");
    await pointAt(mainPage, downloadLink);
    const downloadPromise = mainPage.waitForEvent("download");
    await downloadLink.click();
    const download = await downloadPromise;
    if (!await download.path()) throw new Error("The public extension download did not finish.");
    await wait(1_200);
    await mainPage.goto("chrome://extensions/");
    await mainPage.locator("extensions-manager").waitFor({ state: "attached" });
    const extensionCard = mainPage.locator("extensions-item").filter({ hasText: "Patch the Web" });
    if (await extensionCard.count() !== 1) throw new Error("Chrome did not show the Patch the Web extension card.");
    await extensionCard.scrollIntoViewIfNeeded();
  });

  await runSection(2, async () => {
    await mainPage.goto(careUrl, { waitUntil: "networkidle" });
    if (await mainPage.locator(".care-service").count() !== 12) throw new Error("The original directory did not show twelve services.");
    if (await mainPage.locator(".patch-the-web-navigator").count() !== 0) throw new Error("The clean browser unexpectedly started repaired.");
    await mainPage.locator("#services").scrollIntoViewIfNeeded();
    await wait(800);
    await mainPage.mouse.wheel(0, 320);
  });

  await runSection(3, async () => {
    const overlay = { input: 1, startMs: Date.now() - recordingStartedAt };
    overlays.push(overlay);
    await popupOne.goto(`chrome-extension://${extensionId}/popup.html`);
    await popupOne.locator("#registry-match").waitFor({ state: "visible" });
    await popupOne.getByText("11/11 operation targets healthy", { exact: true }).waitFor({ state: "visible" });
    await popupOne.getByText("Verified and healthy on this page. One click to install.", { exact: true }).waitFor({ state: "visible" });
    await popupOne.locator("#install-button").scrollIntoViewIfNeeded();
  });

  await runSection(4, async () => {
    const installButton = popupOne.locator("#install-button");
    await pointAt(popupOne, installButton);
    await installButton.click();
    await mainPage.locator(".patch-the-web-navigator").waitFor({ state: "visible", timeout: 20_000 });
    overlays[0].endMs = Date.now() - recordingStartedAt;
    await popupOne.close();
    popupOne = undefined;
    await mainPage.locator(".patch-the-web-navigator").scrollIntoViewIfNeeded();
    await mainPage.getByText("12 of 12 services match", { exact: true }).waitFor({ state: "visible" });
  });

  await runSection(5, async () => {
    const harbor = mainPage.getByRole("button", { name: "Add Harbor Family Clinic to comparison" });
    const northside = mainPage.getByRole("button", { name: "Add Northside Community Health to comparison" });
    if (await harbor.count() !== 1 || await northside.count() !== 1) throw new Error("Comparison controls are missing.");
    await visibleClick(mainPage, harbor);
    await wait(500);
    await visibleClick(mainPage, northside);
    await wait(500);
    await visibleClick(mainPage, mainPage.getByRole("button", { name: "Compare selected" }));
    await mainPage.locator(".patch-the-web-compare table").waitFor({ state: "visible" });
  });

  await runSection(6, async () => {
    await visibleClick(mainPage, mainPage.getByRole("button", { name: "Close comparison" }));
    await mainPage.locator(".patch-the-web-navigator").scrollIntoViewIfNeeded();
    const filters = [
      [mainPage.locator("select[id$='-access']"), "wheelchair"],
      [mainPage.locator("select[id$='-language']"), "urdu"],
      [mainPage.locator("select[id$='-availability']"), "new-patients"]
    ];
    for (const [locator, value] of filters) {
      if (await locator.count() !== 1) throw new Error(`Missing repair filter: ${value}`);
      await pointAt(mainPage, locator);
      await locator.selectOption(value);
      await wait(450);
    }
    await mainPage.getByText("1 of 12 services match", { exact: true }).waitFor({ state: "visible" });
  });

  await runSection(7, async () => {
    await wait(700);
    await mainPage.reload({ waitUntil: "networkidle" });
    await mainPage.locator(".patch-the-web-navigator").waitFor({ state: "visible" });
    await mainPage.locator(".patch-the-web-navigator").scrollIntoViewIfNeeded();
    await mainPage.getByText("1 of 12 services match", { exact: true }).waitFor({ state: "visible" });
    const persisted = await Promise.all([
      mainPage.locator("select[id$='-access']").inputValue(),
      mainPage.locator("select[id$='-language']").inputValue(),
      mainPage.locator("select[id$='-availability']").inputValue()
    ]);
    if (persisted.join("|") !== "wheelchair|urdu|new-patients") throw new Error("Filter persistence failed after reload.");
  });

  await runSection(8, async () => {
    const overlay = { input: 2, startMs: Date.now() - recordingStartedAt };
    overlays.push(overlay);
    await popupTwo.goto(`chrome-extension://${extensionId}/popup.html`);
    await popupTwo.getByText("Repair is active", { exact: true }).waitFor({ state: "visible" });
    await popupTwo.getByText("11/11 operations healthy", { exact: true }).waitFor({ state: "visible" });
    const permissions = popupTwo.locator("details");
    await permissions.scrollIntoViewIfNeeded();
    await visibleClick(popupTwo, permissions.locator("summary"));
  });

  await runSection(9, async () => {
    await wait(2_000);
    await popupTwo.locator("footer").scrollIntoViewIfNeeded();
    overlays[1].endMs = Date.now() - recordingStartedAt + Math.max(0, Number(timings.sections[9].durationMs) - 2_000);
  });
  await popupTwo.close();
  popupTwo = undefined;
  await mainPage.close();
  mainPage = undefined;
} finally {
  const recordingEndedAt = Date.now();
  if (overlays[1] && !overlays[1].endMs) overlays[1].endMs = recordingEndedAt - recordingStartedAt;
  await Promise.all(context.pages().map((page) => page.close().catch(() => undefined)));
  await context.close().catch(() => undefined);
  if (profilePath.startsWith(profilePrefix)) await rm(profilePath, { recursive: true, force: true }).catch(() => undefined);
}
// Playwright guarantees video files are complete after the context closes.
// Copying them only now keeps all encoder/file-system waits outside the demo
// and avoids waiting on a video while its browser context is still alive.
await Promise.all([
  copyFile(mainRawVideoPath, mainVideoPath),
  copyFile(popupOneRawVideoPath, popupOnePath),
  copyFile(popupTwoRawVideoPath, popupTwoPath)
]);
const manifest = {
  trimMs: {
    main: recordingStartedAt - mainCreatedAt,
    popupOne: recordingStartedAt - popupOneCreatedAt,
    popupTwo: recordingStartedAt - popupTwoCreatedAt
  },
  durationMs: sectionEvents.at(-1)?.endMs ?? timings.totalMs,
  sections: sectionEvents,
  overlays
};
const overruns = sectionEvents.map((section, index) => ({
  title: section.title,
  overrunMs: Math.max(0, (section.endMs - section.startMs) - Number(timings.sections[index].durationMs))
}));
const worstOverrun = overruns.reduce((worst, item) => item.overrunMs > worst.overrunMs ? item : worst, { title: "none", overrunMs: 0 });
if (worstOverrun.overrunMs > 2_000) {
  throw new Error(`Recording action overran narration by ${worstOverrun.overrunMs} ms in \"${worstOverrun.title}\".`);
}
await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
console.log(`Main continuous capture: ${mainVideoPath}`);
console.log(`Popup captures: ${popupOnePath}, ${popupTwoPath}`);
console.log(`Recording manifest: ${manifestPath}`);
