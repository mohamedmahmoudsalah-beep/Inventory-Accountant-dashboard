# Breadfast Insights

A Power BI–style dashboard for your team: each **team** (department) can have several **task pages**, each with its own connected Google Sheet, charts (bar/line/area/pie/scatter/radar), pivot tables, a searchable table, filters (including date ranges), one-click Excel export, and an AI assistant.

## What's new in this update

**Critical fixes (please re-run the SQL note below if you use shared storage):**
- Fixed a race condition where a slow initial page load could silently overwrite newer changes that had just arrived live from another device — this was the main cause of "my edits disappeared."
- Fixed a bug where a brief network hiccup while loading the shared user list could wipe it down to zero locally, locking out everyone — including admins — until a refresh happened to land at the right time.
- Fixed realtime sync not actually delivering the changed data to other devices (Postgres needs `replica identity full` on the shared tables — see the updated SQL below).
- Fixed chart/widget resize not working — widgets were sitting inside a CSS grid, which fights manual resizing; they're now in a layout that resizes properly.
- Fixed Treemap rendering every cell in the same solid color — it's now sorted largest → smallest with a distinct color per cell.

**New:**
- **Cross-filtering**: click a bar or pie slice to filter the rest of the page by that category (click again to clear it) — closer to how Power BI's cross-filtering works.
- **Auto refresh**: a checkbox next to "Refresh data" pulls the connected sheet automatically every 60 seconds.
- **Tab name field** when pasting a sheet link directly (works once you've signed into "Browse from Drive" at least once in that session).
- Softened both the dark and light theme's contrast — dark was too close to pure black, light too close to pure white.
- Calculated-column help text now reads more like familiar Excel formulas, with worked examples — and you can always just describe what you want in plain language in chat and ask for the exact formula.

**Bug fixes:**
- Fixed a real bug where numbers with thousands separators (e.g. `259,022,315`) were silently read as 0 in charts/pivots — now parsed correctly.
- Fixed a hard 20,000-row cap when reading a Google Sheet — the app now pulls the entire sheet/tab, no matter how large.
- Fixed the AI assistant's example serverless function using an invalid model name, which made every request fail.

**New widgets:** Matrix (true row × column crosstab), Card (single KPI number), Text & Image (freeform notes/images), Treemap chart type. Charts also have a "Show values" toggle to print numbers directly on bars/lines/areas.

**Pivot tables leveled up:** unlimited group-by columns (not just 2), multiple value columns per pivot, sortable column headers, and all the configuration now lives behind an "Edit" button instead of cluttering the widget.

**Measures & calculated columns:** open "Data model" (top bar) to add calculated columns (Excel-like formulas, e.g. `IF(region == "Cairo", revenue * 1.1, revenue)`) and Measures (reusable, optionally conditional aggregations, like a simple SUMIF) — both become selectable wherever a value column is picked (Pivot, Matrix, Card).

**Team/page management:** new teams and pages start empty (no more sample data) — Admins and Managers can rename or delete any team/page from the sidebar.

**Data table:** each column now shows a detected type (number/date/text); Admins/Managers can click any raw cell to edit it directly (calculated columns are shown but not editable, marked with a small ƒ).

**UI:** the sidebar can now collapse to icons-only for more screen space; added a Dark/Light mode toggle; renamed the app to "General Report Inventory Accountant team".

- **Data persists across reloads** — teams, pages, charts, pivots, and filters are saved to your browser's local storage automatically.
- **Google Drive sign-in is cached for the session** — you won't be asked to sign in again on every page reload (it still expires after about an hour, or if you close the tab, since access tokens shouldn't live forever).
- **Pick a specific tab** when connecting a spreadsheet via "Browse from Drive" — if it has more than one tab, you'll be asked which one to load.
- **Combine online sheets** — a new button lets you multi-select several Google Sheets from Drive and stack their rows into one table (same idea as the file-based "Append", but without downloading anything first).
- **Data Sources page** — a new sidebar item showing, for every team and page, exactly where its data comes from (Drive / pasted link / uploaded file) and when it was last refreshed.
- **Pivot tables** — group by 1–2 columns, aggregate a value column (sum/avg/count/min/max), and show only the Top N or Bottom N groups.
- **Date range filter** — add a "from / to" date slicer alongside the existing dropdown filters.
- **Resize and reorder widgets** — drag a chart/pivot by its handle to reorder it, or drag its bottom-right corner to resize it. This is a lighter v1 (grid reorder + resize) rather than a full free-position canvas — widgets still flow in the grid, they don't float at an arbitrary x/y spot.
- **Table shows the first 100 rows** for speed on large sheets, but Export to Excel always exports the complete filtered dataset.
- Real Breadfast logo in the sidebar and login screen; removed the demo-account hint from the login screen.

## Roles & permissions

Four roles now exist instead of just admin/viewer:

