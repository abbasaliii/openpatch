import { preflightPatchOnDocument } from "../src/core/preflight";
import type { OpenPatch } from "../src/core/types";

declare global {
  interface Window {
    __preflightOpenPatch: (patch: OpenPatch) => ReturnType<typeof preflightPatchOnDocument>;
  }
}

window.__preflightOpenPatch = (patch) => preflightPatchOnDocument(patch);
