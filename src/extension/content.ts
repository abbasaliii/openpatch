import civicPatchJson from "../registry/patches/civic-apply.openpatch.json";
import { applyPatch } from "../core/engine";
import { patchMatchesUrl } from "../core/matcher";
import type { OpenPatch, PatchHealth } from "../core/types";
import { validatePatch } from "../core/validator";

const patch = civicPatchJson as OpenPatch;
let health: PatchHealth | null = null;
let enabled = false;

async function initialize() {
  const validation = validatePatch(civicPatchJson);
  if (!validation.ok || !patchMatchesUrl(patch, new URL(location.href))) return;
  const stored = await chrome.storage.local.get("enabledPatches");
  enabled = Boolean((stored.enabledPatches as Record<string, boolean> | undefined)?.[patch.id]);
  if (enabled) {
    health = applyPatch(patch);
    await chrome.storage.local.set({ [`health:${patch.id}:${location.hostname}`]: health });
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "OPENPATCH_GET_STATE") {
    sendResponse({
      matched: patchMatchesUrl(patch, new URL(location.href)),
      enabled,
      health,
      patch: {
        id: patch.id,
        name: patch.name,
        summary: patch.summary,
        version: patch.version,
        capabilities: patch.capabilities,
        author: patch.author
      }
    });
  }
});

void initialize();
