import { preflightPatchOnDocument } from "../src/core/preflight";
import type { CommunityPatch } from "../src/core/types";

declare global {
  interface Window {
    __preflightPatchTheWeb: (patch: CommunityPatch) => ReturnType<typeof preflightPatchOnDocument>;
  }
}

window.__preflightPatchTheWeb = (patch) => preflightPatchOnDocument(patch);
