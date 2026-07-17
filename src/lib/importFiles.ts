import * as XLSX from "xlsx";
import Papa from "papaparse";
import type { DataRow } from "../types";

export interface ParsedFile {
  fileName: string;
  columns: string[];
  rows: DataRow[];
}

function coerceCell(value: unknown): string | number {
  if (typeof value === "number") return value;
  if (value === null || value === undefined) return "";
  const str = String(value).trim();
  if (str === "") return "";
  const num = Number(str);
  return !isNaN(num) ? num : str;
}

/** Reads a single .xlsx/.xls/.csv File (from an <input type="file">) into rows + columns. */
export async function parseFile(file: File): Promise<ParsedFile> {
  const isCsv = file.name.toLowerCase().endsWith(".csv");

  if (isCsv) {
    const text = await file.text();
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
    });
    const columns = parsed.meta.fields ?? [];
    const rows: DataRow[] = (parsed.data as Record<string, string>[])
      .filter((r) => Object.values(r).some((v) => v !== "" && v != null))
      .map((r) => {
        const row: DataRow = {};
        columns.forEach((c) => (row[c] = coerceCell(r[c])));
        return row;
      });
    return { fileName: file.name, columns, rows };
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  const columns = raw.length > 0 ? Object.keys(raw[0]) : [];
  const rows: DataRow[] = raw.map((r) => {
    const row: DataRow = {};
    columns.forEach((c) => (row[c] = coerceCell(r[c])));
    return row;
  });

  return { fileName: file.name, columns, rows };
}

export async function parseFiles(files: File[]): Promise<ParsedFile[]> {
  return Promise.all(files.map(parseFile));
}

/**
 * Append (union): stacks rows from multiple parsed files into one table.
 * Columns don't need to match exactly — the result uses the union of all
 * columns seen across files, filling missing cells with "".
 */
export function appendTables(tables: ParsedFile[]): { columns: string[]; rows: DataRow[] } {
  const columnSet = new Set<string>();
  tables.forEach((t) => t.columns.forEach((c) => columnSet.add(c)));
  const columns = Array.from(columnSet);

  const rows: DataRow[] = [];
  tables.forEach((t) => {
    t.rows.forEach((r) => {
      const row: DataRow = {};
      columns.forEach((c) => (row[c] = r[c] ?? ""));
      rows.push(row);
    });
  });

  return { columns, rows };
}

/**
 * Merge (left join): for every row in `base`, looks up a matching row in
 * `other` by comparing baseKey/otherKey values, and copies over `other`'s
 * remaining columns (prefixed if they'd collide with an existing column).
 */
export function mergeTables(
  base: ParsedFile,
  other: ParsedFile,
  baseKey: string,
  otherKey: string
): { columns: string[]; rows: DataRow[] } {
  const otherByKey = new Map<string, DataRow>();
  other.rows.forEach((r) => otherByKey.set(String(r[otherKey]), r));

  const otherExtraCols = other.columns.filter((c) => c !== otherKey);
  const renamed = otherExtraCols.map((c) =>
    base.columns.includes(c) ? `${c}_2` : c
  );

  const columns = [...base.columns, ...renamed];

  const rows: DataRow[] = base.rows.map((baseRow) => {
    const match = otherByKey.get(String(baseRow[baseKey]));
    const row: DataRow = { ...baseRow };
    otherExtraCols.forEach((c, i) => {
      row[renamed[i]] = match ? match[c] ?? "" : "";
    });
    return row;
  });

  return { columns, rows };
}
