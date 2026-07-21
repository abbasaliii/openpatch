const boxes = [...document.querySelectorAll<HTMLInputElement>("[data-step]")];
const progress = document.querySelector<HTMLElement>("#progress");
const copyButton = document.querySelector<HTMLButtonElement>("#copy-address");
const download = document.querySelector<HTMLAnchorElement>("#extension-download");
const storageKey = "patch-the-web-install-checklist-v0.11.0";

function selectedSteps() {
  return boxes.filter((box) => box.checked).map((box) => box.dataset.step ?? "");
}

function renderProgress() {
  const complete = selectedSteps().length;
  if (progress) progress.textContent = complete === boxes.length ? "Ready to try your first repair ✓" : `${complete} of ${boxes.length} steps marked complete`;
  document.body.classList.toggle("is-ready", complete === boxes.length);
}

try {
  const stored = JSON.parse(localStorage.getItem(storageKey) ?? "[]") as unknown;
  if (Array.isArray(stored)) boxes.forEach((box) => { box.checked = stored.includes(box.dataset.step); });
} catch { /* A checklist should never block installation. */ }

boxes.forEach((box) => box.addEventListener("change", () => {
  localStorage.setItem(storageKey, JSON.stringify(selectedSteps()));
  renderProgress();
}));

download?.addEventListener("click", () => {
  const downloadBox = boxes.find((box) => box.dataset.step === "download");
  if (downloadBox) downloadBox.checked = true;
  localStorage.setItem(storageKey, JSON.stringify(selectedSteps()));
  renderProgress();
});

copyButton?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText("chrome://extensions");
    copyButton.textContent = "Copied ✓";
  } catch {
    copyButton.textContent = "Select and copy the address";
  }
});

renderProgress();
