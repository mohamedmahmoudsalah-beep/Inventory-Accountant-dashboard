# Breadfast Insights

A Power BI–style dashboard for your team: each **team** (department) can have several **task pages**, each with its own connected Google Sheet, charts (bar/line/area/pie/scatter/radar), pivot tables, a searchable table, filters (including date ranges), one-click Excel export, and an AI assistant.

## What's new in this update

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

**Important limitation:** this user list lives in the browser's local storage (see `src/lib/auth.tsx`), not on a server. It won't sync across different browsers or devices, and anyone with devtools access on that machine could technically inspect or edit it. It's a real usability improvement over hard-coding users in source, but it is not a substitute for server-side auth — see "Making it production-ready" below before relying on this for sensitive data.

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
