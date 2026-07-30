import { evaluate } from "mathjs";
import type { DataRow, Measure } from "../types";
import { aggregateColumn } from "./aggregate";

/** Turns a name (measure or column) into a safe mathjs scope-variable name —
 *  same idea as calculatedColumns.ts, since formulas reference names that
 *  can contain spaces via [Brackets]. */
function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "_");
}

const AGG_FUNCS: Record<string, "sum" | "avg" | "count" | "distinct" | "max" | "min"> = {
  SUM: "sum",
  AVG: "avg",
  COUNT: "count",
  DISTINCT: "distinct",
  MAX: "max",
  MIN: "min",
};

/** The aggregate function names usable in a formula — exported so the
 *  Measures editor's autocomplete can suggest them alongside measures/columns. */
export const MEASURE_FORMULA_FUNCTIONS = Object.keys(AGG_FUNCS);

/** Computes a single Measure's value over the given rows. Plain measures
 *  (no formula) work exactly as before: aggregate one column, optionally
 *  filtered by a "where" condition. Formula measures instead evaluate a
 *  small expression that can reference:
 *    - OTHER measures by [Measure Name] — using that measure's own computed value
 *    - columns by [Column Name] on its own — meaning sum(column), the common case
 *    - an explicit aggregate, e.g. SUM([Column]), COUNT([Column]), AVG([Column]),
 *      MIN/MAX/DISTINCT([Column]) — for anything other than a plain sum
 *  e.g. "SUM([Revenue]) / COUNT([Orders])" or "[Total Revenue] / [Total Cost] * 100".
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
  let varCounter = 0;
  let expr = measure.formula;

  // Pass 1: explicit aggregate function calls, e.g. SUM([Column]). Consumed
  // first so pass 2 below never sees the bracket that's already inside one
  // of these calls.
  const funcCallPattern = /\b(SUM|AVG|COUNT|DISTINCT|MAX|MIN)\s*\(\s*\[([^\]]+)\]\s*\)/gi;
  expr = expr.replace(funcCallPattern, (_match, funcName: string, refName: string) => {
    const agg = AGG_FUNCS[funcName.toUpperCase()];
    const varName = `f${varCounter++}`;
    const measureRef = allMeasures.find((m) => m.id !== measure.id && m.name === refName);
    // A function wrapped around a MEASURE name doesn't really change
    // anything (a measure is already one number) — just use its value.
    scope[varName] = measureRef ? computeMeasureValue(measureRef, rows, allMeasures, nextVisiting) : aggregateColumn(rows, refName, agg);
    return varName;
  });

  // Pass 2: any remaining bare [Name] references — same as before, a
  // column on its own means sum(column), a measure means its own value.
  const columnNamesInRows = rows.length > 0 ? Object.keys(rows[0]) : [];
  const referenceable = [
    ...allMeasures.filter((m) => m.id !== measure.id).map((m) => ({ kind: "measure" as const, name: m.name, ref: m })),
    ...columnNamesInRows.map((c) => ({ kind: "column" as const, name: c, ref: c })),
  ].sort((a, b) => b.name.length - a.name.length); // longest names first, so "Total Revenue" isn't partially matched by "Revenue"

  for (const item of referenceable) {
    const bracketed = `[${item.name}]`;
    if (!expr.includes(bracketed)) continue;
    const safe = safeName(item.name) + (item.kind === "measure" ? "_m" : "_c");
    expr = expr.split(bracketed).join(safe);
    scope[safe] = item.kind === "measure" ? computeMeasureValue(item.ref, rows, allMeasures, nextVisiting) : aggregateColumn(rows, item.ref, "sum");
  }

  try {
    const result = evaluate(expr, scope);
    return typeof result === "number" && isFinite(result) ? result : 0;
  } catch (e) {
    console.warn(`Measure "${measure.name}"'s formula couldn't be evaluated:`, e);
    return 0;
  }
}
