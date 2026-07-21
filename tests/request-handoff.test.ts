import { describe, expect, it } from "vitest";
import { buildCommunityRequestUrl, decodeRepairRequestHandoff, encodeRepairRequestHandoff, inferRepairNeeds } from "../src/core/request-handoff";

describe("private extension-to-request handoff", () => {
  it("infers useful outcomes from the complaint and structural signals", () => {
    expect(inferRepairNeeds("I only want to see Karachi programs and the table overflows on my phone", {
      unlabeledFields: 1
    })).toEqual(["filter", "mobile", "accessibility"]);
    expect(inferRepairNeeds("The survey blocks the form and I lose progress after refresh", {
      fields: 4,
      possibleObstructions: 1
    })).toEqual(["progress", "obstruction"]);
  });

  it("round-trips only the bounded allowlisted request fields", () => {
    const fragment = encodeRepairRequestHandoff({
      target: "https://example.edu/programs",
      complaint: "  I only want to see Karachi programs.  ",
      needs: ["filter", "filter", "mobile"]
    });
    expect(fragment).toMatch(/^repair=/);
    expect(decodeRepairRequestHandoff(`#${fragment}`)).toEqual({
      version: 1,
      source: "extension",
      target: "https://example.edu/programs",
      complaint: "I only want to see Karachi programs.",
      needs: ["filter", "mobile"]
    });
    const requestUrl = new URL(buildCommunityRequestUrl({
      target: "https://example.edu/programs",
      complaint: "I only want to see Karachi programs.",
      needs: ["filter"]
    }));
    expect(`${requestUrl.origin}${requestUrl.pathname}`).toBe("https://patch-the-web.vercel.app/authors/");
    expect(requestUrl.search).toBe("");
    expect(decodeRepairRequestHandoff(requestUrl.hash)?.complaint).toBe("I only want to see Karachi programs.");
  });

  it("fails closed for malformed, oversized, and unsupported payloads", () => {
    expect(decodeRepairRequestHandoff("#repair=%7Bbad")).toBeNull();
    expect(decodeRepairRequestHandoff(`#repair=${"x".repeat(6001)}`)).toBeNull();
    expect(decodeRepairRequestHandoff(`#repair=${encodeURIComponent(JSON.stringify({ version: 2, source: "extension", target: "https://example.com", complaint: "This is a long complaint", needs: [] }))}`)).toBeNull();
  });
});
