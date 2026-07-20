import { patchMatchesUrl } from "./matcher";
import type { OpenPatch, PatchCapability } from "./types";

export const PUBLIC_REGISTRY_URL = "https://openpatch-tau.vercel.app/registry/index.json";

export type RegistryPatchEntry = {
  id: string;
  name: string;
  summary: string;
  version: string;
  scope: OpenPatch["match"];
  capabilities: OpenPatch["capabilities"];
  download: string;
  sha256: string;
  verification: { status: "verified"; operations: number; assertions: number };
  compatibility?: {
    status: "healthy" | "drifted" | "unreachable";
    checkedAt: string;
    pageUrl: string;
    patchSha256: string;
    healthy: number;
    total: number;
    fingerprint: string;
    driftedOperationIds: string[];
  };
};

export type PublicRegistryIndex = {
  schemaVersion: 1;
  patches: RegistryPatchEntry[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const CAPABILITIES = new Set<PatchCapability>([
  "layout",
  "accessibility",
  "local-storage",
  "keyboard-navigation",
  "validation",
  "content-filter",
  "hide-elements",
  "reorganize"
]);

const isShortString = (value: unknown, maximum = 500) =>
  typeof value === "string" && value.length > 0 && value.length <= maximum;

const isStringArray = (value: unknown, maximum: number) =>
  Array.isArray(value) && value.length > 0 && value.length <= maximum && value.every((item) => isShortString(item, 200));

function safeEntry(value: unknown): value is RegistryPatchEntry {
  if (!isRecord(value) || !isRecord(value.scope) || !isRecord(value.verification)) return false;
  if (!isShortString(value.id, 120) || !isShortString(value.name, 160) || !isShortString(value.summary, 500)) return false;
  if (!isShortString(value.version, 50) || !isShortString(value.download, 240) || !isShortString(value.sha256, 64)) return false;
  if (!/^\/registry\/patches\/[a-z0-9._-]+\.openpatch\.json$/i.test(String(value.download))) return false;
  if (!/^[a-f0-9]{64}$/.test(String(value.sha256))) return false;
  if (!isStringArray(value.scope.hosts, 20) || !isStringArray(value.scope.paths, 30)) return false;
  if (!Array.isArray(value.capabilities) || value.capabilities.length > CAPABILITIES.size) return false;
  if (!value.capabilities.every((capability) => typeof capability === "string" && CAPABILITIES.has(capability as PatchCapability))) return false;
  if (value.verification.status !== "verified") return false;
  if (!Number.isInteger(value.verification.operations) || Number(value.verification.operations) < 1 || Number(value.verification.operations) > 100) return false;
  if (!Number.isInteger(value.verification.assertions) || Number(value.verification.assertions) < 1 || Number(value.verification.assertions) > 100) return false;
  if (value.compatibility !== undefined) {
    if (!isRecord(value.compatibility)) return false;
    if (!["healthy", "drifted", "unreachable"].includes(String(value.compatibility.status))) return false;
    if (!isShortString(value.compatibility.checkedAt, 40) || !Number.isFinite(Date.parse(String(value.compatibility.checkedAt)))) return false;
    if (!isShortString(value.compatibility.pageUrl, 500) || !isShortString(value.compatibility.patchSha256, 64)) return false;
    if (!/^[a-f0-9]{64}$/.test(String(value.compatibility.patchSha256)) || value.compatibility.patchSha256 !== value.sha256) return false;
    if (!isShortString(value.compatibility.fingerprint, 64) || !/^[a-f0-9]{64}$/.test(String(value.compatibility.fingerprint))) return false;
    if (!Number.isInteger(value.compatibility.healthy) || !Number.isInteger(value.compatibility.total)) return false;
    if (Number(value.compatibility.healthy) < 0 || Number(value.compatibility.total) < 1 || Number(value.compatibility.healthy) > Number(value.compatibility.total)) return false;
    if (!Array.isArray(value.compatibility.driftedOperationIds) || value.compatibility.driftedOperationIds.length > 100) return false;
    if (!value.compatibility.driftedOperationIds.every((id) => isShortString(id, 120))) return false;
    try {
      const monitoredUrl = new URL(String(value.compatibility.pageUrl));
      if (!patchMatchesUrl({ match: value.scope } as OpenPatch, monitoredUrl)) return false;
    } catch { return false; }
    if (value.compatibility.status === "healthy" && (value.compatibility.healthy !== value.compatibility.total || value.compatibility.driftedOperationIds.length > 0)) return false;
    if (value.compatibility.status === "drifted" && value.compatibility.healthy === value.compatibility.total) return false;
  }
  return true;
}

export function parsePublicRegistry(value: unknown): PublicRegistryIndex | null {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.patches) || value.patches.length > 500) return null;
  if (!value.patches.every(safeEntry)) return null;
  return { schemaVersion: 1, patches: value.patches };
}

export function registryMatchesUrl(index: PublicRegistryIndex, url: URL) {
  return index.patches.filter((entry) =>
    entry.compatibility?.status !== "drifted"
    && entry.compatibility?.status !== "unreachable"
    && patchMatchesUrl({ match: entry.scope } as OpenPatch, url)
  );
}

export function registryPatchUrl(entry: RegistryPatchEntry, registryUrl = PUBLIC_REGISTRY_URL) {
  const registry = new URL(registryUrl);
  const download = new URL(entry.download, registry.origin);
  if (download.origin !== registry.origin || !download.pathname.startsWith("/registry/patches/")) {
    throw new Error("Registry patch download escaped the trusted registry origin.");
  }
  return download.toString();
}
