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
      "content-compare",
      "accessibility",
      "keyboard-navigation",
      "local-storage",
      "layout",
      "hide-elements",
      "reorganize"
    ],
    download: "/registry/patches/metrocare-service-navigator.openpatch.json",
    sha256: "14cef4195ec8227fe62c16845fedc683fae1dcb4fd3a752296cef7a1bf9a936c",
    verification: { status: "verified", operations: 11, assertions: 10 },
    compatibility: {
      status: "healthy",
      checkedAt: "2026-07-20T00:52:08.768Z",
      pageUrl: "https://openpatch-tau.vercel.app/care/",
      patchSha256: "14cef4195ec8227fe62c16845fedc683fae1dcb4fd3a752296cef7a1bf9a936c",
      healthy: 11,
      total: 11,
      fingerprint: "3e0a80a64a09c90f056df16f18b9b7141cc95956d8a5cab4fa6ade9da2d5c9ff",
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
    drifted.patches[0].compatibility!.healthy = 10;
    drifted.patches[0].compatibility!.driftedOperationIds = ["add-private-service-navigator"];
    const parsed = parsePublicRegistry(drifted);
    expect(parsed).not.toBeNull();
    expect(registryMatchesUrl(parsed!, new URL("https://openpatch-tau.vercel.app/care/"))).toEqual([]);

    drifted.patches[0].compatibility!.fingerprint = "not-a-hash";
    expect(parsePublicRegistry(drifted)).toBeNull();
  });
});
