import type {
  FieldRule,
  OpenPatch,
  OperationHealth,
  PatchHealth,
  PatchOperation,
  PersistFormOperation,
  ValidationOperation
} from "./types";

type BrowserContext = {
  document: Document;
  window: Window;
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">;
};

const MAX_MATCHES = 100;
const SENSITIVE_AUTOCOMPLETE = /(?:current-password|new-password|one-time-code|cc-|transaction-|webauthn)/i;

function installTrustedUiStyles(document: Document) {
  if (document.querySelector("style[data-openpatch-ui]")) return;
  const style = document.createElement("style");
  style.dataset.openpatchUi = "true";
  style.textContent = `
    .openpatch-save-status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 18px;
      padding: 8px 12px;
      border: 1px solid #b7ebd0;
      border-radius: 999px;
      color: #086647;
      background: #effcf6;
      font: 600 13px/1.2 ui-sans-serif, system-ui, sans-serif;
    }
    .openpatch-save-status::before { content: "✓"; }
    .openpatch-field-error {
      margin: 7px 0 0;
      color: #b42318;
      font: 600 14px/1.35 ui-sans-serif, system-ui, sans-serif;
    }
    [aria-invalid="true"] {
      border-color: #d92d20 !important;
      box-shadow: 0 0 0 3px rgba(217, 45, 32, .12) !important;
    }
  `;
  document.head.append(style);
}

function selected(document: Document, selector: string) {
  return [...document.querySelectorAll<HTMLElement>(selector)].slice(0, MAX_MATCHES);
}

function isEligibleField(element: Element): element is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement {
  if (!["INPUT", "SELECT", "TEXTAREA"].includes(element.tagName)) return false;
  if (element.tagName === "INPUT" && ["password", "file", "hidden", "submit", "button", "reset", "image"].includes((element as HTMLInputElement).type)) return false;
  if (SENSITIVE_AUTOCOMPLETE.test(element.getAttribute("autocomplete") || "")) return false;
  return !(element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).disabled;
}

function fieldKey(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, index: number) {
  return element.name || element.id || `field-${index}`;
}

function readField(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  if (element.tagName === "INPUT" && (["checkbox", "radio"].includes((element as HTMLInputElement).type))) return (element as HTMLInputElement).checked;
  return element.value;
}

function writeField(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: unknown) {
  if (element.tagName === "INPUT" && (["checkbox", "radio"].includes((element as HTMLInputElement).type))) {
    if (typeof value === "boolean") (element as HTMLInputElement).checked = value;
  } else if (typeof value === "string") {
    element.value = value;
  }
}

function viewportMatches(operation: Extract<PatchOperation, { type: "style" }>, window: Window) {
  if (!operation.when) return true;
  const width = window.innerWidth;
  return (operation.when.minWidth === undefined || width >= operation.when.minWidth) &&
    (operation.when.maxWidth === undefined || width <= operation.when.maxWidth);
}

function setupPersistence(
  patch: OpenPatch,
  operation: PersistFormOperation,
  context: BrowserContext,
  form: HTMLFormElement
) {
  const { document, storage } = context;
  const fields = operation.include.flatMap((selector) => selected(form.ownerDocument, `${operation.selector} ${selector}`))
    .filter(isEligibleField);
  const uniqueFields = [...new Set(fields)].slice(0, 40);
  const storageKey = `openpatch:${patch.id}:${operation.key}`;
  const status = document.createElement("p");
  status.className = "openpatch-save-status";
  status.dataset.openpatchOwned = "true";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.textContent = operation.statusText;
  form.prepend(status);

  let restored = false;
  try {
    const raw = storage.getItem(storageKey);
    if (raw) {
      const snapshot = JSON.parse(raw) as Record<string, unknown>;
      uniqueFields.forEach((field, index) => writeField(field, snapshot[fieldKey(field, index)]));
      status.textContent = `Draft restored · ${operation.statusText}`;
      restored = true;
    }
  } catch {
    status.textContent = "Local draft storage is unavailable";
  }

  const save = () => {
    const snapshot: Record<string, unknown> = {};
    uniqueFields.forEach((field, index) => {
      snapshot[fieldKey(field, index)] = readField(field);
    });
    try {
      storage.setItem(storageKey, JSON.stringify(snapshot));
      status.textContent = operation.statusText;
      status.dataset.state = "saved";
    } catch {
      status.textContent = "Could not save this draft on this device";
      status.dataset.state = "error";
    }
  };
  form.addEventListener("input", save);
  form.addEventListener("change", save);
  form.addEventListener("reset", () => storage.removeItem(storageKey));
  return { matched: uniqueFields.length, detail: restored ? "draft restored" : "draft storage ready" };
}

