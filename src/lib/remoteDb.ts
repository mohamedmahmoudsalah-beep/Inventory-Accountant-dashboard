import { getSupabase } from "./supabase";
import { savePersistedState, loadPersistedState } from "./persistence";
import type {
  Department, TaskPage, DataRow, ChartConfig, PivotConfig, MatrixConfig, CardConfig, TextConfig,
} from "../types";

const TEAMS = "teams";
const PAGES = "pages";
const WIDGETS = "widgets";
const PAGE_ROW_CHUNKS = "page_row_chunks";

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

// While this client is busy writing its own page's chunks (which can be
// hundreds of individual writes for a huge sheet), each one of those writes
// is itself a realtime change event on PAGE_ROW_CHUNKS. Reacting to every
// single one with a full reload (see subscribeToTeamsChanges below) used to
// cause a "reload storm" for the exact duration of a big save: dozens of
// heavy, overlapping reads piling up, which is what actually produced the
// hang/timeout ("canceling statement due to statement timeout") — not the
// writes themselves. This client already has the freshest data in memory
// (it just wrote it), so it has nothing to gain from reloading itself mid-save.
let selfWriteDepth = 0;

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

/** Reads every row of page_row_chunks, in bounded pages rather than one
 *  single query. A single unbounded select here was the actual cause of the
 *  "canceling statement due to statement timeout" errors on a large
 *  dataset — Postgres was choking on one giant read, especially while a lot
 *  of writes were happening at the same time. Reading in modest pages keeps
 *  each individual query fast and light, regardless of total sheet size. */
async function loadAllRowChunks(
  supabase: ReturnType<typeof getSupabase>
): Promise<{ data: PageRowChunkRow[] | null; error: unknown }> {
  const PAGE_SIZE = 100; // each chunk row can be up to ~500KB (MAX_CHUNK_BYTES), so keep this modest — 500 of them in one response would defeat the point of paginating at all.
  const all: PageRowChunkRow[] = [];
  let offset = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase!
      .from(PAGE_ROW_CHUNKS)
      .select("page_id, chunk_index, data")
      .order("page_id", { ascending: true })
      .order("chunk_index", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) return { data: null, error };
    all.push(...((data ?? []) as PageRowChunkRow[]));
    if (!data || data.length < PAGE_SIZE) break; // last page
    offset += PAGE_SIZE;
  }
  return { data: all, error: null };
}

/** Loads every team/page/widget and reconstructs the same Department[] tree
 *  shape the rest of the app already works with. Falls back to this
 *  browser's local storage when Supabase isn't configured or the read
 *  fails, rather than blocking the app. */
export async function loadAllTeams(): Promise<Department[] | null> {
  const supabase = getSupabase();
  if (!supabase) return loadPersistedState()?.departments ?? null;

  const [teamsRes, pagesRes, widgetsRes, rowChunksRes] = await Promise.all([
    supabase.from(TEAMS).select("*").order("created_at", { ascending: true }),
    supabase.from(PAGES).select("*").order("created_at", { ascending: true }),
    supabase.from(WIDGETS).select("*").order("created_at", { ascending: true }),
    loadAllRowChunks(supabase),
  ]);

  if (teamsRes.error || pagesRes.error || widgetsRes.error || rowChunksRes.error) {
    console.error(
      "Supabase: failed to load teams/pages/widgets, falling back to local storage.",
      teamsRes.error ?? pagesRes.error ?? widgetsRes.error ?? rowChunksRes.error
    );
    return loadPersistedState()?.departments ?? null;
  }

  const teams = (teamsRes.data ?? []) as TeamRow[];
  const pages = (pagesRes.data ?? []) as PageRow[];
  const widgets = (widgetsRes.data ?? []) as WidgetRow[];
  const rowChunks = (rowChunksRes.data ?? []) as PageRowChunkRow[];
  if (teams.length === 0) return null; // nothing saved yet - let the caller seed defaults

  const widgetsByPage = new Map<string, WidgetRow[]>();
  widgets.forEach((w) => {
    if (!widgetsByPage.has(w.page_id)) widgetsByPage.set(w.page_id, []);
    widgetsByPage.get(w.page_id)!.push(w);
  });

  // Chunks already arrive ordered by chunk_index (the query above), so
  // concatenating them in the order received reconstructs the original row
  // order correctly.
  const rowsByPage = new Map<string, DataRow[]>();
  rowChunks.forEach((c) => {
    if (!rowsByPage.has(c.page_id)) rowsByPage.set(c.page_id, []);
    rowsByPage.get(c.page_id)!.push(...(c.data ?? []));
  });

  const pagesByTeam = new Map<string, TaskPage[]>();
  pages.forEach((p) => {
    if (!pagesByTeam.has(p.team_id)) pagesByTeam.set(p.team_id, []);
    pagesByTeam
      .get(p.team_id)!
      .push(pageRowToTaskPage(p, widgetsByPage.get(p.id) ?? [], rowsByPage.get(p.id) ?? []));
  });

  const departments = teams.map((t) => ({ id: t.id, name: t.name, pages: pagesByTeam.get(t.id) ?? [] }));
  // Mirror locally too, as an offline fallback.
  savePersistedState({ departments, activeDeptId: departments[0]?.id ?? "", activePageId: departments[0]?.pages[0]?.id ?? "" });
  return departments;
}

