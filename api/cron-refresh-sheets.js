// EXAMPLE serverless cron function for Vercel.
//
// Why this exists: without it, "refreshing the data" only happens from
// inside someone's open browser tab (a manual click, or the app's own
// weekly background sync while the Admin's tab happens to be open at that
// exact moment). If the Admin doesn't have the dashboard open then, nothing
// refreshes and everyone just sees whatever was last fetched. This function
// does the same refresh, but triggered by Vercel's own cron scheduler on
// the server, so it runs on a real, dependable clock — no browser needed at
// all. Anyone who wants fresher data in between (daily, or right now) still
// has the in-app "Refresh data" button for that — this cron is just the
// automatic weekly baseline, not the only way to refresh.
//
// Setup:
//   1. Rename this file to `cron-refresh-sheets.js` (Vercel auto-detects
//      files in /api).
//   2. In your Vercel project settings, add these environment variables:
//        SUPABASE_URL              = https://your-project-ref.supabase.co
//        SUPABASE_SERVICE_ROLE_KEY = (Settings -> API -> service_role key —
//                                     NOT the anon key. This key bypasses
//                                     row-level security, which is exactly
//                                     what a trusted server-side cron job
//                                     needs and a public anon key doesn't
//                                     get. Never expose this key to the
//                                     browser/frontend.)
//        CRON_SECRET               = any long random string you make up.
//   3. Make sure vercel.json (already in the repo root) has a "crons" entry
//      pointing at "/api/cron-refresh-sheets".
//
//      Scheduled for once a week — Sunday at 12:00 noon, Cairo time —
//      matching the app's own client-side weekly sync. Vercel's free
//      "Hobby" tier (which this project runs on) only allows cron jobs to
//      fire at most once a day, so a weekly schedule easily fits that; it
//      also only guarantees it'll fire *sometime within* that hour on
//      Hobby, not at the exact minute.
//
//      IMPORTANT — Cairo time and UTC (what Vercel's cron actually runs on)
//      aren't a fixed offset: Egypt observes Daylight Saving Time (EEST,
//      UTC+3) from late April to late October, and Standard Time (EET,
//      UTC+2) the rest of the year. vercel.json's "0 9 * * 0" is set for
//      the UTC+3 half of the year (9:00 UTC = 12:00 noon Cairo). Once Egypt
//      switches back to Standard Time (~late October), change it to
//      "0 10 * * 0" (10:00 UTC = 12:00 noon Cairo) to keep firing at noon
//      local time — and back to "0 9 * * 0" the following April.
//   4. Deploy. Vercel will call this endpoint on its own from then on; you
//      don't need to do anything else, and nobody needs to keep a tab open.
//
// IMPORTANT LIMITATION → mostly lifted, if you do the optional Drive setup
// below: pages connected via a public "Anyone with the link can view" link
// (sourceType: "csv-link") are always refreshed by this cron with no extra
// setup. Pages connected via "Browse from Drive" (sourceType: "drive",
// private sheets) need one extra one-time setup step, because a server has
// no browser session to hold a Google access token — see "Optional: also
// refreshing private Drive sheets" below. Skip that section entirely and
// this still works fine for csv-link pages; drive pages will just keep
// refreshing only from an open browser tab, same as before.
//
// ---------------------------------------------------------------------
// Optional: also refreshing private Drive sheets
// ---------------------------------------------------------------------
// This app already locks "Browse from Drive" to a single fixed account
// (ALLOWED_DRIVE_EMAIL in src/lib/googleDrive.ts — currently
// mohamed.mahmoudsalah@breadfast.com). Because it's always that one
// account, you can authorize it ONCE and let the server reuse that
// authorization indefinitely via a Google OAuth "refresh token", instead of
// needing a live browser session every time.
//
//   1. In Google Cloud Console, open the SAME OAuth client you already
//      created for VITE_GOOGLE_CLIENT_ID (APIs & Services -> Credentials).
//      Web-application OAuth clients always have a client secret too, even
//      though the browser-side sign-in flow this app uses doesn't need it
//      — click into the client and copy that secret.
//   2. Add `http://localhost:53682/callback` to that client's "Authorized
//      redirect URIs" (you can remove it again afterwards; it's only used
//      for the one-time step below).
//   3. Run this once, from your own machine, signed into
//      mohamed.mahmoudsalah@breadfast.com in your browser:
//        GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... node scripts/get-google-refresh-token.example.js
//      (rename that script to drop ".example" first). It opens a consent
//      screen, you approve it as that one account, and it prints a
//      refresh token straight to your terminal.
//   4. Add these three to Vercel's Environment Variables (server-only —
//      don't prefix them VITE_, or they'd ship to the browser):
//        GOOGLE_CLIENT_ID     = same client ID as VITE_GOOGLE_CLIENT_ID
//        GOOGLE_CLIENT_SECRET = from step 1
//        GOOGLE_REFRESH_TOKEN = printed in step 3
//   5. Redeploy. From then on this cron also refreshes source_type="drive"
//      pages, using a fresh access token it silently exchanges for at the
//      start of each run — nobody needs to be signed in anywhere.
//
// If any of those three env vars are missing, drive-sourced pages are just
// skipped (logged, not treated as an error) — csv-link pages are
// unaffected either way.

