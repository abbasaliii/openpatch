import { describe, expect, it } from "vitest";
import { buildAcceptanceCriteria, buildAuthorBrief, buildReviewIssue, cleanPublicUrl } from "../src/site/authors/brief";

describe("guided repair request", () => {
  it("keeps only a public origin and path", () => {
    expect(cleanPublicUrl("https://example.edu/programs?student=123#private")).toBe("https://example.edu/programs");
    expect(() => cleanPublicUrl("http://localhost:5173/demo")).toThrow(/public website/);
    expect(() => cleanPublicUrl("https://person:secret@example.edu/apply")).toThrow(/sign-in details/);
  });

  it("turns plain outcome choices into bounded observable criteria", () => {
    expect(buildAcceptanceCriteria(["filter", "mobile", "filter"], "Keep the program name visible.\n\nShow a match count.")).toEqual([
      "People can quickly search or filter the relevant existing public content.",
      "The repaired workflow fits a 390px viewport without horizontal overflow or covered controls.",
      "Keep the program name visible.",
      "Show a match count."
    ]);
  });

  it("creates a privacy-bounded Codex handoff without technical input", () => {
    const artifact = buildAuthorBrief({
      target: "https://example.edu/programs?session=private#results",
      complaint: "  I only want to see programs available in Karachi.  ",
      needs: ["filter", "mobile", "accessibility"]
    });
    expect(artifact.target).toBe("https://example.edu/programs");
    expect(artifact.criteria).toHaveLength(3);
    expect(artifact.brief).toContain("Use $patch-the-web-author");
    expect(artifact.brief).toContain("Observable acceptance criteria:");
    expect(artifact.brief).toContain("390px viewport");
    expect(artifact.brief).not.toContain("session=private");
    expect(artifact.brief).not.toContain("#results");
  });

  it("requires a concrete complaint and at least one desired outcome", () => {
    expect(() => buildAuthorBrief({ target: "https://example.edu", complaint: "bad", needs: ["mobile"] })).toThrow(/more detail/);
    expect(() => buildAuthorBrief({ target: "https://example.edu", complaint: "This page is difficult to use.", needs: [] })).toThrow(/at least one result/);
  });

  it("builds an explicit public review link without private URL parts or mention injection", () => {
    const artifact = buildAuthorBrief({
      target: "https://example.edu/programs?token=secret#private",
      complaint: "The list is impossible to scan. Please notify @everyone <script>alert(1)</script>.",
      needs: ["filter"]
    });
    const review = buildReviewIssue(artifact.request);
    const url = new URL(review.url);
    expect(url.origin + url.pathname).toBe("https://github.com/abbasaliii/patch-the-web/issues/new");
    expect(url.searchParams.get("labels")).toBe("repair-request,needs-triage");
    expect(review.body).toContain("<!-- patch-the-web-request:v1 -->");
    expect(review.body).toContain("https://example.edu/programs");
    expect(review.body).toContain("&#64;everyone");
    expect(review.body).toContain("&lt;script&gt;");
    expect(review.body).not.toContain("token=secret");
    expect(review.body).not.toContain("#private");
    expect(review.body).not.toContain("<script>");
  });
});
