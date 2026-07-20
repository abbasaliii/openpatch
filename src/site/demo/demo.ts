const form = document.getElementById("benefits-form") as HTMLFormElement;
const genericError = document.getElementById("generic-error") as HTMLElement;
const success = document.getElementById("success-panel") as HTMLElement;
const timeoutButton = document.getElementById("simulate-timeout") as HTMLButtonElement;
const sessionTime = document.getElementById("session-time") as HTMLElement;

let remaining = 9 * 60 + 42;
window.setInterval(() => {
  remaining = Math.max(0, remaining - 1);
  const minutes = Math.floor(remaining / 60).toString().padStart(2, "0");
  const seconds = (remaining % 60).toString().padStart(2, "0");
  sessionTime.textContent = `${minutes}:${seconds}`;
}, 1000);

form.addEventListener("submit", (event) => {
  event.preventDefault();
  genericError.hidden = true;
  success.hidden = true;
  queueMicrotask(() => {
    if (document.documentElement.classList.contains("patch-the-web-active")) {
      if (!form.querySelector('[aria-invalid="true"]')) {
        success.hidden = false;
        success.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }
    genericError.hidden = false;
    genericError.scrollIntoView({ behavior: "smooth", block: "center" });
  });
});

timeoutButton.addEventListener("click", () => {
  sessionStorage.setItem("civicapply-timeout", "true");
  location.reload();
});

if (sessionStorage.getItem("civicapply-timeout")) {
  sessionStorage.removeItem("civicapply-timeout");
  const toast = document.getElementById("timeout-toast") as HTMLElement;
  toast.hidden = false;
  window.setTimeout(() => toast.hidden = true, 6000);
}
