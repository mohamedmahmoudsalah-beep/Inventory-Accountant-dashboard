import Papa from "papaparse";
import type { DataRow } from "../types";
import { getCachedAccessToken, tryServerSideTokenRefresh } from "./googleDrive";

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

export interface FetchedTable {
  fileName: string;
  columns: string[];
  rows: DataRow[];
}

/** Fetches several picked Google Sheets (already authenticated) and returns them
 *  in the same shape importFiles.ts's appendTables()/mergeTables() expect. */
export async function fetchMultipleSheets(
  docs: { url: string; name: string }[]
): Promise<FetchedTable[]> {
  return Promise.all(
    docs.map(async (doc) => {
      const { rows, columns } = await fetchSheetAsRows(doc.url);
      return { fileName: doc.name, columns, rows };
    })
  );
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
export async function fetchSheetAsRows(sheetUrl: string, tabTitle?: string): Promise<ParsedSheet> {
  const token = getCachedAccessToken() ?? (await tryServerSideTokenRefresh());
  const id = extractSheetId(sheetUrl);

  if (token && id) {
    // No row cap: specifying the sheet/tab name alone (no row bound) tells
    // the Sheets API to return every row it has, not just the first N.
    const range = tabTitle ? `'${tabTitle}'!A:ZZ` : "A:ZZ";
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(range)}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );
    if (res.ok) {
      const data = await res.json();
      return rowsFromValues(data.values ?? []);
    }
    // If the authenticated call fails (e.g. token expired), fall through to
    // the public CSV path below rather than failing outright.
  }

  // `cache: "no-store"` stops the browser itself from ever answering this
  // fetch out of its own HTTP cache. That alone isn't always enough, though:
  // Google's export endpoint is also known to sometimes hand back a
  // just-slightly-stale rendered snapshot for the *same exact URL* (its own
  // server/CDN-side caching, not the browser's) — a fresh edit in the sheet
  // can take a little while to show up if you keep asking for that one
  // identical URL. Appending a throwaway, always-different query param
  // forces it to be treated as a distinct request each time, which is the
  // standard workaround and is what actually fixes "refresh brings back an
  // older version than what I just changed."
  const csvUrl = `${toCsvUrl(sheetUrl)}&_cb=${Date.now()}`;
  const res = await fetch(csvUrl, { cache: "no-store" });
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
