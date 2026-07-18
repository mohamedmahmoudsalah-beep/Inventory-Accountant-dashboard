import type { DataRow } from "../types";

export type ColumnType = "number" | "date" | "text";

export function detectColumnType(rows: DataRow[], column: string): ColumnType {
  const sample = rows
    .slice(0, 30)
    .map((r) => r[column])
    .filter((v) => v !== "" && v !== null && v !== undefined);

  if (sample.length === 0) return "text";

  const numCount = sample.filter((v) => {
    if (typeof v === "number") return true;
    const cleaned = String(v).replace(/[,\s%$]/g, "");
    return cleaned !== "" && !isNaN(Number(cleaned));
  }).length;
  if (numCount / sample.length >= 0.8) return "number";

  const dateCount = sample.filter((v) => typeof v !== "number" && !isNaN(Date.parse(String(v)))).length;
  if (dateCount / sample.length >= 0.8) return "date";

  return "text";
}
