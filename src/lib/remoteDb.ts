import { getSupabase } from "./supabase";
import { savePersistedState, loadPersistedState } from "./persistence";
import { showToast } from "./toast";
import type {
  Department, TaskPage, DataRow, ChartConfig, PivotConfig, MatrixConfig, CardConfig, TextConfig,
} from "../types";

const TEAMS = "teams";
const PAGES = "pages";
const WIDGETS = "widgets";
const PAGE_ROW_CHUNKS = "page_row_chunks";
const ACTIVITY_LOG = "activity_log";

/** Best-effort audit trail: "who did what, when" for the high-level actions
 *  (team/page create-rename-delete, connecting/refreshing data, user
 *  management). Deliberately fire-and-forget — a logging failure should
 *  never block or fail the actual action it's describing, so errors here
 *  are only logged to the console, never surfaced to the person. Requires
 *  the `activity_log` table from the README's Supabase setup; silently does
 *  nothing if Supabase isn't configured or the table doesn't exist yet. */
export async function logActivity(actorEmail: string, action: string, details?: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const { error } = await supabase.from(ACTIVITY_LOG).insert({ actor_email: actorEmail, action, details });
    if (error) console.warn("Activity log: failed to record entry (non-fatal).", error);
  } catch (e) {
    console.warn("Activity log: failed to record entry (non-fatal).", e);
  }
}

export interface ActivityLogEntry {
  id: string;
  actor_email: string;
  action: string;
  details: string | null;
  created_at: string;
}

/** Fetches the most recent activity log entries, newest first. */
export async function loadActivityLog(limit = 100): Promise<ActivityLogEntry[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from(ACTIVITY_LOG)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn("Activity log: failed to load entries.", error);
    return [];
  }
  return (data ?? []) as ActivityLogEntry[];
}

// A page's rows used to be stuffed into a single jsonb column (pages.rows)
// as one giant array. For a big sheet (100k+ rows), that one write is a
// single, huge HTTP request — which can silently exceed Supabase's request
// size limits. When that happened, the local browser still looked totally
// fine (it already had the freshly-fetched data in memory), but the write to
// Supabase never actually landed — so every *other* session, and even the
// same Admin on a fresh reload, kept reading back an old/empty row. That's
// the actual cause of "it works for me right now, but looks empty/stale for
// everyone else" on large sheets specifically.
//
// The fix: split a page's rows across many small chunks (a separate table,
// one row per chunk) and write each chunk as its own request. No single
// request ever needs to hold more than a small slice of the data, no matter
// how many total rows the sheet has (tested conceptually against millions).
const MAX_CHUNK_ROWS = 3000;
const MAX_CHUNK_BYTES = 500_000; // ~500KB of serialized JSON per chunk — comfortably small regardless of how many columns a sheet has, so wide sheets still chunk safely even with fewer rows per chunk.

// While this client is busy writing (anything — a team rename, a widget
// edit, or a big chunked row save), each write is itself a realtime change
// event that would otherwise trigger this same client to reload its own
// just-written data right back. That was pure waste at best (a redundant
// full-app re-render on every single edit) and actively harmful at worst
// (see the reload-storm note below). Two mechanisms cover this:
//  - selfWriteDepth: true for the exact duration of a write that's still
//    in flight (matters most for the long chunked row save).
//  - lastSelfWriteAt: a short window after a write's HTTP response has
//    already come back, since the realtime notification for that same
//    write is a separate round-trip that can easily arrive a moment later
//    — by which point selfWriteDepth may already be back to 0.
let selfWriteDepth = 0;
let lastSelfWriteAt = 0;
const SELF_ECHO_WINDOW_MS = 2000;

function isLikelySelfEcho(): boolean {
  return selfWriteDepth > 0 || Date.now() - lastSelfWriteAt < SELF_ECHO_WINDOW_MS;
}

async function trackSelfWrite<T>(fn: () => Promise<T>): Promise<T> {
  selfWriteDepth++;
  try {
    return await fn();
  } finally {
    selfWriteDepth--;
    lastSelfWriteAt = Date.now();
  }
}

