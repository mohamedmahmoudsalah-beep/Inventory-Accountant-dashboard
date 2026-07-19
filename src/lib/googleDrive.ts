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

const SESSION_KEY = "breadfast-gdrive-token-v1";

let gisLoaded = false;
let pickerLoaded = false;
let tokenClient: any = null;
let accessToken: string | null = null;
let tokenExpiresAt = 0;

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

// Restore a still-valid token from this browser tab's sessionStorage, so a
// page reload doesn't force signing in again every time (it still won't
// survive closing the tab, and it's revalidated against ALLOWED_DRIVE_EMAIL
// again the next time a token is actually needed).
try {
  const cached = sessionStorage.getItem(SESSION_KEY);
  if (cached) {
    const parsed = JSON.parse(cached) as { token: string; expiresAt: number };
    if (parsed.expiresAt > Date.now()) {
      accessToken = parsed.token;
      tokenExpiresAt = parsed.expiresAt;
    }
  }
} catch {
  // ignore corrupt/inaccessible sessionStorage
}

function cacheToken(token: string, expiresInSeconds: number) {
  accessToken = token;
  tokenExpiresAt = Date.now() + expiresInSeconds * 1000;
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token, expiresAt: tokenExpiresAt }));
  } catch {
    // ignore
  }
}

/** The current OAuth access token, if the user has already authenticated this session. */
export function getCachedAccessToken(): string | null {
  if (accessToken && tokenExpiresAt > Date.now()) return accessToken;
  return null;
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
  const cached = getCachedAccessToken();
  if (cached && !forceAccountPicker) return cached;

  const resp = await new Promise<{ access_token: string; expires_in?: number }>((resolve, reject) => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: (r: any) => {
        if (r.error) return reject(new Error(r.error));
        resolve(r);
      },
    });
    tokenClient.requestAccessToken({
      prompt: forceAccountPicker ? "select_account" : "",
    });
  });

  const email = await verifySignedInEmail(resp.access_token);
  if (email.toLowerCase() !== ALLOWED_DRIVE_EMAIL.toLowerCase()) {
    // Revoke this token immediately - we don't want to hold access to the
    // wrong account at all, even in memory.
    window.google.accounts.oauth2.revoke(resp.access_token, () => {});
    throw new Error(`WRONG_ACCOUNT:${email || "unknown account"}`);
  }

  cacheToken(resp.access_token, resp.expires_in ?? 3600);
  return resp.access_token;
}

function buildPicker(token: string, multiSelect: boolean): Promise<{ url: string; name: string }[] | null> {
  return new Promise((resolve) => {
    const view = new window.google.picker.DocsView(window.google.picker.ViewId.SPREADSHEETS)
      .setMimeTypes("application/vnd.google-apps.spreadsheet")
      .setMode(window.google.picker.DocsViewMode.LIST);

    let builder = new window.google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(token)
      .setDeveloperKey(GOOGLE_API_KEY);

    if (multiSelect) {
      builder = builder.enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED);
    }

    const picker = builder
      .setCallback((data: any) => {
        if (data.action === window.google.picker.Action.PICKED) {
          resolve(data.docs.map((doc: any) => ({ url: doc.url, name: doc.name })));
        } else if (data.action === window.google.picker.Action.CANCEL) {
          resolve(null);
        }
      })
      .build();

    picker.setVisible(true);
  });
}

/** Opens Google's file picker scoped to the signed-in user's own Drive, single file. */
export async function pickGoogleSheet(): Promise<{ url: string; name: string } | null> {
  if (!isGoogleDriveConfigured()) throw new Error("MISSING_CONFIG");
  const token = await getAccessToken(false);
  await ensurePickerLoaded();
  const picked = await buildPicker(token, false);
  return picked ? picked[0] : null;
}

/** Same as pickGoogleSheet, but lets the user select several spreadsheets at once. */
export async function pickGoogleSheets(): Promise<{ url: string; name: string }[] | null> {
  if (!isGoogleDriveConfigured()) throw new Error("MISSING_CONFIG");
  const token = await getAccessToken(false);
  await ensurePickerLoaded();
  return buildPicker(token, true);
}

export interface SheetTab {
  title: string;
  sheetId: number;
}

/** Lists the tab (worksheet) names inside a spreadsheet, so the user can pick one. */
export async function listSheetTabs(spreadsheetId: string): Promise<SheetTab[]> {
  const token = getCachedAccessToken();
  if (!token) throw new Error("Not signed in to Google Drive yet.");

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Couldn't read this spreadsheet's tabs (status ${res.status}).`);
  const data = await res.json();
  return (data.sheets ?? []).map((s: any) => ({
    title: s.properties.title as string,
    sheetId: s.properties.sheetId as number,
  }));
}
