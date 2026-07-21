import { describe, expect, it } from "vitest";
import civicPatchJson from "../src/registry/patches/civic-apply.patch-the-web.json";
import metroCarePatchJson from "../src/registry/patches/metrocare-service-navigator.patch-the-web.json";
import nuKarachiPatchJson from "../src/registry/patches/nu-karachi-degree-programs.patch-the-web.json";
import hecCampusPatchJson from "../src/registry/patches/hec-campus-finder.patch-the-web.json";
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
const nuKarachiPatch = nuKarachiPatchJson as CommunityPatch;
const hecCampusPatch = hecCampusPatchJson as CommunityPatch;

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
    update.version = "1.3.0";
    const catalog = buildPatchCatalog([civicPatch], { [update.id]: update });
    expect(catalog.patches).toHaveLength(1);
    expect(catalog.patches[0]).toMatchObject({ source: "local", patch: { version: "1.3.0" } });
    expect(comparePatchVersions("1.2.0", "1.1.9")).toBeGreaterThan(0);
  });

  it("keeps discovery and Chrome permissions within declared domains and paths", () => {
    expect(matchingCatalogPatches([{ patch: civicPatch, source: "bundled" }], new URL("https://patch-the-web.vercel.app/demo/start"))).toHaveLength(1);
    expect(matchingCatalogPatches([{ patch: civicPatch, source: "bundled" }], new URL("https://patch-the-web.vercel.app/account"))).toHaveLength(0);
    expect(contentScriptMatches([civicPatch])).toEqual(["https://patch-the-web.vercel.app/demo/*"]);
    expect(permissionOrigins(civicPatch)).toEqual(["https://patch-the-web.vercel.app/*"]);
  });

  it("discovers the feature repair only on the MetroCare route", () => {
    const catalog = [
      { patch: civicPatch, source: "bundled" as const },
      { patch: metroCarePatch, source: "bundled" as const }
    ];
    expect(matchingCatalogPatches(catalog, new URL("https://patch-the-web.vercel.app/care/"))).toHaveLength(1);
    expect(matchingCatalogPatches(catalog, new URL("https://patch-the-web.vercel.app/demo/"))).toHaveLength(1);
    expect(contentScriptMatches([civicPatch, metroCarePatch])).toContain("https://patch-the-web.vercel.app/care/*");
  });

  it("keeps the Karachi program view on the exact university host and path", () => {
    const catalog = [{ patch: nuKarachiPatch, source: "bundled" as const }];
    expect(matchingCatalogPatches(catalog, new URL("https://nu.edu.pk/Degree-Programs"))).toHaveLength(1);
    expect(matchingCatalogPatches(catalog, new URL("https://nu.edu.pk/Admissions"))).toHaveLength(0);
    expect(matchingCatalogPatches(catalog, new URL("https://www.nu.edu.pk/Degree-Programs"))).toHaveLength(0);
    expect(permissionOrigins(nuKarachiPatch)).toEqual(["https://nu.edu.pk/*"]);
    expect(contentScriptMatches([nuKarachiPatch])).toEqual(["https://nu.edu.pk/Degree-Programs*"]);
  });

  it("keeps the HEC campus finder on the exact official page", () => {
    const catalog = [{ patch: hecCampusPatch, source: "bundled" as const }];
    expect(matchingCatalogPatches(catalog, new URL("https://www.hec.gov.pk/english/universities/Pages/DAIs/HEC-recognized-Campuses.aspx"))).toHaveLength(1);
    expect(matchingCatalogPatches(catalog, new URL("https://www.hec.gov.pk/english/universities/Pages/DAIs/Universities.aspx"))).toHaveLength(0);
    expect(permissionOrigins(hecCampusPatch)).toEqual(["https://www.hec.gov.pk/*"]);
  });
});
