import { evaluate } from "mathjs";
import type { CalculatedColumn, DataRow } from "../types";

/**
 * Formula syntax: reference other column names directly (case-sensitive,
 * spaces in names need square brackets like [Total Cost]), use +, -, *, /,
 * comparisons (==, !=, >, <), and IF(condition, ifTrue, ifFalse). Examples:
 *   price * qty
 *   [Total Cost] - [Total Revenue]
 *   IF(region == "Cairo", revenue, 0)
 */
export function applyCalculatedColumns(
  rows: DataRow[],
  baseColumns: string[],
  calcCols: CalculatedColumn[]
): { rows: DataRow[]; columns: string[] } {
  if (calcCols.length === 0) return { rows, columns: baseColumns };

  const columns = [...baseColumns, ...calcCols.map((c) => c.name)];

  const newRows = rows.map((row) => {
    const scope: Record<string, unknown> = {};
    baseColumns.forEach((c) => {
      const safeName = c.replace(/[^a-zA-Z0-9_]/g, "_");
      const value = row[c];
      scope[safeName] = typeof value === "number" ? value : isNaN(Number(value)) ? value : Number(value);
    });
    // IF(cond, a, b) - mathjs doesn't have IF, so translate to its ternary-like ifElse.
    scope.IF = (cond: boolean, a: unknown, b: unknown) => (cond ? a : b);

    const result: DataRow = { ...row };
    calcCols.forEach((calc) => {
      try {
        // Replace bracketed column refs [Col Name] and bare column names with
        // their sanitized scope variable names before evaluating.
        let expr = calc.formula;
        baseColumns
          .slice()
          .sort((a, b) => b.length - a.length) // longest names first to avoid partial overlaps
          .forEach((c) => {
            const safeName = c.replace(/[^a-zA-Z0-9_]/g, "_");
            expr = expr.split(`[${c}]`).join(safeName);
            if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(c)) {
              expr = expr.replace(new RegExp(`\\b${c}\\b`, "g"), safeName);
            }
          });
        const value = evaluate(expr, scope);
        result[calc.name] = typeof value === "number" ? value : String(value);
      } catch {
        result[calc.name] = "#ERROR";
      }
    });
    return result;
  });

  return { rows: newRows, columns };
}
