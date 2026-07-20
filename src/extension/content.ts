import civicPatchJson from "../registry/patches/civic-apply.openpatch.json";
import { applyPatch } from "../core/engine";
import { buildPatchCatalog, matchingCatalogPatches } from "../core/registry";
import type { OpenPatch, PatchHealth } from "../core/types";

type RuntimePatchState = {
  enabled: boolean;
  health: PatchHealth | null;
  source: "bundled" | "local";
  patch: Pick<OpenPatch, "id" | "name" | "summary" | "version" | "capabilities" | "author" | "match"> & { operationCount: number };
};

const bundled = [civicPatchJson as OpenPatch];
let matches: RuntimePatchState[] = [];

async function initialize() {
  const stored = await chrome.storage.local.get(["enabledPatches", "installedPatches"]);
  const enabledPatches = (stored.enabledPatches as Record<string, boolean> | undefined) ?? {};
  const catalog = buildPatchCatalog(bundled, stored.installedPatches);
  const matching = matchingCatalogPatches(catalog.patches, new URL(location.href));

  matches = matching.map(({ patch, source }) => {
    const enabled = Boolean(enabledPatches[patch.id]);
    const health = enabled ? applyPatch(patch) : null;
    if (health) void chrome.storage.local.set({ [`health:${patch.id}:${location.hostname}`]: health });
    return {
      enabled,
      health,
      source,
      patch: {
        id: patch.id,
        name: patch.name,
        summary: patch.summary,
        version: patch.version,
        capabilities: patch.capabilities,
        author: patch.author,
        match: patch.match,
        operationCount: patch.operations.length
      }
    };
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "OPENPATCH_GET_STATE") {
    sendResponse({ matched: matches.length > 0, matches });
  }
});

void initialize();
