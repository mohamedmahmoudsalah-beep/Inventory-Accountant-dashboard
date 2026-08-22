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

function normalizeKeyValue(v: unknown): string {
  if (typeof v === "number") return String(v);
  const str = String(v ?? "").trim();
  if (str === "") return "";

  // Plain numeric IDs get normalized too — strips thousands separators
  // ("16,023,965" vs "16023965") and reconciles number-vs-text storage
  // (16023965 vs "16023965") so an ID column matches regardless of which
  // sheet happened to store/format it which way.
  const cleanedNum = str.replace(/,/g, "");
  if (/^-?\d+(\.\d+)?$/.test(cleanedNum)) return String(Number(cleanedNum));

  // Date-shaped values get normalized to a plain YYYY-MM-DD before
  // comparing — this is the #1 reason a composite key that matches
  // perfectly on an ID alone still finds zero matches once a date column
  // joins it: two Google Sheet tabs can hold the exact same calendar day
  // formatted completely differently depending on that tab's own cell
  // formatting (e.g. "6/1/2026" vs "2026-06-01" vs "01/06/2026"), or with
  // a trailing time-of-day one sheet's formatting adds and the other
  // doesn't ("6/1/2026 0:00:00"). Parsed by hand (not `new Date(...)`) to
  // avoid timezone shifts silently moving a date to the day before/after,
  // and matched from the start only (no trailing anchor) so a trailing
  // time-of-day or stray whitespace doesn't stop it from matching.
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(str);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(str);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;

  return str.toLowerCase();
}

function compositeKey(row: DataRow, keys: string[]): string {
  return keys.map((k) => normalizeKeyValue(row[k])).join("␟");
}

/**
 * Collapses `table` down to one row per unique combination of `keyColumns`
 * — every numeric column gets summed across the rows that share a key,
 * every other (text) column just keeps whatever value the first row in
 * that group had. Meant to run on a table *before* it's used as a merge
 * base/lookup whenever that table can have more than one row per key (e.g.
 * several transactions on the same day for the same item) — a merge
 * always attaches exactly one matching row's values onto every row on the
 * other side, so linking un-aggregated many-rows-per-key data directly is
 * what causes a value to get copied onto more rows than it should,
 * silently multiplying any SUM computed afterwards. Aggregating both sides
 * down to one row per key first (this function) is what a proper "group by
 * key, then join" does, and avoids that entirely — no manual Pivot/Export
 * round-trip needed.
 */
const isNumericCell = (v: unknown) => typeof v === "number" || (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v)));

/** Best-guess default for how a column should combine when its key repeats
 *  — "sum" if essentially every sampled value looks numeric, "first"
 *  (keep whichever value the first row in the group had) otherwise. Used
 *  to pre-fill the aggregation picker in the Merge UI; always overridable
 *  per column from there. */
export function guessAggForColumn(table: ParsedFile, column: string): "sum" | "first" {
  const sample = table.rows.slice(0, 30).map((r) => r[column]).filter((v) => v !== undefined && v !== "");
  if (sample.length === 0) return "first";
  const numeric = sample.filter(isNumericCell).length;
  return numeric / sample.length >= 0.8 ? "sum" : "first";
}

/** Sensible starting point for ColumnPicksEditor: only the columns that
 *  look numeric get pre-checked (with Sum) — text/ID-like columns start
 *  unchecked, since dragging in every column a raw sheet happens to have
 *  is exactly the bloat/noise this picker exists to avoid. Fully
 *  overridable from the UI either way. */
export function defaultPicksForKeys(table: ParsedFile, keyColumns: string[]): Record<string, JoinAgg> {
  const picks: Record<string, JoinAgg> = {};
  table.columns
    .filter((c) => !keyColumns.includes(c))
    .forEach((c) => {
      if (guessAggForColumn(table, c) === "sum") picks[c] = "sum";
    });
  return picks;
}

export type JoinAgg = "sum" | "avg" | "count" | "max" | "min" | "distinct" | "first";

/**
 * Collapses `table` down to one row per unique combination of `keyColumns`.
 *
 * `keepColumns`, when given, is the exact set of non-key columns to carry
 * into the result — anything else is dropped entirely rather than merely
 * left un-aggregated, so a table with a lot of columns nobody asked for
 * (e.g. a raw Odoo export) doesn't balloon the merged result or add noise
 * to it. Omit it to keep every column (the original default behavior).
 *
 * `aggOverrides[column]` picks exactly how that column combines when rows
 * share a key — "sum"/"avg"/"count"/"max"/"min"/"distinct" the usual way,
 * or "first" to just keep whichever value the first row in the group had
 * (the right choice for an ID/name/category column that isn't meant to be
 * combined at all). Falls back to guessAggForColumn's heuristic for any
 * kept column without an explicit override.
 *
 * Meant to run on a table *before* it's used as a merge base/lookup
 * whenever that table can have more than one row per key (e.g. several
 * transactions on the same day for the same product) — a merge always
 * attaches exactly one matching row's values onto every row on the other
 * side, so linking un-aggregated many-rows-per-key data directly is what
 * causes a value to get copied onto more rows than it should, silently
 * multiplying any SUM computed afterwards. Aggregating both sides down to
 * one row per key first (this function) is what a proper "group by key,
 * then join" does, and avoids that entirely.
 */
