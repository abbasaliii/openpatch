import civicPatchJson from "../src/registry/patches/civic-apply.patch-the-web.json";
import metroCarePatchJson from "../src/registry/patches/metrocare-service-navigator.patch-the-web.json";
import { applyPatch } from "../src/core/engine";
import type { CommunityPatch } from "../src/core/types";

declare global {
  interface Window {
    __applyPatchTheWebDemo: () => ReturnType<typeof applyPatch>;
    __applyMetroCarePatch: () => ReturnType<typeof applyPatch>;
  }
}

window.__applyPatchTheWebDemo = () => applyPatch(civicPatchJson as CommunityPatch);
window.__applyMetroCarePatch = () => applyPatch(metroCarePatchJson as CommunityPatch);
