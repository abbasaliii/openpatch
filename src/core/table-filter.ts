import type { TableColumnFilterOperation } from "./types";

export type TableColumnInspection = {
  healthy: boolean;
  matched: number;
  detail: string;
  table?: HTMLTableElement;
  header?: HTMLElement;
  matchingRows?: HTMLTableRowElement[];
  hiddenRows?: HTMLTableRowElement[];
  matrixRows?: HTMLTableRowElement[];
  columnIndex?: number;
};

const MAX_HEADERS = 20;
const MAX_ROWS = 100;
const normalize = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim();

export function inspectTableColumnFilter(
  operation: TableColumnFilterOperation,
  root: ParentNode = document
): TableColumnInspection {
  try {
    const candidates = [...root.querySelectorAll(operation.selector)];
    if (candidates.length !== 1 || candidates[0].tagName !== "TABLE") {
      return { healthy: false, matched: candidates.length, detail: "expected exactly one table" };
    }
    const table = candidates[0] as HTMLTableElement;
    const headers = [...table.querySelectorAll<HTMLElement>(operation.headerSelector)];
    if (headers.length < 2 || headers.length > MAX_HEADERS) {
      return { healthy: false, matched: headers.length, detail: "expected 2-20 table headers" };
    }
    const headerMatches = headers.filter((header) => normalize(header.textContent) === operation.headerText);
    if (headerMatches.length !== 1) {
      return { healthy: false, matched: headerMatches.length, detail: "expected one exact header match" };
    }
    const columnIndex = headers.indexOf(headerMatches[0]);
    const rows = [...table.querySelectorAll<HTMLTableRowElement>(operation.rowSelector)];
    if (rows.length === 0 || rows.length > MAX_ROWS) {
      return { healthy: false, matched: rows.length, detail: "expected 1-100 bounded table rows" };
    }
    const matrixRows = rows.filter((row) => {
      const cells = [...row.children].filter((cell) => cell.tagName === "TH" || cell.tagName === "TD");
      return cells.length === headers.length;
    });
    const dataRows = matrixRows.filter((row) => [...row.children].some((cell) => cell.tagName === "TD"));
    if (dataRows.length === 0) return { healthy: false, matched: 0, detail: "no bounded data rows found" };

    const matchingRows: HTMLTableRowElement[] = [];
    const hiddenRows: HTMLTableRowElement[] = [];
    for (const row of dataRows) {
      const cells = [...row.children].filter((cell) => cell.tagName === "TH" || cell.tagName === "TD") as HTMLElement[];
      const markerCount = cells[columnIndex].querySelectorAll(operation.markerSelector).length;
      if (markerCount > 1) return { healthy: false, matched: markerCount, detail: "expected at most one marker per target cell" };
      (markerCount === 1 ? matchingRows : hiddenRows).push(row);
    }
    if (matchingRows.length === 0) return { healthy: false, matched: 0, detail: "no matching rows found" };
    return {
      healthy: true,
      matched: matchingRows.length,
      detail: `${matchingRows.length} matching rows; ${hiddenRows.length} excluded rows`,
      table,
      header: headerMatches[0],
      matchingRows,
      hiddenRows,
      matrixRows,
      columnIndex
    };
  } catch {
    return { healthy: false, matched: 0, detail: "table selector inspection failed" };
  }
}
