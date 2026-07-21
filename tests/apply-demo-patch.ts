import civicPatchJson from "../src/registry/patches/civic-apply.patch-the-web.json";
import metroCarePatchJson from "../src/registry/patches/metrocare-service-navigator.patch-the-web.json";
import nuKarachiPatchJson from "../src/registry/patches/nu-karachi-degree-programs.patch-the-web.json";
import hecCampusPatchJson from "../src/registry/patches/hec-campus-finder.patch-the-web.json";
import { applyPatch } from "../src/core/engine";
import type { CommunityPatch } from "../src/core/types";

declare global {
  interface Window {
    __applyPatchTheWebDemo: () => ReturnType<typeof applyPatch>;
    __applyMetroCarePatch: () => ReturnType<typeof applyPatch>;
    __applyNuKarachiPatch: () => ReturnType<typeof applyPatch>;
    __applyHecCampusPatch: () => ReturnType<typeof applyPatch>;
  }
}

window.__applyPatchTheWebDemo = () => applyPatch(civicPatchJson as CommunityPatch);
window.__applyMetroCarePatch = () => applyPatch(metroCarePatchJson as CommunityPatch);
window.__applyNuKarachiPatch = () => applyPatch(nuKarachiPatchJson as CommunityPatch);
window.__applyHecCampusPatch = () => applyPatch(hecCampusPatchJson as CommunityPatch);
