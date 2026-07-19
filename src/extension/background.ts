import civicPatchJson from "../registry/patches/civic-apply.openpatch.json";
import metroCarePatchJson from "../registry/patches/metrocare-service-navigator.openpatch.json";
import { buildPatchCatalog, contentScriptMatches, permissionOrigins } from "../core/registry";
import type { OpenPatch } from "../core/types";

const PATCH_ID = "org.openpatch.civicapply-accessible-draft";
const METROCARE_PATCH_ID = "org.openpatch.metrocare-service-navigator";
const RUNTIME_SCRIPT_ID = "openpatch-runtime";
const bundled = [civicPatchJson as OpenPatch, metroCarePatchJson as OpenPatch];
let refreshQueue: Promise<void> = Promise.resolve();

async function refreshRuntime() {
  const stored = await chrome.storage.local.get("installedPatches");
  const catalog = buildPatchCatalog(bundled, stored.installedPatches);
  const allowed: OpenPatch[] = [];

  for (const { patch } of catalog.patches) {
    const origins = permissionOrigins(patch);
    if (await chrome.permissions.contains({ origins })) allowed.push(patch);
  }

  await chrome.scripting.unregisterContentScripts({ ids: [RUNTIME_SCRIPT_ID] }).catch(() => undefined);
  const matches = contentScriptMatches(allowed);
  if (matches.length > 0) {
    await chrome.scripting.registerContentScripts([{
      id: RUNTIME_SCRIPT_ID,
      js: ["content.js"],
      matches,
      runAt: "document_idle",
      persistAcrossSessions: true
    }]);
  }

  await chrome.action.setBadgeBackgroundColor({ color: "#0b9a6d" });
  await chrome.action.setBadgeText({ text: String(catalog.patches.length) });
}

function queueRuntimeRefresh() {
  refreshQueue = refreshQueue.then(refreshRuntime, refreshRuntime);
  return refreshQueue;
}

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get(["enabledPatches", "installedPatches", "installedPatchMeta", "registryMeta"]);
  await chrome.storage.local.set({
    enabledPatches: stored.enabledPatches ?? { [PATCH_ID]: false, [METROCARE_PATCH_ID]: false },
    installedPatches: stored.installedPatches ?? {},
    installedPatchMeta: stored.installedPatchMeta ?? {},
    registryMeta: {
      ...(stored.registryMeta as Record<string, unknown> | undefined),
      lastSync: Date.now(),
      channel: "local-community",
      schemaVersion: 1
    }
  });
  await queueRuntimeRefresh();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "OPENPATCH_REFRESH_RUNTIME") return;
  void queueRuntimeRefresh()
    .then(() => sendResponse({ ok: true }))
    .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Runtime refresh failed" }));
  return true;
});

void queueRuntimeRefresh();
