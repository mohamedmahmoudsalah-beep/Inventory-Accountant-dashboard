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
