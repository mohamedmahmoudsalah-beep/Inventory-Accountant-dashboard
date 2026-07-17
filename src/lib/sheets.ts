import Papa from "papaparse";
import type { DataRow } from "../types";

/**
 * Converts a normal Google Sheets share link into its published CSV export link.
 * Works for links like:
 *   https://docs.google.com/spreadsheets/d/<ID>/edit#gid=<GID>
 * The sheet must be shared as "Anyone with the link can view" (or published to web).
 */
export function toCsvUrl(sheetUrl: string): string {
  const idMatch = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) {
    // Assume the user already pasted a direct CSV export URL.
    return sheetUrl;
  }
  const id = idMatch[1];
  const gidMatch = sheetUrl.match(/[#&?]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : "0";
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}

export interface ParsedSheet {
  rows: DataRow[];
  columns: string[];
}

export async function fetchSheetAsRows(sheetUrl: string): Promise<ParsedSheet> {
  const csvUrl = toCsvUrl(sheetUrl);
  const res = await fetch(csvUrl);
  if (!res.ok) {
    throw new Error(
      `Couldn't load the sheet (status ${res.status}). Make sure it's shared as "Anyone with the link can view".`
    );
  }
  const csvText = await res.text();
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  });

  const columns = parsed.meta.fields ?? [];
  const rows = (parsed.data as DataRow[]).filter((r) =>
    Object.values(r).some((v) => v !== "" && v !== null && v !== undefined)
  );

  return { rows, columns };
}
