import { describe, expect, it } from "vitest";
import metroCarePatch from "../src/registry/patches/metrocare-service-navigator.openpatch.json";
import {
  parsePublicRegistry,
  registryMatchesUrl,
  registryPatchUrl,
  type PublicRegistryIndex
} from "../src/core/remote-registry";

const registryFixture: PublicRegistryIndex = {
  schemaVersion: 1,
  patches: [{
    id: metroCarePatch.id,
    name: metroCarePatch.name,
    summary: metroCarePatch.summary,
    version: metroCarePatch.version,
    scope: metroCarePatch.match,
    capabilities: [
      "content-filter",
      "accessibility",
      "keyboard-navigation",
      "local-storage",
      "layout",
      "hide-elements",
      "reorganize"
    ],
    download: "/registry/patches/metrocare-service-navigator.openpatch.json",
    sha256: "c29721ef80b69bfda17315b556850f863bfdcb9f99d02c398902ca993b869698",
    verification: { status: "verified", operations: 10, assertions: 8 },
    compatibility: {
      status: "healthy",
      checkedAt: "2026-07-20T00:52:08.768Z",
      pageUrl: "https://openpatch-tau.vercel.app/care/",
      patchSha256: "c29721ef80b69bfda17315b556850f863bfdcb9f99d02c398902ca993b869698",
      healthy: 10,
      total: 10,
      fingerprint: "a718426872e03f687ddb31a6844bea09f1051b19951410fc3103b2df15d110b9",
      driftedOperationIds: []
    }
  }]
};

describe("public registry discovery", () => {
  it("finds the verified patch for the current domain and path", () => {
    const registry = parsePublicRegistry(registryFixture);
    expect(registry).not.toBeNull();
    const matches = registryMatchesUrl(registry!, new URL("https://openpatch-tau.vercel.app/care/"));
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe("org.openpatch.metrocare-service-navigator");
    expect(registryPatchUrl(matches[0])).toBe("https://openpatch-tau.vercel.app/registry/patches/metrocare-service-navigator.openpatch.json");
  });

  it("does not offer a patch outside its declared path", () => {
    const registry = parsePublicRegistry(registryFixture)!;
    expect(registryMatchesUrl(registry, new URL("https://openpatch-tau.vercel.app/account/"))).toEqual([]);
  });

  it("rejects unverified metadata and cross-origin downloads", () => {
    const unsafe = structuredClone(registryFixture) as unknown as { patches: Array<{ download: string }> };
    unsafe.patches[0].download = "https://evil.test/patch.json";
    expect(parsePublicRegistry(unsafe)).toBeNull();
    const unverified = structuredClone(registryFixture) as unknown as { patches: Array<{ verification: { status: string } }> };
    unverified.patches[0].verification.status = "pending";
    expect(parsePublicRegistry(unverified)).toBeNull();
  });

  it("quarantines a patch whose live compatibility receipt reports drift", () => {
    const drifted = structuredClone(registryFixture);
    drifted.patches[0].compatibility!.status = "drifted";
    drifted.patches[0].compatibility!.healthy = 9;
    drifted.patches[0].compatibility!.driftedOperationIds = ["add-private-service-navigator"];
    const parsed = parsePublicRegistry(drifted);
    expect(parsed).not.toBeNull();
    expect(registryMatchesUrl(parsed!, new URL("https://openpatch-tau.vercel.app/care/"))).toEqual([]);

    drifted.patches[0].compatibility!.fingerprint = "not-a-hash";
    expect(parsePublicRegistry(drifted)).toBeNull();
  });
});
