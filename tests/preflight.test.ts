// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { preflightPatchOnDocument } from "../src/core/preflight";
import civicPatchJson from "../src/registry/patches/civic-apply.patch-the-web.json";
import metroCarePatchJson from "../src/registry/patches/metrocare-service-navigator.patch-the-web.json";
import nuKarachiPatchJson from "../src/registry/patches/nu-karachi-degree-programs.patch-the-web.json";
import hecCampusPatchJson from "../src/registry/patches/hec-campus-finder.patch-the-web.json";
import type { CommunityPatch } from "../src/core/types";

const fixture = readFileSync(resolve(import.meta.dirname, "../src/site/demo/index.html"), "utf8");
const patch = civicPatchJson as CommunityPatch;
const careFixture = readFileSync(resolve(import.meta.dirname, "../src/site/care/index.html"), "utf8");
const nuFixture = readFileSync(resolve(import.meta.dirname, "fixtures/nu-degree-programs.html"), "utf8");
const hecFixture = readFileSync(resolve(import.meta.dirname, "fixtures/hec-recognized-campuses.html"), "utf8");

describe("in-extension selector preflight", () => {
  beforeEach(() => {
    const parsed = new DOMParser().parseFromString(fixture, "text/html");
    document.head.innerHTML = parsed.head.innerHTML;
    document.body.innerHTML = parsed.body.innerHTML;
  });

  it("accepts every operation target on the intended page", () => {
    const result = preflightPatchOnDocument(patch);
    expect(result.total).toBe(19);
    expect(result.healthy).toBe(19);
  });

  it("fails closed when a critical selector drifts", () => {
    document.getElementById("benefits-form")?.removeAttribute("id");
    const result = preflightPatchOnDocument(patch);
    expect(result.healthy).toBeLessThan(result.total);
    expect(result.results.find((entry) => entry.id === "persist-draft")?.healthy).toBe(false);
    expect(result.results.find((entry) => entry.id === "accessible-validation")?.healthy).toBe(false);
  });
});

describe("collection navigator selector preflight", () => {
  beforeEach(() => {
    const parsed = new DOMParser().parseFromString(careFixture, "text/html");
    document.head.innerHTML = parsed.head.innerHTML;
    document.body.innerHTML = parsed.body.innerHTML;
  });

  it("verifies the exact container and all service items", () => {
    const result = preflightPatchOnDocument(metroCarePatchJson as CommunityPatch);
    expect(result.total).toBe(11);
    expect(result.healthy).toBe(11);
    expect(result.results.find((entry) => entry.id === "add-private-service-navigator")?.matched).toBe(12);
    expect(result.results.find((entry) => entry.id === "add-private-service-comparison")?.matched).toBe(12);
  });

  it("fails closed when the directory container drifts", () => {
    document.getElementById("care-directory")?.removeAttribute("id");
    const result = preflightPatchOnDocument(metroCarePatchJson as CommunityPatch);
    expect(result.results.find((entry) => entry.id === "add-private-service-navigator")?.healthy).toBe(false);
    expect(result.results.find((entry) => entry.id === "add-private-service-comparison")?.healthy).toBe(false);
  });
});

describe("Karachi program selector preflight", () => {
  beforeEach(() => {
    const parsed = new DOMParser().parseFromString(nuFixture, "text/html");
    document.head.innerHTML = parsed.head.innerHTML;
    document.body.innerHTML = parsed.body.innerHTML;
  });

  it("verifies every constrained operation against the campus table", () => {
    const result = preflightPatchOnDocument(nuKarachiPatchJson as CommunityPatch);
    expect(result).toMatchObject({ healthy: 4, total: 4 });
    expect(result.results.find((entry) => entry.id === "show-karachi-programs-only")?.matched).toBe(4);
  });

  it("remains self-contained when Chrome serializes it into the active tab", () => {
    const injected = new Function("candidate", `return (${preflightPatchOnDocument.toString()})(candidate);`) as (candidate: CommunityPatch) => ReturnType<typeof preflightPatchOnDocument>;
    const result = injected(nuKarachiPatchJson as CommunityPatch);
    expect(result).toMatchObject({ healthy: 4, total: 4 });
    expect(result.results.find((entry) => entry.id === "show-karachi-programs-only")?.matched).toBe(4);
  });

  it("fails closed when the university table selector drifts", () => {
    document.querySelector("table.edu-table-responsive")?.classList.remove("edu-table-responsive");
    const result = preflightPatchOnDocument(nuKarachiPatchJson as CommunityPatch);
    expect(result.healthy).toBe(0);
  });

  it("fails closed when the exact public campus header drifts", () => {
    document.querySelector("tr.heading-table > th:nth-child(4)")!.textContent = "Karachi City";
    const result = preflightPatchOnDocument(nuKarachiPatchJson as CommunityPatch);
    expect(result.results.find((entry) => entry.id === "show-karachi-programs-only")?.healthy).toBe(false);
  });
});

describe("HEC public-table search preflight", () => {
  beforeEach(() => {
    const parsed = new DOMParser().parseFromString(hecFixture, "text/html");
    document.head.innerHTML = parsed.head.innerHTML;
    document.body.innerHTML = parsed.body.innerHTML;
  });

  it("verifies the exact tables, headers, and bounded public rows", () => {
    const result = preflightPatchOnDocument(hecCampusPatchJson as CommunityPatch);
    expect(result).toMatchObject({ healthy: 5, total: 5 });
    expect(result.results.find((entry) => entry.id === "search-recognized-campuses")?.matched).toBe(8);
  });

  it("remains self-contained when Chrome serializes it into the active tab", () => {
    const injected = new Function("candidate", `return (${preflightPatchOnDocument.toString()})(candidate);`) as (candidate: CommunityPatch) => ReturnType<typeof preflightPatchOnDocument>;
    expect(injected(hecCampusPatchJson as CommunityPatch)).toMatchObject({ healthy: 5, total: 5 });
  });
});
