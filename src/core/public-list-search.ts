import type { PublicListSearchOperation } from "./types";

export type PublicListSearchInspection = {
  healthy: boolean;
  matched: number;
  detail: string;
  container?: HTMLElement;
  items?: HTMLElement[];
};

const forbiddenContent = "form, input, select, textarea, button, [contenteditable='true']";

export function inspectPublicListSearch(operation: PublicListSearchOperation, document: Document): PublicListSearchInspection {
  try {
    const containers = [...document.querySelectorAll(operation.selector)];
    if (containers.length !== 1 || containers[0].matches("form")) {
      return { healthy: false, matched: containers.length, detail: `expected exactly one non-form container, found ${containers.length}` };
    }
    const container = containers[0] as HTMLElement;
    const matches = [...container.querySelectorAll(operation.itemSelector)];
    const items = matches.filter((item): item is HTMLElement => item.tagName === "LI");
    if (matches.length !== items.length || items.length < 1 || items.length > operation.maxItems) {
      return { healthy: false, matched: matches.length, detail: `expected 1-${operation.maxItems} public list items, found ${matches.length}` };
    }
    if (items.some((item) => item.matches("[data-patch-the-web-owned]") || item.querySelector(forbiddenContent))) {
      return { healthy: false, matched: items.length, detail: "public list items must not contain forms or interactive controls" };
    }
    const selected = new Set(items);
    if (items.some((item) => [...item.querySelectorAll(operation.itemSelector)].some((child) => selected.has(child as HTMLElement)))) {
      return { healthy: false, matched: items.length, detail: "public list items must not overlap or nest" };
    }
    if (items.some((item) => !(item.textContent ?? "").replace(/\s+/g, " ").trim())) {
      return { healthy: false, matched: items.length, detail: "every public list item must contain visible text" };
    }
    return { healthy: true, matched: items.length, detail: `${items.length} public list entries searchable`, container, items };
  } catch {
    return { healthy: false, matched: 0, detail: "public list inspection failed" };
  }
}
