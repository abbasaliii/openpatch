import { describe, expect, it } from "vitest";
import {
  compatibilityEvidence,
  compatibilityStatus,
  summarizeCompatibility,
  type PatchCompatibilityReport
} from "../src/core/compatibility";
import type { SelectorPreflightResult } from "../src/core/preflight";

const healthy: SelectorPreflightResult = {
  healthy: 2,
  total: 2,
  results: [
    { id: "directory", matched: 12, healthy: true },
    { id: "help", matched: 1, healthy: true }
  ]
};

describe("compatibility sentinel", () => {
  it("records deterministic structural evidence for a healthy page", () => {
    expect(compatibilityStatus(healthy)).toBe("healthy");
    expect(compatibilityEvidence("a".repeat(64), healthy)).toBe(
      `${"a".repeat(64)}|2/2|directory:12:1|help:1:1`
    );
  });

  it("marks selector drift even when only one operation breaks", () => {
    const drifted: SelectorPreflightResult = {
      healthy: 1,
      total: 2,
      results: [
        { id: "directory", matched: 0, healthy: false },
        { id: "help", matched: 1, healthy: true }
      ]
    };
    expect(compatibilityStatus(drifted)).toBe("drifted");
    expect(compatibilityEvidence("b".repeat(64), drifted)).toContain("directory:0:0");
  });

  it("summarizes healthy, drifted, and unreachable patches separately", () => {
    const make = (status: PatchCompatibilityReport["status"]): PatchCompatibilityReport => ({
      id: status,
      version: "1.0.0",
      pageUrl: "https://example.test/",
      status,
      checkedAt: "2026-07-20T00:00:00.000Z",
      patchSha256: "d".repeat(64),
      healthy: status === "healthy" ? 1 : 0,
      total: 1,
      fingerprint: "c".repeat(64),
      driftedOperationIds: status === "drifted" ? ["directory"] : [],
      results: []
    });
    expect(summarizeCompatibility([make("healthy"), make("drifted"), make("unreachable")]))
      .toEqual({ healthy: 1, drifted: 1, unreachable: 1, total: 3 });
  });
});
