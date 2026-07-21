import { buildReviewIssue, cleanPublicUrl, REPAIR_NEEDS, type RepairNeed, type RepairRequestArtifact } from "../site/authors/brief";

export type RepairSubmissionEnvelope = {
  request: RepairRequestArtifact;
  consent: true;
  openedAt: number;
  submissionId: string;
  website?: string;
};

export type ValidatedRepairSubmission = {
  request: RepairRequestArtifact;
  submissionId: string;
  issue: { title: string; body: string; labels: string[] };
};

export class RepairSubmissionError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

const repairNeedNames = new Set(Object.keys(REPAIR_NEEDS));
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const email = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const longNumber = /(?:\d[\s().-]*){8,}/;
const credential = /\b(?:password|passcode|one[- ]?time code|otp|api key|secret)\s*[:=]\s*\S+/i;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RepairSubmissionError("invalid_request", "The repair request is malformed.");
  return value as Record<string, unknown>;
}

function normalizedLine(value: unknown, maximum: number) {
  if (typeof value !== "string") throw new RepairSubmissionError("invalid_request", "The repair request contains an invalid text field.");
  const normalized = value.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length > maximum) throw new RepairSubmissionError("invalid_request", "The repair request contains text outside the allowed size.");
  return normalized;
}

function containsLikelyPrivateData(value: string) {
  return email.test(value) || longNumber.test(value) || credential.test(value);
}

export function validateRepairSubmission(value: unknown, now = Date.now()): ValidatedRepairSubmission {
  const envelope = record(value);
  if (envelope.consent !== true) throw new RepairSubmissionError("consent_required", "Review and confirm the exact public request before submitting.");
  if (typeof envelope.website === "string" && envelope.website.trim()) throw new RepairSubmissionError("automated_submission", "The request could not be submitted.");
  if (typeof envelope.openedAt !== "number" || !Number.isSafeInteger(envelope.openedAt)) throw new RepairSubmissionError("invalid_request", "Restart the request and try again.");
  const elapsed = now - envelope.openedAt;
  if (elapsed < 2_000 || elapsed > 86_400_000) throw new RepairSubmissionError("expired_request", "Restart the request and review it again before submitting.");
  if (typeof envelope.submissionId !== "string" || !uuid.test(envelope.submissionId)) throw new RepairSubmissionError("invalid_request", "Restart the request and try again.");

  const source = record(envelope.request);
  if (source.schemaVersion !== 1 || source.kind !== "patch-the-web-repair-request") throw new RepairSubmissionError("invalid_request", "This repair-request version is not supported.");
  const publicScope = cleanPublicUrl(normalizedLine(source.publicScope, 2_048));
  const complaint = normalizedLine(source.complaint, 900);
  if (complaint.length < 12) throw new RepairSubmissionError("invalid_request", "Describe the problem in a little more detail.");
  if (!Array.isArray(source.needs) || source.needs.length < 1 || source.needs.length > repairNeedNames.size) throw new RepairSubmissionError("invalid_request", "Choose at least one repair outcome.");
  const needs = [...new Set(source.needs.map((need) => {
    if (typeof need !== "string" || !repairNeedNames.has(need)) throw new RepairSubmissionError("invalid_request", "The request contains an unsupported repair outcome.");
    return need as RepairNeed;
  }))];
  if (!Array.isArray(source.criteria) || source.criteria.length < 1 || source.criteria.length > 12) throw new RepairSubmissionError("invalid_request", "Provide between one and twelve testable outcomes.");
  const criteria = [...new Set(source.criteria.map((criterion) => normalizedLine(criterion, 240)))];
  if (containsLikelyPrivateData([complaint, ...criteria].join("\n"))) {
    throw new RepairSubmissionError("private_data_detected", "Remove email addresses, phone or account numbers, passwords, and verification codes before submitting publicly.");
  }

  const request: RepairRequestArtifact = { schemaVersion: 1, kind: "patch-the-web-repair-request", publicScope, complaint, needs, criteria };
  const review = buildReviewIssue(request);
  const marker = `<!-- patch-the-web-submission:${envelope.submissionId} -->`;
  return {
    request,
    submissionId: envelope.submissionId,
    issue: {
      title: review.title,
      body: `${review.body}\n\n${marker}\nSubmitted through the guided no-account intake. Reporter identity and contact details were not collected.`,
      labels: ["repair-request", "needs-triage"]
    }
  };
}
