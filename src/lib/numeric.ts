/**
 * Parses a value into a number for chart/pivot aggregation. Plain Number()
 * fails on anything with thousands separators or currency symbols (e.g.
 * "259,022,315" or "$1,234.50"), silently turning real data into 0 — this
 * strips that formatting first.
 */
export function parseNumeric(value: unknown): number {
  if (typeof value === "number") return isNaN(value) ? 0 : value;
  if (value === null || value === undefined) return 0;

  const str = String(value).trim();
  if (str === "") return 0;

  // Strip thousands separators, currency symbols, percent signs, and spaces;
  // keep digits, a single leading minus, and one decimal point.
  const cleaned = str.replace(/[^0-9.\-]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/** How a widget should display numeric values. "auto" abbreviates large
 *  numbers (1,234,567 -> 1.23M, 750,000 -> 750K, 2,500,000,000 -> 2.5B).
 *  "full" always spells the number out with thousands separators. Left
 *  undefined on a widget's config means "auto" (the default). */
export type NumberFormatMode = "auto" | "full";

const COMPACT_FORMATTER = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});
const FULL_FORMATTER = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

/** Formats a number for display in a Chart/Pivot/Matrix/Card, according to
 *  the widget's chosen number format. Defaults to "auto" (compact) since
 *  that's the more readable choice for most dashboards at a glance — pass
 *  "full" to always show the exact number instead. */
export function formatNumber(value: number, mode: NumberFormatMode = "auto"): string {
  if (!isFinite(value)) return "0";
  return mode === "full" ? FULL_FORMATTER.format(value) : COMPACT_FORMATTER.format(value);
}
