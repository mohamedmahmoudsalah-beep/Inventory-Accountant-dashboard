import type { DataRow, PivotAgg } from "../types";
import { parseNumeric } from "./numeric";

export function aggregateValues(values: number[], agg: PivotAgg): number {
  if (values.length === 0) return 0;
  switch (agg) {
    case "sum": return values.reduce((a, b) => a + b, 0);
    case "avg": return values.reduce((a, b) => a + b, 0) / values.length;
    case "count": return values.length;
    case "max": return Math.max(...values);
    case "min": return Math.min(...values);
    case "distinct": return new Set(values).size; // aggregateColumn below handles the real (non-numeric) distinct-count case directly; this only runs if aggregateValues is ever called with raw numbers directly.
  }
}

/** Optional single equality condition, like a simple SUMIF/COUNTIF filter. */
export function filterByCondition(rows: DataRow[], conditionColumn?: string, conditionValue?: string): DataRow[] {
  if (!conditionColumn || conditionValue === undefined || conditionValue === "") return rows;
  return rows.filter((r) => String(r[conditionColumn]) === conditionValue);
}

export function aggregateColumn(
  rows: DataRow[],
  column: string,
  agg: PivotAgg,
  conditionColumn?: string,
  conditionValue?: string
): number {
  const filtered = filterByCondition(rows, conditionColumn, conditionValue);
  if (agg === "distinct") {
    // Counts unique values, not a numeric total — this is the piece needed
    // for "how many separate times did X happen", as opposed to "how many
    // rows/products were involved across all of them" (which repeats once
    // per row and so isn't the same number). E.g. distinct COUNT of a visit
    // date/ID column tells you how many separate visits there were, even
    // though each visit itself spans many product rows.
    const unique = new Set(filtered.map((r) => String(r[column] ?? "")));
    return unique.size;
  }
  const values = filtered.map((r) => parseNumeric(r[column]));
  return aggregateValues(values, agg);
}
