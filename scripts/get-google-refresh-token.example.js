// ONE-TIME local helper — you run this yourself, on your own machine, not on
// Vercel. It signs you into Google once (as mohamed.mahmoudsalah@breadfast.com,
// the one account "Browse from Drive" is locked to), and prints a refresh
// token you paste into Vercel's environment variables. After that, the
// server-side cron (api/cron-refresh-sheets.js) can silently exchange that
// refresh token for a fresh access token on every run, forever — no browser,
// no re-login, no expiry from normal use.
//
// Rename this file to drop ".example" before running it.
//
// Setup (5 minutes, once):
//   1. Google Cloud Console -> APIs & Services -> Credentials -> your
//      existing OAuth 2.0 Client ID (the same one VITE_GOOGLE_CLIENT_ID
//      points at). Open it and copy its "Client secret" too — web-app OAuth
//      clients always have one, even though the browser sign-in flow this
//      app normally uses (Google Identity Services token flow) never needed
//      it until now.
//   2. On that same client's edit page, add this to "Authorized redirect
//      URIs": http://localhost:53682/callback
//      (You can remove it again after this script finishes.)
//   3. Run:
//        GOOGLE_CLIENT_ID=xxx GOOGLE_CLIENT_SECRET=xxx node scripts/get-google-refresh-token.js
//   4. It prints a URL — open it in a browser where you're signed into
//      mohamed.mahmoudsalah@breadfast.com, and approve access. You'll be
//      redirected to localhost, which this script is temporarily listening
//      on; it'll pick up the authorization code automatically.
//   5. It prints "GOOGLE_REFRESH_TOKEN=...". Copy that whole value into
//      Vercel's Environment Variables, alongside GOOGLE_CLIENT_ID and
//      GOOGLE_CLIENT_SECRET from step 1.
//
// Note: if your Google Cloud project's OAuth consent screen is still in
// "Testing" mode (not "Published"), Google expires refresh tokens after 7
// days of testing-mode use. Either publish the consent screen (fine for an
// internal-only app — choose "Internal" user type if this is a Google
// Workspace domain), or add mohamed.mahmoudsalah@breadfast.com as a listed
// test user, which avoids the 7-day expiry for that account specifically.

import { createServer } from "node:http";
import { URL } from "node:url";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = "http://localhost:53682/callback";
const SCOPE = "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars first — see the comment at the top of this file.");
  process.exit(1);
}

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", CLIENT_ID);
authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", SCOPE);
authUrl.searchParams.set("access_type", "offline"); // required to get a refresh token at all
authUrl.searchParams.set("prompt", "consent"); // required to get one even on a repeat authorization

console.log("\nOpen this URL in a browser signed into mohamed.mahmoudsalah@breadfast.com, then approve access:\n");
console.log(authUrl.toString());
console.log("\nWaiting for the redirect back to localhost...\n");

const server = createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  if (url.pathname !== "/callback") {
    res.writeHead(404).end();
    return;
  }
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  if (error) {
    res.writeHead(400, { "Content-Type": "text/plain" }).end(`Google returned an error: ${error}`);
    console.error(`Google returned an error: ${error}`);
    server.close();
    process.exit(1);
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: REDIRECT_URI,
      }),
    });
    const data = await tokenRes.json();

    if (!tokenRes.ok || !data.refresh_token) {
      res.writeHead(500, { "Content-Type": "text/plain" }).end(
        "Didn't get a refresh token back. If you've authorized this app before, revoke its access at https://myaccount.google.com/permissions and try again (Google only issues a refresh token the first time, unless prompt=consent forces it — which this script already sets)."
      );
      console.error("Token exchange response:", data);
      server.close();
      process.exit(1);
    }

    // Confirm this really is the intended account before printing anything.
    const emailRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    const emailInfo = await emailRes.json();

    res.writeHead(200, { "Content-Type": "text/plain" }).end("Done — check your terminal, then close this tab.");

    console.log(`Signed in as: ${emailInfo.email}\n`);
    console.log("Add these to Vercel's Environment Variables:\n");
    console.log(`GOOGLE_CLIENT_ID=${CLIENT_ID}`);
    console.log(`GOOGLE_CLIENT_SECRET=${CLIENT_SECRET}`);
    console.log(`GOOGLE_REFRESH_TOKEN=${data.refresh_token}\n`);
  } catch (e) {
    res.writeHead(500, { "Content-Type": "text/plain" }).end("Something went wrong — check your terminal.");
    console.error(e);
  } finally {
    server.close();
    process.exit(0);
  }
});

server.listen(53682);