| Role | Can do |
|---|---|
| **Admin** | Everything — manage users, add/remove teams & pages, connect data sources, edit widgets |
| **Manager** | Connect/import/combine data sources, edit charts & pivots — can't manage users or add/remove teams/pages |
| **Employee** | View dashboards, use filters, export to Excel, use the AI assistant — can't edit widgets or data connections |
| **Viewer** | Read-only — sees the dashboard exactly as configured, no filters/export/assistant |

Admins manage who has access from inside the app now: click **Manage Users** in the sidebar to add a teammate by email, change their role, or remove them — no code edits or redeploys needed for day-to-day access changes.

**Important limitation:** by default this user list lives in the browser's local storage (see `src/lib/auth.tsx`) — not shared across devices. Set up shared storage below (Supabase) to make it a real, shared list everyone sees, with live updates. Either way, it's still a client-side email allow-list rather than real server-side authentication — see "Making it production-ready" before relying on this for sensitive data.

## Setting up shared storage (so everyone sees the same data)

By default, all the dashboard data (teams, pages, charts, filters, and the user list) lives only in your own browser's local storage — great for trying things out, but nobody else sees your changes, and switching browsers/devices loses it.

To make it real and shared across your whole team (free, ~10 minutes):

1. Go to [supabase.com](https://supabase.com) → sign up → **New project**. Pick any name/region, set a database password (you won't need it day-to-day), and wait ~2 minutes for it to spin up.
2. In your new project, go to the **SQL Editor** (left sidebar) → **New query**, paste this, and click **Run**:

   ```sql
   create table app_state (
     id text primary key,
     data jsonb not null,
     updated_at timestamptz default now()
   );

   create table app_users (
     email text primary key,
     role text not null,
     created_at timestamptz default now()
   );

   alter table app_state enable row level security;
   alter table app_users enable row level security;

   -- This app authenticates with its own email allow-list rather than
   -- Supabase Auth, so these policies simply allow the anon key full
   -- access. That matches this project's existing "client-side gate"
   -- trust model, just now shared across devices instead of siloed to one
   -- browser. Tighten this (e.g. real Supabase Auth + per-row policies)
   -- before storing anything sensitive - see "Making it production-ready".
   create policy "anon full access" on app_state for all using (true) with check (true);
   create policy "anon full access" on app_users for all using (true) with check (true);

   alter publication supabase_realtime add table app_state;
   alter publication supabase_realtime add table app_users;

   -- Without this, Postgres only sends the primary key (not the actual
   -- changed data) in realtime UPDATE events, so other browsers/devices
   -- never actually receive your changes even though the write succeeded.
   alter table app_state replica identity full;
   alter table app_users replica identity full;
   ```

**Already set this up before and having sync issues (edits not appearing on other devices)?** You likely created the tables before the `replica identity full` lines existed. Just run this in the SQL Editor — no need to recreate anything:
```sql
alter table app_state replica identity full;
alter table app_users replica identity full;
```

3. Go to **Settings → API** in the left sidebar. Copy the **Project URL** and the **anon public** key.
4. Add them to your `.env` file (copy `.env.example` if you haven't already):
   ```
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```
5. Add the same two variables in Vercel/Netlify's Environment Variables settings, then redeploy (same as the Google Drive variables — local `.env` files never get uploaded).

Once both variables are set, the app automatically starts reading/writing through Supabase instead of local storage — no code changes needed. Every browser and device that opens the site will see the same teams, pages, charts, and user list, and changes appear live for everyone else without needing to refresh (via Supabase's realtime subscriptions).

**Security note:** because there's no real per-user server-side authentication (see "Making it production-ready" below), the anon key embedded in the app has full read/write access to these two tables for anyone who has it — including someone who extracted it from the deployed site's JS bundle, not just people who signed in through the app's UI. This is a reasonable trade-off for an internal tool your team trusts, but it is not equivalent to real access control. Move to Supabase Auth with per-row policies before storing anything sensitive.

## Run it locally

```bash
npm install
npm run dev
```

Demo accounts (see `src/lib/auth.tsx`):
- `admin@example.com` → admin (can add teams/tasks, connect sheets, edit charts)
- `manager@example.com` → viewer (read-only)

## Connecting data — two ways

**1. Paste a link (quick, works today, no setup):**
Share the sheet as "Anyone with the link can view", then click **Paste sheet link** on any task page.

**2. Browse from Drive (full access, no per-sheet sharing needed):**
Click **Browse from Drive** to sign in with Google and pick any spreadsheet you can already see in your own Drive — private sheets included. Access is locked to **mohamed.mahmoudsalah@breadfast.com** only (set in `src/lib/googleDrive.ts` as `ALLOWED_DRIVE_EMAIL`) — anyone else who signs in gets rejected before the picker opens. This needs a one-time Google Cloud setup (free, ~5 minutes):

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → create a project (or use an existing one).
2. **APIs & Services → Library** → enable **Google Sheets API** and **Google Picker API**.
3. **APIs & Services → OAuth consent screen** → set it up as "Internal" if everyone is in your Google Workspace, otherwise "External" and add your team's emails as test users.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID** → type "Web application" → add your dev URL (`http://localhost:5173`) and your deployed URL (e.g. `https://yourapp.vercel.app`) under **Authorized JavaScript origins**.
5. Also under **Credentials**, create an **API key** (used by the Picker).
6. Copy `.env.example` to `.env` in the project root and fill in:
   ```
   VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   VITE_GOOGLE_API_KEY=your-api-key
   ```
7. Restart `npm run dev`. When you deploy (Vercel/Netlify), add the same two variables in the project's Environment Variables settings.

Until this is set up, **Browse from Drive** shows a reminder instead of crashing — the "paste a link" method keeps working regardless.

Either way, click **Refresh data** any time the underlying sheet changes.

## Importing Excel/CSV files directly

Click **Import file** on any task page (no Google account needed for this one). Three modes:
- **Replace** — upload one `.xlsx`/`.xls`/`.csv` file; it becomes the page's data.
- **Append (stack rows)** — upload several files; their rows get combined into one table (columns don't need to match exactly — mismatched ones are filled with blanks).
- **Merge (join)** — upload two files and pick the matching column in each (e.g. "Employee ID" in both); columns from the second file get added onto the first file's rows, like a VLOOKUP/left join.

## Charts available

Bar, Line, Area, Pie, Scatter, and Radar — pick the type, X column, and Y column per chart. Every chart and the data table have their own **Export to Excel** button.

## Teams and task pages

- Each team in the sidebar can be expanded to show its task pages.
- Admins can **Add team** and, inside a team, **Add task page** — each page has its own sheet connection, filters, and charts, so a "Sales" team could have separate pages like "Weekly targets" and "Regional breakdown".

## Deploying (free, no Lovable subscription needed)

1. Push this folder to a GitHub repository.
2. Go to [vercel.com](https://vercel.com) or [netlify.com](https://netlify.com), sign in with GitHub, import the repo — both auto-detect Vite and deploy for free.
3. Add your own domain under the project's **Domains** settings (free on both platforms).
4. If you set up Google Drive access above, add `VITE_GOOGLE_CLIENT_ID` and `VITE_GOOGLE_API_KEY` in the project's Environment Variables, and add the deployed URL to the OAuth client's Authorized JavaScript origins (step 4 above). **Without these two variables set on Vercel/Netlify itself (not just your local `.env`), "Browse from Drive" will show "Google Drive isn't connected yet" even though it works locally** — local `.env` files are never uploaded, so the hosting platform needs its own copy of these values.

## Wiring up the AI assistant

The assistant calls `/api/assistant` (see `src/lib/assistant.ts`) — it never calls Anthropic directly from the browser, since an API key in frontend code would be visible via devtools.

To enable it on Vercel:
1. Rename `api/assistant.example.js` to `api/assistant.js`.
2. In Vercel → Settings → Environment Variables, add `ANTHROPIC_API_KEY` (from [console.anthropic.com](https://console.anthropic.com)).
3. Redeploy — Vercel automatically turns files in `/api` into serverless functions.

**Troubleshooting "I couldn't reach the assistant backend":**
- Did you rename the file (step 1)? If it's still `assistant.example.js`, Vercel never turns it into an endpoint and `/api/assistant` 404s.
- Is `ANTHROPIC_API_KEY` set in Vercel's **Environment Variables** (not just your local `.env`)? Did you redeploy after adding it?
- Check **Vercel → your project → Deployments → (latest) → Functions/Logs** for the actual error message from `api/assistant.js` — it's usually more specific than what shows in the chat panel.
- Make sure the `model` value in `api/assistant.js` is a real, current model name (check [docs.claude.com](https://docs.claude.com) for the current list) — an outdated or mistyped model name will make every request fail with a 400 error.

## Making it production-ready

Two things are intentionally simple so you could ship the UI fast:

**1. Real authentication.** `src/lib/auth.tsx` checks emails against a list hard-coded in the frontend — visible to anyone reading the JS bundle, with no password/identity check. Before sharing this outside your own team, swap it for [Supabase Auth](https://supabase.com/auth) (Google sign-in + a `profiles` table with each user's role) or another provider (Auth0, Clerk, Firebase Auth).

**2. Enforcing roles server-side.** "Admin vs viewer" currently only hides buttons in the UI. Pair real auth with a real backend (Supabase Postgres + Row Level Security, or your own API) so permissions are enforced server-side, not just in the interface.

Everything else — Drive/Sheets connection, charts, filters, tables, Excel export, and the assistant proxy pattern — is production-ready as-is.

## Project structure

```
src/
  components/     Sidebar, TopBar, FilterBar, ChartCard, DataTable, AIAssistant, LoginScreen, NamePromptModal, BrandMark
  lib/             auth.tsx (login), sheets.ts (reads a sheet, private or public), googleDrive.ts (OAuth + Picker), exportExcel.ts, assistant.ts
  data/            sample demo data shown before a sheet is connected
  types/           shared TypeScript types
api/
  assistant.example.js   serverless proxy to the Anthropic API (rename to enable)
.env.example        copy to .env and fill in for real Google Drive access
```