let saveFailWarned = false;
function warnSaveFailedOnce(context: string, error: unknown) {
  console.error(`Supabase: failed to save ${context} — this change was NOT saved for other devices.`, error);
  if (!saveFailWarned) {
    saveFailWarned = true;
    alert(
      "Your changes are only saved in this browser right now — they didn't save to the shared database. " +
        "Open the browser console (F12 → Console) for the exact error, or check that the Supabase SQL setup " +
        "was run on this exact project and that VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY are correct."
    );
  }
}

export async function saveTeamRemote(team: { id: string; name: string }): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const { error } = await supabase.from(TEAMS).upsert({ id: team.id, name: team.name });
    if (error) warnSaveFailedOnce("a team", error);
  } catch (e) {
    warnSaveFailedOnce("a team", e);
  }
}

export async function deleteTeamRemote(id: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const { error } = await supabase.from(TEAMS).delete().eq("id", id);
    if (error) warnSaveFailedOnce("a team deletion", error);
  } catch (e) {
    warnSaveFailedOnce("a team deletion", e);
  }
}

/** Writes a page's rows in small chunks instead of one giant blob — see the
 *  comment at the top of this file for why. Safe to call with an empty
 *  array (just clears any existing chunks for the page). */
async function saveRowsRemote(pageId: string, rows: DataRow[]): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return true;

  const chunks = chunkRows(rows);
  const CONCURRENCY = 4; // a handful of parallel requests moves through hundreds of chunks much faster than one at a time, without opening so many at once that it looks like a flood.

  selfWriteDepth++;
  try {
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
  } finally {
    selfWriteDepth--;
  }
}

/** Saves a page's own config fields (small, always safe to write in one
 *  request) and, when includeRows is set, its actual row data (written
 *  separately, in chunks — see saveRowsRemote). Row data is only sent for
 *  pages with no live source (manual imports) or right after a live fetch —
 *  sheet-connected pages can always be re-fetched, so their (potentially
 *  huge) row data doesn't need to be re-sent on every unrelated edit. */
export async function savePageRemote(page: TaskPage, teamId: string, includeRows = false): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const shouldIncludeRows = includeRows || page.sourceType === "manual";

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
      return; // don't bother writing rows if the page's own row failed
    }
  } catch (e) {
    warnSaveFailedOnce("a page", e);
    return;
  }

  if (shouldIncludeRows) await saveRowsRemote(page.id, page.rows);
}

export async function deletePageRemote(id: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    // Row chunks aren't cleaned up by an on-delete-cascade unless the SQL
    // setup includes it — deleting them explicitly here works either way.
    await supabase.from(PAGE_ROW_CHUNKS).delete().eq("page_id", id);
    const { error } = await supabase.from(PAGES).delete().eq("id", id);
    if (error) warnSaveFailedOnce("a page deletion", error);
  } catch (e) {
    warnSaveFailedOnce("a page deletion", e);
  }
}

export async function saveWidgetRemote(
  id: string,
  pageId: string,
  kind: WidgetKind,
  config: ChartConfig | PivotConfig | MatrixConfig | CardConfig | TextConfig
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const { error } = await supabase.from(WIDGETS).upsert({ id, page_id: pageId, kind, config });
    if (error) warnSaveFailedOnce("a widget", error);
  } catch (e) {
    warnSaveFailedOnce("a widget", e);
  }
}

export async function deleteWidgetRemote(id: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const { error } = await supabase.from(WIDGETS).delete().eq("id", id);
    if (error) warnSaveFailedOnce("a widget deletion", error);
  } catch (e) {
    warnSaveFailedOnce("a widget deletion", e);
  }
}

/** Realtime: rather than trying to merge partial row-level changes into
 *  local state, any change on any of the four tables just triggers a
 *  fresh reload. teams/pages/widgets are small and infrequent, so they keep
 *  a short debounce. page_row_chunks is different: a single big sheet
 *  refresh can be hundreds of individual chunk writes in quick succession,
 *  so it gets a longer debounce (to coalesce a whole burst into one reload
 *  instead of many overlapping ones) and is skipped entirely while THIS
 *  client is the one doing that writing — it already has the freshest data
 *  in memory and gains nothing from reloading itself mid-save. Both of
 *  these were root causes of the app appearing to hang / occasionally
 *  timing out while a large sheet was being refreshed. */
export function subscribeToTeamsChanges(onChange: (departments: Department[]) => void): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => {};

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  function reload(delay: number) {
    if (selfWriteDepth > 0) return; // we're mid-save ourselves — our own local state is already the freshest there is
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const departments = await loadAllTeams();
      if (departments) onChange(departments);
    }, delay);
  }

  const channel = supabase
    .channel("teams_pages_widgets_changes")
    .on("postgres_changes", { event: "*", schema: "public", table: TEAMS }, () => reload(300))
    .on("postgres_changes", { event: "*", schema: "public", table: PAGES }, () => reload(300))
    .on("postgres_changes", { event: "*", schema: "public", table: WIDGETS }, () => reload(300))
    .on("postgres_changes", { event: "*", schema: "public", table: PAGE_ROW_CHUNKS }, () => reload(2500))
    .subscribe((status, err) => {
      if (status === "CHANNEL_ERROR" || err) {
        console.error("Supabase: realtime subscription for teams/pages/widgets failed to connect.", err ?? status);
      }
    });

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    supabase.removeChannel(channel);
  };
}
