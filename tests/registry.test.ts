import { describe, expect, it } from "vitest";
import civicPatchJson from "../src/registry/patches/civic-apply.patch-the-web.json";
import metroCarePatchJson from "../src/registry/patches/metrocare-service-navigator.patch-the-web.json";
import {
  buildPatchCatalog,
  comparePatchVersions,
  contentScriptMatches,
  matchingCatalogPatches,
  permissionOrigins
} from "../src/core/registry";
import type { CommunityPatch } from "../src/core/types";

const civicPatch = civicPatchJson as CommunityPatch;
const metroCarePatch = metroCarePatchJson as CommunityPatch;

describe("community patch catalog", () => {
  it("loads validated local patches and rejects malformed storage entries", () => {
    const local = structuredClone(civicPatch);
    local.id = "org.patchtheweb.example-repair";
    local.version = "1.0.0";
    local.match = { hosts: ["portal.example.edu"], paths: ["/apply/*"] };
    const catalog = buildPatchCatalog([civicPatch], { local, unsafe: { type: "script" } });
    expect(catalog.patches).toHaveLength(2);
    expect(catalog.rejected).toBe(1);
    expect(catalog.patches.find((entry) => entry.patch.id === local.id)?.source).toBe("local");
  });

  it("allows a user-installed newer version to replace the bundled version", () => {
    const update = structuredClone(civicPatch);
    update.version = "1.2.0";
    const catalog = buildPatchCatalog([civicPatch], { [update.id]: update });
    expect(catalog.patches).toHaveLength(1);
    expect(catalog.patches[0]).toMatchObject({ source: "local", patch: { version: "1.2.0" } });
    expect(comparePatchVersions("1.2.0", "1.1.9")).toBeGreaterThan(0);
  });

  it("keeps discovery and Chrome permissions within declared domains and paths", () => {
    expect(matchingCatalogPatches([{ patch: civicPatch, source: "bundled" }], new URL("http://localhost/demo/start"))).toHaveLength(1);
    expect(matchingCatalogPatches([{ patch: civicPatch, source: "bundled" }], new URL("http://localhost/account"))).toHaveLength(0);
    expect(contentScriptMatches([civicPatch])).toEqual(["*://patch-the-web.vercel.app/demo/*", "http://127.0.0.1/demo/*", "http://localhost/demo/*"]);
    expect(permissionOrigins(civicPatch)).toEqual(["*://patch-the-web.vercel.app/*", "http://127.0.0.1/*", "http://localhost/*"]);
  });

  it("discovers the feature repair only on the MetroCare route", () => {
    const catalog = [
      { patch: civicPatch, source: "bundled" as const },
      { patch: metroCarePatch, source: "bundled" as const }
    ];
    expect(matchingCatalogPatches(catalog, new URL("https://patch-the-web.vercel.app/care/"))).toHaveLength(1);
    expect(matchingCatalogPatches(catalog, new URL("https://patch-the-web.vercel.app/demo/"))).toHaveLength(1);
    expect(contentScriptMatches([civicPatch, metroCarePatch])).toContain("*://patch-the-web.vercel.app/care/*");
  });
});
