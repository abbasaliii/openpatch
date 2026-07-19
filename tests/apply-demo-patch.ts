import civicPatchJson from "../src/registry/patches/civic-apply.openpatch.json";
import metroCarePatchJson from "../src/registry/patches/metrocare-service-navigator.openpatch.json";
import { applyPatch } from "../src/core/engine";
import type { OpenPatch } from "../src/core/types";

declare global {
  interface Window {
    __applyOpenPatchDemo: () => ReturnType<typeof applyPatch>;
    __applyMetroCarePatch: () => ReturnType<typeof applyPatch>;
  }
}

window.__applyOpenPatchDemo = () => applyPatch(civicPatchJson as OpenPatch);
window.__applyMetroCarePatch = () => applyPatch(metroCarePatchJson as OpenPatch);