function chunkRows(rows: DataRow[]): DataRow[][] {
  if (rows.length === 0) return [];
  const chunks: DataRow[][] = [];
  let current: DataRow[] = [];
  let currentBytes = 0;
  for (const row of rows) {
    const rowBytes = JSON.stringify(row).length;
    if (current.length > 0 && (current.length >= MAX_CHUNK_ROWS || currentBytes + rowBytes > MAX_CHUNK_BYTES)) {
      chunks.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(row);
    currentBytes += rowBytes;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

type WidgetKind = "chart" | "pivot" | "matrix" | "card" | "text";

interface WidgetRow {
  id: string;
  page_id: string;
  kind: WidgetKind;
  config: ChartConfig | PivotConfig | MatrixConfig | CardConfig | TextConfig;
}

interface PageRow {
  id: string;
  team_id: string;
  name: string;
  source_type: string | null;
  sheet_url: string | null;
  sheet_tab_title: string | null;
  last_updated: string | null;
  columns: string[] | null;
  measures: unknown[] | null;
  calculated_columns: unknown[] | null;
  active_filters: unknown[] | null;
  widget_order: string[] | null;
}

interface PageRowChunkRow {
  page_id: string;
  chunk_index: number;
  data: DataRow[];
}

interface TeamRow {
  id: string;
  name: string;
}

function pageRowToTaskPage(row: PageRow, widgets: WidgetRow[], rows: DataRow[]): TaskPage {
  return {
    id: row.id,
    name: row.name,
    sourceType: (row.source_type as TaskPage["sourceType"]) ?? "manual",
    sheetUrl: row.sheet_url ?? "",
    sheetTabTitle: row.sheet_tab_title ?? undefined,
    lastUpdated: row.last_updated,
    columns: row.columns ?? [],
    rows,
    measures: (row.measures as TaskPage["measures"]) ?? [],
    calculatedColumns: (row.calculated_columns as TaskPage["calculatedColumns"]) ?? [],
    activeFilters: (row.active_filters as TaskPage["activeFilters"]) ?? [],
    widgetOrder: row.widget_order ?? [],
    charts: widgets.filter((w) => w.kind === "chart").map((w) => w.config as ChartConfig),
    pivots: widgets.filter((w) => w.kind === "pivot").map((w) => w.config as PivotConfig),
    matrices: widgets.filter((w) => w.kind === "matrix").map((w) => w.config as MatrixConfig),
    cards: widgets.filter((w) => w.kind === "card").map((w) => w.config as CardConfig),
    texts: widgets.filter((w) => w.kind === "text").map((w) => w.config as TextConfig),
  };
}

/** Fetches teams/pages/widgets only — no row data. Used both for the one
 *  true full load at startup and for every metadata-only realtime reload
 *  (a rename, a filter change, a widget edit, ...), which never needs to
 *  touch row data at all. */
async function fetchTeamsPagesWidgets(): Promise<
  { teams: TeamRow[]; pages: PageRow[]; widgets: WidgetRow[] } | null
> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const [teamsRes, pagesRes, widgetsRes] = await Promise.all([
    supabase.from(TEAMS).select("*").order("created_at", { ascending: true }),
    supabase.from(PAGES).select("*").order("created_at", { ascending: true }),
    supabase.from(WIDGETS).select("*").order("created_at", { ascending: true }),
  ]);
  if (teamsRes.error || pagesRes.error || widgetsRes.error) {
    console.error(
      "Supabase: failed to load teams/pages/widgets metadata.",
      teamsRes.error ?? pagesRes.error ?? widgetsRes.error
    );
    return null;
  }
  return {
    teams: (teamsRes.data ?? []) as TeamRow[],
    pages: (pagesRes.data ?? []) as PageRow[],
    widgets: (widgetsRes.data ?? []) as WidgetRow[],
  };
}

function buildDepartments(
  teams: TeamRow[],
  pages: PageRow[],
  widgets: WidgetRow[],
  rowsByPage: Map<string, DataRow[]>
): Department[] {
  const widgetsByPage = new Map<string, WidgetRow[]>();
  widgets.forEach((w) => {
    if (!widgetsByPage.has(w.page_id)) widgetsByPage.set(w.page_id, []);
    widgetsByPage.get(w.page_id)!.push(w);
  });

  const pagesByTeam = new Map<string, TaskPage[]>();
  pages.forEach((p) => {
    if (!pagesByTeam.has(p.team_id)) pagesByTeam.set(p.team_id, []);
    pagesByTeam
      .get(p.team_id)!
      .push(pageRowToTaskPage(p, widgetsByPage.get(p.id) ?? [], rowsByPage.get(p.id) ?? []));
  });

  return teams.map((t) => ({ id: t.id, name: t.name, pages: pagesByTeam.get(t.id) ?? [] }));
}

/** Fetches just one page's rows, in bounded pages. Used both when the app
 *  first shows a page (lazy load — see App.tsx) and when a realtime event
 *  says only that one page's chunks changed — there's no reason to ever
 *  read anyone else's data just because one page's sheet was refreshed. */
export async function loadPageRows(pageId: string): Promise<DataRow[] | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const PAGE_SIZE = 100;
  const all: DataRow[] = [];
  let offset = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from(PAGE_ROW_CHUNKS)
      .select("chunk_index, data")
      .eq("page_id", pageId)
      .order("chunk_index", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) {
      console.error(`Supabase: failed to load rows for page ${pageId}.`, error);
      return null;
    }
    (data ?? []).forEach((c) => all.push(...((c as PageRowChunkRow).data ?? [])));
    if (!data || data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return all;
}

export type LoadTeamsResult =
  | { status: "ok"; departments: Department[] }
  // Genuinely nothing saved yet (a brand-new Supabase project) — safe for
  // the caller to seed a starting default team.
  | { status: "empty" }
  // The read itself failed (network blip, timeout, misconfigured
  // credentials, ...). This is NOT the same as "empty" and must never be
  // treated as one: an Admin's browser hitting a transient read error used
  // to look identical to "nothing saved yet" and would re-seed a brand new
  // blank default team right over whatever real data actually exists but
  // just failed to load this one time.
  | { status: "error"; localFallback: Department[] | null };

/** Loads every team/page/widget and reconstructs the same Department[] tree
 *  shape the rest of the app already works with — but with every page's
 *  `rows` starting empty. Only used for the one true full load at startup.
 *
 *  This used to also eagerly fetch every row of every page across every
 *  team in one go. That was the real cause of the app timing out on load
 *  once there were enough teams/pages/data: the very first thing it did was
 *  try to read far more than it actually needed right away (rows for pages
 *  nobody was even looking at yet). Now the initial load is just metadata
 *  (small, fast), and the caller is expected to call loadPageRows for
 *  whichever one page is actually being viewed — see App.tsx, which does
 *  this for the active page on mount and again whenever you switch pages. */
export async function loadAllTeams(): Promise<LoadTeamsResult> {
  const supabase = getSupabase();
  if (!supabase) return { status: "error", localFallback: loadPersistedState()?.departments ?? null };

  const metadata = await fetchTeamsPagesWidgets();
  if (!metadata) return { status: "error", localFallback: loadPersistedState()?.departments ?? null };

  const { teams, pages, widgets } = metadata;
  if (teams.length === 0) return { status: "empty" };

  const departments = buildDepartments(teams, pages, widgets, new Map());
  // Mirror locally too, as an offline fallback. Note: this intentionally
  // only ever caches whatever rows are already in memory for each page at
  // the time this runs elsewhere (App.tsx re-saves the fuller picture as
  // pages get lazily loaded) — this specific call just seeds structure.
  savePersistedState({ departments, activeDeptId: departments[0]?.id ?? "", activePageId: departments[0]?.pages[0]?.id ?? "" });
  return { status: "ok", departments };
}

let saveFailWarned = false;
function warnSaveFailedOnce(context: string, error: unknown) {
  console.error(`Supabase: failed to save ${context} — this change was NOT saved for other devices.`, error);
  if (!saveFailWarned) {
    saveFailWarned = true;
    showToast(
      `Couldn't save ${context} to the shared database — it's only in this browser right now. Check the console (F12) or your Supabase setup.`,
      { type: "error", durationMs: 8000 }
    );
  }
}

export async function saveTeamRemote(team: { id: string; name: string }): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await trackSelfWrite(async () => {
    try {
      const { error } = await supabase.from(TEAMS).upsert({ id: team.id, name: team.name });
      if (error) warnSaveFailedOnce("a team", error);
    } catch (e) {
      warnSaveFailedOnce("a team", e);
    }
  });
}

export async function deleteTeamRemote(id: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await trackSelfWrite(async () => {
    try {
      const { error } = await supabase.from(TEAMS).delete().eq("id", id);
      if (error) warnSaveFailedOnce("a team deletion", error);
    } catch (e) {
      warnSaveFailedOnce("a team deletion", e);
    }
  });
}

/** Writes a page's rows in small chunks instead of one giant blob — see the
 *  comment at the top of this file for why. Safe to call with an empty
 *  array (just clears any existing chunks for the page). onProgress (if
 *  given) is called after each batch with (chunksDone, totalChunks), so the
 *  UI can show real progress for a big save instead of it looking frozen. */
async function saveRowsRemote(
  pageId: string,
  rows: DataRow[],
  onProgress?: (done: number, total: number) => void
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return true;

  const chunks = chunkRows(rows);
  const CONCURRENCY = 4; // a handful of parallel requests moves through hundreds of chunks much faster than one at a time, without opening so many at once that it looks like a flood.

  return trackSelfWrite(async () => {
    try {
      onProgress?.(0, chunks.length);
      for (let start = 0; start < chunks.length; start += CONCURRENCY) {
        const batch = chunks.slice(start, start + CONCURRENCY);
        const results = await Promise.all(
          batch.map((chunk, i) =>
            supabase.from(PAGE_ROW_CHUNKS).upsert({ page_id: pageId, chunk_index: start + i, data: chunk })
          )
        );
        const failed = results.find((r) => r.error);
        if (failed?.error) {
          warnSaveFailedOnce("this page's data (a chunk of rows)", failed.error);
          return false;
        }
        onProgress?.(Math.min(start + CONCURRENCY, chunks.length), chunks.length);
      }
      // Clean up any leftover chunks from a previous, larger version of this
      // page's data (e.g. the sheet had more rows before) — otherwise stale
      // rows from an old chunk index would silently tag along forever.
      const { error: cleanupError } = await supabase
        .from(PAGE_ROW_CHUNKS)
        .delete()
        .eq("page_id", pageId)
        .gte("chunk_index", chunks.length);
      if (cleanupError) warnSaveFailedOnce("cleaning up old row chunks", cleanupError);
      return true;
    } catch (e) {
      warnSaveFailedOnce("this page's data (a chunk of rows)", e);
      return false;
    }
  });
}

/** Saves a page's own config fields (small, always safe to write in one
 *  request) and, when includeRows is set, its actual row data (written
 *  separately, in chunks — see saveRowsRemote). Row data is only sent for
 *  pages with no live source (manual imports) or right after a live fetch —
 *  sheet-connected pages can always be re-fetched, so their (potentially
 *  huge) row data doesn't need to be re-sent on every unrelated edit. */
export async function savePageRemote(
  page: TaskPage,
  teamId: string,
  includeRows = false,
  onRowSaveProgress?: (done: number, total: number) => void
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const shouldIncludeRows = includeRows || page.sourceType === "manual";

  const pageWriteOk = await trackSelfWrite(async () => {
    try {
      const { error } = await supabase.from(PAGES).upsert({
        id: page.id,
        team_id: teamId,
        name: page.name,
        source_type: page.sourceType ?? "manual",
        sheet_url: page.sheetUrl || null,
        sheet_tab_title: page.sheetTabTitle || null,
        last_updated: page.lastUpdated,
        columns: page.columns,
        measures: page.measures,
        calculated_columns: page.calculatedColumns,
        active_filters: page.activeFilters,
        widget_order: page.widgetOrder ?? [],
      });
      if (error) {
        warnSaveFailedOnce("a page", error);
        return false;
      }
      return true;
    } catch (e) {
      warnSaveFailedOnce("a page", e);
      return false;
    }
  });
  if (!pageWriteOk) return; // don't bother writing rows if the page's own row failed

  if (shouldIncludeRows) await saveRowsRemote(page.id, page.rows, onRowSaveProgress);
}

export async function deletePageRemote(id: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await trackSelfWrite(async () => {
    try {
      // Row chunks aren't cleaned up by an on-delete-cascade unless the SQL
      // setup includes it — deleting them explicitly here works either way.
      await supabase.from(PAGE_ROW_CHUNKS).delete().eq("page_id", id);
      const { error } = await supabase.from(PAGES).delete().eq("id", id);
      if (error) warnSaveFailedOnce("a page deletion", error);
    } catch (e) {
      warnSaveFailedOnce("a page deletion", e);
    }
  });
}

export async function saveWidgetRemote(
  id: string,
  pageId: string,
  kind: WidgetKind,
  config: ChartConfig | PivotConfig | MatrixConfig | CardConfig | TextConfig
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await trackSelfWrite(async () => {
    try {
      const { error } = await supabase.from(WIDGETS).upsert({ id, page_id: pageId, kind, config });
      if (error) warnSaveFailedOnce("a widget", error);
    } catch (e) {
      warnSaveFailedOnce("a widget", e);
    }
  });
}

export async function deleteWidgetRemote(id: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await trackSelfWrite(async () => {
    try {
      const { error } = await supabase.from(WIDGETS).delete().eq("id", id);
      if (error) warnSaveFailedOnce("a widget deletion", error);
    } catch (e) {
      warnSaveFailedOnce("a widget deletion", e);
    }
  });
}

/** Realtime, split into two independent, much narrower paths instead of one
 *  "anything changed, reload literally everything" handler:
 *
 *  - teams/pages/widgets (metadata) changes reuse whatever rows are already
 *    known locally for every page — a rename, a filter change, a widget
 *    edit, adding a team, etc. never implies row data changed, so there's
 *    no reason to ever re-fetch it here. This is what was actually causing
 *    "editing literally anything sometimes makes the data disappear": every
 *    single edit was re-fetching *all* rows for *all* pages from scratch,
 *    and if that big read was even slightly off (a network hiccup, timing,
 *    replication lag right after a write), the correct data on screen got
 *    replaced by an empty/partial one.
 *  - page_row_chunks changes re-fetch rows for *only* the one page whose
 *    chunks actually changed (read straight off the realtime payload
 *    itself), leaving every other page's already-loaded data untouched.
 *
 *  Both paths are skipped entirely while THIS client is the one doing the
 *  writing (selfWriteDepth > 0) — it already has the freshest data in
 *  memory. Both also simply do nothing on a failed read, rather than
 *  blanking out whatever was correctly on screen a moment ago. */
export function subscribeToTeamsChanges(
  getCurrentDepartments: () => Department[],
  onChange: (departments: Department[]) => void
): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => {};

  let metadataTimer: ReturnType<typeof setTimeout> | null = null;
  function reloadMetadata() {
    if (isLikelySelfEcho()) return;
    if (metadataTimer) clearTimeout(metadataTimer);
    metadataTimer = setTimeout(async () => {
      const metadata = await fetchTeamsPagesWidgets();
      if (!metadata || metadata.teams.length === 0) return;
      const existingRowsByPage = new Map<string, DataRow[]>();
      getCurrentDepartments().forEach((d) => d.pages.forEach((p) => existingRowsByPage.set(p.id, p.rows)));
      onChange(buildDepartments(metadata.teams, metadata.pages, metadata.widgets, existingRowsByPage));
    }, 300);
  }

  const rowsTimers = new Map<string, ReturnType<typeof setTimeout>>();
  function reloadPageRows(pageId: string) {
    if (isLikelySelfEcho()) return;
    const existing = rowsTimers.get(pageId);
    if (existing) clearTimeout(existing);
    rowsTimers.set(
      pageId,
      setTimeout(async () => {
        rowsTimers.delete(pageId);
        const rows = await loadPageRows(pageId);
        if (rows === null) return; // read failed — leave whatever's currently shown alone
        onChange(
          getCurrentDepartments().map((d) => ({
            ...d,
            pages: d.pages.map((p) => (p.id === pageId ? { ...p, rows } : p)),
          }))
        );
      }, 2500) // a big sheet refresh is hundreds of individual chunk writes in quick succession — coalesce a whole burst into one fetch instead of many overlapping ones
    );
  }

  const channel = supabase
    .channel("teams_pages_widgets_changes")
    .on("postgres_changes", { event: "*", schema: "public", table: TEAMS }, reloadMetadata)
    .on("postgres_changes", { event: "*", schema: "public", table: PAGES }, reloadMetadata)
    .on("postgres_changes", { event: "*", schema: "public", table: WIDGETS }, reloadMetadata)
    .on("postgres_changes", { event: "*", schema: "public", table: PAGE_ROW_CHUNKS }, (payload) => {
      const changed = (payload.new ?? payload.old) as { page_id?: string } | null;
      if (changed?.page_id) reloadPageRows(changed.page_id);
    })
    .subscribe((status, err) => {
      if (status === "CHANNEL_ERROR" || err) {
        console.error("Supabase: realtime subscription for teams/pages/widgets failed to connect.", err ?? status);
      }
    });

  return () => {
    if (metadataTimer) clearTimeout(metadataTimer);
    rowsTimers.forEach((t) => clearTimeout(t));
    supabase.removeChannel(channel);
  };
}
