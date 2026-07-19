import civicPatchJson from "../src/registry/patches/civic-apply.openpatch.json";
import { applyPatch } from "../src/core/engine";
import type { OpenPatch } from "../src/core/types";

declare global {
  interface Window {
    __applyOpenPatchDemo: () => ReturnType<typeof applyPatch>;
  }
}

window.__applyOpenPatchDemo = () => applyPatch(civicPatchJson as OpenPatch);
