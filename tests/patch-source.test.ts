import { describe, expect, it } from "vitest";
import { canonicalPatchSource } from "../src/core/patch-source";

describe("canonical patch source", () => {
  it("normalizes Windows and legacy line endings to LF", () => {
    expect(canonicalPatchSource("{\r\n  \"ok\": true\r}\r\n")).toBe("{\n  \"ok\": true\n}\n");
  });

  it("leaves canonical patch text unchanged", () => {
    const raw = "{\n  \"ok\": true\n}\n";
    expect(canonicalPatchSource(raw)).toBe(raw);
  });
});
