# Project Summary: General Report Inventory Accountant Team Dashboard

## What this is

A self-hosted, Power BI–style analytics dashboard built as a real React web app (not a template or a Lovable project) — free to run, deployed on Vercel, using Google Sheets/Drive as the data source and Supabase as the shared database. It was built incrementally over many rounds of requirements and bug fixes, starting from "I want a website like Lovable" and ending up as a genuinely custom internal BI tool for Breadfast.

**Live at:** `https://inventory-accountant-dashboard.vercel.app`
**Source:** GitHub repo `mohamedmahmoudsalah-beep/Inventory-Accountant-dashboard`

## How it's built (tech stack)

- **Frontend:** React 19 + TypeScript, built with Vite, styled with Tailwind CSS v4.
- **Charts:** Recharts (bar, line, area, pie, scatter, radar, treemap).
- **Data parsing:** PapaParse (CSV), SheetJS/xlsx (Excel), mathjs (calculated-column formulas).
- **Backend:** No custom server — it's a static site. Two external services do the heavy lifting:
  - **Google (Sheets/Drive/Picker APIs)** for reading spreadsheets, either via a public "anyone with the link" CSV export, or via real OAuth sign-in ("Browse from Drive") scoped to one specific Google account.
  - **Supabase** (Postgres + realtime) for shared, cross-device storage of the dashboard's data and the user list, with live sync between everyone's browsers.
- **Hosting:** Vercel (free tier), auto-deploying from the GitHub repo on every push.
- **AI Assistant:** calls Anthropic's API through a small Vercel serverless function (`api/assistant.js`), so the API key never touches the browser.

## Core structure: Teams → Pages → Widgets

- The sidebar lists **Teams** (e.g. "Sales", "Analysis"), each expandable to show its **Task Pages** (e.g. "Overview", "Vendor Rts").
- Each page has its own: connected data source, filters, and an independent set of widgets. Nothing is shared between pages except the underlying login/user list.
- Admins and Managers can add, rename, and delete both Teams and Pages directly from the sidebar. New Teams/Pages start empty (no placeholder/sample data).

## Connecting data (four ways, per page)

1. **Paste a public link** — share a Google Sheet as "Anyone with the link can view," paste the link. Works with no Google account sign-in.
2. **Browse from Drive** — real Google OAuth sign-in (locked to `mohamed.mahmoudsalah@breadfast.com` only), then pick any spreadsheet from that Drive — private sheets included, no need to change sharing settings. If the sheet has multiple tabs, you're asked which one to load.
3. **Combine online sheets** — pick several spreadsheets from Drive at once; their rows get stacked into one table (must share the same/similar columns).
4. **Import a local file** — upload `.xlsx`/`.xls`/`.csv` directly, with three modes: Replace, Append (stack rows from multiple files), or Merge (join two files on a matching column, like VLOOKUP).

Once connected: **Refresh data** re-pulls the latest version manually, or toggle **Auto (60s)** to pull automatically on a timer. The full sheet is always fetched (no row cap) — the on-screen table just displays the first 100 rows for speed, while Export always includes every row.

## Widgets you can add to a page