function ruleFailure(value: string, rule: FieldRule) {
  if (rule.kind === "required") return value.trim().length === 0;
  if (rule.kind === "email") return value.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  if (rule.kind === "minLength") return value.length > 0 && value.length < Number(rule.value);
  if (rule.kind === "pattern") {
    try {
      return value.length > 0 && !new RegExp(String(rule.value)).test(value);
    } catch {
      return true;
    }
  }
  return false;
}

function setupValidation(operation: ValidationOperation, context: BrowserContext, form: HTMLFormElement) {
  const { document } = context;
  const pairs = operation.fields.flatMap((field) =>
    selected(document, field.selector)
      .filter((element): element is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement => isEligibleField(element))
      .map((element) => ({ element, rules: field.rules }))
  );

  const validate = (element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, rules: FieldRule[]) => {
    const existingId = `openpatch-error-${operation.id}-${element.id || element.name || "field"}`.replace(/[^a-z0-9_-]/gi, "-");
    document.getElementById(existingId)?.remove();
    element.removeAttribute("aria-invalid");
    const originalDescription = (element.getAttribute("aria-describedby") || "").split(/\s+/).filter((id) => id && id !== existingId);
    const failed = rules.find((rule) => ruleFailure(element.value, rule));
    if (!failed) {
      if (originalDescription.length > 0) element.setAttribute("aria-describedby", originalDescription.join(" "));
      else element.removeAttribute("aria-describedby");
      return true;
    }
    const error = document.createElement("p");
    error.id = existingId;
    error.className = "openpatch-field-error";
    error.dataset.openpatchOwned = "true";
    error.setAttribute("role", "alert");
    error.textContent = failed.message;
    element.setAttribute("aria-invalid", "true");
    element.setAttribute("aria-describedby", [...originalDescription, existingId].join(" "));
    element.insertAdjacentElement("afterend", error);
    return false;
  };

  pairs.forEach(({ element, rules }) => element.addEventListener("blur", () => validate(element, rules)));
  form.addEventListener("submit", (event) => {
    const invalid = pairs.filter(({ element, rules }) => !validate(element, rules));
    if (invalid.length > 0) {
      event.preventDefault();
      invalid[0].element.focus();
    }
  });
  return pairs.length;
}

