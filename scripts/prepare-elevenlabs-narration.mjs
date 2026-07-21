import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const require = createRequire(import.meta.url);
const ffmpegPath = require("ffmpeg-static");
const root = resolve(import.meta.dirname, "..");
const inputPath = resolve(root, "submission-assets/patch-the-web-elevenlabs-roger.mp3");
const narrationPath = resolve(root, "submission-assets/live-demo-narration.json");
const timingPath = resolve(root, "dist/video/live-demo-timings.json");
const audioDir = resolve(root, "dist/video/audio-patch-the-web-live-demo");
const sections = JSON.parse(await readFile(narrationPath, "utf8"));
const reference = JSON.parse(await readFile(timingPath, "utf8"));

if (sections.length !== 10 || reference.sections.length !== sections.length) {
  throw new Error("Expected ten narration sections and ten reference timings.");
}

await mkdir(audioDir, { recursive: true });
const analysis = await run(ffmpegPath, [
  "-hide_banner", "-i", inputPath,
  "-af", "silencedetect=noise=-38dB:d=0.25",
  "-f", "null", "NUL"
], { maxBuffer: 8 * 1024 * 1024 });
const diagnostic = `${analysis.stdout}\n${analysis.stderr}`;
const durationMatch = diagnostic.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
if (!durationMatch) throw new Error("Could not read ElevenLabs audio duration.");
const totalSeconds = Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3]);

const silences = [];
const silencePattern = /silence_end:\s*([\d.]+)\s*\|\s*silence_duration:\s*([\d.]+)/g;
for (const match of diagnostic.matchAll(silencePattern)) {
  silences.push({ end: Number(match[1]), duration: Number(match[2]) });
}
if (silences.length < sections.length - 1) throw new Error("Not enough natural pauses to align narration sections.");

const referenceTotal = reference.sections.reduce((sum, section) => sum + Number(section.durationMs), 0);
let referenceCursor = 0;
let previousBoundary = 0;
const boundaries = [0];
for (let index = 0; index < sections.length - 1; index += 1) {
  referenceCursor += Number(reference.sections[index].durationMs);
  const predicted = totalSeconds * (referenceCursor / referenceTotal);
  const candidates = silences.filter((silence) => silence.end > previousBoundary + 3 && Math.abs(silence.end - predicted) <= 2.25);
  if (!candidates.length) throw new Error(`No natural pause found near ${predicted.toFixed(3)} seconds for section ${index + 1}.`);
  const chosen = candidates.reduce((best, candidate) => {
    const score = Math.abs(candidate.end - predicted) + (candidate.duration < 0.35 ? 0.35 : 0);
    return score < best.score ? { ...candidate, score } : best;
  }, { score: Number.POSITIVE_INFINITY });
  boundaries.push(chosen.end);
  previousBoundary = chosen.end;
}
boundaries.push(totalSeconds);

const outputTimings = [];
for (let index = 0; index < sections.length; index += 1) {
  const start = boundaries[index];
  const end = boundaries[index + 1];
  const outputPath = resolve(audioDir, `section-${String(index + 1).padStart(2, "0")}.wav`);
  await run(ffmpegPath, [
    "-hide_banner", "-loglevel", "error", "-y",
    "-ss", start.toFixed(3), "-to", end.toFixed(3), "-i", inputPath,
    "-vn", "-ac", "1", "-ar", "44100", "-c:a", "pcm_s16le", outputPath
  ], { maxBuffer: 4 * 1024 * 1024 });
  outputTimings.push({ title: sections[index].title, durationMs: Math.round((end - start) * 1000) });
}

const timingDocument = {
  source: "ElevenLabs Roger, Multilingual v2",
  sections: outputTimings,
  totalMs: outputTimings.reduce((sum, section) => sum + section.durationMs, 0)
};
await writeFile(timingPath, `${JSON.stringify(timingDocument, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ totalSeconds, boundaries, sections: outputTimings }, null, 2));
