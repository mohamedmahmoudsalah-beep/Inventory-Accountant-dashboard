# Breadfast Insights

A Power BI–style dashboard for your team: each **team** (department) can have several **task pages**, each with its own connected Google Sheet, charts (bar/line/area/pie/scatter/radar), pivot tables, a searchable table, filters (including date ranges), one-click Excel export, and an AI assistant.

## What's new in this update

**Latest round:**
- **Data sync changed from daily to weekly** — Sunday at 12:00 noon (Cairo time), both the client-side safety-net sync and the server-side cron. Anyone who needs data refreshed more often than that still uses "Refresh data" manually, same as always. The IndexedDB cache TTL was extended to match (~6.5 days instead of ~24h).
- **Fixed a likely major source of high Supabase egress:** metadata queries no longer use `select("*")`, which could silently re-download a leftover legacy `pages.rows` column full of duplicate row data on every load. See "Cutting Supabase egress" below — there's one SQL command you should run once to finish this.
- **Added a ~24h client-side (IndexedDB) cache for page data**, so reloading the dashboard or switching pages doesn't keep re-fetching from Supabase — "Refresh data" is the one thing that bypasses and updates it. Also stopped the realtime subscription from re-downloading a page's data for browsers that never had it open in the first place.
- **AI assistant now uses Google's Gemini API by default** — a genuinely free tier (no credit card), instead of Anthropic's pay-as-you-go API. See "Wiring up the AI assistant" below.
- **Measure formulas now support explicit aggregate functions** — `SUM([Column])`, `COUNT([Column])`, `AVG(...)`, `MIN(...)`, `MAX(...)`, `DISTINCT(...)` — not just implicit sum. Autocomplete suggests these alongside measures/columns.
- **Pie charts show each slice's percentage directly on the chart**, not just on hover.
- **Treemap cells show their name and share-of-total percentage directly on the cell**, not just on hover.
- **A safety-net sync on login:** if a connected sheet's data is more than ~6.5 days old (the server cron isn't set up yet, or a browser wasn't open at the scheduled weekly sync time), the app now syncs it automatically in the background as soon as the Admin logs in — with a visible "Syncing…" notification — instead of silently showing stale numbers until someone remembers to click Refresh.

**Latest round:**
- **Card widget settings are now hidden behind a gear icon** (like Pivot/Matrix already were) instead of always showing.
- **Fixed a timezone bug in the date-range filter** that silently dropped the first day of a range (e.g. "Jul 1 → Jul 31" was actually starting from Jul 2).
- **"Filter this widget" now supports number comparisons** (greater than / less than / between) when the chosen column is numeric, not just an exact-match dropdown.
- **Never reconnecting Google Drive:** a new optional server-side token refresh (reusing the same setup as the data-refresh cron) means the Admin's browser stops needing to redo the Google sign-in popup just to refresh already-connected sheets.
- **Measures can now be formulas** — e.g. `[Total Revenue] / [Total Cost] * 100` — referencing other measures and/or columns, with a live autocomplete dropdown as you type (also added to Calculated columns' formula input).

**A round of completeness/UX fixes and new features:**
- **Manager role tightened:** Managers can no longer connect, import, or refresh any data source — only the Admin account does that now. Managers still add/rename/remove teams & pages and edit widgets. See "Roles & permissions" below.
- **Weekly sync instead of daily:** the background data sync now runs once a week (Admin-only, Sunday at 12:00 noon Cairo time), instead of once a day. Anyone who wants fresher data in between still has the "Refresh data" button for that.
- **Toast notifications instead of `alert()` popups** for errors and confirmations — small, dismissible, non-blocking.
- **Undo for delete:** deleting a team or page no longer needs a blocking confirm dialog — it's removed immediately with a 6-second "Undo" toast, and only actually deleted from the shared database if you don't click Undo.
- **Activity Log:** a new screen (Admins/Managers) showing who created/renamed/deleted teams & pages, connected/refreshed data, and changed user roles — see "Setting up shared storage" for the one extra table it needs.
- **Sidebar search:** filter teams/pages by name instead of scrolling.
- **Smart number formatting:** Chart axes/labels, Pivot cells, Matrix cells, and Card values now show compact numbers (1.2K / 3.4M / 2.1B) by default, with a per-widget "Full number" option.
- **Per-widget filter:** Pivot, Matrix, and Card widgets can each have their own "filter this widget" (pick a column + value), independent of the page's shared filter bar.
- **Card alerts & period comparison:** a Card can highlight itself red when its value crosses a threshold you set, and/or show "+X% vs last month" using a date column.
- **Export page to PDF:** a new button next to the existing Excel export, captures the whole page (all widgets) as a downloadable PDF.
- **Error boundary:** a JS error in one part of the app now shows a clear "something went wrong, reload" screen instead of a blank white page.
- **Data table now previews 10 rows** instead of 100 (Export still gets every row).

**Fixed the app hanging / showing "no data yet" and a Postgres timeout error during a big sheet refresh.** Refreshing a large sheet writes its rows in many small chunks (see the chunked-storage note above) — but each of those individual writes was also a realtime "something changed" event, and the app was reacting to *every single one* by re-fetching everything from scratch. For a sheet with hundreds of chunks, that meant dozens of overlapping, increasingly heavy reloads firing back to back for the whole duration of the refresh, which is what actually produced the freeze and the `57014 canceling statement due to statement timeout` error — not the save itself. Three changes fix this:
- The browser doing the writing no longer reloads itself mid-save (it already has the data it just wrote); everyone else's reload is now debounced over a longer window so a whole burst of chunk-writes coalesces into one reload instead of many.
- Chunks are now written a handful at a time in parallel instead of strictly one at a time, so a big refresh finishes noticeably faster.
- Reading all the chunks back (on page load, and for that one coalesced reload) is now done in small bounded pages instead of one unbounded query, so it can't itself become the slow query that times out.

If you're still seeing `statement timeout` errors after this update, Supabase's default per-role query timeout is quite short (a few seconds on some projects). Raise it once, in the SQL Editor:
```sql
alter role anon set statement_timeout = '30s';
notify pgrst, 'reload config';
```

**Fixed large sheets appearing empty (or stale) for everyone except whoever just fetched them.** A page's rows were stored as one single value in the shared database. For a big sheet, that one write could silently exceed Supabase's request-size limit and fail — the browser that did the fetching still looked completely fine (the data was already in its own memory), but the write never actually reached Supabase. Every other device — and even the same Admin account on a fresh reload — kept reading back whatever smaller/older/emptier version had last saved successfully, along with a stale "Last updated" time. Rows are now written in many small chunks instead of one giant blob, so no single write ever has to carry more than a few thousand rows no matter how large the sheet is. **Requires a small SQL update if you already have shared storage set up — see "Setting up shared storage" below.**

**Fixed a real data-loss bug: shared pages could silently go empty for everyone but the person who last touched them.**
Any save that wasn't an explicit data refresh (changing a filter, reordering widgets, adding a measure, ...) used to write an empty row array to the shared database for sheet-connected pages, wiping out whatever had been fetched — and that empty state then synced live to every other browser. This is fixed: those saves now leave the stored rows alone instead of blanking them.

**Fixed Manager-role edits/pages never actually reaching the shared database.**
The functions that write to Supabase were checking for the Admin role literally, even though Managers are supposed to be able to edit widgets and refresh data per the roles table below. A Manager's changes looked fine in their own browser but never saved for anyone else. Now every write is gated by the actual permission it corresponds to (`canEditWidgets`, `canManageStructure`, `canManageDataSources`), so a Manager's work persists like it should.

**Added an optional server-side cron job for data refresh** — see "Setting up server-side data refresh" below. Previously, refreshing a connected sheet only happened from inside someone's open browser tab; now it can also run on Vercel's own schedule with nobody logged in, and (with one extra one-time setup step) that now covers private Drive-connected sheets too, not just public links.

**Fixed "Refresh data" sometimes bringing back an older version than what was just edited.** The fetch to Google's CSV export endpoint had no cache-busting at all, so it could legitimately get served a cached response (by the browser, or by Google's own export endpoint caching that exact URL) instead of the actual latest version. Every refresh now forces a fresh, uncached request.