- **Charts:** bar, line, area, pie, scatter, radar, treemap — pick X/Y columns and toggle "show values" to print numbers on the chart. Clicking a bar or pie slice **cross-filters** the whole page by that category (click again to clear).
- **Pivot table:** group by any number of columns (nested rows), with multiple aggregated value columns per pivot, sortable column headers, and Top N / Bottom N limiting. All the configuration lives behind an "Edit" (gear) button so the widget itself stays clean.
- **Matrix:** a true row × column crosstab (like Excel's PivotTable with both a row and column dimension) with one aggregated value at each intersection.
- **Card:** a single big KPI number (a chosen aggregation of a column or Measure).
- **Text & Image:** freeform notes or an image, for adding context/instructions to a page.
- Every widget can be **exported to Excel** individually, and can be **dragged to reorder** and **resized** by dragging its corner.

## Measures & Calculated Columns ("Data model" button)

- **Calculated columns:** add a new column computed from existing ones with an Excel-like formula (e.g. `[Total Cost] - [Total Revenue]`, or `IF(region == "Cairo", revenue * 1.1, revenue)`). Evaluated live via mathjs; shown in the data table marked with a small ƒ and not directly editable (since they're derived).
- **Measures:** a saved, reusable aggregation — optionally conditional, like a simple SUMIF (e.g. "Cairo Revenue = sum(revenue) where region = Cairo"). Once created, a Measure becomes selectable as the value in any Pivot, Matrix, or Card widget, so you don't have to redefine the same calculation everywhere.

## The data table (bottom of every page)

- Shows the first 100 filtered rows (for speed); Export always gets everything.
- Each column header shows its detected type (number / date / text).
- Admins/Managers can click any raw cell to edit it directly. Calculated columns are shown but not editable (they're derived).

## Filters

- Standard dropdown "equals" filters, plus a **date range** slicer (from/to).
- All filters combine (AND) and apply to every widget and the table on that page at once.
- Clicking a chart element adds/updates a filter too (cross-filtering), so chart clicks and the filter bar stay in sync.

## Roles & permissions (4 tiers)

| Role | Can do |
|---|---|
| **Admin** | Everything: manage users, add/rename/delete teams & pages, connect data, edit widgets |
| **Manager** | Same as Admin except can't manage the user list |
| **Employee** | View, filter, export, use the AI assistant — can't edit widgets or data connections |
| **Viewer** | Read-only, sees the dashboard exactly as configured |

Admins manage the user list from an in-app **"Manage Users"** page (add by email, change role, remove) — no code edits needed.

## Shared storage (Supabase) — the important part

By default the whole app (teams, pages, widgets, filters, and the user list) would only live in one browser's local storage. Once Supabase is configured (two environment variables + a one-time SQL setup), everything moves to a real shared Postgres database:
- Every device/browser that logs in sees the same data.
- Changes sync **live** to everyone else's open tab via Supabase's realtime subscriptions (no refresh needed).
- Critical detail: the Supabase tables need `replica identity full` set, or realtime updates only carry the row's ID (not its actual new content), so other devices never actually receive the change — this was a real bug found and fixed mid-project.
- If Supabase isn't configured (or the values are wrong), the app **falls back gracefully to local-only storage** rather than crashing — this took a fix too, since a malformed Supabase URL originally crashed the entire app on load.

## AI Assistant

A chat panel that can answer questions about the currently-loaded data and suggest which chart/filter to use. It calls a Vercel serverless function (`api/assistant.js`, renamed from the shipped `.example.js`) which holds the real `ANTHROPIC_API_KEY` server-side — the browser never sees it.

## Design

- Dark mode and Light mode (toggle in the sidebar), both tuned to avoid pure-black/pure-white extremes.
- Breadfast's real logo and magenta brand color throughout.
- Sidebar can collapse to icons-only for more working space.
- App is titled "General Report Inventory Accountant team."

## Known simplifications (by design, not oversights)

- **Auth is an email allow-list, not real authentication** — no passwords, no server-side session verification. It's appropriate for a trusted internal team tool, not for anything with sensitive external-facing access. Moving to Supabase Auth with row-level security is the documented upgrade path if that's ever needed.
- **Widget "resize"** is real (drag the corner) but widgets still flow in a wrapping layout — there's no free-form x/y canvas positioning yet.
- **Matrix and Pivot sorting**: Pivot has full sortable headers; Matrix currently only sorts row/column labels alphabetically.
- **Tab-name selection when pasting a plain link** only works if you've also signed into "Browse from Drive" at least once in that session (otherwise there's no authenticated way to look up tab names for a public link).

## Where things stand

The app is fully functional and deployed. The last few rounds of work fixed several real, previously-shipped bugs (a data-sync race condition, a user-list-wiping bug that could lock out admins, non-working widget resize, monochrome treemaps, and the Supabase realtime/replica-identity issue) — all confirmed via TypeScript type-checking and successful production builds before each delivery.
