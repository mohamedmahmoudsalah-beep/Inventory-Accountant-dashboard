import { evaluate } from "mathjs";
import type { DataRow, Measure } from "../types";
import { aggregateColumn } from "./aggregate";

/** Turns a name (measure or column) into a safe mathjs scope-variable name —
 *  same idea as calculatedColumns.ts, since formulas reference names that
 *  can contain spaces via [Brackets]. */
function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "_");
}

/** Computes a single Measure's value over the given rows. Plain measures
 *  (no formula) work exactly as before: aggregate one column, optionally
 *  filtered by a "where" condition. Formula measures instead evaluate a
 *  small expression that can reference OTHER measures by [Measure Name]
 *  (using that measure's own computed value) and/or columns by [Column
 *  Name] (meaning sum(column) over these same rows) — e.g. dividing one
 *  measure by another for a ratio/percentage.
 *
 *  `visiting` guards against a formula that (directly or indirectly)
 *  references itself — rather than looping forever, an already-visiting
 *  measure resolves to 0 and a warning is logged, same spirit as
 *  calculatedColumns.ts's "#ERROR" fallback. */
export function computeMeasureValue(
  measure: Measure,
  rows: DataRow[],
  allMeasures: Measure[],
  visiting: Set<string> = new Set()
): number {
  if (!measure.formula) {
    return aggregateColumn(rows, measure.column, measure.agg, measure.conditionColumn, measure.conditionValue);
  }

  if (visiting.has(measure.id)) {
    console.warn(`Measure "${measure.name}" has a circular formula reference — returning 0 to avoid an infinite loop.`);
    return 0;
  }
  const nextVisiting = new Set(visiting).add(measure.id);

  const scope: Record<string, number> = {};
  const columnNamesInRows = rows.length > 0 ? Object.keys(rows[0]) : [];

  // Longest names first, so "Total Revenue" doesn't get partially matched
  // by a shorter "Revenue" that happens to also exist.
  const referenceable = [
    ...allMeasures.filter((m) => m.id !== measure.id).map((m) => ({ kind: "measure" as const, name: m.name, ref: m })),
    ...columnNamesInRows.map((c) => ({ kind: "column" as const, name: c, ref: c })),
  ].sort((a, b) => b.name.length - a.name.length);

  let expr = measure.formula;
  for (const item of referenceable) {
    const bracketed = `[${item.name}]`;
    if (!expr.includes(bracketed)) continue;
    const safe = safeName(item.name) + (item.kind === "measure" ? "_m" : "_c");
    expr = expr.split(bracketed).join(safe);
    if (item.kind === "measure") {
      scope[safe] = computeMeasureValue(item.ref, rows, allMeasures, nextVisiting);
    } else {
      scope[safe] = aggregateColumn(rows, item.ref, "sum");
    }
  }

  try {
    const result = evaluate(expr, scope);
    return typeof result === "number" && isFinite(result) ? result : 0;
  } catch (e) {
    console.warn(`Measure "${measure.name}"'s formula couldn't be evaluated:`, e);
    return 0;
  }
}
