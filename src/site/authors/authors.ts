import { buildAuthorBrief, buildReviewIssue, type RepairNeed, type RepairRequestArtifact } from "./brief";

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
const draftKey = "patch-the-web-author-draft-v1";
let brief = "";
let requestArtifact: RepairRequestArtifact | undefined;
let reviewUrl = "";

type Draft = { target?: string; complaint?: string; criteria?: string; needs?: string[] };

function selectedNeeds() {
  return needInputs.filter((input) => input.checked).map((input) => input.value as RepairNeed);
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
  if (shareConsent.checked) {
    githubSubmit.href = reviewUrl;
    githubSubmit.removeAttribute("aria-disabled");
  } else {
    githubSubmit.removeAttribute("href");
    githubSubmit.setAttribute("aria-disabled", "true");
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
  formStatus.textContent = "Request cleared.";
  targetInput.focus();
});

restoreDraft();