**Widget size now actually persists.** Resizing a chart/pivot/matrix by dragging its corner used to reset back to the default size on the next reload. It's now saved onto the widget just like any other edit.

**New charts and matrices no longer guess columns for you.** They used to silently pick the first couple of columns in the sheet; now a new chart/matrix opens straight into its column picker (same pattern Pivot already used), and stays out of the way until you've chosen.

**Fixed chart/matrix editing feeling like it "hung" on large sheets.** Typing in a chart or matrix's title was re-running the full aggregation over every row on every keystroke. That calculation is now cached and only re-runs when the data or the chosen columns actually change.

**Rebuilt shared storage as normalized tables instead of one JSON blob:**
Every previous save wrote the *entire* dashboard (all teams, all pages, all widgets, and for a while all spreadsheet rows too) as one JSON object — so even renaming a single chart re-uploaded everything else along with it. This is now three small tables (`teams`, `pages`, `widgets`), each holding one row per item:
- Editing one chart's title now writes to exactly one small widget row — not the whole dashboard.
- This should resolve the recurring Supabase "Disk IO Budget" warnings and the intermittent save failures that came with them.
- **You need to run new SQL if you already had shared storage set up** — see "Setting up shared storage" below (your old `app_state` table can be dropped).
- Which team/page you're currently looking at is now a personal, local-only preference (like a browser bookmark) rather than shared data — no reason for that to sync to everyone else.

**Fixed excessive Supabase usage (Disk IO exhaustion warning):**
The app used to push a full save to the shared database on almost every small edit (typing a chart title, moving a filter, resizing a widget's parent, etc.), which could exhaust a free-tier Supabase project's daily Disk IO budget and cause intermittent failures that looked like CORS errors. This is now much lighter:
- Small edits are saved **locally only** (instant, free) so your own browser never loses your work.
- The shared database is only written to: **once a week, Sunday at 12:00 noon Cairo time** (a background sync, Admin-only, only runs while the Admin's browser tab happens to be open at that time), or immediately after a **deliberate** action — connecting/refreshing a sheet, importing a file, or adding/renaming/deleting a team or page.
- **Only the Admin account connects, imports, or refreshes any data source.** Managers can add/rename/remove teams & pages and edit charts/pivots/matrices/cards, but have no way to connect, import, or refresh data anymore — that's Admin-only. Employees and Viewers are read-only for data connections either way. This was a deliberate simplification so one account is the single source of truth for what data is loaded.
- Sheet data fetched by the admin is shared with everyone automatically (no one else needs their own Drive access) — but only refreshes on the weekly Sunday sync or when the admin manually clicks refresh, not continuously. If you want it refreshed more often than weekly, click **Refresh data** yourself whenever you like — the weekly sync is just the automatic baseline, not a limit.
- Fixed imported/combined offline Excel data disappearing after a refresh — it's now saved immediately since (unlike a live sheet link) there's nowhere to re-fetch it from later.
- Fixed repeated "couldn't load sheet" popups hammering the page for non-admin accounts — automatic background attempts now fail silently and only try once, instead of retrying and alerting endlessly.
- Fixed manually resizing a chart/pivot silently reverting to the default size after any unrelated edit elsewhere on the page.

**If you're seeing a Supabase "Disk IO Budget" email:** that's a resource-usage warning from Supabase itself (free tier), not something wrong with your data. It should settle down significantly with the changes above; if it persists, Supabase's dashboard shows daily/hourly IO usage under Settings → Infrastructure.

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
- **Combine online sheets** — a button that lets you multi-select several Google Sheets from Drive at once. After picking them, you're asked one simple question: put them together normally (stack every sheet's rows into one table — the default, same as before), or link them by a relationship instead (pick a matching column between the first sheet and each of the others, like a VLOOKUP) — entirely optional, right there in the same step, no separate panel to dig through.
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
| **Admin** | Everything — manage users, add/remove teams & pages, connect/refresh data sources, edit widgets |
| **Manager** | Add/rename/remove teams & pages, edit charts/pivots/matrices/cards, export — can't connect or refresh any data source (that's Admin-only now) and can't manage users |
| **Employee** | View dashboards, use filters, export to Excel, use the AI assistant — can't edit widgets or data connections |
| **Viewer** | Read-only — sees the dashboard exactly as configured, no filters/export/assistant |

