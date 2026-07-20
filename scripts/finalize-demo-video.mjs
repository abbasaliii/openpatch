import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const require = createRequire(import.meta.url);
const ffmpegPath = require("ffmpeg-static");
const root = resolve(import.meta.dirname, "..");
const videoDir = resolve(root, "dist/video");
const silentPath = resolve(root, "submission-assets/patch-the-web-demo-silent.webm");
const narrationPath = resolve(videoDir, "patch-the-web-demo-narration.wav");
const stagedPath = resolve(videoDir, "patch-the-web-demo-final.mp4");
const finalPath = resolve(root, "submission-assets/patch-the-web-demo.mp4");
const contactSheetPath = resolve(videoDir, "patch-the-web-demo-contact-sheet-v2.png");
await mkdir(videoDir, { recursive: true });

await run(ffmpegPath, [
  "-hide_banner", "-loglevel", "error", "-y",
  "-i", silentPath,
  "-i", narrationPath,
  "-filter_complex", "[1:a]loudnorm=I=-16:TP=-1.5:LRA=11[a]",
  "-map", "0:v:0", "-map", "[a]",
  "-c:v", "libx264", "-preset", "medium", "-crf", "18",
  "-pix_fmt", "yuv420p", "-r", "30",
  "-c:a", "aac", "-b:a", "192k",
  "-movflags", "+faststart", "-shortest",
  stagedPath
], { maxBuffer: 8 * 1024 * 1024 });

await copyFile(stagedPath, finalPath);
await run(ffmpegPath, [
  "-hide_banner", "-loglevel", "error", "-y",
  "-i", finalPath,
  "-vf", "fps=1/14,scale=380:-1,tile=4x3:padding=8:margin=8:color=0x0b2018",
  "-frames:v", "1",
  contactSheetPath
], { maxBuffer: 8 * 1024 * 1024 });

const bytes = await readFile(finalPath);
const fileStat = await stat(finalPath);
const sha256 = createHash("sha256").update(bytes).digest("hex").toUpperCase();
console.log(`Final video: ${finalPath}`);
console.log(`Bytes: ${fileStat.size}`);
console.log(`SHA-256: ${sha256}`);
console.log(`Contact sheet: ${contactSheetPath}`);
