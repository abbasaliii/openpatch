import { buildAuthorBrief, buildReviewIssue, cleanPublicUrl, type RepairNeed, type RepairRequestArtifact } from "./brief";
import { decodeRepairRequestHandoff, REQUEST_HANDOFF_KEY } from "../../core/request-handoff";

const form = document.querySelector<HTMLFormElement>("#brief-form")!;
const result = document.querySelector<HTMLElement>("#result")!;
const preview = document.querySelector<HTMLElement>("#preview")!;
const scope = document.querySelector<HTMLElement>("#scope")!;
const formStatus = document.querySelector<HTMLElement>("#form-status")!;
const copyButton = document.querySelector<HTMLButtonElement>("#copy")!;
const targetInput = document.querySelector<HTMLInputElement>("#target")!;
const complaintInput = document.querySelector<HTMLTextAreaElement>("#complaint")!;
const extraInput = document.querySelector<HTMLTextAreaElement>("#criteria")!;
const needInputs = [...document.querySelectorAll<HTMLInputElement>("input[name='needs']")];
const reviewDialog = document.querySelector<HTMLDialogElement>("#review-dialog")!;
const sharePreview = document.querySelector<HTMLElement>("#share-preview")!;
const shareConsent = document.querySelector<HTMLInputElement>("#share-consent")!;
const githubSubmit = document.querySelector<HTMLAnchorElement>("#github-submit")!;
const directSubmit = document.querySelector<HTMLButtonElement>("#direct-submit")!;
const submitStatus = document.querySelector<HTMLElement>("#submit-status")!;
const submissionNote = document.querySelector<HTMLElement>("#submission-note")!;
const submissionActions = document.querySelector<HTMLElement>("#submission-actions")!;
const directSuccess = document.querySelector<HTMLElement>("#direct-success")!;
const websiteTrap = document.querySelector<HTMLInputElement>("#website")!;
const draftKey = "patch-the-web-author-draft-v1";
let brief = "";
let requestArtifact: RepairRequestArtifact | undefined;
let reviewUrl = "";
let directSubmissionAvailable = false;
let openedAt = Date.now();
let submissionId = crypto.randomUUID();

type Draft = { target?: string; complaint?: string; criteria?: string; needs?: string[] };

function selectedNeeds() {
  return needInputs.filter((input) => input.checked).map((input) => input.value as RepairNeed);
}

async function checkDirectSubmission() {
  try {
    const response = await fetch("/api/repair-requests", { headers: { "Accept": "application/json" }, cache: "no-store" });
    const status = await response.json() as { directSubmission?: unknown };
    directSubmissionAvailable = response.ok && status.directSubmission === true;
  } catch {
    directSubmissionAvailable = false;
  }
  directSubmit.hidden = !directSubmissionAvailable;
  githubSubmit.textContent = directSubmissionAvailable ? "Use GitHub instead ↗" : "Continue with GitHub ↗";
  submissionNote.textContent = directSubmissionAvailable
    ? "Direct submission needs no account. GitHub remains available if you prefer to submit under your username."
    : "Direct submission is not active right now. GitHub sign-in is required for the fallback; installing repairs still needs no account.";
  directSubmit.disabled = !directSubmissionAvailable || !shareConsent.checked;
}

function saveDraft() {
  const draft: Draft = {
    target: targetInput.value,
    complaint: complaintInput.value,
    criteria: extraInput.value,
    needs: selectedNeeds()
  };
  sessionStorage.setItem(draftKey, JSON.stringify(draft));
}

function restoreDraft() {
  try {
    const draft = JSON.parse(sessionStorage.getItem(draftKey) ?? "null") as Draft | null;
    if (!draft) return;
    targetInput.value = draft.target ?? "";
    complaintInput.value = draft.complaint ?? "";
    extraInput.value = draft.criteria ?? "";
    const needs = new Set(draft.needs ?? []);
    needInputs.forEach((input) => { input.checked = needs.has(input.value); });
    if (targetInput.value || complaintInput.value) formStatus.textContent = "Your unfinished request was restored in this browser tab.";
  } catch {
    sessionStorage.removeItem(draftKey);
  }
}

