import type {
  CollectionFilterOperation,
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
    .openpatch-navigator {
      margin: 0 0 24px;
      padding: 22px;
      border: 1px solid #b9e6d1;
      border-radius: 18px;
      color: #17352a;
      background: linear-gradient(145deg, #f2fcf7, #ffffff);
      box-shadow: 0 14px 36px rgba(22, 94, 67, .09);
      font-family: ui-sans-serif, system-ui, sans-serif;
    }
    .openpatch-navigator__head { display: flex; align-items: start; gap: 14px; margin-bottom: 18px; }
    .openpatch-navigator__mark {
      display: grid; place-items: center; width: 38px; height: 38px; flex: 0 0 auto;
      border-radius: 12px; color: #fff; background: #0b9569; font-weight: 850;
    }
    .openpatch-navigator h2 { margin: 0 0 4px; color: #143126; font-size: 20px; line-height: 1.2; }
    .openpatch-navigator p { margin: 0; color: #5f746b; font-size: 13px; line-height: 1.5; }
    .openpatch-navigator__controls { display: grid; grid-template-columns: minmax(210px, 1.4fr) repeat(3, minmax(130px, 1fr)); gap: 10px; }
    .openpatch-navigator label { display: grid; gap: 6px; color: #355649; font-size: 11px; font-weight: 800; }
    .openpatch-navigator input, .openpatch-navigator select {
      width: 100%; min-height: 42px; padding: 9px 11px; border: 1px solid #bed4ca; border-radius: 10px;
      color: #19362b; background: #fff; font: 500 13px/1.25 ui-sans-serif, system-ui, sans-serif;
    }
    .openpatch-navigator input:focus, .openpatch-navigator select:focus {
      outline: 3px solid rgba(11, 149, 105, .18); outline-offset: 1px; border-color: #0b9569;
    }
    .openpatch-navigator__receipt { display: flex; align-items: center; gap: 10px; margin-top: 15px; padding-top: 14px; border-top: 1px solid #dcece4; }
    .openpatch-navigator__status { color: #136b4d !important; font-weight: 800; }
    .openpatch-navigator__privacy { margin-left: auto !important; font-size: 10px !important; }
    .openpatch-navigator__clear {
      min-height: 34px; padding: 7px 10px; border: 1px solid #bad5c8; border-radius: 9px;
      color: #176248; background: #fff; font: 800 11px/1 ui-sans-serif, system-ui, sans-serif; cursor: pointer;
    }
    .openpatch-navigator__clear:focus-visible { outline: 3px solid rgba(11, 149, 105, .18); outline-offset: 2px; }
    @media (max-width: 760px) {
      .openpatch-navigator { padding: 18px; border-radius: 16px; }
      .openpatch-navigator__controls { grid-template-columns: 1fr; }
      .openpatch-navigator__receipt { align-items: flex-start; flex-wrap: wrap; }
      .openpatch-navigator__privacy { width: 100%; margin-left: 0 !important; }
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
      const stored = JSON.parse(raw) as { savedAt?: unknown; values?: unknown };
      const savedAt = typeof stored.savedAt === "number" ? stored.savedAt : 0;
      const expired = Date.now() - savedAt > operation.ttlMinutes * 60_000;
      const values = stored.values && typeof stored.values === "object" && !Array.isArray(stored.values)
        ? stored.values as Record<string, unknown>
        : null;
      if (expired || !values) {
        storage.removeItem(storageKey);
        status.textContent = `Previous draft expired · ${operation.statusText}`;
      } else {
        uniqueFields.forEach((field, index) => writeField(field, values[fieldKey(field, index)]));
        status.textContent = `Draft restored · ${operation.statusText}`;
        restored = true;
      }
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
      storage.setItem(storageKey, JSON.stringify({ savedAt: Date.now(), values: snapshot }));
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

function splitAttributeTokens(value: string | null) {
  return (value ?? "").toLowerCase().split(/[\s,|]+/).filter(Boolean);
}

function setupCollectionFilter(
  patch: OpenPatch,
  operation: CollectionFilterOperation,
  context: BrowserContext,
  container: HTMLElement
) {
  const { document, storage } = context;
  const items = [...container.querySelectorAll<HTMLElement>(operation.items)].slice(0, MAX_MATCHES);
  if (items.length === 0) return { matched: 0, detail: "no collection items found" };

  const panel = document.createElement("section");
  panel.className = "openpatch-navigator";
  panel.dataset.openpatchOwned = "true";
  panel.setAttribute("aria-label", operation.title);
  const head = document.createElement("div");
  head.className = "openpatch-navigator__head";
  const mark = document.createElement("span");
  mark.className = "openpatch-navigator__mark";
  mark.setAttribute("aria-hidden", "true");
  mark.textContent = "⌕";
  const copy = document.createElement("div");
  const title = document.createElement("h2");
  title.textContent = operation.title;
  const description = document.createElement("p");
  description.textContent = operation.description;
  copy.append(title, description);
  head.append(mark, copy);

  const controls = document.createElement("div");
  controls.className = "openpatch-navigator__controls";
  const searchId = `openpatch-search-${operation.id}`;
  const searchLabel = document.createElement("label");
  searchLabel.htmlFor = searchId;
  searchLabel.append(document.createTextNode(operation.search.label));
  const search = document.createElement("input");
  search.id = searchId;
  search.type = "search";
  search.autocomplete = "off";
  search.placeholder = operation.search.placeholder ?? "";
  search.setAttribute("aria-keyshortcuts", "/");
  searchLabel.append(search);
  controls.append(searchLabel);

  const selects = operation.filters.map((filter) => {
    const id = `openpatch-filter-${operation.id}-${filter.id}`;
    const label = document.createElement("label");
    label.htmlFor = id;
    label.append(document.createTextNode(filter.label));
    const select = document.createElement("select");
    select.id = id;
    const any = document.createElement("option");
    any.value = "";
    any.textContent = `Any ${filter.label.toLowerCase()}`;
    select.append(any);
    filter.options.forEach((option) => {
      const element = document.createElement("option");
      element.value = option.value;
      element.textContent = option.label;
      select.append(element);
    });
    label.append(select);
    controls.append(label);
    return { filter, select };
  });

  const receipt = document.createElement("div");
  receipt.className = "openpatch-navigator__receipt";
  const status = document.createElement("p");
  status.className = "openpatch-navigator__status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "openpatch-navigator__clear";
  clear.textContent = "Clear filters";
  const privacy = document.createElement("p");
  privacy.className = "openpatch-navigator__privacy";
  privacy.textContent = operation.persist
    ? `Preferences stay on this device for ${Math.round(operation.persist.ttlMinutes / 60)} hours`
    : "Filtering stays on this page";
  receipt.append(status, clear, privacy);
  panel.append(head, controls, receipt);
  container.prepend(panel);

  const storageKey = operation.persist ? `openpatch:${patch.id}:${operation.persist.key}` : null;
  const readState = () => ({
    search: search.value,
    filters: Object.fromEntries(selects.map(({ filter, select }) => [filter.id, select.value]))
  });
  const saveState = () => {
    if (!storageKey) return;
    try { storage.setItem(storageKey, JSON.stringify({ savedAt: Date.now(), ...readState() })); } catch { /* origin storage can be unavailable */ }
  };
  const apply = () => {
    const query = search.value.trim().toLowerCase();
    let visible = 0;
    items.forEach((item) => {
      const searchable = operation.search.attributes.map((attribute) => item.getAttribute(attribute) ?? "").join(" ").toLowerCase();
      const matchesSearch = query.length === 0 || query.split(/\s+/).every((term) => searchable.includes(term));
      const matchesFilters = selects.every(({ filter, select }) => {
        if (!select.value) return true;
        return splitAttributeTokens(item.getAttribute(filter.attribute)).includes(select.value.toLowerCase());
      });
      const show = matchesSearch && matchesFilters;
      item.hidden = !show;
      item.toggleAttribute("data-openpatch-filtered", !show);
      if (show) visible += 1;
    });
    status.textContent = `${visible} of ${items.length} services match`;
    saveState();
  };

  if (storageKey && operation.persist) {
    try {
      const raw = storage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as { savedAt?: unknown; search?: unknown; filters?: unknown };
        const savedAt = typeof saved.savedAt === "number" ? saved.savedAt : 0;
        if (Date.now() - savedAt <= operation.persist.ttlMinutes * 60_000) {
          if (typeof saved.search === "string") search.value = saved.search;
          if (saved.filters && typeof saved.filters === "object" && !Array.isArray(saved.filters)) {
            const storedFilters = saved.filters as Record<string, unknown>;
            selects.forEach(({ filter, select }) => {
              if (typeof storedFilters[filter.id] === "string") select.value = String(storedFilters[filter.id]);
            });
          }
        } else storage.removeItem(storageKey);
      }
    } catch { /* invalid local state is ignored */ }
  }

  search.addEventListener("input", apply);
  selects.forEach(({ select }) => select.addEventListener("change", apply));
  clear.addEventListener("click", () => {
    search.value = "";
    selects.forEach(({ select }) => { select.value = ""; });
    apply();
    search.focus();
  });
  document.addEventListener("keydown", (event) => {
    const keyboardEvent = event as KeyboardEvent;
    const active = document.activeElement as HTMLElement | null;
    const typing = active?.tagName === "INPUT" || active?.tagName === "TEXTAREA" || active?.tagName === "SELECT" || active?.isContentEditable;
    if (keyboardEvent.key === "/" && !typing) {
      keyboardEvent.preventDefault();
      search.focus();
    }
    if (keyboardEvent.key === "Escape" && document.activeElement === search && search.value) {
      search.value = "";
      apply();
    }
  });
  apply();
  return { matched: items.length, detail: `${items.length} items filterable` };
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
    if (operation.type === "collectionFilter") {
      const containers = selected(document, operation.selector);
      if (containers.length !== 1) return { id: operation.id, type: operation.type, matched: containers.length, applied: false, detail: "expected exactly one collection container" };
      const result = setupCollectionFilter(patch, operation, context, containers[0]);
      return { id: operation.id, type: operation.type, matched: result.matched, applied: result.matched > 0, detail: result.detail };
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
  const appliedMarkers = new Set((root.dataset.openpatchApplied ?? "").split(/\s+/).filter(Boolean));
  if (appliedMarkers.has(marker)) {
    return { patchId: patch.id, version: patch.version, applied: true, operations: [], healthy: patch.operations.length, total: patch.operations.length, timestamp: Date.now() };
  }
  const operations = patch.operations.map((operation) => applyOperation(patch, operation, { document: documentRef, window: windowRef, storage: storageRef }));
  const healthy = operations.filter((operation) => operation.applied).length;
  appliedMarkers.add(marker);
  root.dataset.openpatchApplied = [...appliedMarkers].join(" ");
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