export function aggregateForJoin(
  table: ParsedFile,
  keyColumns: string[],
  options?: { keepColumns?: string[]; aggOverrides?: Record<string, JoinAgg> }
): ParsedFile {
  const valueColumns = (options?.keepColumns ?? table.columns.filter((c) => !keyColumns.includes(c)));
  const resultColumns = [...keyColumns, ...valueColumns.filter((c) => !keyColumns.includes(c))];

  const groups = new Map<string, DataRow[]>();
  table.rows.forEach((r) => {
    const key = compositeKey(r, keyColumns);
    const bucket = groups.get(key);
    if (bucket) bucket.push(r);
    else groups.set(key, [r]);
  });

  const rows: DataRow[] = [];
  groups.forEach((groupRows) => {
    const row: DataRow = {};
    resultColumns.forEach((c) => {
      if (keyColumns.includes(c)) {
        row[c] = groupRows[0][c];
        return;
      }
      const agg = options?.aggOverrides?.[c] ?? guessAggForColumn(table, c);
      const nums = () => groupRows.map((r) => (isNumericCell(r[c]) ? Number(r[c]) : 0));
      switch (agg) {
        case "sum": row[c] = nums().reduce((a, b) => a + b, 0); break;
        case "avg": row[c] = nums().reduce((a, b) => a + b, 0) / groupRows.length; break;
        case "count": row[c] = groupRows.filter((r) => r[c] !== undefined && r[c] !== "").length; break;
        case "max": row[c] = Math.max(...nums()); break;
        case "min": row[c] = Math.min(...nums()); break;
        case "distinct": row[c] = new Set(groupRows.map((r) => String(r[c] ?? ""))).size; break;
        case "first": default: row[c] = groupRows[0][c]; break;
      }
    });
    rows.push(row);
  });

  return { fileName: table.fileName, columns: resultColumns, rows };
}

/**
 * Merge (left join): for every row in `base`, looks up a matching row in
 * `other` by comparing baseKeys/otherKeys values (in order — the Nth base
 * key is matched against the Nth other key), and copies over `other`'s
 * remaining columns (renamed if they'd collide with an existing column).
 *
 * Pass more than one key when a single column doesn't uniquely identify a
 * "row" on either side — e.g. matching by Product AND Month together,
 * because Product alone would match every month's row. Matching on too few
 * keys is the #1 cause of a merge silently multiplying totals: if `other`
 * has several rows sharing the same (incomplete) key, only the last one
 * found wins the lookup, and if `base` has many rows sharing that key, the
 * single matched value gets copied onto every one of them — inflating any
 * SUM computed over it afterwards. Matching on the full combination that's
 * actually unique on the `other` side avoids this.
 */
export function mergeTables(
  base: ParsedFile,
  other: ParsedFile,
  baseKeys: string[],
  otherKeys: string[]
): { columns: string[]; rows: DataRow[] } {
  const otherByKey = new Map<string, DataRow>();
  other.rows.forEach((r) => otherByKey.set(compositeKey(r, otherKeys), r));

  const otherExtraCols = other.columns.filter((c) => !otherKeys.includes(c));
  const renamed = otherExtraCols.map((c) =>
    base.columns.includes(c) ? `${c}_2` : c
  );

  const columns = [...base.columns, ...renamed];

  const rows: DataRow[] = base.rows.map((baseRow) => {
    const match = otherByKey.get(compositeKey(baseRow, baseKeys));
    const row: DataRow = { ...baseRow };
    otherExtraCols.forEach((c, i) => {
      row[renamed[i]] = match ? match[c] ?? "" : "";
    });
    return row;
  });

  return { columns, rows };
}

export interface LookupJoin {
  table: ParsedFile;
  baseKeys: string[]; // column(s) in `base` — matched in order against otherKeys
  otherKeys: string[]; // matching column(s) in `table`, same length as baseKeys
  /** Also add rows for entries in `table` whose key never matched any
   *  base row — with every base-only column left blank and the base's key
   *  columns filled from this lookup's own key values. Off by default
   *  (the original left-join behavior: only base rows survive, any
   *  lookup-only entry is silently dropped) — turn on when a lookup
   *  sheet's own entries matter even without a matching base row, e.g.
   *  wanting every Scrap entry to show up somewhere even for a date/item
   *  no matching Sales row was ever recorded for. */
  includeUnmatched?: boolean;
}

