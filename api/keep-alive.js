// EXAMPLE serverless "keep-alive" endpoint for Vercel.
//
// Why this exists: Supabase's free tier automatically pauses a project
// after a period of inactivity (roughly a week with no API requests). The
// first request after that can take 10-30+ seconds to wake back up, which
// is what shows up in the app as "opens to an empty page, works fine a
// moment later." Pinging the app's own frontend URL does NOT prevent this —
// that just serves static files from Vercel and never actually touches
// Supabase. This endpoint exists specifically to be pinged instead: it runs
// a real (tiny, free) Supabase query, which is what actually counts as
// "activity" and resets the inactivity clock.
//
// Setup:
//   1. Rename this file to `keep-alive.js` (Vercel auto-detects files in /api).
//   2. Make sure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are already set
//      in Vercel's Environment Variables (same ones used by
//      cron-refresh-sheets.js, if you set that up — otherwise see README
//      "Setting up server-side data refresh" for where to get them).
//   3. Deploy. Your endpoint is now:
//        https://your-app.vercel.app/api/keep-alive
//   4. Point an external uptime pinger (UptimeRobot, etc.) at that exact
//      URL — see the README section on this for the click-by-click steps.
//
// This has no CRON_SECRET check (unlike cron-refresh-sheets.js) since it
// only ever runs a harmless read-only query — there's nothing sensitive to
// protect here, and it needs to be simple enough for a plain HTTP monitor
// (no custom headers) to hit successfully.

import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured" });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { error } = await supabase.from("teams").select("id").limit(1);

  if (error) {
    console.error("keep-alive: Supabase query failed", error);
    return res.status(500).json({ ok: false, error: error.message });
  }
  return res.status(200).json({ ok: true, checkedAt: new Date().toISOString() });
}
