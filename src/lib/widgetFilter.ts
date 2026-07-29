import type { DataRow, WidgetFilter } from "../types";
import { parseNumeric } from "./numeric";

/** Applies a single widget-level filter (Pivot/Matrix/Card) to a set of rows.
 *  "equals" (the default when `mode` is absent) matches text columns
 *  exactly; "gt"/"lt"/"between" compare numerically — used for number
 *  columns, where a single exact value rarely means anything useful. */
export function applyWidgetFilter(rows: DataRow[], filter: WidgetFilter | undefined): DataRow[] {
  if (!filter) return rows;
  const mode = filter.mode ?? "equals";

  if (mode === "gt") {
    const bound = parseNumeric(filter.value);
    return rows.filter((r) => parseNumeric(r[filter.column]) > bound);
  }
  if (mode === "lt") {
    const bound = parseNumeric(filter.value);
    return rows.filter((r) => parseNumeric(r[filter.column]) < bound);
  }
  if (mode === "between") {
    const a = parseNumeric(filter.value);
    const b = parseNumeric(filter.value2 ?? filter.value);
    const [min, max] = a <= b ? [a, b] : [b, a];
    return rows.filter((r) => {
      const v = parseNumeric(r[filter.column]);
      return v >= min && v <= max;
    });
  }
  return rows.filter((r) => String(r[filter.column] ?? "") === filter.value);
}
