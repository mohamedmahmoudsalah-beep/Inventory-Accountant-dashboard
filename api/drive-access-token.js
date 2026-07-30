// EXAMPLE serverless function for Vercel: lets the signed-in Admin's BROWSER
// silently get a fresh Google Drive/Sheets access token without ever seeing
// the Google sign-in popup again — using the same long-lived refresh token
// already set up for the data-refresh cron (api/cron-refresh-sheets.example.js).
//
// Why this exists: the in-app "Browse from Drive"/"Refresh data" flow
// normally uses a short-lived (~1 hour) OAuth token obtained through an
// interactive Google popup, cached only in that browser tab's
// sessionStorage — so closing the browser, or the hour running out, means
// clicking through the Google sign-in popup again just to refresh data you
// already connected. Since only one fixed account
// (mohamed.mahmoudsalah@breadfast.com) is allowed to connect/refresh data
// sources at all, that account can instead rely on this endpoint, which
// mints a fresh access token on demand from a refresh token that (unlike
// the short-lived access token) doesn't expire on its own — no popup, ever,
// after the one-time setup below.
//
// Setup (skip this if you already did it for the data-refresh cron — it's
// the exact same three env vars, reused here):
//   1. Rename this file to `drive-access-token.js` (drop ".example").
//   2. If you haven't already, follow README.md → "Setting up server-side
//      data refresh" to get GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and
//      GOOGLE_REFRESH_TOKEN — the one-time script is
//      `scripts/get-google-refresh-token.example.js`.
//   3. Make sure those three, plus SUPABASE_URL and
//      SUPABASE_SERVICE_ROLE_KEY, are set in Vercel's Environment Variables
//      (same place as the cron's variables).
//   4. Deploy. From then on, the Admin's browser fetches a fresh token from
//      here automatically whenever it needs one — the interactive Google
//      popup is only needed the very first time (to run the one-time
//      script), never again after that.
//
// Security note: this hands back a real Google OAuth access token scoped to
// the Admin's own Drive/Sheets — NOT a token anyone can request. Every call
// is checked against the actual signed-in Supabase session first (below),
// and rejected unless that session belongs to the one allowed email.

import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  const jwt = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!jwt) return res.status(401).json({ error: "Missing Authorization bearer token (sign in first)." });

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured." });
  }

  // Verifying the JWT server-side (rather than trusting whatever email the
  // browser claims) is what makes this endpoint safe to expose at all.
  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
  if (userError || !userData?.user?.email) {
    return res.status(401).json({ error: "Invalid or expired session." });
  }

  const email = userData.user.email.toLowerCase();
  const allowedEmail = (process.env.SINGLE_DRIVE_ADMIN_EMAIL ?? "mohamed.mahmoudsalah@breadfast.com").toLowerCase();
  if (email !== allowedEmail) {
    return res.status(403).json({ error: "This endpoint is limited to the single Drive-connected admin account." });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    // Not configured yet — the frontend treats this as "fall back to the
    // old interactive popup flow," so nothing breaks, it just doesn't get
    // the "never reconnect" benefit until this is set up.
    return res.status(501).json({ error: "Server-side Drive token refresh isn't set up yet." });
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    console.error("drive-access-token: Google refresh failed", errText);
    return res.status(502).json({ error: `Google token refresh failed: ${errText}` });
  }

  const data = await tokenRes.json();
  return res.status(200).json({ access_token: data.access_token, expires_in: data.expires_in ?? 3600 });
}