export interface MergeMatchStats {
  tableFileName: string;
  matchedBaseRows: number;
  unmatchedBaseRows: number;
  totalBaseRows: number;
  unmatchedLookupRows: number;
  totalLookupRows: number;
}

/**
 * Joins any number of "lookup" sheets onto one base/main sheet — the
 * classic "one big sheet + a couple of reference sheets" shape (e.g. a
 * transactions sheet, plus a branches sheet, plus a products sheet, each
 * linked onto transactions by its own ID column). Every lookup is matched
 * against `base`'s own columns (never against another lookup's columns),
 * which keeps the join unambiguous and lets lookups be added/removed/
 * reordered independently in the UI without re-picking earlier keys.
 *
 * For a true chain (sheet C only has a key that lives in sheet B, not in
 * the base sheet), join B onto the base first, apply it, then re-open
 * Import → Merge with the *result* as the new base and C as the lookup —
 * two passes covers that case without needing more UI complexity here.
 *
 * Also returns `columnGroups`: which original sheet each column came from
 * (base.fileName for base columns, each lookup's fileName for the columns
 * it contributed) — meant to be stored on the page so every column picker
 * in the app can group fields by their source sheet, the same idea as
 * Excel's PivotTable field list grouping fields by table.
 */
export function mergeManyTables(
  base: ParsedFile,
  lookups: LookupJoin[]
): { columns: string[]; rows: DataRow[]; columnGroups: Record<string, string>; matchStats: MergeMatchStats[] } {
  let columns = [...base.columns];
  let rows: DataRow[] = base.rows.map((r) => ({ ...r }));
  const columnGroups: Record<string, string> = {};
  base.columns.forEach((c) => (columnGroups[c] = base.fileName));
  const matchStats: MergeMatchStats[] = [];

  lookups.forEach(({ table, baseKeys, otherKeys, includeUnmatched }) => {
    const byKey = new Map<string, DataRow>();
    table.rows.forEach((r) => byKey.set(compositeKey(r, otherKeys), r));

    const extraCols = table.columns.filter((c) => !otherKeys.includes(c));
    const suffix = `_${table.fileName.replace(/[^\w]+/g, "_").replace(/^_+|_+$/g, "") || "linked"}`;
    const renamed = extraCols.map((c) => (columns.includes(c) ? `${c}${suffix}` : c));
    columns = [...columns, ...renamed];
    renamed.forEach((c) => (columnGroups[c] = table.fileName));

    const usedKeys = new Set<string>();
    let matchedBaseRows = 0;
    const baseRowCountBeforeOrphans = rows.length;
    rows.forEach((row) => {
      const key = compositeKey(row, baseKeys);
      const match = byKey.get(key);
      if (match) {
        matchedBaseRows++;
        usedKeys.add(key);
      }
      extraCols.forEach((c, i) => {
        row[renamed[i]] = match ? match[c] ?? "" : "";
      });
    });

    const lookupKeys = new Set(table.rows.map((lr) => compositeKey(lr, otherKeys)));
    let unmatchedLookupCount = 0;

    if (includeUnmatched) {
      const orphanRows: DataRow[] = [];
      const seenOrphanKeys = new Set<string>();
      table.rows.forEach((lr) => {
        const key = compositeKey(lr, otherKeys);
        if (usedKeys.has(key) || seenOrphanKeys.has(key)) return;
        seenOrphanKeys.add(key);
        unmatchedLookupCount++;
        const row: DataRow = {};
        columns.forEach((c) => (row[c] = ""));
        baseKeys.forEach((bk, i) => (row[bk] = lr[otherKeys[i]] ?? ""));
        extraCols.forEach((c, i) => (row[renamed[i]] = lr[c] ?? ""));
        orphanRows.push(row);
      });
      rows = [...rows, ...orphanRows];
    } else {
      unmatchedLookupCount = [...lookupKeys].filter((k) => !usedKeys.has(k)).length;
    }

    matchStats.push({
      tableFileName: table.fileName,
      matchedBaseRows,
      unmatchedBaseRows: baseRowCountBeforeOrphans - matchedBaseRows,
      totalBaseRows: baseRowCountBeforeOrphans,
      unmatchedLookupRows: unmatchedLookupCount,
      totalLookupRows: lookupKeys.size,
    });
  });

  return { columns, rows, columnGroups, matchStats };
}
