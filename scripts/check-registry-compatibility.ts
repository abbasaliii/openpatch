import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright";
import {
  compatibilityEvidence,
  compatibilityStatus,
  summarizeCompatibility,
  type PatchCompatibilityReport,
  type RegistryCompatibilityReport
} from "../src/core/compatibility";
import type { SelectorPreflightResult } from "../src/core/preflight";
import { parsePublicRegistry } from "../src/core/remote-registry";
import type { OpenPatch } from "../src/core/types";
import { validatePatch } from "../src/core/validator";

const option = (name: string, fallback: string) => {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
};

const positionalOutput = process.argv.slice(2).find((argument) => !argument.startsWith("--"));
const registryUrl = option("--registry", "https://openpatch-tau.vercel.app/registry/index.json");
const outputPath = resolve(option("--out", positionalOutput ?? "compatibility-report.json"));
const runtimePath = resolve(import.meta.dirname, "../dist/test/preflight-runtime.js");
const checkedAt = new Date().toISOString();

function publicPageUrl(patch: OpenPatch) {
  const host = patch.match.hosts.find((candidate) => candidate !== "localhost" && candidate !== "127.0.0.1");
  if (!host) throw new Error("Patch has no monitorable public host.");
  const path = patch.match.paths[0]?.replace(/\*.*$/, "") || "/";
  return new URL(path, `https://${host}`).toString();
}

const indexResponse = await fetch(registryUrl, { cache: "no-store" });
if (!indexResponse.ok) throw new Error(`Registry returned ${indexResponse.status}.`);
const index = parsePublicRegistry(await indexResponse.json());
if (!index) throw new Error("Registry metadata failed its safety policy.");

const browser = await chromium.launch({ headless: true });
const reports: PatchCompatibilityReport[] = [];
try {
  for (const entry of index.patches) {
    let pageUrl = `https://${entry.scope.hosts[0]}/`;
    try {
      const patchResponse = await fetch(new URL(entry.download, new URL(registryUrl).origin), { cache: "no-store" });
      if (!patchResponse.ok) throw new Error(`Patch download returned ${patchResponse.status}.`);
      const raw = await patchResponse.text();
      const sha256 = createHash("sha256").update(raw).digest("hex");
      if (sha256 !== entry.sha256) throw new Error("Registry SHA-256 receipt does not match the patch bytes.");
      const validation = validatePatch(JSON.parse(raw) as unknown);
      if (!validation.ok) throw new Error(`Patch policy failed at ${validation.issues[0]?.path}.`);
      const patch = validation.patch;
      pageUrl = publicPageUrl(patch);

      const page = await browser.newPage();
      try {
        const navigation = await page.goto(pageUrl, { waitUntil: "networkidle", timeout: 30_000 });
        if (!navigation?.ok()) throw new Error(`Monitored page returned ${navigation?.status() ?? "no response"}.`);
        await page.addScriptTag({ path: runtimePath });
        const serializedPatch = JSON.stringify(patch).replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");
        const preflight = await page.evaluate<SelectorPreflightResult>(`window.__preflightOpenPatch(${serializedPatch})`);
        const evidence = compatibilityEvidence(sha256, preflight);
        const fingerprint = createHash("sha256").update(evidence).digest("hex");
        reports.push({
          id: patch.id,
          version: patch.version,
          pageUrl,
          status: compatibilityStatus(preflight),
          checkedAt,
          patchSha256: sha256,
          healthy: preflight.healthy,
          total: preflight.total,
          fingerprint,
          driftedOperationIds: preflight.results.filter((result) => !result.healthy).map((result) => result.id),
          results: preflight.results
        });
      } finally {
        await page.close();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown compatibility error";
      reports.push({
        id: entry.id,
        version: entry.version,
        pageUrl,
        status: "unreachable",
        checkedAt,
        patchSha256: entry.sha256,
        healthy: 0,
        total: entry.verification.operations,
        fingerprint: createHash("sha256").update(`${entry.sha256}|unreachable|${message}`).digest("hex"),
        driftedOperationIds: [],
        results: [],
        error: message
      });
    }
  }
} finally {
  await browser.close();
}

const report: RegistryCompatibilityReport = {
  schemaVersion: 1,
  generatedAt: checkedAt,
  registryUrl,
  summary: summarizeCompatibility(reports),
  patches: reports
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
for (const patch of reports) {
  const icon = patch.status === "healthy" ? "✓" : "✗";
  console.log(`${icon} ${patch.id}@${patch.version}: ${patch.status} (${patch.healthy}/${patch.total}) ${patch.pageUrl}`);
}
console.log(`Compatibility report: ${outputPath}`);
if (report.summary.healthy !== report.summary.total) process.exitCode = 1;
