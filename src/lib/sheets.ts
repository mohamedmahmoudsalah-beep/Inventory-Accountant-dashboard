import Papa from "papaparse";
import type { DataRow } from "../types";
import { getCachedAccessToken } from "./googleDrive";

export function extractSheetId(sheetUrl: string): string | null {
  const idMatch = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return idMatch ? idMatch[1] : null;
}

/**
 * Converts a normal Google Sheets share link into its published CSV export link.
 * Only works if the sheet is shared as "Anyone with the link can view".
 */
export function toCsvUrl(sheetUrl: string): string {
  const id = extractSheetId(sheetUrl);
  if (!id) return sheetUrl; // assume it's already a direct CSV export URL
  const gidMatch = sheetUrl.match(/[#&?]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : "0";
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}

export interface ParsedSheet {
  rows: DataRow[];
  columns: string[];
}

function rowsFromValues(values: string[][]): ParsedSheet {
  const [header, ...rest] = values;
  const columns = header ?? [];
  const rows: DataRow[] = rest
    .filter((r) => r.some((cell) => cell !== "" && cell !== undefined))
    .map((r) => {
      const row: DataRow = {};
      columns.forEach((col, i) => {
        const raw = r[i];
        const num = Number(raw);
        row[col] = raw !== "" && raw !== undefined && !isNaN(num) && raw.trim() !== "" ? num : raw ?? "";
      });
      return row;
    });
  return { rows, columns };
}

/**
 * Reads a sheet using the Sheets API with the user's own OAuth token — this
 * works for PRIVATE files the user can see in their Drive, no "anyone with
 * the link" sharing required. Falls back to the public CSV export if no
 * token is available (e.g. the user pasted a link instead of using
 * "Browse from Drive").
 */
export async function fetchSheetAsRows(sheetUrl: string): Promise<ParsedSheet> {
  const token = getCachedAccessToken();
  const id = extractSheetId(sheetUrl);

  if (token && id) {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/A1:ZZ20000`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (res.ok) {
      const data = await res.json();
      return rowsFromValues(data.values ?? []);
    }
    // If the authenticated call fails (e.g. token expired), fall through to
    // the public CSV path below rather than failing outright.
  }

  const csvUrl = toCsvUrl(sheetUrl);
  const res = await fetch(csvUrl);
  if (!res.ok) {
    throw new Error(
      `Couldn't load the sheet (status ${res.status}). Either use "Browse from Drive" to sign in, or share the sheet as "Anyone with the link can view".`
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