function restoreExtensionHandoff() {
  if (!new URLSearchParams(location.hash.replace(/^#/, "")).has(REQUEST_HANDOFF_KEY)) return false;
  const handoff = decodeRepairRequestHandoff(location.hash);
  history.replaceState(null, "", `${location.pathname}${location.search}`);
  if (!handoff) {
    formStatus.textContent = "The private extension handoff was invalid or expired. Start a new request below.";
    return false;
  }
  try {
    targetInput.value = cleanPublicUrl(handoff.target);
    complaintInput.value = handoff.complaint;
    const needs = new Set(handoff.needs);
    needInputs.forEach((input) => { input.checked = needs.has(input.value as RepairNeed); });
    saveDraft();
    formStatus.textContent = handoff.needs.length > 0
      ? "Prefilled privately from the extension. Review the suggested outcomes, then create your request."
      : "Prefilled privately from the extension. Choose the outcomes you want, then create your request.";
    complaintInput.focus();
    return true;
  } catch {
    formStatus.textContent = "The extension handoff did not contain a valid public page. Start a new request below.";
    return false;
  }
}

form.addEventListener("input", saveDraft);
form.addEventListener("change", saveDraft);

form.addEventListener("submit", (event) => {
  event.preventDefault();
  formStatus.textContent = "";
  try {
    const artifact = buildAuthorBrief({
      target: targetInput.value,
      complaint: complaintInput.value,
      needs: selectedNeeds(),
      extraCriteria: extraInput.value
    });
    brief = artifact.brief;
    requestArtifact = artifact.request;
    const review = buildReviewIssue(artifact.request);
    reviewUrl = review.url;
    sharePreview.textContent = review.body;
    shareConsent.checked = false;
    shareConsent.closest<HTMLElement>("label")!.hidden = false;
    submitStatus.textContent = "";
    directSuccess.hidden = true;
    submissionActions.hidden = false;
    directSubmit.disabled = true;
    githubSubmit.removeAttribute("href");
    githubSubmit.setAttribute("aria-disabled", "true");
    scope.textContent = `Scope locked to ${artifact.target} · ${artifact.criteria.length} testable outcomes`;
    preview.textContent = brief;
    result.hidden = false;
    sessionStorage.removeItem(draftKey);
    result.scrollIntoView({ behavior: "smooth", block: "start" });
    result.querySelector<HTMLElement>("h2")?.focus();
  } catch (error) {
    formStatus.textContent = error instanceof Error ? error.message : "Check the request and try again.";
    formStatus.scrollIntoView({ behavior: "smooth", block: "center" });
  }
});

copyButton.addEventListener("click", async () => {
  await navigator.clipboard.writeText(brief);
  copyButton.textContent = "Copied — paste into Codex";
});

document.querySelector<HTMLButtonElement>("#download")!.addEventListener("click", () => {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([brief], { type: "text/markdown" }));
  link.download = "patch-the-web-repair-brief.md";
  link.click();
  URL.revokeObjectURL(link.href);
});

document.querySelector<HTMLButtonElement>("#download-request")!.addEventListener("click", () => {
  if (!requestArtifact) return;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([`${JSON.stringify(requestArtifact, null, 2)}\n`], { type: "application/json" }));
  link.download = "repair.patch-the-web-request.json";
  link.click();
  URL.revokeObjectURL(link.href);
});

document.querySelector<HTMLButtonElement>("#review-submit")!.addEventListener("click", () => {
  if (!requestArtifact) return;
  reviewDialog.showModal();
  reviewDialog.querySelector<HTMLElement>("h2")?.focus();
});

shareConsent.addEventListener("change", () => {
  directSubmit.disabled = !directSubmissionAvailable || !shareConsent.checked;
  if (shareConsent.checked) {
    githubSubmit.href = reviewUrl;
    githubSubmit.removeAttribute("aria-disabled");
  } else {
    githubSubmit.removeAttribute("href");
    githubSubmit.setAttribute("aria-disabled", "true");
  }
});

directSubmit.addEventListener("click", async () => {
  if (!requestArtifact || !shareConsent.checked || !directSubmissionAvailable) return;
  directSubmit.disabled = true;
  githubSubmit.setAttribute("aria-disabled", "true");
  submitStatus.textContent = "Submitting the reviewed request…";
  try {
    const response = await fetch("/api/repair-requests", {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ request: requestArtifact, consent: true, openedAt, submissionId, website: websiteTrap.value })
    });
    const body = await response.json() as { message?: unknown; number?: unknown; url?: unknown };
    if (!response.ok || !Number.isInteger(body.number) || typeof body.url !== "string") {
      throw new Error(typeof body.message === "string" ? body.message : "The request could not be submitted. Use the GitHub option instead.");
    }
    const issueUrl = new URL(body.url);
    if (issueUrl.origin !== "https://github.com" || issueUrl.pathname !== `/abbasaliii/patch-the-web/issues/${body.number}`) throw new Error("The submission receipt was invalid.");
    document.querySelector<HTMLElement>("#submitted-number")!.textContent = `#${body.number}`;
    const submittedLink = document.querySelector<HTMLAnchorElement>("#submitted-link")!;
    submittedLink.href = issueUrl.toString();
    directSuccess.hidden = false;
    submissionActions.hidden = true;
    shareConsent.closest<HTMLElement>("label")!.hidden = true;
    submitStatus.textContent = "Submitted successfully.";
    directSuccess.querySelector<HTMLElement>("h3")?.focus();
    sessionStorage.removeItem(draftKey);
  } catch (error) {
    submitStatus.textContent = error instanceof Error ? error.message : "The request could not be submitted. Use the GitHub option instead.";
    githubSubmit.removeAttribute("aria-disabled");
    directSubmit.disabled = false;
  }
});

githubSubmit.addEventListener("click", (event) => {
  if (!shareConsent.checked || !githubSubmit.href) event.preventDefault();
});

document.querySelector<HTMLButtonElement>("#close-review")!.addEventListener("click", () => reviewDialog.close());
document.querySelector<HTMLButtonElement>("#close-review-secondary")!.addEventListener("click", () => reviewDialog.close());

document.querySelector<HTMLButtonElement>("#start-over")!.addEventListener("click", () => {
  form.reset();
  sessionStorage.removeItem(draftKey);
  result.hidden = true;
  brief = "";
  requestArtifact = undefined;
  reviewUrl = "";
  openedAt = Date.now();
  submissionId = crypto.randomUUID();
  directSuccess.hidden = true;
  submissionActions.hidden = false;
  shareConsent.closest<HTMLElement>("label")!.hidden = false;
  submitStatus.textContent = "";
  formStatus.textContent = "Request cleared.";
  targetInput.focus();
});

if (!restoreExtensionHandoff()) restoreDraft();
void checkDirectSubmission();
