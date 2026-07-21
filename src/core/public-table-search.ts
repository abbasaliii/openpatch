import type { PublicTableSearchOperation } from "./types";

export type PublicTableSearchInspection = {
  healthy: boolean;
  matched: number;
  detail: string;
  tables?: HTMLTableElement[];
  headers?: HTMLTableRowElement[];
  dataRows?: HTMLTableRowElement[];
};

const normalize = (value: string | null) => (value ?? "").replace(/\s+/g, " ").trim();

export function inspectPublicTableSearch(operation: PublicTableSearchOperation, document: Document): PublicTableSearchInspection {
  try {
    const matches = [...document.querySelectorAll(operation.selector)];
    const tables = matches.filter((element): element is HTMLTableElement => element.tagName === "TABLE");
    if (matches.length !== tables.length || tables.length < 1 || tables.length > operation.maxTables) {
      return { healthy: false, matched: matches.length, detail: `expected 1-${operation.maxTables} tables, found ${matches.length}` };
    }
    const headers: HTMLTableRowElement[] = [];
    const dataRows: HTMLTableRowElement[] = [];
    for (const table of tables) {
      const rows = [...table.querySelectorAll<HTMLTableRowElement>(operation.rowSelector)];
      const headerMatches = rows.filter((row) => normalize(row.cells[0]?.textContent ?? null) === operation.headerText);
      if (headerMatches.length < 1 || headerMatches.length > 12) return { healthy: false, matched: headerMatches.length, detail: `expected 1-12 ${operation.headerText} headers per table` };
      const header = headerMatches[0];
      const columnCount = header.cells.length;
      if (columnCount < 2 || columnCount > 12) return { healthy: false, matched: columnCount, detail: "table header must contain 2-12 columns" };
      if (headerMatches.some((candidate) => candidate.cells.length !== columnCount)) {
        return { healthy: false, matched: headerMatches.length, detail: "repeated table headers must have the same column count" };
      }
      const headerSet = new Set(headerMatches);
      const rowsForTable = rows.filter((row) => !headerSet.has(row) && row.cells.length === columnCount);
      if (rowsForTable.length === 0) return { healthy: false, matched: 0, detail: "table has no bounded public data rows" };
      headers.push(...headerMatches);
      dataRows.push(...rowsForTable);
    }
    if (dataRows.length > operation.maxRows) return { healthy: false, matched: dataRows.length, detail: `public row bound exceeded (${dataRows.length}/${operation.maxRows})` };
    return { healthy: true, matched: dataRows.length, detail: `${dataRows.length} public rows searchable across ${tables.length} tables`, tables, headers, dataRows };
  } catch {
    return { healthy: false, matched: 0, detail: "public table inspection failed" };
  }
}