Admins manage who has access from inside the app now: click **Manage Users** in the sidebar to add a teammate by email, change their role, or remove them — no code edits or redeploys needed for day-to-day access changes.

**Important limitation:** by default this user list lives in the browser's local storage (see `src/lib/auth.tsx`) — not shared across devices. Set up shared storage below (Supabase) to make it a real, shared list everyone sees, with live updates. Either way, it's still a client-side email allow-list rather than real server-side authentication — see "Making it production-ready" before relying on this for sensitive data.

## Setting up shared storage (so everyone sees the same data)

By default, all the dashboard data (teams, pages, widgets, filters, and the user list) lives only in your own browser's local storage — great for trying things out, but nobody else sees your changes, and switching browsers/devices loses it.

Data is stored in **normalized tables** — one row per team, one row per page, one row per widget — rather than one giant JSON blob. This keeps every individual write small regardless of how large your dashboard grows, which matters a lot on Supabase's free tier (a single-blob design that re-saves everything on every edit can exhaust the free tier's daily Disk IO budget surprisingly fast once a few thousand spreadsheet rows are involved).

To make it real and shared across your whole team (free, ~10 minutes):

1. Go to [supabase.com](https://supabase.com) → sign up → **New project**. Pick any name/region, set a database password (you won't need it day-to-day), and wait ~2 minutes for it to spin up.
2. In your new project, go to the **SQL Editor** (left sidebar) → **New query**, paste this, and click **Run**:

   ```sql
   create table teams (
     id text primary key,
     name text not null,
     created_at timestamptz default now()
   );

   create table pages (
     id text primary key,
     team_id text not null references teams(id) on delete cascade,
     name text not null,
     source_type text,
     sheet_url text,
     sheet_tab_title text,
     last_updated timestamptz,
     columns jsonb default '[]',
     rows jsonb default '[]',
     measures jsonb default '[]',
     calculated_columns jsonb default '[]',
     active_filters jsonb default '[]',
     widget_order jsonb default '[]',
     created_at timestamptz default now()
   );

   create table widgets (
     id text primary key,
     page_id text not null references pages(id) on delete cascade,
     kind text not null,
     config jsonb not null,
     created_at timestamptz default now()
   );

   -- A page's rows are stored here, split across many small chunks (one row
   -- of this table per chunk), instead of as one giant value inside pages'
   -- own `rows` column. See "Why rows are chunked" below for why this
   -- matters a lot once a sheet gets into the tens/hundreds of thousands of
   -- rows.
   create table page_row_chunks (
     page_id text not null references pages(id) on delete cascade,
     chunk_index int not null,
     data jsonb not null default '[]',
     primary key (page_id, chunk_index)
   );

   create table app_users (
     email text primary key,
     role text not null,
     created_at timestamptz default now()
   );

   -- Audit trail: "who did what, when" for the Activity Log screen (team/page
   -- create-rename-delete, connecting/refreshing data, user management).
   -- Writes to this table are best-effort/fire-and-forget from the app, so a
   -- missing table or a failed insert never blocks the actual action.
   create table activity_log (
     id uuid primary key default gen_random_uuid(),
     actor_email text not null,
     action text not null,
     details text,
     created_at timestamptz default now()
   );

   alter table teams enable row level security;
   alter table pages enable row level security;
   alter table widgets enable row level security;
   alter table page_row_chunks enable row level security;
   alter table app_users enable row level security;
   alter table activity_log enable row level security;

   -- This app authenticates with its own email allow-list rather than
   -- Supabase Auth, so these policies simply allow the anon key full
   -- access. That matches this project's existing "client-side gate"
   -- trust model, just shared across devices instead of siloed to one
   -- browser. Tighten this (e.g. real Supabase Auth + per-row policies)
   -- before storing anything sensitive - see "Making it production-ready".
   create policy "anon full access" on teams for all using (true) with check (true);
   create policy "anon full access" on pages for all using (true) with check (true);
   create policy "anon full access" on widgets for all using (true) with check (true);
   create policy "anon full access" on page_row_chunks for all using (true) with check (true);
   create policy "anon full access" on app_users for all using (true) with check (true);
   create policy "anon full access" on activity_log for all using (true) with check (true);

   alter publication supabase_realtime add table teams;
   alter publication supabase_realtime add table pages;
   alter publication supabase_realtime add table widgets;
   alter publication supabase_realtime add table page_row_chunks;
   alter publication supabase_realtime add table app_users;

   -- Without this, Postgres only sends the primary key (not the actual
   -- changed data) in realtime UPDATE events, so other browsers/devices
   -- never actually receive your changes even though the write succeeded.
   alter table teams replica identity full;
   alter table pages replica identity full;
   alter table widgets replica identity full;
   alter table page_row_chunks replica identity full;
   alter table app_users replica identity full;
   ```

   **If you already ran the old SQL before today** (your `pages` table already exists and has a `rows` column), run this instead of the block above — it only adds what's missing and migrates your existing row data across, without touching your teams/widgets/users:

   ```sql
   create table if not exists page_row_chunks (
     page_id text not null references pages(id) on delete cascade,
     chunk_index int not null,
     data jsonb not null default '[]',
     primary key (page_id, chunk_index)
   );
   alter table page_row_chunks enable row level security;
   create policy "anon full access" on page_row_chunks for all using (true) with check (true);
   alter publication supabase_realtime add table page_row_chunks;
   alter table page_row_chunks replica identity full;

   -- One-time: move whatever's currently sitting in pages.rows into chunk 0
   -- for that page (fine even for a big sheet — this only runs once, inside
   -- Postgres itself, not over the request-size-limited REST API).
   insert into page_row_chunks (page_id, chunk_index, data)
   select id, 0, rows from pages
   where rows is not null and jsonb_array_length(rows) > 0
   on conflict (page_id, chunk_index) do update set data = excluded.data;

   -- Optional cleanup, once you've confirmed the app is reading correctly
   -- from page_row_chunks (reload the app and check a large sheet's page):
   -- alter table pages drop column rows;
   ```

   **Why rows are chunked instead of one `pages.rows` column:** a single write request has to fit under Supabase's request-size limits. A sheet with a few hundred rows fits fine as one blob — a sheet with 100,000+ rows might not, and when a write like that silently fails, the browser that fetched the data still shows it fine (it's already sitting in that tab's memory), while Supabase itself never actually got the update. Every *other* device just keeps reading whatever smaller/older dataset was last written successfully — which looks exactly like "big sheets don't show data for anyone but me, and even I don't see the newest fetch after a reload." Splitting the data into many small chunks means no single request ever has to carry more than a few thousand rows, no matter how big the whole sheet is.

   **Already have `teams`/`pages`/`widgets`/`page_row_chunks` set up and just need the Activity Log table?** Run only this:

   ```sql
   create table if not exists activity_log (
     id uuid primary key default gen_random_uuid(),
     actor_email text not null,
     action text not null,
     details text,
     created_at timestamptz default now()
   );
   alter table activity_log enable row level security;
   create policy "anon full access" on activity_log for all using (true) with check (true);
   ```

   The Activity Log screen (visible to Admins and Managers) will show a friendly "no activity yet" message until this table exists — nothing else in the app depends on it, so there's no rush.


**Upgrading from an older version of this project?** That version used a single `app_state` table holding everything as one JSON blob. This version replaces it with the `teams`/`pages`/`widgets` tables above — run the SQL above to create them (your old `app_state` table can just be dropped, or left alone and ignored: `drop table if exists app_state;`).

3. Go to **Settings → API** in the left sidebar. Copy the **Project URL** and the **anon public** key.
4. Add them to your `.env` file (copy `.env.example` if you haven't already):
   ```
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```
5. Add the same two variables in Vercel/Netlify's Environment Variables settings, then redeploy (same as the Google Drive variables — local `.env` files never get uploaded).

Once both variables are set, the app automatically starts reading/writing through Supabase instead of local storage — no code changes needed. Every browser and device that opens the site will see the same teams, pages, charts, and user list, and changes appear live for everyone else without needing to refresh (via Supabase's realtime subscriptions).

**Security note:** because there's no real per-user server-side authentication (see "Making it production-ready" below), the anon key embedded in the app has full read/write access to these two tables for anyone who has it — including someone who extracted it from the deployed site's JS bundle, not just people who signed in through the app's UI. This is a reasonable trade-off for an internal tool your team trusts, but it is not equivalent to real access control. Move to Supabase Auth with per-row policies before storing anything sensitive.

## Setting up server-side data refresh (recommended — no browser needed)

Without this, a connected sheet only ever refreshes when the Admin, with an open browser tab, either clicks **Refresh data** or happens to have the tab open at the scheduled weekly sync time (the app's own client-side weekly sync, Admin-only). If nobody's logged in, the data just sits there until someone is — which is confusing when you expect "latest data" to actually mean latest.

This adds a real server-side cron job (`api/cron-refresh-sheets.js`) so the refresh happens on Vercel's own clock, independent of anyone having the app open:

1. Rename `api/cron-refresh-sheets.example.js` to `api/cron-refresh-sheets.js`.
2. In Supabase, go to **Settings → API** and copy the **service_role** key (not the anon key — this one bypasses row-level security, which is what a trusted server job needs).
3. In Vercel's Environment Variables, add:
   ```
   SUPABASE_URL=https://your-project-ref.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   CRON_SECRET=a-long-random-string-you-make-up
   ```
   (`SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` are server-only — never put them in `.env`/`VITE_...` variables, since anything prefixed `VITE_` ships to the browser.)
4. Redeploy. `vercel.json` already registers the cron schedule.

**Free "Hobby" plan limit:** Vercel only allows cron jobs to fire **at most once per day** on the free tier — an hourly schedule fails to deploy with "Hobby accounts are limited to daily cron jobs." `vercel.json` is set to `0 9 * * 0` (once a week, Sunday, ~noon Cairo time during Egypt's daylight-saving months — see the DST note in `api/cron-refresh-sheets.example.js` for when to switch it to `0 10 * * 0`). If you're on Vercel Pro, you could go as frequent as hourly (`0 * * * *`) instead.

**Limitation, mostly optional to lift:** by default this only refreshes sheets connected via a public "Anyone with the link can view" link. If your "Browse from Drive" sheets are all tied to one fixed account anyway (this app already locks Drive access to a single allowed email), you can also enable refreshing those — see the long comment block at the top of `api/cron-refresh-sheets.example.js` ("Optional: also refreshing private Drive sheets") and the one-time helper script at `scripts/get-google-refresh-token.example.js`. It's a ~5 minute one-time setup (authorize once, get a refresh token, add it to Vercel's env vars) and after that the cron refreshes private Drive sheets too, with nobody needing to be signed in anywhere.

## Daily email report (optional)

A daily email digest of every Card widget's value ("WH stock valuation: 1.28B", etc.), grouped by team/page — for people who want the headline numbers without opening the dashboard.

**Why an HTML email instead of literally emailing the PDF:** turning a live dashboard into a pixel-perfect PDF needs a real browser (headless Chromium) rendering React + charts, which is heavy to run in a Vercel serverless function on the free tier. A plain HTML table of "every Card's current number" covers the same daily need without that infrastructure. The **Export page to PDF** button in the app itself is still there any time someone wants the exact visual page.

This uses [Resend](https://resend.com) to actually send the email — free tier is 3,000 emails/month and 100/day with no credit card, which comfortably covers one email a day to a small team.

1. Sign up at [resend.com](https://resend.com) (free). You can start sending immediately from their shared `onboarding@resend.dev` address to your own verified email, or verify your own domain (Resend dashboard → Domains → add a few DNS records at your registrar) to send from e.g. `reports@yourcompany.com` to anyone.
2. Resend dashboard → **API Keys** → Create API Key, copy it.
3. Rename `api/cron-daily-report.example.js` to `api/cron-daily-report.js`.
4. In Vercel's Environment Variables, add (alongside the ones from the section above):
   ```
   RESEND_API_KEY=your-resend-api-key
   REPORT_FROM_EMAIL=onboarding@resend.dev
   REPORT_RECIPIENTS=mohamed.mahmoudsalah@breadfast.com,manager@breadfast.com
   ```
5. Redeploy. `vercel.json` already registers this cron for `0 6 * * *` (once daily, ~6am UTC — before the data refresh at noon UTC, so adjust the two times if you want the report to reflect that day's *freshest* refresh instead).

**Free "Hobby" plan limit:** Vercel's free tier allows a small number of cron jobs (2, at the time of writing) as long as each fires at most once a day — this report and the data-refresh cron above together fit within that. If you ever need a third daily cron, you'd need Vercel Pro.

## Never reconnecting Google Drive (optional, recommended for the Admin account)

By default, the Google sign-in used by "Browse from Drive"/"Refresh data" gives a short-lived token (~1 hour), cached only in that browser tab (`sessionStorage`) — so closing the browser, or the hour running out, means clicking through the Google popup again just to refresh a sheet you already connected.

Since only the Admin account connects/refreshes data at all now (see "Roles & permissions"), this is worth fixing once: reuse the exact same long-lived refresh token already set up for the server-side cron (see "Setting up server-side data refresh" above) so the Admin's browser can silently mint a fresh token any time, no popup, ever again after this one-time setup.

1. If you haven't already done "Setting up server-side data refresh" above, do that first — you need `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REFRESH_TOKEN`.
2. Rename `api/drive-access-token.example.js` to `api/drive-access-token.js`.
3. Make sure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are also set in Vercel (same ones the crons use) — this endpoint checks the caller's real signed-in session against those, so only the actual Admin account can ever use it.
4. Deploy. From then on, "Refresh data" and "Browse from Drive" both silently pull a fresh token from this endpoint first, falling back to the old interactive popup only if it isn't set up (or if a different, non-admin account somehow tries).

## Cutting Supabase egress (bandwidth) usage

If Supabase's dashboard shows unusually high egress (e.g. over a gigabyte a day for a small internal tool), there are two separate things going on — one is very likely the main cause, the other is a client-side optimization on top.

### The likely main cause: a leftover `rows` column on `pages`

If this project was ever migrated from the old single-JSON-blob storage to the current `page_row_chunks` design (see "Setting up shared storage" above), the migration SQL **copies** the old data across but only *optionally* drops the original column — the cleanup line was left commented out on purpose, so nothing broke for anyone who hadn't verified the new setup yet:

```sql
-- alter table pages drop column rows;
```

If that line was never actually run, `pages.rows` still exists and still holds a full copy of every page's row data, duplicated alongside the newer `page_row_chunks` table. Every metadata load — which happens once per app load, for every single user — used to fetch this with `select("*")` on `pages`, silently re-downloading that entire duplicate blob every time, for data that's already being fetched correctly (and far more cheaply) from `page_row_chunks`. That alone can easily account for the bulk of unexpected egress.

**Fixed in code:** `pages`/`teams`/`widgets` queries now name their columns explicitly instead of `select("*")`, so this can't happen even if the column still exists.

**You should also actually run the cleanup now**, once you've confirmed the app is working correctly (reload it, check a page with a large sheet loads fine):

```sql
alter table pages drop column rows;
```

This is safe — nothing in the app reads or writes that column anymore.

### Client-side caching (IndexedDB, ~24h)

Since the shared data only actually changes once a week (the Sunday-noon sync), reloading the dashboard or switching between pages doesn't need to re-fetch from Supabase every time. `src/lib/rowsCache.ts` caches each page's rows in the browser's IndexedDB for ~6.5 days:

- Opening a page, switching teams, or reloading the browser reads from this cache first — no Supabase request at all if it's still fresh.
- **"Refresh data"** (and the background weekly / on-login sync) is the one thing that bypasses the cache and writes the newly-fetched rows straight back into it, so a manual refresh is never left looking stale.
- The realtime subscription also **skips reloading a page's rows for a browser that never had that page open in the first place** — previously, every connected browser (including people not even looking at the affected page) would re-download full row data for every page touched by e.g. the weekly sync, which is a much bigger source of unnecessary egress than any one person's own navigation.

**One trade-off worth knowing:** with a ~6.5-day cache, if the Admin does a manual mid-week "Refresh data," anyone who *already has that page open* gets the update instantly via the realtime subscription (which always bypasses the cache). Someone who opens that page for the first time *after* the refresh gets it too — the cache entry is tagged with the page's `lastUpdated` at write time, so a mismatch against the current value is treated as a miss even though the TTL hasn't expired, and the app quietly re-fetches instead of showing an old cached copy under a new "Last updated" timestamp.

No SQL or setup needed for this part — it's automatic once this version is deployed. If you ever need to clear it (e.g. testing), it's in the browser's DevTools → Application → IndexedDB → `breadfast-dashboard-cache`.

### Smaller row storage (columnar chunks)

Rows used to be stored as plain JSON objects — `{"Date": "...", "SKU": "...", "Value": "..."}` — which repeats every column NAME on every single row. For a wide sheet with thousands of rows, that repetition is often a bigger share of the total bytes than the actual values. `page_row_chunks` now stores each chunk's column names once, plus every row as a plain value-array in that same order, and the app converts it back to normal row objects immediately after loading — nothing else changes, it's just meaningfully fewer bytes moved on every read (which is most of what shows up as "PostgREST Egress" in Supabase's usage dashboard).

This is backward-compatible automatically: any chunk saved before this update (in the old format) still loads correctly, and gets re-saved in the new, smaller format the next time that page is refreshed — no migration step to run.

## Keeping Supabase from pausing (optional, fixes the "opens empty, works a moment later" pattern)

Supabase's free tier automatically pauses a project after a period of no API activity. The first request after that can take 10-30+ seconds to wake back up — which shows up in the app as: opens to an empty/placeholder page, then works fine if you wait a moment or refresh. The app now retries this automatically in the background (and shows a "Try again now" button), so it self-heals either way — but if you'd rather it just never happened, keep the project pinged so it never goes to sleep:

1. Rename `api/keep-alive.example.js` to `api/keep-alive.js` and redeploy. This is a tiny endpoint that runs one real (harmless, read-only) Supabase query when hit — that's what actually counts as "activity," unlike pinging the app's own frontend URL (which never touches Supabase at all).
2. Go to [uptimerobot.com](https://uptimerobot.com) and create a free account.
3. Click **+ Add New Monitor**.
4. Monitor type: **HTTP(s)**.
5. Friendly name: anything, e.g. "Breadfast dashboard keep-alive".
6. URL: `https://your-app.vercel.app/api/keep-alive` (your actual Vercel domain).
7. Monitoring interval: 5 minutes (the shortest the free plan allows — plenty often enough).
8. Save. That's it — UptimeRobot will hit that URL every 5 minutes forever, which is exactly what stops Supabase from ever seeing a long enough gap in activity to pause.

**Does this affect anything else?** No downsides worth worrying about for this use case:
- **Cost:** both sides are free at this scale. ~288 requests/day is a rounding error against Supabase's free-tier request limits and Vercel's free-tier function-invocation limits — nowhere close to either.
- **App behavior:** none — it's a background health check nobody using the app ever sees or interacts with.
- **What it doesn't cover:** this only prevents the *inactivity* auto-pause. It won't help if Supabase pauses/suspends a project for a billing issue or a manual action on your end — those need to be resolved directly in the Supabase dashboard regardless.
- UptimeRobot's free plan also emails you if the endpoint ever goes down (e.g. a real outage) — a small side benefit, not just an anti-pause trick.

## Run it locally

```bash
npm install
npm run dev
```

Demo accounts (see `src/lib/auth.tsx`):
- `admin@example.com` → admin (can add teams/tasks, connect sheets, edit charts)
- `manager@example.com` → manager (can refresh data and edit charts/pivots, can't manage users)

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

Click **Import file** on any task page. Three modes:
- **Replace** — upload one `.xlsx`/`.xls`/`.csv` file, or paste one Google Sheet link; it becomes the page's data.
- **Append (stack rows)** — upload several files and/or paste several Google Sheet links; their rows get combined into one table (columns don't need to match exactly — mismatched ones are filled with blanks).
- **Merge (join)** — combines a main table with one or more others by a matching column, like a VLOOKUP/left join done any number of times. Two ways to feed it, picked with a small switch at the top of this mode:
  - **"Tabs in one Google Sheet"** (the easy, common case) — paste one spreadsheet link, click **List tabs**, pick which tab is the main table, then pick any other tabs *in that same spreadsheet* to link onto it (e.g. a "Products" tab matched by a product ID column). No need to paste the same link more than once or juggle separate files — everything comes from the one sheet you already have.
  - **"Separate files"** — the older flow: upload a base file, then upload other files to link onto it, for when the data genuinely lives in different files rather than tabs of one sheet.

  Either way, every linked sheet/file is matched directly against the **base table's own columns** (not against another linked sheet's columns) — covers "one main sheet + a few reference/lookup sheets" cleanly. If sheet C's key only exists in sheet B (a true chain, not a star), merge A+B first, apply it, then reopen Import → Merge using that result as the new base and C as the linked one.

  Once merged, the page behaves exactly like any other page (one flat table) — Page-level access, the row cache, Measures/Calculated Columns, and everything else in this README work on it the same way, since none of them care where the rows originally came from.

  "List tabs" needs Google Drive connected (see "Connecting data" below) — it calls the Sheets API to read the spreadsheet's tab names, same as picking a tab when connecting a page's main data source.

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

The assistant calls `/api/assistant` (see `src/lib/assistant.ts`) — it never calls Google/Anthropic directly from the browser, since an API key in frontend code would be visible via devtools.

By default this is wired up for **Google's Gemini API**, which has a genuine free tier (no credit card needed) — a better fit for a small internal tool than Anthropic's API, which is pay-as-you-go with no permanent free tier.

To enable it on Vercel:
1. Rename `api/assistant.example.js` to `api/assistant.js`.
2. Get a free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) — sign in with any Google account, click "Create API key." No billing setup required for the free tier.
3. In Vercel → Settings → Environment Variables, add `GEMINI_API_KEY` = the key you just copied.
4. Redeploy — Vercel automatically turns files in `/api` into serverless functions.

**Free-tier limits** (Google can change these — check [ai.google.dev/gemini-api/docs/rate-limits](https://ai.google.dev/gemini-api/docs/rate-limits) for current numbers): the default model, `gemini-3.5-flash-lite`, comfortably covers a small team's occasional questions and has Google's highest free daily quota in the current lineup. For noticeably smarter answers at a lower daily cap, switch the `model` value in `api/assistant.js` to `gemini-3.5-flash`.

**If you hit a `"models/... is no longer available to new users"` error:** Google has been retiring `gemini-2.5-*` model IDs for new API keys well before their listed shutdown dates. Check [ai.google.dev/gemini-api/docs/models](https://ai.google.dev/gemini-api/docs/models) for the current model list and swap the `model` value in `api/assistant.js` — nothing else needs to change.

**One tradeoff worth knowing:** on the free tier, Google's terms allow using your prompts/responses to improve their models (this stops applying once billing is enabled on the project, or on Vertex AI). For an internal inventory-accounting tool this is usually a non-issue, but keep it in mind.

**Prefer Claude instead?** Anthropic's API has no permanent free tier (it's billed per token, though Claude Sonnet is inexpensive for short answers like this) but some people prefer its answer quality/style. Swap `api/assistant.js`'s fetch call for `https://api.anthropic.com/v1/messages` with an `x-api-key` header and `ANTHROPIC_API_KEY` instead — same request/response shape otherwise (`{ question, departmentName, columns, sampleRows, totalRows }` in, `{ answer }` out), so nothing on the frontend needs to change either way.

**Troubleshooting "I couldn't reach the assistant backend":**
- Did you rename the file (step 1)? If it's still `assistant.example.js`, Vercel never turns it into an endpoint and `/api/assistant` 404s.
- Is `GEMINI_API_KEY` set in Vercel's **Environment Variables** (not just your local `.env`)? Did you redeploy after adding it?
- Check **Vercel → your project → Deployments → (latest) → Functions/Logs** for the actual error message from `api/assistant.js` — it's usually more specific than what shows in the chat panel.
- Make sure the `model` value in `api/assistant.js` is a real, current model name (check [ai.google.dev/gemini-api/docs/models](https://ai.google.dev/gemini-api/docs/models) for the current list) — an outdated or mistyped model name will make every request fail with a 400/404 error.

### "Explain this" buttons on filters, charts, pivots, and matrices

Every active filter (in the filter bar) and every Chart/Pivot/Matrix widget has a small ✨ button in its header, separate from the full **AI Assistant** panel. Clicking it asks the same `/api/assistant` endpoint above (so it needs the same one-time setup) a question built automatically from that exact filter/widget's own configuration — which column, which value/aggregation/grouping — and always answers in plain, non-technical Arabic.

Unlike the full Assistant panel (Admin/Manager/Employee only — Viewer is excluded there, see "Roles & permissions"), these buttons are available to **every role, including Viewer**: they only ever explain something already visible on screen, never open a general chat, so there's nothing extra being exposed by letting everyone use them.

If `/api/assistant` isn't set up yet, these buttons show the same "couldn't reach the assistant backend" message as the main panel — the setup above covers both.

## Real authentication & Row Level Security (implemented)

The app now uses real **Supabase Auth** (email + password) instead of the old client-side email allow-list, and the database enforces roles itself via **Row Level Security** — not just the UI hiding buttons. This only applies once Supabase is configured (see "Setting up shared storage" above); without Supabase, the app still falls back to the old email-only allow-list for a quick local trial.

**What changed, concretely:**
- Signing in now checks a real password against Supabase Auth (`supabase.auth.signInWithPassword`), not just "is this email on a list."
- A person's role still lives in `app_users` (looked up by email) — but now every table's Postgres policies check that role directly (via a `my_role()` function keyed off the signed-in session), so the *database* refuses an unauthorized write even if someone bypassed the app's UI entirely (browser devtools, a raw API call, etc.). Under the old "anon full access" policies, the anon key alone had full read/write on every table, signed in or not.
- Removing someone in **Manage Users** immediately revokes their access at the database level (no matching `app_users` row = every policy below blocks them), not just from the interface.

**One-time setup (run this after the SQL in "Setting up shared storage" above):**

```sql
-- 1. A security-definer function that looks up the CALLER's own role via
--    their signed-in email — SECURITY DEFINER lets it read app_users
--    internally regardless of that table's own restrictive policy below,
--    while still only ever returning the caller's own row.
create or replace function public.my_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from app_users where email = auth.jwt() ->> 'email' limit 1;
$$;

grant execute on function public.my_role() to authenticated;

-- 2. Drop the old blanket-access policies from "Setting up shared storage" —
--    those let anyone with the anon key read/write everything, signed in or
--    not. The policies below replace them with real role checks.
drop policy if exists "anon full access" on teams;
drop policy if exists "anon full access" on pages;
drop policy if exists "anon full access" on widgets;
drop policy if exists "anon full access" on page_row_chunks;
drop policy if exists "anon full access" on app_users;
drop policy if exists "anon full access" on activity_log;

-- 3. Real policies. Anyone with an assigned role can view teams/pages/
--    widgets/data; only Admins & Managers can create/rename/delete
--    structure or edit widgets (matches canManageStructure/canEditWidgets
--    in src/lib/permissions.ts); only Admins touch data sources
--    (canManageDataSources); only Admins manage the user list.
create policy "read for any signed-in role" on teams for select using (public.my_role() is not null);
create policy "write for admin/manager" on teams for insert with check (public.my_role() in ('admin','manager'));
create policy "update for admin/manager" on teams for update using (public.my_role() in ('admin','manager')) with check (public.my_role() in ('admin','manager'));
create policy "delete for admin/manager" on teams for delete using (public.my_role() in ('admin','manager'));

create policy "read for any signed-in role" on pages for select using (public.my_role() is not null);
create policy "write for admin/manager" on pages for insert with check (public.my_role() in ('admin','manager'));
create policy "update for admin/manager" on pages for update using (public.my_role() in ('admin','manager')) with check (public.my_role() in ('admin','manager'));
create policy "delete for admin/manager" on pages for delete using (public.my_role() in ('admin','manager'));

create policy "read for any signed-in role" on widgets for select using (public.my_role() is not null);
create policy "write for admin/manager" on widgets for insert with check (public.my_role() in ('admin','manager'));
create policy "update for admin/manager" on widgets for update using (public.my_role() in ('admin','manager')) with check (public.my_role() in ('admin','manager'));
create policy "delete for admin/manager" on widgets for delete using (public.my_role() in ('admin','manager'));

create policy "read for any signed-in role" on page_row_chunks for select using (public.my_role() is not null);
create policy "write for admin" on page_row_chunks for insert with check (public.my_role() = 'admin');
create policy "update for admin" on page_row_chunks for update using (public.my_role() = 'admin') with check (public.my_role() = 'admin');
create policy "delete for admin" on page_row_chunks for delete using (public.my_role() = 'admin');

create policy "admin full access" on app_users for all using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

create policy "insert for any signed-in role" on activity_log for insert with check (public.my_role() is not null);
create policy "read for admin/manager" on activity_log for select using (public.my_role() in ('admin','manager'));
```

**Bootstrapping the very first Admin account** (chicken-and-egg: `app_users` inserts now require already being an Admin, so the first one has to be created directly, not through the app):

1. Supabase Dashboard → **Authentication → Users → Add user**. Set the email to `mohamed.mahmoudsalah@breadfast.com` and a real password. Leave "Auto Confirm User" checked (or see the email-confirmation note below).
2. Back in the **SQL Editor**, run:
   ```sql
   insert into app_users (email, role) values ('mohamed.mahmoudsalah@breadfast.com', 'admin')
   on conflict (email) do update set role = 'admin';
   ```
   (Running this in the SQL Editor executes as the Postgres superuser, so it isn't subject to the RLS policies above — this is the one and only manual bootstrap step.)
3. Sign in to the app with that email/password. From there, use **Manage Users** to add everyone else — the app handles both the Supabase Auth account and the `app_users` role together.

**About email confirmation:** Supabase's Email provider (Authentication → Providers → Email) has a "Confirm email" toggle. For a small internal tool without transactional email set up, turning it **off** means an account works with its password immediately — no confirmation link to click. Leave it **on** for extra safety if you'd rather every new account confirm via email first (needs Supabase's built-in email sending or your own SMTP configured under Authentication → Settings).

**Known limitation:** removing someone in Manage Users deletes their `app_users` row (which the RLS policies above key everything off, so their access is fully cut immediately) but does **not** delete their underlying Supabase Auth login credential — that requires the `service_role` key, which the browser never has access to for good reason. To fully delete the account too: Supabase Dashboard → Authentication → Users → find them → Delete. A server-side admin API route (using the service key, never shipped to the browser) would be the way to fold that into the app itself later.

## Page-level access for Employee/Viewer

Admin and Manager always see every team and page, same as before. Employee and Viewer can now be scoped down to **specific pages only** — everything else is hidden from them, not just in the UI but at the database level (Postgres itself refuses to return rows for pages they weren't given access to).

**One-time setup (run this after the RLS setup above):**

```sql
create table user_page_access (
  email text not null references app_users(email) on delete cascade,
  page_id text not null references pages(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (email, page_id)
);

alter table user_page_access enable row level security;
alter publication supabase_realtime add table user_page_access;
alter table user_page_access replica identity full;

-- Admin/Manager assign access for anyone; a signed-in person can also read
-- their own assignment row (not strictly required by the app today, since
-- Employee/Viewer never call loadAllPageAccess() themselves, but keeps the
-- policy honest for any future screen that shows someone their own access).
create policy "admin/manager manage access" on user_page_access for all
  using (public.my_role() in ('admin','manager'))
  with check (public.my_role() in ('admin','manager'));
create policy "read own access" on user_page_access for select
  using (email = auth.jwt() ->> 'email');

-- True for Admin/Manager unconditionally, or for anyone else who has an
-- explicit row in user_page_access for that page. SECURITY DEFINER so it
-- can check user_page_access even though that table's own policy above
-- would otherwise only let a non-admin see their own rows anyway — this
-- just keeps the check in one place instead of repeating the OR in every
-- policy below.
create or replace function public.can_access_page(p_page_id text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    public.my_role() in ('admin','manager')
    or exists (
      select 1 from user_page_access
      where page_id = p_page_id and email = auth.jwt() ->> 'email'
    );
$$;

grant execute on function public.can_access_page(text) to authenticated;

-- IMPORTANT — grandfather in everyone who already has an Employee/Viewer
-- account: before locking reads down, give every EXISTING Employee/Viewer
-- explicit access to every page that EXISTS RIGHT NOW. Nobody's account
-- and no data gets touched by this — it only adds rows to the new
-- user_page_access table, so existing Employee/Viewer users keep seeing
-- exactly what they already see today. From this point on, this is a
-- one-time backfill only: any NEW Employee/Viewer added after today starts
-- with zero pages (as intended) and an Admin/Manager assigns them
-- explicitly in Manage Users. Run this once, right here, before the policy
-- swap below — running it again later is harmless (on conflict do
-- nothing), but it won't un-assign anything an Admin has since narrowed
-- down.
insert into user_page_access (email, page_id)
select u.email, p.id
from app_users u
cross join pages p
where u.role in ('employee', 'viewer')
on conflict (email, page_id) do nothing;

-- Replace the old "any signed-in role can read everything" policies on
-- pages/widgets/page_row_chunks with page-scoped ones. Writes are
-- untouched (still admin/manager for pages/widgets, admin-only for row
-- data) — this only changes what Employee/Viewer can SELECT.
drop policy if exists "read for any signed-in role" on pages;
create policy "read own accessible pages" on pages for select using (public.can_access_page(id));

drop policy if exists "read for any signed-in role" on widgets;
create policy "read own accessible pages" on widgets for select using (public.can_access_page(page_id));

drop policy if exists "read for any signed-in role" on page_row_chunks;
create policy "read own accessible pages" on page_row_chunks for select using (public.can_access_page(page_id));
```

**Assigning access:** in **Manage Users**, any Employee or Viewer row has a "Page access" toggle — expand it to check off exactly which teams/pages that person can see. **Existing** Employee/Viewer accounts start out fully checked (every current page — see the grandfather-in step above), so nothing changes for them the moment you run this migration; **new** Employees/Viewers added after today start with nothing checked until an Admin/Manager assigns some.

**Note on `teams`:** the `teams` table itself is intentionally left readable by any signed-in role (team *names* aren't sensitive on their own) — Employee/Viewer will see every team in the sidebar, but a team none of their assigned pages belong to just shows empty when expanded. The app already filters these empty teams out of the sidebar for Employee/Viewer client-side, so in practice they only ever see teams that actually contain a page they have access to.

**Without Supabase configured (local fallback mode):** there's no database to enforce this, so the same "Page access" UI in Manage Users just stores the assignment in that browser's local storage instead, and the app filters the sidebar/dashboard against it client-side — the same "client-side gate" trust model the rest of local mode already uses. Fine for a quick trial; use the real Supabase setup above for anything where this actually needs to be enforced.

**Troubleshooting "an Employee/Viewer still sees everything even after assigning specific pages":** `drop policy if exists` succeeds silently even when nothing matched — so if an earlier draft of this project's SQL left a differently-named permissive SELECT policy on `pages`/`widgets`/`page_row_chunks` (Postgres OR's every matching policy together, so *any* permissive one being present is enough to leak full access), the drop above wouldn't have removed it. Run this once in the SQL Editor to see exactly what's active:
```sql
select tablename, policyname, cmd
from pg_policies
where tablename in ('pages', 'widgets', 'page_row_chunks')
order by tablename, policyname;
```
If a SELECT policy other than `"read own accessible pages"` shows up for any of these three tables, clear the slate and recreate just the intended one:
```sql
do $$
declare pol record;
begin
  for pol in
    select policyname, tablename from pg_policies
    where tablename in ('pages', 'widgets', 'page_row_chunks') and cmd = 'SELECT'
  loop
    execute format('drop policy %I on %I', pol.policyname, pol.tablename);
  end loop;
end $$;

create policy "read own accessible pages" on pages for select using (public.can_access_page(id));
create policy "read own accessible pages" on widgets for select using (public.can_access_page(page_id));
create policy "read own accessible pages" on page_row_chunks for select using (public.can_access_page(page_id));
```
This only touches SELECT policies on these three tables — writes and every other table are untouched, and no data is affected.

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
