export const REPAIR_NEEDS = {
  filter: "People can quickly search or filter the relevant existing public content.",
  mobile: "The repaired workflow fits a 390px viewport without horizontal overflow or covered controls.",
  accessibility: "Interactive controls have accessible names and status or error changes are announced.",
  progress: "Eligible non-sensitive unfinished input is restored locally after reload and expires within seven days.",
  keyboard: "The repaired workflow is fully usable with keyboard-only navigation and visible focus.",
  obstruction: "Only the explicitly identified obstruction is removed; legal, consent, security, and required notices remain.",
  simplify: "The important task is reachable through a clearer sequence without changing the website's real submission logic."
} as const;

export type RepairNeed = keyof typeof REPAIR_NEEDS;

export type AuthorBriefInput = {
  target: string;
  complaint: string;
  needs: RepairNeed[];
  extraCriteria?: string;
};

export type RepairRequestArtifact = {
  schemaVersion: 1;
  kind: "patch-the-web-repair-request";
  publicScope: string;
  complaint: string;
  needs: RepairNeed[];
  criteria: string[];
};

const privateIpv4 = /^(?:10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/;

export function cleanPublicUrl(raw: string) {
  const url = new URL(raw.trim());
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error("Use a public http or https URL.");
  if (url.username || url.password) throw new Error("Remove sign-in details from the URL.");
  const hostname = url.hostname.toLocaleLowerCase();
  if (hostname === "localhost" || hostname === "::1" || hostname.endsWith(".local") || privateIpv4.test(hostname)) {
    throw new Error("Use a public website, not a private or local address.");
  }
  return `${url.origin}${url.pathname}`;
}

function normalizeLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function buildAcceptanceCriteria(needs: RepairNeed[], extraCriteria = "") {
  const selected = [...new Set(needs)].map((need) => REPAIR_NEEDS[need]).filter(Boolean);
  const extras = extraCriteria.split("\n").map(normalizeLine).filter(Boolean);
  return [...new Set([...selected, ...extras])].slice(0, 12);
}

export function buildAuthorBrief(input: AuthorBriefInput) {
  const target = cleanPublicUrl(input.target);
  const complaint = normalizeLine(input.complaint);
  if (complaint.length < 12) throw new Error("Describe the problem in a little more detail.");
  if (complaint.length > 900) throw new Error("Keep the problem description under 900 characters.");
  const criteria = buildAcceptanceCriteria(input.needs, input.extraCriteria);
  if (criteria.length === 0) throw new Error("Choose at least one result you want from the repair.");

  const brief = [
    "Use $patch-the-web-author to inspect this live public website and author a safe, tested community repair.",
    "",
    `Public scope: ${target}`,
    `User complaint: ${complaint}`,
    "",
    "Observable acceptance criteria:",
    ...criteria.map((criterion) => `- ${criterion}`),
    "",
    "Privacy boundary: retain only the origin and path above. Do not collect page text, field values, cookies, storage, query strings, credentials, or private data.",
    "",
    "Inspect the exact live DOM and desktop + 390px screenshots before choosing selectors. Use only the constrained Patch the Web DSL. Run policy validation, unit tests, browser tests, and Compatibility Sentinel. Return a publication receipt with scope, operation health, SHA-256, fingerprint, and before/after evidence."
  ].join("\n");

  const request: RepairRequestArtifact = {
    schemaVersion: 1,
    kind: "patch-the-web-repair-request",
    publicScope: target,
    complaint,
    needs: [...new Set(input.needs)],
    criteria
  };

  return { target, complaint, criteria, brief, request };
}

function publicIssueText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("@", "&#64;");
}

export function buildReviewIssue(request: RepairRequestArtifact) {
  const target = cleanPublicUrl(request.publicScope);
  const hostname = new URL(target).hostname;
  const complaint = publicIssueText(normalizeLine(request.complaint));
  const criteria = request.criteria.map((criterion) => publicIssueText(normalizeLine(criterion))).filter(Boolean).slice(0, 12);
  const body = [
    "<!-- patch-the-web-request:v1 -->",
    "## Public page",
    target,
    "",
    "## Problem",
    complaint,
    "",
    "## Desired outcomes",
    ...criteria.map((criterion) => `- ${criterion}`),
    "",
    "## Privacy confirmation",
    "- [x] I reviewed this public issue and removed personal, account, application, payment, and authentication information.",
    "- [x] I understand that this request is public and that publication still requires policy validation, automated tests, live compatibility evidence, and human review.",
    "",
    "## Track this request",
    "After creating the issue, follow its review status at https://patch-the-web.vercel.app/requests/."
  ].join("\n");
  const url = new URL("https://github.com/abbasaliii/patch-the-web/issues/new");
  url.searchParams.set("title", `[Repair request] ${hostname}`);
  url.searchParams.set("labels", "repair-request,needs-triage");
  url.searchParams.set("body", body);
  return { title: `[Repair request] ${hostname}`, body, url: url.toString() };
}
