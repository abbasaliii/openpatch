import type {
  CollectionCompareOperation,
  CollectionFilterOperation,
  FieldRule,
  CommunityPatch,
  OperationHealth,
  PatchHealth,
  PatchOperation,
  PersistFormOperation,
  PublicListSearchOperation,
  PublicTableSearchOperation,
  ValidationOperation
} from "./types";
import { inspectTableColumnFilter } from "./table-filter";
import { inspectPublicTableSearch } from "./public-table-search";
import { inspectPublicListSearch } from "./public-list-search";

type BrowserContext = {
  document: Document;
  window: Window;
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">;
};

const MAX_MATCHES = 100;
const SENSITIVE_AUTOCOMPLETE = /(?:current-password|new-password|one-time-code|cc-|transaction-|webauthn)/i;
const SENSITIVE_FIELD_HINT = /(?:^|[-_.])(?:password|passwd|passcode|pin|otp|one[-_.]?time|verification[-_.]?code|auth[-_.]?code|security[-_.]?code|secret|token|cvv|cvc|card[-_.]?number|credit[-_.]?card|routing[-_.]?number|bank[-_.]?account|account[-_.]?number|social[-_.]?security|ssn|tax[-_.]?id|passport)(?:$|[-_.])/i;

function installTrustedUiStyles(document: Document) {
  if (document.querySelector("style[data-patch-the-web-ui]")) return;
  const style = document.createElement("style");
  style.dataset.patchTheWebUi = "true";
  style.textContent = `
    .patch-the-web-save-status {
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
    .patch-the-web-save-status::before { content: "✓"; }
    .patch-the-web-field-error {
      margin: 7px 0 0;
      color: #b42318;
      font: 600 14px/1.35 ui-sans-serif, system-ui, sans-serif;
    }
    [aria-invalid="true"] {
      border-color: #d92d20 !important;
      box-shadow: 0 0 0 3px rgba(217, 45, 32, .12) !important;
    }
    .patch-the-web-navigator {
      margin: 0 0 24px;
      padding: 22px;
      border: 1px solid #b9e6d1;
      border-radius: 18px;
      color: #17352a;
      background: linear-gradient(145deg, #f2fcf7, #ffffff);
      box-shadow: 0 14px 36px rgba(22, 94, 67, .09);
      font-family: ui-sans-serif, system-ui, sans-serif;
    }
    .patch-the-web-navigator__head { display: flex; align-items: start; gap: 14px; margin-bottom: 18px; }
    .patch-the-web-navigator__mark {
      display: grid; place-items: center; width: 38px; height: 38px; flex: 0 0 auto;
      border-radius: 12px; color: #fff; background: #0b9569; font-weight: 850;
    }
    .patch-the-web-navigator h2 { margin: 0 0 4px; color: #143126; font-size: 20px; line-height: 1.2; }
    .patch-the-web-navigator p { margin: 0; color: #5f746b; font-size: 13px; line-height: 1.5; }
    .patch-the-web-navigator__controls { display: grid; grid-template-columns: minmax(210px, 1.4fr) repeat(3, minmax(130px, 1fr)); gap: 10px; }
    .patch-the-web-navigator label { display: grid; gap: 6px; color: #355649; font-size: 11px; font-weight: 800; }
    .patch-the-web-navigator input, .patch-the-web-navigator select {
      width: 100%; min-height: 42px; padding: 9px 11px; border: 1px solid #bed4ca; border-radius: 10px;
      color: #19362b; background: #fff; font: 500 13px/1.25 ui-sans-serif, system-ui, sans-serif;
    }
    .patch-the-web-navigator input:focus, .patch-the-web-navigator select:focus {
      outline: 3px solid rgba(11, 149, 105, .18); outline-offset: 1px; border-color: #0b9569;
    }
    .patch-the-web-navigator__receipt { display: flex; align-items: center; gap: 10px; margin-top: 15px; padding-top: 14px; border-top: 1px solid #dcece4; }
    .patch-the-web-navigator__status { color: #136b4d !important; font-weight: 800; }
    .patch-the-web-navigator__privacy { margin-left: auto !important; font-size: 10px !important; }
    .patch-the-web-navigator__clear {
      min-height: 34px; padding: 7px 10px; border: 1px solid #bad5c8; border-radius: 9px;
      color: #176248; background: #fff; font: 800 11px/1 ui-sans-serif, system-ui, sans-serif; cursor: pointer;
    }
    .patch-the-web-navigator__clear:focus-visible { outline: 3px solid rgba(11, 149, 105, .18); outline-offset: 2px; }
    .patch-the-web-table-search, .patch-the-web-list-search {
      margin: 0 0 22px; padding: 20px; border: 1px solid #b9e6d1; border-radius: 16px;
      color: #17352a; background: linear-gradient(145deg, #f2fcf7, #fff);
      box-shadow: 0 12px 30px rgba(22,94,67,.08); font-family: ui-sans-serif, system-ui, sans-serif;
    }
    .patch-the-web-table-search h2, .patch-the-web-list-search h2 { margin: 0 0 4px; color: #143126; font-size: 20px; line-height: 1.2; }
    .patch-the-web-table-search p, .patch-the-web-list-search p { margin: 0; color: #5f746b; font-size: 13px; line-height: 1.5; }
    .patch-the-web-table-search label, .patch-the-web-list-search label { display: grid; gap: 7px; margin-top: 15px; color: #355649; font-size: 11px; font-weight: 800; }
    .patch-the-web-table-search input, .patch-the-web-list-search input { width: 100%; min-height: 43px; padding: 9px 11px; border: 1px solid #bed4ca; border-radius: 10px; color: #19362b; background: #fff; font: 500 14px/1.25 ui-sans-serif, system-ui, sans-serif; }
    .patch-the-web-table-search input:focus, .patch-the-web-list-search input:focus { outline: 3px solid rgba(11,149,105,.18); outline-offset: 1px; border-color: #0b9569; }
    .patch-the-web-table-search__receipt, .patch-the-web-list-search__receipt { display: flex; gap: 12px; align-items: center; margin-top: 13px; padding-top: 12px; border-top: 1px solid #dcece4; }
    .patch-the-web-table-search__status, .patch-the-web-list-search__status { color: #136b4d !important; font-weight: 800; }
    .patch-the-web-table-search__privacy, .patch-the-web-list-search__privacy { margin-left: auto !important; font-size: 10px !important; }
    .patch-the-web-compare {
      margin: -8px 0 26px;
      padding: 18px 20px;
      border: 1px solid #245d4a;
      border-radius: 18px;
      color: #fff;
      background: linear-gradient(135deg, #123a2d, #1d5a45);
      box-shadow: 0 16px 34px rgba(20, 68, 51, .16);
      font-family: ui-sans-serif, system-ui, sans-serif;
    }
    .patch-the-web-compare__bar { display: flex; align-items: center; gap: 16px; }
    .patch-the-web-compare__mark {
      display: grid; place-items: center; width: 38px; height: 38px; flex: 0 0 auto;
      border: 1px solid rgba(255,255,255,.2); border-radius: 12px; color: #102f25; background: #70dfb2; font-weight: 900;
    }
    .patch-the-web-compare__copy { min-width: 180px; }
    .patch-the-web-compare h2, .patch-the-web-compare h3 { margin: 0 0 3px; color: #fff; line-height: 1.2; }
    .patch-the-web-compare h2 { font-size: 17px; }
    .patch-the-web-compare h3 { font-size: 20px; }
    .patch-the-web-compare p { margin: 0; color: #c8ded5; font-size: 11px; line-height: 1.45; }
    .patch-the-web-compare__selection { display: flex; flex: 1; align-items: center; justify-content: flex-end; gap: 7px; flex-wrap: wrap; }
    .patch-the-web-compare__chip { padding: 6px 9px; border: 1px solid rgba(255,255,255,.18); border-radius: 999px; color: #eaf8f2; background: rgba(255,255,255,.08); font-size: 10px; font-weight: 750; }
    .patch-the-web-compare__actions { display: flex; gap: 7px; }
    .patch-the-web-compare__action, .patch-the-web-compare__close {
      min-height: 36px; padding: 8px 11px; border: 1px solid rgba(255,255,255,.24); border-radius: 9px;
      color: #12382c; background: #72e0b2; font: 800 11px/1 ui-sans-serif, system-ui, sans-serif; cursor: pointer;
    }
    .patch-the-web-compare__action.secondary, .patch-the-web-compare__close { color: #e9f7f1; background: transparent; }
    .patch-the-web-compare__action:disabled { color: #8bb5a5; background: #2b604d; cursor: not-allowed; }
    .patch-the-web-compare__action:focus-visible, .patch-the-web-compare__close:focus-visible, .patch-the-web-compare__select:focus-visible {
      outline: 3px solid rgba(112, 223, 178, .3); outline-offset: 2px;
    }
    .patch-the-web-compare__select {
      align-self: flex-start; margin: 14px 0 0; padding: 7px 10px; border: 1px solid #b9d4c8; border-radius: 9px;
      color: #176248; background: #f5fbf8; font: 800 10px/1 ui-sans-serif, system-ui, sans-serif; cursor: pointer;
    }
    .patch-the-web-compare__select[aria-pressed="true"] { border-color: #167e59; color: #fff; background: #167e59; }
    .patch-the-web-compare__select:disabled { opacity: .48; cursor: not-allowed; }
    [data-patch-the-web-compared] { box-shadow: 0 0 0 3px rgba(22, 126, 89, .14), 0 12px 30px rgba(29, 77, 58, .07) !important; }
    .patch-the-web-compare__result { margin-top: 18px; padding-top: 18px; border-top: 1px solid rgba(255,255,255,.18); }
    .patch-the-web-compare__result-head { display: flex; align-items: start; justify-content: space-between; gap: 16px; margin-bottom: 13px; }
    .patch-the-web-compare__table-wrap { overflow-x: auto; border: 1px solid rgba(255,255,255,.15); border-radius: 12px; background: #fff; }
    .patch-the-web-compare__table-wrap:focus-visible { outline: 3px solid #79e5b7; outline-offset: 3px; }
    .patch-the-web-compare table { width: 100%; min-width: 560px; border-collapse: collapse; color: #18372b; background: #fff; font-size: 11px; }
    .patch-the-web-compare th, .patch-the-web-compare td { padding: 11px 13px; border-bottom: 1px solid #e1ebe6; text-align: left; vertical-align: top; }
    .patch-the-web-compare thead th { color: #10392b; background: #eef8f3; font-size: 11px; }
    .patch-the-web-compare tbody th { width: 18%; color: #5c7168; background: #f8fbfa; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; }
    .patch-the-web-compare tr:last-child th, .patch-the-web-compare tr:last-child td { border-bottom: 0; }
    .patch-the-web-compare__status { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    @media (max-width: 760px) {
      .patch-the-web-navigator { padding: 18px; border-radius: 16px; }
      .patch-the-web-navigator__controls { grid-template-columns: 1fr; }
      .patch-the-web-navigator__receipt { align-items: flex-start; flex-wrap: wrap; }
      .patch-the-web-navigator__privacy { width: 100%; margin-left: 0 !important; }
      .patch-the-web-compare { margin-top: -6px; padding: 16px; }
      .patch-the-web-compare__bar { align-items: flex-start; flex-wrap: wrap; }
      .patch-the-web-compare__copy { flex: 1; }
      .patch-the-web-compare__selection { width: 100%; justify-content: flex-start; order: 3; }
      .patch-the-web-compare__actions { width: 100%; order: 4; }
      .patch-the-web-compare__action { flex: 1; }
      .patch-the-web-compare__result-head { flex-direction: column; }
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
  if ([element.getAttribute("name") || "", element.getAttribute("id") || ""].some((value) => SENSITIVE_FIELD_HINT.test(value))) return false;
  return !(element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).disabled;
}

function fieldKeys(elements: Array<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  const bases = elements.map((element, index) => element.name || element.id || `field-${index}`);
  const counts = new Map<string, number>();
  bases.forEach((base) => counts.set(base, (counts.get(base) ?? 0) + 1));
  return bases.map((base, index) => (counts.get(base) ?? 0) > 1 ? `${base}:${index}` : base);
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
  patch: CommunityPatch,
  operation: PersistFormOperation,
  context: BrowserContext,
  form: HTMLFormElement
) {
  const { document, storage } = context;
  const fields = operation.include.flatMap((selector) => selected(form.ownerDocument, `${operation.selector} ${selector}`))
    .filter(isEligibleField);
  const uniqueFields = [...new Set(fields)].slice(0, 40);
  const uniqueFieldKeys = fieldKeys(uniqueFields);
  const storageKey = `patch-the-web:${patch.id}:${operation.key}`;
  const status = document.createElement("p");
  status.className = "patch-the-web-save-status";
  status.dataset.patchTheWebOwned = "true";
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
        uniqueFields.forEach((field, index) => writeField(field, values[uniqueFieldKeys[index]]));
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
      snapshot[uniqueFieldKeys[index]] = readField(field);
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
    const existingId = `patch-the-web-error-${operation.id}-${element.id || element.name || "field"}`.replace(/[^a-z0-9_-]/gi, "-");
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
    error.className = "patch-the-web-field-error";
    error.dataset.patchTheWebOwned = "true";
    error.setAttribute("role", "alert");
    error.textContent = failed.message;
    element.setAttribute("aria-invalid", "true");
    element.setAttribute("aria-describedby", [...originalDescription, existingId].join(" "));
    element.insertAdjacentElement("afterend", error);
    return false;
  };

  pairs.forEach(({ element, rules }) => {
    element.addEventListener("blur", () => validate(element, rules));
    element.addEventListener("input", () => {
      if (element.getAttribute("aria-invalid") === "true") validate(element, rules);
    });
    element.addEventListener("change", () => {
      if (element.getAttribute("aria-invalid") === "true") validate(element, rules);
    });
  });
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
  return (value ?? "").slice(0, 4096).toLowerCase().split(/[\s,|]+/).filter(Boolean).slice(0, 100);
}

function setupCollectionFilter(
  patch: CommunityPatch,
  operation: CollectionFilterOperation,
  context: BrowserContext,
  container: HTMLElement
) {
  const { document, storage } = context;
  const items = [...container.querySelectorAll<HTMLElement>(operation.items)].slice(0, MAX_MATCHES);
  if (items.length === 0) return { matched: 0, detail: "no collection items found" };

  const panel = document.createElement("section");
  panel.className = "patch-the-web-navigator";
  panel.dataset.patchTheWebOwned = "true";
  panel.setAttribute("aria-label", operation.title);
  const head = document.createElement("div");
  head.className = "patch-the-web-navigator__head";
  const mark = document.createElement("span");
  mark.className = "patch-the-web-navigator__mark";
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
  controls.className = "patch-the-web-navigator__controls";
  const searchId = `patch-the-web-search-${operation.id}`;
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
    const id = `patch-the-web-filter-${operation.id}-${filter.id}`;
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
  receipt.className = "patch-the-web-navigator__receipt";
  const status = document.createElement("p");
  status.className = "patch-the-web-navigator__status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "patch-the-web-navigator__clear";
  clear.textContent = "Clear filters";
  const privacy = document.createElement("p");
  privacy.className = "patch-the-web-navigator__privacy";
  privacy.textContent = operation.persist
    ? `Preferences stay on this device for ${Math.round(operation.persist.ttlMinutes / 60)} hours`
    : "Filtering stays on this page";
  receipt.append(status, clear, privacy);
  panel.append(head, controls, receipt);
  container.prepend(panel);

  const storageKey = operation.persist ? `patch-the-web:${patch.id}:${operation.persist.key}` : null;
  const readState = () => ({
    search: search.value,
    filters: Object.fromEntries(selects.map(({ filter, select }) => [filter.id, select.value]))
  });
  const saveState = () => {
    if (!storageKey) return;
    try { storage.setItem(storageKey, JSON.stringify({ savedAt: Date.now(), ...readState() })); } catch { /* origin storage can be unavailable */ }
  };
  const apply = (persist = true) => {
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
      item.toggleAttribute("data-patch-the-web-filtered", !show);
      if (show) visible += 1;
    });
    status.textContent = `${visible} of ${items.length} services match`;
    if (persist) saveState();
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

  search.addEventListener("input", () => apply());
  selects.forEach(({ select }) => select.addEventListener("change", () => apply()));
  clear.addEventListener("click", () => {
    search.value = "";
    selects.forEach(({ select }) => { select.value = ""; });
    apply(false);
    if (storageKey) {
      try { storage.removeItem(storageKey); } catch { /* origin storage can be unavailable */ }
    }
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
  apply(false);
  return { matched: items.length, detail: `${items.length} items filterable` };
}

function setupCollectionCompare(
  operation: CollectionCompareOperation,
  context: BrowserContext,
  container: HTMLElement
) {
  const { document } = context;
  const items = [...container.querySelectorAll<HTMLElement>(operation.items)].slice(0, MAX_MATCHES);
  const titledItems = items.map((item) => ({
    item,
    title: item.getAttribute(operation.itemTitleAttribute)?.trim().slice(0, 120) ?? ""
  }));
  const titles = titledItems.map(({ title }) => title);
  if (items.length < 2 || titles.some((title) => !title) || new Set(titles).size !== titles.length) {
    return { matched: items.length, applied: false, detail: "comparison requires unique declared item titles" };
  }

  const panel = document.createElement("section");
  panel.className = "patch-the-web-compare";
  panel.dataset.patchTheWebOwned = "true";
  panel.setAttribute("aria-label", operation.title);

  const bar = document.createElement("div");
  bar.className = "patch-the-web-compare__bar";
  const mark = document.createElement("span");
  mark.className = "patch-the-web-compare__mark";
  mark.setAttribute("aria-hidden", "true");
  mark.textContent = "⇄";
  const copy = document.createElement("div");
  copy.className = "patch-the-web-compare__copy";
  const title = document.createElement("h2");
  title.textContent = operation.title;
  const description = document.createElement("p");
  description.textContent = operation.description;
  copy.append(title, description);

  const selection = document.createElement("div");
  selection.className = "patch-the-web-compare__selection";
  const actions = document.createElement("div");
  actions.className = "patch-the-web-compare__actions";
  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "patch-the-web-compare__action secondary";
  clear.textContent = "Clear";
  const compare = document.createElement("button");
  compare.type = "button";
  compare.className = "patch-the-web-compare__action";
  compare.textContent = "Compare selected";
  compare.disabled = true;
  actions.append(clear, compare);
  bar.append(mark, copy, selection, actions);

  const liveStatus = document.createElement("p");
  liveStatus.className = "patch-the-web-compare__status";
  liveStatus.setAttribute("role", "status");
  liveStatus.setAttribute("aria-live", "polite");

  const result = document.createElement("section");
  result.className = "patch-the-web-compare__result";
  result.hidden = true;
  const resultHead = document.createElement("div");
  resultHead.className = "patch-the-web-compare__result-head";
  const resultCopy = document.createElement("div");
  const resultTitle = document.createElement("h3");
  resultTitle.id = `patch-the-web-compare-title-${operation.id}`;
  resultTitle.tabIndex = -1;
  resultTitle.textContent = "Service comparison";
  const resultDescription = document.createElement("p");
  resultDescription.id = `patch-the-web-compare-description-${operation.id}`;
  resultDescription.textContent = "A private side-by-side view built only from the declared directory fields.";
  result.setAttribute("aria-labelledby", resultTitle.id);
  result.setAttribute("aria-describedby", resultDescription.id);
  resultCopy.append(resultTitle, resultDescription);
  const close = document.createElement("button");
  close.type = "button";
  close.className = "patch-the-web-compare__close";
  close.textContent = "Close comparison";
  resultHead.append(resultCopy, close);
  const tableWrap = document.createElement("div");
  tableWrap.className = "patch-the-web-compare__table-wrap";
  tableWrap.tabIndex = 0;
  tableWrap.setAttribute("role", "region");
  tableWrap.setAttribute("aria-label", "Scrollable service comparison");
  result.append(resultHead, tableWrap);
  panel.append(bar, liveStatus, result);

  const navigator = [...container.children].find((element) => element.classList.contains("patch-the-web-navigator"));
  if (navigator) navigator.insertAdjacentElement("afterend", panel);
  else container.prepend(panel);

  const selectedItems = new Set<HTMLElement>();
  const buttons = titledItems.map(({ item, title: itemTitle }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "patch-the-web-compare__select";
    button.dataset.patchTheWebOwned = "true";
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-label", `Add ${itemTitle} to comparison`);
    button.textContent = "Compare";
    const link = item.querySelector("a[href]");
    if (link) link.insertAdjacentElement("beforebegin", button);
    else item.append(button);
    return { item, itemTitle, button };
  });

  const displayValue = (item: HTMLElement, field: CollectionCompareOperation["fields"][number]) => {
    const tokens = new Set(splitAttributeTokens(item.getAttribute(field.attribute)));
    const labels = field.values
      .filter((option) => tokens.has(option.value.toLowerCase()))
      .map((option) => option.label);
    return labels.length > 0 ? labels.join(", ") : "Not listed";
  };

  const renderSelection = () => {
    selection.replaceChildren(...buttons
      .filter(({ item }) => selectedItems.has(item))
      .map(({ itemTitle }) => {
        const chip = document.createElement("span");
        chip.className = "patch-the-web-compare__chip";
        chip.textContent = itemTitle;
        return chip;
      }));
    const count = selectedItems.size;
    compare.disabled = count < 2;
    clear.disabled = count === 0;
    buttons.forEach(({ item, itemTitle, button }) => {
      const pressed = selectedItems.has(item);
      button.setAttribute("aria-pressed", String(pressed));
      button.setAttribute("aria-label", `${pressed ? "Remove" : "Add"} ${itemTitle} ${pressed ? "from" : "to"} comparison`);
      button.textContent = pressed ? "Selected" : "Compare";
      button.disabled = !pressed && count >= operation.maxItems;
      item.toggleAttribute("data-patch-the-web-compared", pressed);
    });
    liveStatus.textContent = count === 0
      ? `Choose 2 to ${operation.maxItems} items to compare.`
      : count === 1
        ? "1 item selected. Choose at least one more."
        : `${count} items selected and ready to compare.`;
    if (count < 2) result.hidden = true;
  };

  buttons.forEach(({ item, button }) => button.addEventListener("click", () => {
    if (selectedItems.has(item)) selectedItems.delete(item);
    else if (selectedItems.size < operation.maxItems) selectedItems.add(item);
    renderSelection();
  }));

  compare.addEventListener("click", () => {
    const chosen = buttons.filter(({ item }) => selectedItems.has(item));
    if (chosen.length < 2) return;
    const table = document.createElement("table");
    table.setAttribute("aria-labelledby", resultTitle.id);
    table.setAttribute("aria-describedby", resultDescription.id);
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    const criteriaHead = document.createElement("th");
    criteriaHead.scope = "col";
    criteriaHead.textContent = "What matters";
    headRow.append(criteriaHead, ...chosen.map(({ itemTitle }) => {
      const cell = document.createElement("th");
      cell.scope = "col";
      cell.textContent = itemTitle;
      return cell;
    }));
    thead.append(headRow);
    const tbody = document.createElement("tbody");
    operation.fields.forEach((field) => {
      const row = document.createElement("tr");
      const label = document.createElement("th");
      label.scope = "row";
      label.textContent = field.label;
      row.append(label, ...chosen.map(({ item }) => {
        const cell = document.createElement("td");
        cell.textContent = displayValue(item, field);
        return cell;
      }));
      tbody.append(row);
    });
    table.append(thead, tbody);
    tableWrap.replaceChildren(table);
    result.hidden = false;
    liveStatus.textContent = `Comparison opened for ${chosen.length} items.`;
    resultTitle.focus();
    if (typeof result.scrollIntoView === "function") result.scrollIntoView({ block: "nearest" });
  });

  clear.addEventListener("click", () => {
    selectedItems.clear();
    result.hidden = true;
    renderSelection();
    (buttons.find(({ item }) => !item.hidden)?.button ?? compare).focus();
  });
  close.addEventListener("click", () => {
    result.hidden = true;
    compare.focus();
  });
  renderSelection();
  return { matched: items.length, applied: true, detail: `${items.length} items safely comparable` };
}

function setupPublicTableSearch(operation: PublicTableSearchOperation, context: BrowserContext) {
  const inspection = inspectPublicTableSearch(operation, context.document);
  if (!inspection.healthy || !inspection.tables || !inspection.headers || !inspection.dataRows) return inspection;
  const { document } = context;
  const panel = document.createElement("section");
  panel.className = "patch-the-web-table-search";
  panel.dataset.patchTheWebOwned = "true";
  const title = document.createElement("h2");
  title.textContent = operation.title;
  const description = document.createElement("p");
  description.textContent = operation.description;
  const label = document.createElement("label");
  label.textContent = operation.searchLabel;
  const input = document.createElement("input");
  input.type = "search";
  input.placeholder = operation.placeholder ?? "";
  input.autocomplete = "off";
  const receipt = document.createElement("div");
  receipt.className = "patch-the-web-table-search__receipt";
  const status = document.createElement("p");
  status.className = "patch-the-web-table-search__status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const privacy = document.createElement("p");
  privacy.className = "patch-the-web-table-search__privacy";
  privacy.textContent = "Search stays on this page";
  label.append(input);
  receipt.append(status, privacy);
  panel.append(title, description, label, receipt);
  inspection.tables[0].before(panel);
  inspection.tables.forEach((table, index) => table.setAttribute("aria-label", `${operation.tableLabel} ${index + 1} of ${inspection.tables!.length}`));
  inspection.headers.forEach((row) => [...row.cells].forEach((cell) => {
    cell.setAttribute("role", "columnheader");
    cell.setAttribute("scope", "col");
  }));
  const searchable = inspection.dataRows.map((row) => ({ row, text: (row.textContent ?? "").replace(/\s+/g, " ").trim().toLocaleLowerCase() }));
  const update = () => {
    const query = input.value.replace(/\s+/g, " ").trim().toLocaleLowerCase();
    let visible = 0;
    searchable.forEach(({ row, text }) => {
      const match = query.length === 0 || text.includes(query);
      row.hidden = !match;
      row.style.setProperty("display", match ? "" : "none", match ? "" : "important");
      row.toggleAttribute("aria-hidden", !match);
      row.dataset.patchTheWebTableSearchMatch = String(match);
      if (match) visible += 1;
    });
    status.textContent = query ? `${visible} of ${searchable.length} rows match` : `${searchable.length} public rows available`;
  };
  input.addEventListener("input", update);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && input.value) { input.value = ""; update(); }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && document.activeElement !== input) { event.preventDefault(); input.focus(); }
  });
  update();
  return inspection;
}

function setupPublicListSearch(operation: PublicListSearchOperation, context: BrowserContext) {
  const inspection = inspectPublicListSearch(operation, context.document);
  if (!inspection.healthy || !inspection.container || !inspection.items) return inspection;
  const { document } = context;
  const panel = document.createElement("section");
  panel.className = "patch-the-web-list-search";
  panel.dataset.patchTheWebOwned = "true";
  const title = document.createElement("h2");
  title.textContent = operation.title;
  const description = document.createElement("p");
  description.textContent = operation.description;
  const label = document.createElement("label");
  label.textContent = operation.searchLabel;
  const input = document.createElement("input");
  input.type = "search";
  input.placeholder = operation.placeholder ?? "";
  input.autocomplete = "off";
  const receipt = document.createElement("div");
  receipt.className = "patch-the-web-list-search__receipt";
  const status = document.createElement("p");
  status.className = "patch-the-web-list-search__status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const privacy = document.createElement("p");
  privacy.className = "patch-the-web-list-search__privacy";
  privacy.textContent = "Search stays on this page";
  label.append(input);
  receipt.append(status, privacy);
  panel.append(title, description, label, receipt);
  const firstList = inspection.items[0].parentElement;
  (firstList ?? inspection.container.firstElementChild)?.before(panel);
  const searchable = inspection.items.map((item) => ({ item, text: (item.textContent ?? "").replace(/\s+/g, " ").trim().toLocaleLowerCase() }));
  const update = () => {
    const query = input.value.replace(/\s+/g, " ").trim().toLocaleLowerCase();
    let visible = 0;
    searchable.forEach(({ item, text }) => {
      const match = query.length === 0 || text.includes(query);
      item.hidden = !match;
      item.style.setProperty("display", match ? "" : "none", match ? "" : "important");
      item.toggleAttribute("aria-hidden", !match);
      item.dataset.patchTheWebListSearchMatch = String(match);
      if (match) visible += 1;
    });
    status.textContent = query ? `${visible} of ${searchable.length} ${operation.itemLabel} match` : `${searchable.length} public ${operation.itemLabel} available`;
  };
  input.addEventListener("input", update);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && input.value) { input.value = ""; update(); }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && document.activeElement !== input) { event.preventDefault(); input.focus(); }
  });
  update();
  return inspection;
}

function applyOperation(patch: CommunityPatch, operation: PatchOperation, context: BrowserContext): OperationHealth {
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
    if (operation.type === "collectionCompare") {
      const containers = selected(document, operation.selector);
      if (containers.length !== 1) return { id: operation.id, type: operation.type, matched: containers.length, applied: false, detail: "expected exactly one collection container" };
      const result = setupCollectionCompare(operation, context, containers[0]);
      return { id: operation.id, type: operation.type, matched: result.matched, applied: result.applied, detail: result.detail };
    }
    if (operation.type === "tableColumnFilter") {
      const inspection = inspectTableColumnFilter(operation, document);
      if (!inspection.healthy || !inspection.table || !inspection.header || !inspection.matchingRows || !inspection.hiddenRows || !inspection.matrixRows || inspection.columnIndex === undefined) {
        return { id: operation.id, type: operation.type, matched: inspection.matched, applied: false, detail: inspection.detail };
      }
      inspection.table.setAttribute("aria-label", operation.tableLabel);
      inspection.table.dataset.patchTheWebTableFilter = "active";
      inspection.header.setAttribute("aria-label", operation.columnLabel);
      const columnIndex = inspection.columnIndex;
      inspection.hiddenRows.forEach((row) => {
        row.hidden = true;
        row.style.setProperty("display", "none", "important");
        row.setAttribute("aria-hidden", "true");
        row.dataset.patchTheWebTableRowHidden = "true";
      });
      inspection.matchingRows.forEach((row) => {
        row.dataset.patchTheWebTableRowMatch = "true";
        const cells = [...row.children].filter((cell) => cell.tagName === "TH" || cell.tagName === "TD") as HTMLElement[];
        const marker = cells[columnIndex].querySelector<HTMLElement>(operation.markerSelector);
        marker?.setAttribute("role", "img");
        marker?.setAttribute("aria-hidden", "false");
        marker?.setAttribute("aria-label", operation.markerLabel);
        marker?.setAttribute("title", operation.markerLabel);
      });
      if (operation.collapseOtherColumns) {
        inspection.matrixRows.forEach((row) => {
          const cells = [...row.children].filter((cell) => cell.tagName === "TH" || cell.tagName === "TD") as HTMLElement[];
          cells.forEach((cell, index) => {
            if (index === 0 || index === columnIndex) return;
            cell.hidden = true;
            cell.style.setProperty("display", "none", "important");
            cell.setAttribute("aria-hidden", "true");
            cell.dataset.patchTheWebTableColumnHidden = "true";
          });
        });
      }
      return { id: operation.id, type: operation.type, matched: inspection.matched, applied: true, detail: inspection.detail };
    }
    if (operation.type === "publicTableSearch") {
      const inspection = setupPublicTableSearch(operation, context);
      return { id: operation.id, type: operation.type, matched: inspection.matched, applied: inspection.healthy, detail: inspection.detail };
    }
    if (operation.type === "publicListSearch") {
      const inspection = setupPublicListSearch(operation, context);
      return { id: operation.id, type: operation.type, matched: inspection.matched, applied: inspection.healthy, detail: inspection.detail };
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
  patch: CommunityPatch,
  context: Partial<BrowserContext> = {}
): PatchHealth {
  const documentRef = context.document ?? document;
  const windowRef = context.window ?? window;
  const storageRef = context.storage ?? windowRef.localStorage;
  const marker = `${patch.id}@${patch.version}`;
  installTrustedUiStyles(documentRef);
  const root = documentRef.documentElement;
  const appliedMarkers = new Set((root.dataset.patchTheWebApplied ?? "").split(/\s+/).filter(Boolean));
  if (appliedMarkers.has(marker)) {
    return { patchId: patch.id, version: patch.version, applied: true, operations: [], healthy: patch.operations.length, total: patch.operations.length, timestamp: Date.now() };
  }
  const operations = patch.operations.map((operation) => applyOperation(patch, operation, { document: documentRef, window: windowRef, storage: storageRef }));
  const healthy = operations.filter((operation) => operation.applied).length;
  appliedMarkers.add(marker);
  root.dataset.patchTheWebApplied = [...appliedMarkers].join(" ");
  root.classList.add("patch-the-web-active");
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