import { createClient } from "@supabase/supabase-js";
import Papa from "papaparse";
import { randomUUID } from "node:crypto";

function extractSheetId(sheetUrl) {
  const idMatch = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return idMatch ? idMatch[1] : null;
}

function toCsvUrl(sheetUrl) {
  const id = extractSheetId(sheetUrl);
  if (!id) return sheetUrl; // assume it's already a direct CSV export URL
  const gidMatch = sheetUrl.match(/[#&?]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : "0";
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}

async function fetchCsvSheetAsRows(sheetUrl) {
  // See src/lib/sheets.ts for why: Google's export endpoint can hand back a
  // slightly-stale snapshot for the exact same URL, so every call appends a
  // throwaway cache-busting param and disables any HTTP caching.
  const csvUrl = `${toCsvUrl(sheetUrl)}&_cb=${Date.now()}`;
  const res = await fetch(csvUrl, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Sheet fetch failed (status ${res.status}) — is it still shared as "Anyone with the link can view"?`);
  }
  const csvText = await res.text();
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  });
  const columns = parsed.meta.fields ?? [];
  const rows = parsed.data.filter((r) => Object.values(r).some((v) => v !== "" && v !== null && v !== undefined));
  return { rows, columns };
}

// Mirrors src/lib/sheets.ts's rowsFromValues exactly (2D values array ->
// typed rows), duplicated here since this file runs outside the app bundle.
function rowsFromValues(values) {
  const [header, ...rest] = values;
  const columns = header ?? [];
  const rows = rest
    .filter((r) => r.some((cell) => cell !== "" && cell !== undefined))
    .map((r) => {
      const row = {};
      columns.forEach((col, i) => {
        const raw = r[i];
        const num = Number(raw);
        row[col] = raw !== "" && raw !== undefined && !isNaN(num) && String(raw).trim() !== "" ? num : raw ?? "";
      });
      return row;
    });
  return { rows, columns };
}

let cachedAccessToken = null;
let cachedAccessTokenExpiresAt = 0;

/** Exchanges the long-lived stored refresh token for a short-lived access
 *  token. Refresh tokens don't expire from use (only if revoked, unused for
 *  6 months, or the Google Cloud project's OAuth consent screen is still in
 *  "Testing" mode, where they expire after 7 days — publish the consent
 *  screen, or add the account as a "test user", to avoid that). */
async function getDriveAccessToken() {
  if (cachedAccessToken && cachedAccessTokenExpiresAt > Date.now()) return cachedAccessToken;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`Couldn't refresh the Google Drive access token (status ${res.status}). Is GOOGLE_REFRESH_TOKEN still valid?`);
  }
  const data = await res.json();
  cachedAccessToken = data.access_token;
  cachedAccessTokenExpiresAt = Date.now() + (data.expires_in ?? 3600) * 1000 - 30_000; // 30s safety margin
  return cachedAccessToken;
}

async function fetchDriveSheetAsRows(sheetUrl, tabTitle) {
  const accessToken = await getDriveAccessToken();
  if (!accessToken) return null; // Drive OAuth env vars not configured — caller skips this page
  const id = extractSheetId(sheetUrl);
  if (!id) throw new Error("Couldn't parse a spreadsheet ID out of this URL.");
  const range = tabTitle ? `'${tabTitle}'!A:ZZ` : "A:ZZ";
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }
  );
  if (!res.ok) {
    throw new Error(`Sheets API fetch failed (status ${res.status}) for spreadsheet ${id}.`);
  }
  const data = await res.json();
  return rowsFromValues(data.values ?? []);
}

