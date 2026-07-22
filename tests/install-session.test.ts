import { describe, expect, it } from "vitest";
import { INSTALL_SESSION_TTL_MS, isInstallSession } from "../src/extension/install-session";

const now = 1_800_000_000_000;
const valid = {
  raw: "{}",
  hash: "a".repeat(64),
  source: "local-file" as const,
  tabId: 42,
  tabUrl: "https://example.org/application",
  createdAt: now - 1_000
};

describe("temporary guided installation sessions", () => {
  it("accepts a bounded fresh exact-tab candidate", () => expect(isInstallSession(valid, now)).toBe(true));
  it("expires candidates after fifteen minutes", () => expect(isInstallSession({ ...valid, createdAt: now - INSTALL_SESSION_TTL_MS - 1 }, now)).toBe(false));
  it("rejects non-web targets and malformed receipts", () => {
    expect(isInstallSession({ ...valid, tabUrl: "chrome://extensions" }, now)).toBe(false);
    expect(isInstallSession({ ...valid, hash: "not-a-hash" }, now)).toBe(false);
  });
  it("rejects oversized repair artifacts", () => expect(isInstallSession({ ...valid, raw: "x".repeat(256_001) }, now)).toBe(false));
});
