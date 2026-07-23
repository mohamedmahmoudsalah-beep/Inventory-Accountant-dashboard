// EXAMPLE serverless cron function for Vercel.
//
// Why this exists: without it, "refreshing the data" only happens from
// inside someone's open browser tab (a manual click, or the app's own
// hourly setInterval while an Admin/Manager tab happens to be open). If
// nobody has the dashboard open at the top of the hour, nothing refreshes
// and everyone just sees whatever was last fetched — sometimes described as
// "even the Admin doesn't get the latest data without a manual refresh."
// This function does the same refresh, but triggered by Vercel's own cron
// scheduler on the server, so it runs on a real, dependable clock —no
// browser needed at all.
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
//      IMPORTANT — Vercel's free "Hobby" tier (which this project runs on)
//      only allows cron jobs to fire ONCE PER DAY. An hourly expression like
//      "0 * * * *" will fail at deploy time on Hobby with an error like
//      "Hobby accounts are limited to daily cron jobs." vercel.json in this
//      repo is set to "0 3 * * *" (once a day, ~3am UTC) to match that
//      limit. Vercel also only guarantees it'll fire *sometime within* that
//      hour on Hobby, not at the exact minute.
//      If you upgrade to Vercel Pro, you can change the schedule to
//      "0 * * * *" for a real hourly refresh (matching the app's existing
//      client-side hourly cadence) — that's the only line to change.
//   4. Deploy. Vercel will call this endpoint on its own from then on; you
//      don't need to do anything else, and nobody needs to keep a tab open.
//
// IMPORTANT LIMITATION: this can only refresh pages connected via a public
// "Anyone with the link can view" Google Sheets link (sourceType:
// "csv-link"). Pages connected via "Browse from Drive" (sourceType:
// "drive", private/OAuth-only sheets) can't be refreshed from a server with
// no logged-in user — there's no browser session here to hold a Google
// access token. Those pages still only refresh when an Admin/Manager has
// the app open (manually, or via the existing client-side hourly sync). If
// you want a private sheet to also benefit from this server-side cron,
// switch its sharing setting to "Anyone with the link can view" and
// reconnect it in the app as a pasted link instead of via Drive browsing.

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

async function fetchSheetAsRows(sheetUrl) {
  const csvUrl = toCsvUrl(sheetUrl);
  const res = await fetch(csvUrl);
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

// Mirrors src/lib/rowIds.ts's ROW_ID_KEY/stampRowIds exactly — kept as a
// tiny standalone copy here since this function runs outside the Vite/TS
// build, on plain Node, and the key name has to match or the app's
// row-editing code (which looks rows up by this key) won't find them.
const ROW_ID_KEY = "__rid";
function stampRowIds(rows) {
  return rows.map((row) => ({ ...row, [ROW_ID_KEY]: randomUUID() }));
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
    .eq("source_type", "csv-link"); // see the "IMPORTANT LIMITATION" note above

  if (fetchError) {
    console.error("cron-refresh-sheets: couldn't list pages", fetchError);
    return res.status(500).json({ error: fetchError.message });
  }

  const results = [];
  for (const page of pages ?? []) {
    if (!page.sheet_url) continue;
    try {
      const { rows, columns } = await fetchSheetAsRows(page.sheet_url);
      const stampedRows = stampRowIds(rows);
      const { error: updateError } = await supabase
        .from("pages")
        .update({ rows: stampedRows, columns, last_updated: new Date().toISOString() })
        .eq("id", page.id);
      if (updateError) throw updateError;
      results.push({ pageId: page.id, status: "ok", rowCount: stampedRows.length });
    } catch (e) {
      console.warn(`cron-refresh-sheets: failed for page ${page.id}`, e);
      results.push({ pageId: page.id, status: "error", error: e instanceof Error ? e.message : String(e) });
    }
  }

  return res.status(200).json({ refreshed: results.length, results });
}