function applyOperation(patch: OpenPatch, operation: PatchOperation, context: BrowserContext): OperationHealth {
  const { document, window } = context;
  try {
    if (operation.type === "style") {
      const elements = selected(document, operation.selector);
      if (!viewportMatches(operation, window)) return { id: operation.id, type: operation.type, matched: elements.length, applied: true, detail: "viewport rule inactive" };
      elements.forEach((element) => Object.entries(operation.styles).forEach(([property, value]) => element.style.setProperty(property, value)));
      return { id: operation.id, type: operation.type, matched: elements.length, applied: elements.length > 0 };
    }
    if (operation.type === "attributes") {
      const elements = selected(document, operation.selector);
      elements.forEach((element) => Object.entries(operation.attributes).forEach(([name, value]) => element.setAttribute(name, value)));
      return { id: operation.id, type: operation.type, matched: elements.length, applied: elements.length > 0 };
    }
    if (operation.type === "hide") {
      const elements = selected(document, operation.selector);
      elements.forEach((element) => {
        element.hidden = true;
        element.setAttribute("aria-hidden", "true");
      });
      return { id: operation.id, type: operation.type, matched: elements.length, applied: elements.length > 0 };
    }
    if (operation.type === "move") {
      const elements = selected(document, operation.selector);
      const targets = selected(document, operation.target);
      if (targets.length !== 1 || elements.length === 0) return { id: operation.id, type: operation.type, matched: elements.length, applied: false, detail: `expected one target, found ${targets.length}` };
      const target = targets[0];
      elements.forEach((element) => {
        if (operation.position === "before") target.before(element);
        if (operation.position === "after") target.after(element);
        if (operation.position === "prepend") target.prepend(element);
        if (operation.position === "append") target.append(element);
      });
      return { id: operation.id, type: operation.type, matched: elements.length, applied: true };
    }
    if (operation.type === "persistForm") {
      const forms = selected(document, operation.selector).filter((element): element is HTMLFormElement => element.tagName === "FORM");
      if (forms.length !== 1) return { id: operation.id, type: operation.type, matched: forms.length, applied: false, detail: "expected exactly one form" };
      const result = setupPersistence(patch, operation, context, forms[0]);
      return { id: operation.id, type: operation.type, matched: result.matched, applied: result.matched > 0, detail: result.detail };
    }
    if (operation.type === "validation") {
      const forms = selected(document, operation.selector).filter((element): element is HTMLFormElement => element.tagName === "FORM");
      if (forms.length !== 1) return { id: operation.id, type: operation.type, matched: forms.length, applied: false, detail: "expected exactly one form" };
      const count = setupValidation(operation, context, forms[0]);
      return { id: operation.id, type: operation.type, matched: count, applied: count > 0 };
    }
    const containers = selected(document, operation.container);
    if (containers.length !== 1) return { id: operation.id, type: operation.type, matched: containers.length, applied: false, detail: "expected exactly one navigation container" };
    const items = [...containers[0].querySelectorAll<HTMLElement>(operation.items)].slice(0, 50);
    items.forEach((item, index) => item.tabIndex = index === 0 ? 0 : -1);
    containers[0].addEventListener("keydown", (event) => {
      const keyboardEvent = event as KeyboardEvent;
      const previousKey = operation.orientation === "horizontal" ? "ArrowLeft" : "ArrowUp";
      const nextKey = operation.orientation === "horizontal" ? "ArrowRight" : "ArrowDown";
      if (![previousKey, nextKey, "Home", "End"].includes(keyboardEvent.key)) return;
      const current = items.indexOf(document.activeElement as HTMLElement);
      if (current < 0) return;
      keyboardEvent.preventDefault();
      let next = keyboardEvent.key === "Home" ? 0 : keyboardEvent.key === "End" ? items.length - 1 : current + (keyboardEvent.key === nextKey ? 1 : -1);
      if (operation.wrap !== false) next = (next + items.length) % items.length;
      else next = Math.max(0, Math.min(items.length - 1, next));
      items.forEach((item, index) => item.tabIndex = index === next ? 0 : -1);
      items[next]?.focus();
    });
    return { id: operation.id, type: operation.type, matched: items.length, applied: items.length > 0 };
  } catch (error) {
    return { id: operation.id, type: operation.type, matched: 0, applied: false, detail: error instanceof Error ? error.message : "operation failed" };
  }
}

export function applyPatch(
  patch: OpenPatch,
  context: Partial<BrowserContext> = {}
): PatchHealth {
  const documentRef = context.document ?? document;
  const windowRef = context.window ?? window;
  const storageRef = context.storage ?? windowRef.localStorage;
  const marker = `${patch.id}@${patch.version}`;
  installTrustedUiStyles(documentRef);
  const root = documentRef.documentElement;
  if (root.dataset.openpatchApplied === marker) {
    return { patchId: patch.id, version: patch.version, applied: true, operations: [], healthy: patch.operations.length, total: patch.operations.length, timestamp: Date.now() };
  }
  const operations = patch.operations.map((operation) => applyOperation(patch, operation, { document: documentRef, window: windowRef, storage: storageRef }));
  const healthy = operations.filter((operation) => operation.applied).length;
  root.dataset.openpatchApplied = marker;
  root.classList.add("openpatch-active");
  return {
    patchId: patch.id,
    version: patch.version,
    applied: healthy === operations.length,
    operations,
    healthy,
    total: operations.length,
    timestamp: Date.now()
  };
}
