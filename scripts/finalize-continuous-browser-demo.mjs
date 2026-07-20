import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const require = createRequire(import.meta.url);
const ffmpegPath = require("ffmpeg-static");
const root = resolve(import.meta.dirname, "..");
const videoDir = resolve(root, "dist/video");
const manifest = JSON.parse(await readFile(resolve(videoDir, "continuous-recording-manifest.json"), "utf8"));
const mainPath = resolve(root, "submission-assets/patch-the-web-continuous-main.webm");
const popupOnePath = resolve(root, "submission-assets/patch-the-web-continuous-popup-1.webm");
const popupTwoPath = resolve(root, "submission-assets/patch-the-web-continuous-popup-2.webm");
const narration = JSON.parse(await readFile(resolve(root, "submission-assets/live-demo-narration.json"), "utf8"));
const narrationTimings = JSON.parse(await readFile(resolve(videoDir, "live-demo-timings.json"), "utf8"));
const narrationSectionPaths = manifest.sections.map((_, index) =>
  resolve(videoDir, "audio-patch-the-web-live-demo", `section-${String(index + 1).padStart(2, "0")}.wav`)
);
const stagedPath = resolve(videoDir, "patch-the-web-continuous-final.mp4");
const namedPath = resolve(root, "submission-assets/patch-the-web-live-walkthrough.mp4");
const finalPath = resolve(root, "submission-assets/patch-the-web-demo.mp4");
const captionPath = resolve(root, "submission-assets/patch-the-web-demo.srt");
const contactSheetPath = resolve(videoDir, "patch-the-web-continuous-contact-sheet.png");
await mkdir(videoDir, { recursive: true });

if (narration.length !== manifest.sections.length || narrationTimings.sections.length !== manifest.sections.length) {
  throw new Error("Narration, timing, and recording sections must have the same length.");
}

const seconds = (milliseconds) => (Number(milliseconds) / 1000).toFixed(3);
const srtTime = (milliseconds) => {
  const total = Math.max(0, Math.round(milliseconds));
  const hours = Math.floor(total / 3_600_000);
  const minutes = Math.floor((total % 3_600_000) / 60_000);
  const secondsPart = Math.floor((total % 60_000) / 1_000);
  const millisecondsPart = total % 1_000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secondsPart).padStart(2, "0")},${String(millisecondsPart).padStart(3, "0")}`;
};

const captions = [];
let captionIndex = 1;
narration.forEach((section, sectionIndex) => {
  const sentences = String(section.text).trim().split(/(?<=[.!?])\s+/).filter(Boolean);
  const durationMs = Number(narrationTimings.sections[sectionIndex].durationMs);
  const totalWeight = sentences.reduce((sum, sentence) => sum + Math.max(1, sentence.length), 0);
  let cursorMs = Number(manifest.sections[sectionIndex].startMs);
  sentences.forEach((sentence, sentenceIndex) => {
    const duration = sentenceIndex === sentences.length - 1
      ? Number(manifest.sections[sectionIndex].startMs) + durationMs - cursorMs
      : durationMs * (Math.max(1, sentence.length) / totalWeight);
    captions.push(String(captionIndex), `${srtTime(cursorMs)} --> ${srtTime(cursorMs + duration)}`, sentence, "");
    captionIndex += 1;
    cursorMs += duration;
  });
});
await writeFile(captionPath, `${captions.join("\n").trimEnd()}\n`, "utf8");

const [firstOverlay, secondOverlay] = manifest.overlays;
const filter = [
  "[1:v]crop=390:844:0:0,scale=390:844,format=yuv420p[p1]",
  `[0:v][p1]overlay=x=W-w-24:y=10:enable='between(t,${seconds(firstOverlay.startMs)},${seconds(firstOverlay.endMs)})'[v1]`,
  "[2:v]crop=390:844:0:0,scale=390:844,format=yuv420p[p2]",
  `[v1][p2]overlay=x=W-w-24:y=10:enable='between(t,${seconds(secondOverlay.startMs)},${seconds(secondOverlay.endMs)})'[v]`,
  ...manifest.sections.map((section, index) => `[${index + 3}:a]adelay=${Math.round(section.startMs)}:all=1[n${index}]`),
  `${manifest.sections.map((_, index) => `[n${index}]`).join("")}amix=inputs=${manifest.sections.length}:duration=longest:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[a]`
].join(";");

await run(ffmpegPath, [
  "-hide_banner", "-loglevel", "error", "-y",
  "-ss", seconds(manifest.trimMs.main), "-i", mainPath,
  "-ss", seconds(manifest.trimMs.popupOne), "-i", popupOnePath,
  "-ss", seconds(manifest.trimMs.popupTwo), "-i", popupTwoPath,
  ...narrationSectionPaths.flatMap((path) => ["-i", path]),
  "-filter_complex", filter,
  "-map", "[v]", "-map", "[a]",
  "-c:v", "libx264", "-preset", "medium", "-crf", "18",
  "-pix_fmt", "yuv420p", "-r", "30",
  "-c:a", "aac", "-b:a", "192k",
  "-movflags", "+faststart", "-t", seconds(manifest.durationMs),
  stagedPath
], { maxBuffer: 16 * 1024 * 1024 });

await copyFile(stagedPath, namedPath);
await copyFile(stagedPath, finalPath);
await run(ffmpegPath, [
  "-hide_banner", "-loglevel", "error", "-y",
  "-i", finalPath,
  "-vf", "fps=1/10,scale=380:-1,tile=4x3:padding=8:margin=8:color=0x0b2018",
  "-frames:v", "1", contactSheetPath
], { maxBuffer: 8 * 1024 * 1024 });

const bytes = await readFile(finalPath);
const fileStat = await stat(finalPath);
const sha256 = createHash("sha256").update(bytes).digest("hex").toUpperCase();
console.log(`Final continuous video: ${finalPath}`);
console.log(`Named copy: ${namedPath}`);
console.log(`Bytes: ${fileStat.size}`);
console.log(`SHA-256: ${sha256}`);
console.log(`Contact sheet: ${contactSheetPath}`);
