import { appendFile, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  compatibilityMaterialState,
  type RegistryCompatibilityReport
} from "../src/core/compatibility";

const candidatePath = resolve(process.argv[2] ?? "compatibility-report.json");
const publishedPath = resolve(process.argv[3] ?? "src/registry/compatibility.json");
const summaryIndex = process.argv.indexOf("--summary");
const summaryPath = summaryIndex >= 0 && process.argv[summaryIndex + 1]
  ? resolve(process.argv[summaryIndex + 1])
  : undefined;

const candidate = parseReport(await readFile(candidatePath, "utf8"), "candidate");
const published = parseReport(await readFile(publishedPath, "utf8"), "published");
const materiallyChanged = JSON.stringify(compatibilityMaterialState(candidate)) !==
  JSON.stringify(compatibilityMaterialState(published));

if (summaryPath) await appendFile(summaryPath, markdownSummary(candidate), "utf8");

if (materiallyChanged) {
  await writeFile(publishedPath, `${JSON.stringify(candidate, null, 2)}\n`, "utf8");
  console.log(`Material compatibility state changed; promoted ${candidatePath} to ${publishedPath}.`);
} else {
  console.log("No material compatibility state changed; the published receipt remains stable.");
}

function parseReport(raw: string, label: string) {
  const value = JSON.parse(raw) as Partial<RegistryCompatibilityReport>;
  if (value.schemaVersion !== 1 || !value.summary || !Array.isArray(value.patches)) {
    throw new Error(`The ${label} compatibility report is malformed.`);
  }
  for (const patch of value.patches) {
    if (!patch.id || !patch.version || !patch.status || !patch.patchSha256 || !patch.fingerprint) {
      throw new Error(`The ${label} compatibility report has an incomplete patch receipt.`);
    }
  }
  return value as RegistryCompatibilityReport;
}

function markdownSummary(report: RegistryCompatibilityReport) {
  const rows = [...report.patches]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((patch) => {
      const icon = patch.status === "healthy" ? "✅" : patch.status === "drifted" ? "⛔" : "⚠️";
      return `| ${escapeCell(patch.id)} | ${icon} ${patch.status} | ${patch.healthy}/${patch.total} | ${escapeCell(patch.checkedAt)} |`;
    });
  return [
    "## OpenPatch Compatibility Sentinel",
    "",
    `Checked ${report.summary.total} patches: ${report.summary.healthy} healthy, ${report.summary.drifted} drifted, ${report.summary.unreachable} unreachable.`,
    "",
    "| Patch | State | Operations | Checked (UTC) |",
    "| --- | --- | ---: | --- |",
    ...rows,
    ""
  ].join("\n");
}

function escapeCell(value: string) {
  return value.replaceAll("|", "\\|");
}
