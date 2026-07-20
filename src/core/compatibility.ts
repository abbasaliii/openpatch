import type { SelectorPreflightResult } from "./preflight";

export type CompatibilityStatus = "healthy" | "drifted" | "unreachable";

export type PatchCompatibilityReport = {
  id: string;
  version: string;
  pageUrl: string;
  status: CompatibilityStatus;
  checkedAt: string;
  patchSha256: string;
  healthy: number;
  total: number;
  fingerprint: string;
  driftedOperationIds: string[];
  results: SelectorPreflightResult["results"];
  error?: string;
};

export type RegistryCompatibilityReport = {
  schemaVersion: 1;
  generatedAt: string;
  registryUrl: string;
  summary: { healthy: number; drifted: number; unreachable: number; total: number };
  patches: PatchCompatibilityReport[];
};

export function compatibilityEvidence(patchSha256: string, preflight: SelectorPreflightResult) {
  const operations = [...preflight.results]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((result) => `${result.id}:${result.matched}:${result.healthy ? 1 : 0}`)
    .join("|");
  return `${patchSha256}|${preflight.healthy}/${preflight.total}|${operations}`;
}

export function compatibilityStatus(preflight: SelectorPreflightResult): CompatibilityStatus {
  return preflight.total > 0 && preflight.healthy === preflight.total ? "healthy" : "drifted";
}

export function summarizeCompatibility(patches: PatchCompatibilityReport[]) {
  return {
    healthy: patches.filter((patch) => patch.status === "healthy").length,
    drifted: patches.filter((patch) => patch.status === "drifted").length,
    unreachable: patches.filter((patch) => patch.status === "unreachable").length,
    total: patches.length
  };
}
