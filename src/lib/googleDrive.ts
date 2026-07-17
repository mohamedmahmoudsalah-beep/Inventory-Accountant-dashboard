// Real Google Drive/Sheets integration using Google Identity Services (GIS)
// for OAuth and the Google Picker API to browse the user's Drive.
//
// This REQUIRES a one-time setup in Google Cloud Console (free). See
// README.md → "Setting up real Google Drive access" for the exact steps.
// Until you add your own Client ID + API key below (or via .env, see below),
// the "Browse from Drive" button will show a setup reminder instead of
// crashing the app.

declare global {
  interface Window {
    google: any;
    gapi: any;
  }
}

// Put your own values in a .env file (see .env.example) — never hard-code
// real credentials directly in source if this repo will be public.
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";
export const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY ?? "";

// Only this Google account is allowed to connect Drive/Sheets. Anyone else
// who signs in gets rejected before the picker ever opens.
export const ALLOWED_DRIVE_EMAIL = "mohamed.mahmoudsalah@breadfast.com";

const SCOPES =
  "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email";

let gisLoaded = false;
let pickerLoaded = false;
let tokenClient: any = null;
let accessToken: string | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(script);
  });
}

export function isGoogleDriveConfigured() {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_API_KEY);
}

/** The current OAuth access token, if the user has already authenticated this session. */
export function getCachedAccessToken(): string | null {
  return accessToken;
}

async function ensureGisLoaded() {
  if (gisLoaded) return;
  await loadScript("https://accounts.google.com/gsi/client");
  gisLoaded = true;
}

async function ensurePickerLoaded() {
  if (pickerLoaded) return;
  await loadScript("https://apis.google.com/js/api.js");
  await new Promise<void>((resolve) => {
    window.gapi.load("picker", () => resolve());
  });
  pickerLoaded = true;
}

async function verifySignedInEmail(token: string): Promise<string> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Couldn't verify the signed-in Google account.");
  const info = await res.json();
  return (info.email as string) ?? "";
}

async function getAccessToken(forceAccountPicker = false): Promise<string> {
  await ensureGisLoaded();
  if (accessToken && !forceAccountPicker) return accessToken;

  const token = await new Promise<string>((resolve, reject) => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: (resp: any) => {
        if (resp.error) return reject(new Error(resp.error));
        resolve(resp.access_token);
      },
    });
    tokenClient.requestAccessToken({
      prompt: forceAccountPicker ? "select_account" : "",
    });
  });

  const email = await verifySignedInEmail(token);
  if (email.toLowerCase() !== ALLOWED_DRIVE_EMAIL.toLowerCase()) {
    // Revoke this token immediately - we don't want to hold access to the
    // wrong account at all, even in memory.
    window.google.accounts.oauth2.revoke(token, () => {});
    throw new Error(
      `WRONG_ACCOUNT:${email || "unknown account"}`
    );
  }

  accessToken = token;
  return token;
}

/**
 * Opens Google's file picker scoped to the signed-in user's own Drive.
 * Resolves with the picked file's webViewLink (a normal Sheets URL), which
 * plugs straight into the existing fetchSheetAsRows() CSV export logic.
 */
export async function pickGoogleSheet(): Promise<{ url: string; name: string } | null> {
  if (!isGoogleDriveConfigured()) {
    throw new Error("MISSING_CONFIG");
  }

  const token = await getAccessToken(true);
  await ensurePickerLoaded();

  return new Promise((resolve) => {
    const view = new window.google.picker.DocsView(window.google.picker.ViewId.SPREADSHEETS)
      .setMimeTypes("application/vnd.google-apps.spreadsheet")
      .setMode(window.google.picker.DocsViewMode.LIST);

    const picker = new window.google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(token)
      .setDeveloperKey(GOOGLE_API_KEY)
      .setCallback((data: any) => {
        if (data.action === window.google.picker.Action.PICKED) {
          const doc = data.docs[0];
          resolve({ url: doc.url, name: doc.name });
        } else if (data.action === window.google.picker.Action.CANCEL) {
          resolve(null);
        }
      })
      .build();

    picker.setVisible(true);
  });
}
