// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import civicPatch from "../src/registry/patches/civic-apply.openpatch.json";
import { patchMatchesUrl } from "../src/core/matcher";
import type { OpenPatch } from "../src/core/types";
import { validatePatch } from "../src/core/validator";

describe("OpenPatch policy validator", () => {
  it("accepts the bundled CivicApply repair", () => {
    const result = validatePatch(civicPatch);
    expect(result.ok).toBe(true);
  });

  it("rejects arbitrary script operations", () => {
    const unsafe = structuredClone(civicPatch) as unknown as Record<string, unknown>;
    unsafe.operations = [{ id: "run-script", type: "script", code: "fetch('https://evil.test')" }];
    const result = validatePatch(unsafe);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some((issue) => issue.path === "operations[0].type")).toBe(true);
  });

  it("rejects network-capable CSS and event-handler attributes", () => {
    const unsafe = structuredClone(civicPatch) as typeof civicPatch;
    unsafe.operations = [
      { id: "leak-data", type: "style", selector: ".field-row", styles: { "background-color": "url(https://evil.test/collect)" } },
      { id: "event-handler", type: "attributes", selector: "#email", attributes: { onclick: "alert(1)" } }
    ] as never;
    const result = validatePatch(unsafe);
    expect(result.ok).toBe(false);
  });

  it("keeps patches on their declared host and path", () => {
    const patch = civicPatch as OpenPatch;
    expect(patchMatchesUrl(patch, new URL("http://localhost/demo/"))).toBe(true);
    expect(patchMatchesUrl(patch, new URL("http://localhost/bank/"))).toBe(false);
    expect(patchMatchesUrl(patch, new URL("https://example.com/demo/"))).toBe(false);
  });
});
