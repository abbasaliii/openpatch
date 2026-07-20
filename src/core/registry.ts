import { patchMatchesUrl } from "./matcher";
import type { CommunityPatch } from "./types";
import { validatePatch } from "./validator";

export type CatalogPatch = {
  patch: CommunityPatch;
  source: "bundled" | "local";
};

export type CatalogResult = {
  patches: CatalogPatch[];
  rejected: number;
};

function versionParts(version: string) {
  return version.split(/[.-]/).slice(0, 3).map((part) => Number.parseInt(part, 10) || 0);
}

export function comparePatchVersions(left: string, right: string) {
  const a = versionParts(left);
  const b = versionParts(right);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return left.localeCompare(right);
}

export function buildPatchCatalog(bundled: CommunityPatch[], stored: unknown): CatalogResult {
  const byId = new Map<string, CatalogPatch>();
  let rejected = 0;

  for (const patch of bundled) {
    const validation = validatePatch(patch);
    if (!validation.ok) {
      rejected += 1;
      continue;
    }
    byId.set(patch.id, { patch, source: "bundled" });
  }

  if (stored && typeof stored === "object" && !Array.isArray(stored)) {
    for (const candidate of Object.values(stored as Record<string, unknown>)) {
      const validation = validatePatch(candidate);
      if (!validation.ok) {
        rejected += 1;
        continue;
      }
      const current = byId.get(validation.patch.id);
      if (!current || comparePatchVersions(validation.patch.version, current.patch.version) >= 0) {
        byId.set(validation.patch.id, { patch: validation.patch, source: "local" });
      }
    }
  }

  return { patches: [...byId.values()], rejected };
}

export function matchingCatalogPatches(catalog: CatalogPatch[], url: URL) {
  return catalog.filter(({ patch }) => patchMatchesUrl(patch, url));
}

export function contentScriptMatches(patches: CommunityPatch[]) {
  const matches = new Set<string>();
  for (const patch of patches) {
    for (const host of patch.match.hosts) {
      const scheme = host === "localhost" || host === "127.0.0.1" ? "http" : "*";
      for (const path of patch.match.paths) matches.add(`${scheme}://${host}${path}`);
    }
  }
  return [...matches].sort();
}

export function permissionOrigins(patch: Pick<CommunityPatch, "match">) {
  return [...new Set(patch.match.hosts.map((host) => {
    const scheme = host === "localhost" || host === "127.0.0.1" ? "http" : "*";
    return `${scheme}://${host}/*`;
  }))].sort();
}
