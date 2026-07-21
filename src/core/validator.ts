import type {
  CommunityPatch,
  PatchCapability,
  PatchOperation,
  ValidationIssue,
  ValidationResult
} from "./types";

const CAPABILITIES = new Set<PatchCapability>([
  "layout",
  "accessibility",
  "local-storage",
  "keyboard-navigation",
  "validation",
  "content-filter",
  "content-compare",
  "hide-elements",
  "reorganize"
]);

export const SAFE_STYLE_PROPERTIES = new Set([
  "display",
  "position",
  "inset",
  "top",
  "right",
  "bottom",
  "left",
  "z-index",
  "width",
  "min-width",
  "max-width",
  "height",
  "min-height",
  "max-height",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "gap",
  "row-gap",
  "column-gap",
  "grid-template-columns",
  "grid-template-rows",
  "grid-column",
  "grid-row",
  "flex-direction",
  "flex-wrap",
  "align-items",
  "align-content",
  "justify-content",
  "order",
  "overflow",
  "overflow-x",
  "overflow-y",
  "font-size",
  "font-weight",
  "line-height",
  "letter-spacing",
  "text-align",
  "color",
  "background-color",
  "border",
  "border-width",
  "border-style",
  "border-color",
  "border-radius",
  "box-shadow",
  "opacity",
  "visibility",
  "cursor",
  "outline",
  "outline-offset",
  "table-layout",
  "overflow-wrap",
  "word-break"
]);

