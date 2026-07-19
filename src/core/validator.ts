import type {
  OpenPatch,
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
  "outline-offset"
]);

const SAFE_ATTRIBUTE = /^(aria-[a-z-]+|role|tabindex|autocomplete|inputmode|title)$/;
const SAFE_ID = /^[a-z0-9][a-z0-9._-]{2,79}$/;
const SAFE_VERSION = /^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i;
const SAFE_HOST = /^(localhost|127\.0\.0\.1|(?:\*\.)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)$/i;
const UNSAFE_VALUE = /(javascript\s*:|expression\s*\(|url\s*\(|@import|<\/?script|onerror\s*=|onload\s*=)/i;
const UNSAFE_SELECTOR = /(^|[\s,>+~])(?:html|head|body|\*)(?:$|[\s,>+~.#[:])/i;

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
  const known = ["style", "attributes", "hide", "move", "persistForm", "validation", "keyboardNavigation"];
  if (typeof type !== "string" || !known.includes(type)) {
    issues.push({ path: `${base}.type`, message: "is not an allowed transformation" });
    return;
  }

  if (["style", "attributes", "hide", "move", "persistForm", "validation"].includes(type)) {
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
        if (typeof path !== "string" || !path.startsWith("/") || path.includes("..") || /[?#]/.test(path)) {
          issues.push({ path: `match.paths[${index}]`, message: "must be a safe pathname pattern" });
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
  }
  if (!text(value.changelog, 500)) issues.push({ path: "changelog", message: "must describe this version" });

  if (issues.length > 0) return { ok: false, issues, warnings };
  return { ok: true, patch: value as unknown as OpenPatch, warnings };
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
  }
  return [...result];
}
