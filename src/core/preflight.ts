import type { CommunityPatch } from "./types";

export type SelectorPreflightResult = {
  healthy: number;
  total: number;
  results: Array<{ id: string; matched: number; healthy: boolean }>;
};

export function preflightPatchOnDocument(candidate: CommunityPatch): SelectorPreflightResult {
  const count = (selector: string, root: ParentNode = document) => {
    try { return root.querySelectorAll(selector).length; } catch { return 0; }
  };
  const results = candidate.operations.map((operation) => {
    if (operation.type === "publicListSearch") {
      try {
        const containers = [...document.querySelectorAll(operation.selector)];
        if (containers.length !== 1 || containers[0].tagName === "FORM") return { id: operation.id, matched: containers.length, healthy: false };
        const matches = [...containers[0].querySelectorAll(operation.itemSelector)];
        const items = matches.filter((item) => item.tagName === "LI");
        const selected = new Set(items);
        const controls = items.some((item) => item.querySelector("form, input, select, textarea, button, [contenteditable='true']"));
        const nested = items.some((item) => [...item.querySelectorAll(operation.itemSelector)].some((child) => selected.has(child)));
        const blank = items.some((item) => !(item.textContent ?? "").replace(/\s+/g, " ").trim());
        return { id: operation.id, matched: matches.length, healthy: matches.length === items.length && items.length > 0 && items.length <= operation.maxItems && !controls && !nested && !blank };
      } catch {
        return { id: operation.id, matched: 0, healthy: false };
      }
    }
    if (operation.type === "publicTableSearch") {
      try {
        const matches = [...document.querySelectorAll(operation.selector)];
        const tables = matches.filter((element) => element.tagName === "TABLE");
        if (matches.length !== tables.length || tables.length < 1 || tables.length > operation.maxTables) {
          return { id: operation.id, matched: matches.length, healthy: false };
        }
        const normalize = (value: string | null) => (value ?? "").replace(/\s+/g, " ").trim();
        let dataRows = 0;
        for (const table of tables) {
          const rows = [...table.querySelectorAll(operation.rowSelector)];
          const headers = rows.filter((row) => normalize((row as HTMLTableRowElement).cells[0]?.textContent ?? null) === operation.headerText);
          if (headers.length < 1 || headers.length > 12) return { id: operation.id, matched: headers.length, healthy: false };
          const columnCount = (headers[0] as HTMLTableRowElement).cells.length;
          if (columnCount < 2 || columnCount > 12) return { id: operation.id, matched: columnCount, healthy: false };
          if (headers.some((header) => (header as HTMLTableRowElement).cells.length !== columnCount)) {
            return { id: operation.id, matched: headers.length, healthy: false };
          }
          const headerSet = new Set(headers);
          dataRows += rows.filter((row) => !headerSet.has(row) && (row as HTMLTableRowElement).cells.length === columnCount).length;
        }
        return { id: operation.id, matched: dataRows, healthy: dataRows > 0 && dataRows <= operation.maxRows };
      } catch {
        return { id: operation.id, matched: 0, healthy: false };
      }
    }
    if (operation.type === "tableColumnFilter") {
      try {
        const tables = [...document.querySelectorAll(operation.selector)];
        if (tables.length !== 1 || tables[0].tagName !== "TABLE") {
          return { id: operation.id, matched: tables.length, healthy: false };
        }
        const table = tables[0];
        const headers = [...table.querySelectorAll(operation.headerSelector)];
        if (headers.length < 2 || headers.length > 20) {
          return { id: operation.id, matched: headers.length, healthy: false };
        }
        const normalize = (value: string | null) => (value ?? "").replace(/\s+/g, " ").trim();
        const matchingHeaders = headers.filter((header) => normalize(header.textContent) === operation.headerText);
        if (matchingHeaders.length !== 1) {
          return { id: operation.id, matched: matchingHeaders.length, healthy: false };
        }
        const columnIndex = headers.indexOf(matchingHeaders[0]);
        const rows = [...table.querySelectorAll(operation.rowSelector)];
        if (rows.length === 0 || rows.length > 100) {
          return { id: operation.id, matched: rows.length, healthy: false };
        }
        const dataRows = rows.filter((row) => {
          const cells = [...row.children].filter((cell) => cell.tagName === "TH" || cell.tagName === "TD");
          return cells.length === headers.length && cells.some((cell) => cell.tagName === "TD");
        });
        let matchingRows = 0;
        for (const row of dataRows) {
          const cells = [...row.children].filter((cell) => cell.tagName === "TH" || cell.tagName === "TD");
          const markerCount = cells[columnIndex].querySelectorAll(operation.markerSelector).length;
          if (markerCount > 1) return { id: operation.id, matched: markerCount, healthy: false };
          if (markerCount === 1) matchingRows += 1;
        }
        return { id: operation.id, matched: matchingRows, healthy: dataRows.length > 0 && matchingRows > 0 };
      } catch {
        return { id: operation.id, matched: 0, healthy: false };
      }
    }
    if (operation.type === "keyboardNavigation") {
      const containers = document.querySelectorAll(operation.container);
      const matched = containers.length === 1 ? count(operation.items, containers[0]) : containers.length;
      return { id: operation.id, matched, healthy: containers.length === 1 && matched > 0 };
    }
    if (operation.type === "collectionFilter" || operation.type === "collectionCompare") {
      const containers = document.querySelectorAll(operation.selector);
      const matched = containers.length === 1 ? count(operation.items, containers[0]) : containers.length;
      if (operation.type === "collectionCompare" && containers.length === 1) {
        const titles = [...containers[0].querySelectorAll(operation.items)]
          .map((item) => item.getAttribute(operation.itemTitleAttribute)?.trim().slice(0, 120) ?? "");
        const uniqueTitles = new Set(titles);
        return { id: operation.id, matched, healthy: matched >= 2 && titles.every(Boolean) && uniqueTitles.size === titles.length };
      }
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
