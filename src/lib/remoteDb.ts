import { getSupabase } from "./supabase";
import { savePersistedState, loadPersistedState } from "./persistence";
import type {
  Department, TaskPage, ChartConfig, PivotConfig, MatrixConfig, CardConfig, TextConfig,
} from "../types";

const TEAMS = "teams";
const PAGES = "pages";
const WIDGETS = "widgets";

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
  rows: Record<string, unknown>[] | null;
  measures: unknown[] | null;
  calculated_columns: unknown[] | null;
  active_filters: unknown[] | null;
  widget_order: string[] | null;
}

interface TeamRow {
  id: string;
  name: string;
}

function pageRowToTaskPage(row: PageRow, widgets: WidgetRow[]): TaskPage {
  return {
    id: row.id,
    name: row.name,
    sourceType: (row.source_type as TaskPage["sourceType"]) ?? "manual",
    sheetUrl: row.sheet_url ?? "",
    sheetTabTitle: row.sheet_tab_title ?? undefined,
    lastUpdated: row.last_updated,
    columns: row.columns ?? [],
    rows: (row.rows as TaskPage["rows"]) ?? [],
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

/** Loads every team/page/widget and reconstructs the same Department[] tree
 *  shape the rest of the app already works with. Falls back to this
 *  browser's local storage when Supabase isn't configured or the read
 *  fails, rather than blocking the app. */
export async function loadAllTeams(): Promise<Department[] | null> {
  const supabase = getSupabase();
  if (!supabase) return loadPersistedState()?.departments ?? null;

  const [teamsRes, pagesRes, widgetsRes] = await Promise.all([
    supabase.from(TEAMS).select("*").order("created_at", { ascending: true }),
    supabase.from(PAGES).select("*").order("created_at", { ascending: true }),
    supabase.from(WIDGETS).select("*").order("created_at", { ascending: true }),
  ]);

  if (teamsRes.error || pagesRes.error || widgetsRes.error) {
    console.error(
      "Supabase: failed to load teams/pages/widgets, falling back to local storage.",
      teamsRes.error ?? pagesRes.error ?? widgetsRes.error
    );
    return loadPersistedState()?.departments ?? null;
  }

  const teams = (teamsRes.data ?? []) as TeamRow[];
  const pages = (pagesRes.data ?? []) as PageRow[];
  const widgets = (widgetsRes.data ?? []) as WidgetRow[];
  if (teams.length === 0) return null; // nothing saved yet - let the caller seed defaults

  const widgetsByPage = new Map<string, WidgetRow[]>();
  widgets.forEach((w) => {
    if (!widgetsByPage.has(w.page_id)) widgetsByPage.set(w.page_id, []);
    widgetsByPage.get(w.page_id)!.push(w);
  });

  const pagesByTeam = new Map<string, TaskPage[]>();
  pages.forEach((p) => {
    if (!pagesByTeam.has(p.team_id)) pagesByTeam.set(p.team_id, []);
    pagesByTeam.get(p.team_id)!.push(pageRowToTaskPage(p, widgetsByPage.get(p.id) ?? []));
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
  const { error } = await supabase.from(TEAMS).upsert({ id: team.id, name: team.name });
  if (error) warnSaveFailedOnce("a team", error);
}

export async function deleteTeamRemote(id: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase.from(TEAMS).delete().eq("id", id);
  if (error) warnSaveFailedOnce("a team deletion", error);
}

/** Saves a page's own config fields. Row data is only included for pages
 *  with no live source (manual imports) — sheet-connected pages can always
 *  be re-fetched, so their (potentially huge) row data never needs to sit
 *  in this small config row. */
export async function savePageRemote(page: TaskPage, teamId: string, includeRows = false): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const shouldIncludeRows = includeRows || page.sourceType === "manual";

  const { error } = await supabase.from(PAGES).upsert({
    id: page.id,
    team_id: teamId,
    name: page.name,
    source_type: page.sourceType ?? "manual",
    sheet_url: page.sheetUrl || null,
    sheet_tab_title: page.sheetTabTitle || null,
    last_updated: page.lastUpdated,
    columns: page.columns,
    rows: shouldIncludeRows ? page.rows : [],
    measures: page.measures,
    calculated_columns: page.calculatedColumns,
    active_filters: page.activeFilters,
    widget_order: page.widgetOrder ?? [],
  });
  if (error) warnSaveFailedOnce("a page", error);
}

export async function deletePageRemote(id: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase.from(PAGES).delete().eq("id", id);
  if (error) warnSaveFailedOnce("a page deletion", error);
}

export async function saveWidgetRemote(
  id: string,
  pageId: string,
  kind: WidgetKind,
  config: ChartConfig | PivotConfig | MatrixConfig | CardConfig | TextConfig
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase.from(WIDGETS).upsert({ id, page_id: pageId, kind, config });
  if (error) warnSaveFailedOnce("a widget", error);
}

export async function deleteWidgetRemote(id: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase.from(WIDGETS).delete().eq("id", id);
  if (error) warnSaveFailedOnce("a widget deletion", error);
}

/** Realtime: rather than trying to merge partial row-level changes into
 *  local state, any change on any of the three tables just triggers a
 *  fresh (cheap — small normalized rows) full reload. Simpler and safer
 *  than hand-merging partial updates. */
export function subscribeToTeamsChanges(onChange: (departments: Department[]) => void): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => {};

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  function reload() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const departments = await loadAllTeams();
      if (departments) onChange(departments);
    }, 300);
  }

  const channel = supabase
    .channel("teams_pages_widgets_changes")
    .on("postgres_changes", { event: "*", schema: "public", table: TEAMS }, reload)
    .on("postgres_changes", { event: "*", schema: "public", table: PAGES }, reload)
    .on("postgres_changes", { event: "*", schema: "public", table: WIDGETS }, reload)
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
