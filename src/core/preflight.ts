import type { OpenPatch } from "./types";

export type SelectorPreflightResult = {
  healthy: number;
  total: number;
  results: Array<{ id: string; matched: number; healthy: boolean }>;
};

export function preflightPatchOnDocument(candidate: OpenPatch): SelectorPreflightResult {
  const count = (selector: string, root: ParentNode = document) => {
    try { return root.querySelectorAll(selector).length; } catch { return 0; }
  };
  const results = candidate.operations.map((operation) => {
    if (operation.type === "keyboardNavigation") {
      const containers = document.querySelectorAll(operation.container);
      const matched = containers.length === 1 ? count(operation.items, containers[0]) : containers.length;
      return { id: operation.id, matched, healthy: containers.length === 1 && matched > 0 };
    }
    if (operation.type === "collectionFilter") {
      const containers = document.querySelectorAll(operation.selector);
      const matched = containers.length === 1 ? count(operation.items, containers[0]) : containers.length;
      return { id: operation.id, matched, healthy: containers.length === 1 && matched > 0 };
    }
    const matched = count(operation.selector);
    if (operation.type === "move") return { id: operation.id, matched, healthy: matched > 0 && count(operation.target) === 1 };
    if (operation.type === "persistForm") {
      const fields = operation.include.reduce((total, selector) => total + count(`${operation.selector} ${selector}`), 0);
      return { id: operation.id, matched: fields, healthy: matched === 1 && fields > 0 };
    }
    if (operation.type === "validation") {
      const fields = operation.fields.reduce((total, field) => total + count(field.selector), 0);
      return { id: operation.id, matched: fields, healthy: matched === 1 && fields === operation.fields.length };
    }
    return { id: operation.id, matched, healthy: matched > 0 };
  });
  return { healthy: results.filter((result) => result.healthy).length, total: results.length, results };
}