// Mirrors src/lib/rowIds.ts's ROW_ID_KEY/stampRowIds exactly — kept as a
// tiny standalone copy here since this function runs outside the Vite/TS
// build, on plain Node, and the key name has to match or the app's
// row-editing code (which looks rows up by this key) won't find them.
const ROW_ID_KEY = "__rid";
function stampRowIds(rows) {
  return rows.map((row) => ({ ...row, [ROW_ID_KEY]: randomUUID() }));
}

// Mirrors src/lib/remoteDb.ts's chunkRows exactly — a page's rows are
// stored across many small chunks (one row per chunk in page_row_chunks),
// not one giant value, so no single write request ever needs to hold more
// than a small slice of the data regardless of total sheet size.
const MAX_CHUNK_ROWS = 3000;
const MAX_CHUNK_BYTES = 500_000;
function chunkRows(rows) {
  if (rows.length === 0) return [];
  const chunks = [];
  let current = [];
  let currentBytes = 0;
  for (const row of rows) {
    const rowBytes = JSON.stringify(row).length;
    if (current.length > 0 && (current.length >= MAX_CHUNK_ROWS || currentBytes + rowBytes > MAX_CHUNK_BYTES)) {
      chunks.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(row);
    currentBytes += rowBytes;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

// Mirrors src/lib/remoteDb.ts's toColumnarChunk exactly — stores a chunk's
// column names once, and each row as a plain value-array in that same
// order, instead of repeating every column name on every row object. For a
// wide sheet with thousands of rows this cuts a meaningful share of the
// actual bytes moved on every future read (which is most of what "egress"
// usage in Supabase's dashboard is counting).
function toColumnarChunk(rows) {
  const colSet = new Set();
  for (const row of rows) for (const key of Object.keys(row)) colSet.add(key);
  const cols = Array.from(colSet);
  return { cols, rows: rows.map((row) => cols.map((c) => (row[c] === undefined ? "" : row[c]))) };
}

async function saveRowsChunked(supabase, pageId, rows) {
  const chunks = chunkRows(rows);
  for (let i = 0; i < chunks.length; i++) {
    const { error } = await supabase
      .from("page_row_chunks")
      .upsert({ page_id: pageId, chunk_index: i, data: toColumnarChunk(chunks[i]) });
    if (error) throw error;
  }
  const { error: cleanupError } = await supabase
    .from("page_row_chunks")
    .delete()
    .eq("page_id", pageId)
    .gte("chunk_index", chunks.length);
  if (cleanupError) throw cleanupError;
}

export default async function handler(req, res) {
  // Vercel automatically sends this header on scheduled invocations when
  // CRON_SECRET is set, which stops anyone else from hitting this URL and
  // forcing refreshes (or running up your Google/Supabase usage) on demand.
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured" });
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: pages, error: fetchError } = await supabase
    .from("pages")
    .select("id, sheet_url, sheet_tab_title, source_type")
    .not("sheet_url", "is", null)
    .in("source_type", ["csv-link", "drive"]);

  if (fetchError) {
    console.error("cron-refresh-sheets: couldn't list pages", fetchError);
    return res.status(500).json({ error: fetchError.message });
  }

  const results = [];
  for (const page of pages ?? []) {
    if (!page.sheet_url) continue;
    try {
      let parsed;
      if (page.source_type === "drive") {
        parsed = await fetchDriveSheetAsRows(page.sheet_url, page.sheet_tab_title);
        if (!parsed) {
          results.push({ pageId: page.id, status: "skipped", reason: "Drive OAuth env vars not configured — see the setup notes at the top of this file" });
          continue;
        }
      } else {
        parsed = await fetchCsvSheetAsRows(page.sheet_url);
      }
      const stampedRows = stampRowIds(parsed.rows);
      const { error: updateError } = await supabase
        .from("pages")
        .update({ columns: parsed.columns, last_updated: new Date().toISOString() })
        .eq("id", page.id);
      if (updateError) throw updateError;
      await saveRowsChunked(supabase, page.id, stampedRows);
      results.push({ pageId: page.id, status: "ok", rowCount: stampedRows.length });
    } catch (e) {
      console.warn(`cron-refresh-sheets: failed for page ${page.id}`, e);
      results.push({ pageId: page.id, status: "error", error: e instanceof Error ? e.message : String(e) });
    }
  }

  return res.status(200).json({ refreshed: results.length, results });
}
