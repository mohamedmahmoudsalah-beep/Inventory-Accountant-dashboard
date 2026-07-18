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
  const values = filtered.map((r) => parseNumeric(r[column]));
  return aggregateValues(values, agg);
}