const SAFE_ATTRIBUTE = /^(aria-[a-z-]+|role|tabindex|autocomplete|inputmode|title)$/;
const SAFE_ID = /^[a-z0-9][a-z0-9._-]{2,79}$/;
const SAFE_VERSION = /^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i;
const SAFE_HOST = /^(localhost|127\.0\.0\.1|(?:\*\.)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)$/i;
const SAFE_PATH = /^\/[a-z0-9._~!$&'()+,;=:@%/-]*\*?$/i;
const UNSAFE_VALUE = /(javascript\s*:|expression\s*\(|url\s*\(|@import|<\/?script|onerror\s*=|onload\s*=)/i;
const UNSAFE_SELECTOR = /(^|[\s,>+~])(?:html|head|body|\*)(?:$|[\s,>+~.#[:])|:root\b|:(?:is|where|not|has)\([^)]*\*/i;
const UNSAFE_PATTERN = /(\\[1-9]|\(\?[=!<]|\([^)]*[+*][^)]*\)[+*?{])/;
const SAFE_DATA_ATTRIBUTE = /^data-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_TOKEN = /^[a-z0-9][a-z0-9_-]{0,39}$/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown, max: number) =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;

function checkSelector(selector: unknown, path: string, issues: ValidationIssue[]) {
  if (!text(selector, 240)) {
    issues.push({ path, message: "must be a non-empty selector under 240 characters" });
    return;
  }
  const value = selector as string;
  if (UNSAFE_SELECTOR.test(value)) {
    issues.push({ path, message: "may not target document-wide html, head, body, or universal selectors" });
  }
  if (typeof document !== "undefined") {
    try {
      document.createDocumentFragment().querySelector(value);
    } catch {
      issues.push({ path, message: "is not valid CSS selector syntax" });
    }
  }
}

function checkOperation(value: unknown, index: number, issues: ValidationIssue[]) {
  const base = `operations[${index}]`;
  if (!isRecord(value)) {
    issues.push({ path: base, message: "must be an object" });
    return;
  }
  if (!text(value.id, 80) || !SAFE_ID.test(String(value.id))) {
    issues.push({ path: `${base}.id`, message: "must use 3-80 lowercase letters, numbers, dots, dashes, or underscores" });
  }
  const type = value.type;
  const known = ["style", "attributes", "hide", "move", "persistForm", "validation", "keyboardNavigation", "collectionFilter", "collectionCompare", "tableColumnFilter", "publicTableSearch"];
  if (typeof type !== "string" || !known.includes(type)) {
    issues.push({ path: `${base}.type`, message: "is not an allowed transformation" });
    return;
  }

  if (["style", "attributes", "hide", "move", "persistForm", "validation", "collectionFilter", "collectionCompare", "tableColumnFilter", "publicTableSearch"].includes(type)) {
    checkSelector(value.selector, `${base}.selector`, issues);
  }

  if (type === "style") {
    if (!isRecord(value.styles) || Object.keys(value.styles).length === 0 || Object.keys(value.styles).length > 32) {
      issues.push({ path: `${base}.styles`, message: "must contain 1-32 style declarations" });
    } else {
      for (const [property, raw] of Object.entries(value.styles)) {
        if (!SAFE_STYLE_PROPERTIES.has(property)) {
          issues.push({ path: `${base}.styles.${property}`, message: "property is outside the layout allowlist" });
        }
        if (typeof raw !== "string" || raw.length > 160 || UNSAFE_VALUE.test(raw) || /[{};]/.test(raw)) {
          issues.push({ path: `${base}.styles.${property}`, message: "contains an unsafe or invalid CSS value" });
        }
      }
    }
    if (value.when !== undefined) {
      if (!isRecord(value.when)) {
        issues.push({ path: `${base}.when`, message: "must be a viewport constraint object" });
      } else {
        for (const key of ["minWidth", "maxWidth"] as const) {
          if (value.when[key] !== undefined && (typeof value.when[key] !== "number" || value.when[key] < 240 || value.when[key] > 5000)) {
            issues.push({ path: `${base}.when.${key}`, message: "must be between 240 and 5000" });
          }
        }
      }
    }
  }

  if (type === "attributes") {
    if (!isRecord(value.attributes) || Object.keys(value.attributes).length === 0 || Object.keys(value.attributes).length > 20) {
      issues.push({ path: `${base}.attributes`, message: "must contain 1-20 attributes" });
    } else {
      for (const [name, raw] of Object.entries(value.attributes)) {
        if (!SAFE_ATTRIBUTE.test(name)) {
          issues.push({ path: `${base}.attributes.${name}`, message: "only ARIA and safe interaction attributes are allowed" });
        }
        if (typeof raw !== "string" || raw.length > 240 || UNSAFE_VALUE.test(raw)) {
          issues.push({ path: `${base}.attributes.${name}`, message: "contains an unsafe value" });
        }
      }
    }
  }

  if (type === "move") {
    checkSelector(value.target, `${base}.target`, issues);
    if (!["before", "after", "prepend", "append"].includes(String(value.position))) {
      issues.push({ path: `${base}.position`, message: "must be before, after, prepend, or append" });
    }
  }

  if (type === "persistForm") {
    if (!text(value.key, 80) || !/^[a-z0-9._-]+$/i.test(String(value.key))) {
      issues.push({ path: `${base}.key`, message: "must be a stable storage key" });
    }
    if (!Array.isArray(value.include) || value.include.length === 0 || value.include.length > 12) {
      issues.push({ path: `${base}.include`, message: "must list 1-12 field selectors" });
    } else {
      value.include.forEach((selector, i) => checkSelector(selector, `${base}.include[${i}]`, issues));
    }
    if (!Number.isInteger(value.ttlMinutes) || Number(value.ttlMinutes) < 5 || Number(value.ttlMinutes) > 10080) {
      issues.push({ path: `${base}.ttlMinutes`, message: "must expire drafts between 5 minutes and 7 days" });
    }
    if (!text(value.statusText, 120)) {
      issues.push({ path: `${base}.statusText`, message: "must be concise visible status text" });
    }
  }

  if (type === "validation") {
    if (!Array.isArray(value.fields) || value.fields.length === 0 || value.fields.length > 30) {
      issues.push({ path: `${base}.fields`, message: "must define 1-30 fields" });
    } else {
      value.fields.forEach((field, fieldIndex) => {
        const fieldPath = `${base}.fields[${fieldIndex}]`;
        if (!isRecord(field)) {
          issues.push({ path: fieldPath, message: "must be an object" });
          return;
        }
        checkSelector(field.selector, `${fieldPath}.selector`, issues);
        if (!Array.isArray(field.rules) || field.rules.length === 0 || field.rules.length > 5) {
          issues.push({ path: `${fieldPath}.rules`, message: "must define 1-5 rules" });
          return;
        }
        field.rules.forEach((rule, ruleIndex) => {
          const rulePath = `${fieldPath}.rules[${ruleIndex}]`;
          if (!isRecord(rule) || !["required", "email", "minLength", "pattern"].includes(String(rule.kind))) {
            issues.push({ path: rulePath, message: "uses an unsupported validation rule" });
          } else {
            if (!text(rule.message, 180)) issues.push({ path: `${rulePath}.message`, message: "must include an accessible error message" });
            if (rule.kind === "minLength" && (typeof rule.value !== "number" || rule.value < 1 || rule.value > 500)) {
              issues.push({ path: `${rulePath}.value`, message: "must be a number between 1 and 500" });
            }
            if (rule.kind === "pattern" && (!text(rule.value, 120) || UNSAFE_VALUE.test(String(rule.value)))) {
              issues.push({ path: `${rulePath}.value`, message: "must be a safe regular expression" });
            } else if (rule.kind === "pattern") {
              try {
                if (UNSAFE_PATTERN.test(String(rule.value))) throw new Error("unsafe pattern");
                new RegExp(String(rule.value));
              } catch {
                issues.push({ path: `${rulePath}.value`, message: "must be a bounded regular expression without lookarounds, backreferences, or nested quantifiers" });
              }
            }
          }
        });
      });
    }
  }

  if (type === "keyboardNavigation") {
    checkSelector(value.container, `${base}.container`, issues);
    checkSelector(value.items, `${base}.items`, issues);
    if (!["horizontal", "vertical"].includes(String(value.orientation))) {
      issues.push({ path: `${base}.orientation`, message: "must be horizontal or vertical" });
    }
  }

  if (type === "collectionFilter") {
    checkSelector(value.items, `${base}.items`, issues);
    if (!text(value.title, 80)) issues.push({ path: `${base}.title`, message: "must be a concise navigator title" });
    if (!text(value.description, 180)) issues.push({ path: `${base}.description`, message: "must explain what the navigator changes" });
    if (!isRecord(value.search)) {
      issues.push({ path: `${base}.search`, message: "must define an accessible search control" });
    } else {
      if (!text(value.search.label, 80)) issues.push({ path: `${base}.search.label`, message: "must label the search control" });
      if (value.search.placeholder !== undefined && !text(value.search.placeholder, 100)) {
        issues.push({ path: `${base}.search.placeholder`, message: "must be concise when provided" });
      }
      if (!Array.isArray(value.search.attributes) || value.search.attributes.length === 0 || value.search.attributes.length > 6) {
        issues.push({ path: `${base}.search.attributes`, message: "must list 1-6 data attributes" });
      } else {
        value.search.attributes.forEach((attribute, attributeIndex) => {
          if (typeof attribute !== "string" || !SAFE_DATA_ATTRIBUTE.test(attribute)) {
            issues.push({ path: `${base}.search.attributes[${attributeIndex}]`, message: "must be a safe data-* attribute" });
          }
        });
      }
    }
    if (!Array.isArray(value.filters) || value.filters.length === 0 || value.filters.length > 6) {
      issues.push({ path: `${base}.filters`, message: "must define 1-6 safe filters" });
    } else {
      value.filters.forEach((filter, filterIndex) => {
        const filterPath = `${base}.filters[${filterIndex}]`;
        if (!isRecord(filter)) {
          issues.push({ path: filterPath, message: "must be an object" });
          return;
        }
        if (!text(filter.id, 40) || !SAFE_TOKEN.test(String(filter.id))) issues.push({ path: `${filterPath}.id`, message: "must be a stable filter id" });
        if (!text(filter.label, 80)) issues.push({ path: `${filterPath}.label`, message: "must label the filter" });
        if (typeof filter.attribute !== "string" || !SAFE_DATA_ATTRIBUTE.test(filter.attribute)) {
          issues.push({ path: `${filterPath}.attribute`, message: "must read one safe data-* attribute" });
        }
        if (!Array.isArray(filter.options) || filter.options.length === 0 || filter.options.length > 12) {
          issues.push({ path: `${filterPath}.options`, message: "must define 1-12 options" });
          return;
        }
        filter.options.forEach((option, optionIndex) => {
          const optionPath = `${filterPath}.options[${optionIndex}]`;
          if (!isRecord(option) || !text(option.label, 60) || !text(option.value, 40) || !SAFE_TOKEN.test(String(option.value))) {
            issues.push({ path: optionPath, message: "must contain a safe value and visible label" });
          }
        });
      });
    }
    if (value.persist !== undefined) {
      if (!isRecord(value.persist)) {
        issues.push({ path: `${base}.persist`, message: "must define a bounded local preference receipt" });
      } else {
        if (!text(value.persist.key, 80) || !/^[a-z0-9._-]+$/i.test(String(value.persist.key))) {
          issues.push({ path: `${base}.persist.key`, message: "must be a stable storage key" });
        }
        if (!Number.isInteger(value.persist.ttlMinutes) || Number(value.persist.ttlMinutes) < 5 || Number(value.persist.ttlMinutes) > 10080) {
          issues.push({ path: `${base}.persist.ttlMinutes`, message: "must expire between 5 minutes and 7 days" });
        }
      }
    }
  }

  if (type === "collectionCompare") {
    checkSelector(value.items, `${base}.items`, issues);
    if (!text(value.title, 80)) issues.push({ path: `${base}.title`, message: "must be a concise comparison title" });
    if (!text(value.description, 180)) issues.push({ path: `${base}.description`, message: "must explain the comparison feature" });
    if (typeof value.itemTitleAttribute !== "string" || !SAFE_DATA_ATTRIBUTE.test(value.itemTitleAttribute)) {
      issues.push({ path: `${base}.itemTitleAttribute`, message: "must read one safe data-* attribute" });
    }
    if (!Number.isInteger(value.maxItems) || Number(value.maxItems) < 2 || Number(value.maxItems) > 4) {
      issues.push({ path: `${base}.maxItems`, message: "must allow comparison of 2-4 items" });
    }
    if (!Array.isArray(value.fields) || value.fields.length < 2 || value.fields.length > 8) {
      issues.push({ path: `${base}.fields`, message: "must define 2-8 comparison fields" });
    } else {
      value.fields.forEach((field, fieldIndex) => {
        const fieldPath = `${base}.fields[${fieldIndex}]`;
        if (!isRecord(field)) {
          issues.push({ path: fieldPath, message: "must be an object" });
          return;
        }
        if (!text(field.id, 40) || !SAFE_TOKEN.test(String(field.id))) issues.push({ path: `${fieldPath}.id`, message: "must be a stable field id" });
        if (!text(field.label, 80)) issues.push({ path: `${fieldPath}.label`, message: "must label the comparison field" });
        if (typeof field.attribute !== "string" || !SAFE_DATA_ATTRIBUTE.test(field.attribute)) {
          issues.push({ path: `${fieldPath}.attribute`, message: "must read one safe data-* attribute" });
        }
        if (!Array.isArray(field.values) || field.values.length === 0 || field.values.length > 16) {
          issues.push({ path: `${fieldPath}.values`, message: "must define 1-16 bounded display values" });
          return;
        }
        field.values.forEach((option, optionIndex) => {
          const optionPath = `${fieldPath}.values[${optionIndex}]`;
          if (!isRecord(option) || !text(option.label, 60) || !text(option.value, 40) || !SAFE_TOKEN.test(String(option.value))) {
            issues.push({ path: optionPath, message: "must contain a safe value and visible label" });
          }
        });
        const optionValues = field.values
          .filter(isRecord)
          .map((option) => option.value)
          .filter((option): option is string => typeof option === "string");
        if (new Set(optionValues).size !== optionValues.length) issues.push({ path: `${fieldPath}.values`, message: "display values must be unique" });
      });
      const fieldIds = value.fields
        .filter(isRecord)
        .map((field) => field.id)
        .filter((field): field is string => typeof field === "string");
      if (new Set(fieldIds).size !== fieldIds.length) issues.push({ path: `${base}.fields`, message: "comparison field ids must be unique" });
    }
  }

  if (type === "tableColumnFilter") {
    const allowed = new Set(["id", "type", "selector", "headerSelector", "rowSelector", "headerText", "markerSelector", "tableLabel", "columnLabel", "markerLabel", "collapseOtherColumns"]);
    Object.keys(value).forEach((key) => {
      if (!allowed.has(key)) issues.push({ path: `${base}.${key}`, message: "is not allowed for a bounded table filter" });
    });
    checkSelector(value.headerSelector, `${base}.headerSelector`, issues);
    checkSelector(value.rowSelector, `${base}.rowSelector`, issues);
    checkSelector(value.markerSelector, `${base}.markerSelector`, issues);
    if (!text(value.headerText, 80) || String(value.headerText) !== String(value.headerText).replace(/\s+/g, " ").trim()) {
      issues.push({ path: `${base}.headerText`, message: "must be an exact normalized public header under 80 characters" });
    }
    for (const key of ["tableLabel", "columnLabel", "markerLabel"] as const) {
      if (!text(value[key], 160) || UNSAFE_VALUE.test(String(value[key]))) {
        issues.push({ path: `${base}.${key}`, message: "must be a safe accessible label under 160 characters" });
      }
    }
    if (value.collapseOtherColumns !== true) {
      issues.push({ path: `${base}.collapseOtherColumns`, message: "must be true for a focused bounded table view" });
    }
  }

  if (type === "publicTableSearch") {
    const allowed = new Set(["id", "type", "selector", "rowSelector", "headerText", "title", "description", "searchLabel", "placeholder", "tableLabel", "maxTables", "maxRows"]);
    Object.keys(value).forEach((key) => {
      if (!allowed.has(key)) issues.push({ path: `${base}.${key}`, message: "is not allowed for bounded public-table search" });
    });
    checkSelector(value.rowSelector, `${base}.rowSelector`, issues);
    if (!text(value.headerText, 80) || String(value.headerText) !== String(value.headerText).replace(/\s+/g, " ").trim()) {
      issues.push({ path: `${base}.headerText`, message: "must be an exact normalized public header under 80 characters" });
    }
    for (const key of ["title", "description", "searchLabel", "tableLabel"] as const) {
      if (!text(value[key], key === "description" ? 180 : 120) || UNSAFE_VALUE.test(String(value[key]))) {
        issues.push({ path: `${base}.${key}`, message: "must be concise safe visible text" });
      }
    }
    if (value.placeholder !== undefined && (!text(value.placeholder, 100) || UNSAFE_VALUE.test(String(value.placeholder)))) {
      issues.push({ path: `${base}.placeholder`, message: "must be concise safe placeholder text" });
    }
    if (!Number.isInteger(value.maxTables) || Number(value.maxTables) < 1 || Number(value.maxTables) > 5) {
      issues.push({ path: `${base}.maxTables`, message: "must bound the feature to 1-5 tables" });
    }
    if (!Number.isInteger(value.maxRows) || Number(value.maxRows) < 1 || Number(value.maxRows) > 300) {
      issues.push({ path: `${base}.maxRows`, message: "must bound the feature to 1-300 public rows" });
    }
  }
}

export function validatePatch(value: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  if (!isRecord(value)) return { ok: false, issues: [{ path: "$", message: "patch must be a JSON object" }], warnings };

  if (value.schemaVersion !== 1) issues.push({ path: "schemaVersion", message: "must equal 1" });
  if (!text(value.id, 80) || !SAFE_ID.test(String(value.id))) issues.push({ path: "id", message: "must be a stable lowercase patch id" });
  if (!text(value.name, 80)) issues.push({ path: "name", message: "must be 1-80 characters" });
  if (!text(value.summary, 240)) issues.push({ path: "summary", message: "must be 1-240 characters" });
  if (!text(value.version, 40) || !SAFE_VERSION.test(String(value.version))) issues.push({ path: "version", message: "must be semantic version syntax" });
  if (!isRecord(value.author) || !text(value.author.name, 80)) issues.push({ path: "author.name", message: "must identify the patch author" });
  else if (value.author.verified !== undefined && typeof value.author.verified !== "boolean") issues.push({ path: "author.verified", message: "must be a boolean when provided" });
  if (!isRecord(value.match)) {
    issues.push({ path: "match", message: "must define exact hosts and paths" });
  } else {
    if (!Array.isArray(value.match.hosts) || value.match.hosts.length === 0 || value.match.hosts.length > 12) {
      issues.push({ path: "match.hosts", message: "must list 1-12 hosts" });
    } else {
      value.match.hosts.forEach((host, index) => {
        if (typeof host !== "string" || !SAFE_HOST.test(host)) issues.push({ path: `match.hosts[${index}]`, message: "must be an exact host or one leftmost subdomain wildcard" });
      });
    }
    if (!Array.isArray(value.match.paths) || value.match.paths.length === 0 || value.match.paths.length > 20) {
      issues.push({ path: "match.paths", message: "must list 1-20 pathname patterns" });
    } else {
      value.match.paths.forEach((path, index) => {
        if (typeof path !== "string" || !SAFE_PATH.test(path) || path.includes("..") || path.slice(0, -1).includes("*")) {
          issues.push({ path: `match.paths[${index}]`, message: "must be a safe pathname with at most one final wildcard" });
        }
      });
    }
  }
  if (!Array.isArray(value.capabilities) || value.capabilities.length === 0) {
    issues.push({ path: "capabilities", message: "must declare at least one capability" });
  } else {
    value.capabilities.forEach((capability, index) => {
      if (!CAPABILITIES.has(capability as PatchCapability)) issues.push({ path: `capabilities[${index}]`, message: "is not a recognized capability" });
    });
  }
  if (!Array.isArray(value.operations) || value.operations.length === 0 || value.operations.length > 100) {
    issues.push({ path: "operations", message: "must contain 1-100 constrained operations" });
  } else {
    value.operations.forEach((operation, index) => checkOperation(operation, index, issues));
    const ids = value.operations.map((operation) => isRecord(operation) ? operation.id : undefined).filter(Boolean);
    if (new Set(ids).size !== ids.length) issues.push({ path: "operations", message: "operation ids must be unique" });
    if (Array.isArray(value.capabilities)) {
      const declared = new Set(value.capabilities);
      requiredCapabilities(value.operations as PatchOperation[]).forEach((capability) => {
        if (!declared.has(capability)) issues.push({ path: "capabilities", message: `must declare ${capability} for the requested operations` });
      });
    }
  }
  if (!Array.isArray(value.verify) || value.verify.length === 0) {
    warnings.push({ path: "verify", message: "published patches should include selector assertions" });
  } else if (value.verify.length > 50) {
    issues.push({ path: "verify", message: "must contain no more than 50 assertions" });
  } else {
    value.verify.forEach((assertion, index) => {
      const path = `verify[${index}]`;
      if (!isRecord(assertion) || !["exists", "attribute"].includes(String(assertion.type))) {
        issues.push({ path, message: "must be an exists or attribute assertion" });
        return;
      }
      checkSelector(assertion.selector, `${path}.selector`, issues);
      if (assertion.type === "exists") {
        for (const bound of ["min", "max"] as const) {
          if (assertion[bound] !== undefined && (!Number.isInteger(assertion[bound]) || Number(assertion[bound]) < 0 || Number(assertion[bound]) > 100)) {
            issues.push({ path: `${path}.${bound}`, message: "must be an integer between 0 and 100" });
          }
        }
        if (typeof assertion.min === "number" && typeof assertion.max === "number" && assertion.min > assertion.max) {
          issues.push({ path, message: "minimum selector count may not exceed maximum" });
        }
      } else {
        if (!text(assertion.name, 80) || !/^[a-z][a-z0-9:._-]*$/i.test(String(assertion.name))) issues.push({ path: `${path}.name`, message: "must be a safe attribute name" });
        if (typeof assertion.value !== "string" || assertion.value.length > 240 || UNSAFE_VALUE.test(assertion.value)) issues.push({ path: `${path}.value`, message: "must be a safe assertion value" });
      }
    });
  }
  if (!text(value.changelog, 500)) issues.push({ path: "changelog", message: "must describe this version" });

  if (issues.length > 0) return { ok: false, issues, warnings };
  return { ok: true, patch: value as unknown as CommunityPatch, warnings };
}

export function requiredCapabilities(operations: PatchOperation[]): PatchCapability[] {
  const result = new Set<PatchCapability>();
  for (const operation of operations) {
    if (operation.type === "style") result.add("layout");
    if (operation.type === "attributes") result.add("accessibility");
    if (operation.type === "hide") result.add("hide-elements");
    if (operation.type === "move") result.add("reorganize");
    if (operation.type === "persistForm") result.add("local-storage");
    if (operation.type === "validation") result.add("validation");
    if (operation.type === "keyboardNavigation") result.add("keyboard-navigation");
    if (operation.type === "collectionFilter") {
      result.add("content-filter");
      result.add("accessibility");
      result.add("keyboard-navigation");
      if (operation.persist) result.add("local-storage");
    }
    if (operation.type === "collectionCompare") {
      result.add("content-compare");
      result.add("accessibility");
      result.add("keyboard-navigation");
    }
    if (operation.type === "tableColumnFilter") {
      result.add("content-filter");
      result.add("hide-elements");
      result.add("accessibility");
    }
    if (operation.type === "publicTableSearch") {
      result.add("content-filter");
      result.add("accessibility");
      result.add("keyboard-navigation");
    }
  }
  return [...result];
}
