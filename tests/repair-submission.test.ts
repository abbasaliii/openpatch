import { describe, expect, it } from "vitest";
import { RepairSubmissionError, validateRepairSubmission } from "../src/core/repair-submission";

const submissionId = "123e4567-e89b-42d3-a456-426614174000";

function request(overrides: Record<string, unknown> = {}) {
  return {
    request: {
      schemaVersion: 1,
      kind: "patch-the-web-repair-request",
      publicScope: "https://example.edu/programs?student=private#results",
      complaint: "I only want to see programs offered in Karachi without scanning every campus.",
      needs: ["filter", "mobile"],
      criteria: ["Show only programs available in Karachi.", "Fit the results at 390px."],
      ...overrides
    },
    consent: true,
    openedAt: 10_000,
    submissionId,
    website: ""
  };
}

describe("repair submission validation", () => {
  it("normalizes a reviewed request into a bounded public issue", () => {
    const result = validateRepairSubmission(request(), 15_000);
    expect(result.request.publicScope).toBe("https://example.edu/programs");
    expect(result.issue.title).toBe("[Repair request] example.edu");
    expect(result.issue.labels).toEqual(["repair-request", "needs-triage"]);
    expect(result.issue.body).toContain(`<!-- patch-the-web-submission:${submissionId} -->`);
    expect(result.issue.body).not.toContain("student=private");
    expect(result.issue.body).toContain("Reporter identity and contact details were not collected.");
  });

  it.each([
    ["email address", { complaint: "Please contact me at student@example.edu because this form is inaccessible." }],
    ["long number", { complaint: "My application number 1234 5678 disappears whenever this page reloads." }],
    ["credential", { complaint: "The page broke after I entered password: hunter-two into the field." }]
  ])("blocks likely private data: %s", (_name, override) => {
    expect(() => validateRepairSubmission(request(override), 15_000)).toThrowError(RepairSubmissionError);
    try {
      validateRepairSubmission(request(override), 15_000);
    } catch (error) {
      expect(error).toMatchObject({ code: "private_data_detected" });
    }
  });

  it("rejects automation traps, unsupported outcomes, and stale consent", () => {
    expect(() => validateRepairSubmission({ ...request(), website: "spam" }, 15_000)).toThrowError(/could not be submitted/);
    expect(() => validateRepairSubmission(request({ needs: ["run-script"] }), 15_000)).toThrowError(/unsupported repair outcome/);
    expect(() => validateRepairSubmission(request(), 90_000_001)).toThrowError(/Restart the request/);
  });
});
