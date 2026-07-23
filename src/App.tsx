import { useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { AuthProvider, useAuth } from "./lib/auth";
import { LoginScreen } from "./components/LoginScreen";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { FilterBar } from "./components/FilterBar";
import { ChartCard } from "./components/ChartCard";
import { PivotCard } from "./components/PivotCard";
import { MatrixCard } from "./components/MatrixCard";
import { CardWidget } from "./components/CardWidget";
import { TextWidget } from "./components/TextWidget";
import { WidgetShell } from "./components/WidgetShell";
import { DataTable } from "./components/DataTable";
import { AIAssistant } from "./components/AIAssistant";
import { NamePromptModal } from "./components/NamePromptModal";
import { DataSourcesView } from "./components/DataSourcesView";
import { UserManagement } from "./components/UserManagement";
import { DataModelPanel } from "./components/DataModelPanel";
import { fetchSheetAsRows } from "./lib/sheets";
import {
  loadAllTeams, saveTeamRemote, deleteTeamRemote, savePageRemote, deletePageRemote,
  saveWidgetRemote, deleteWidgetRemote, subscribeToTeamsChanges,
} from "./lib/remoteDb";
import { savePersistedState } from "./lib/persistence";
import {
  canEditWidgets, canExport as canExportPerm, canUseFilters,
  canManageStructure, canManageDataSources,
} from "./lib/permissions";
import { applyCalculatedColumns } from "./lib/calculatedColumns";
import { stampRowIds, ROW_ID_KEY } from "./lib/rowIds";
import { getStoredTheme, applyTheme, type Theme } from "./lib/theme";
import type {
  CalculatedColumn, CardConfig, ChartConfig, DataRow, Department, FilterConfig,
  MatrixConfig, Measure, PivotConfig, TextConfig, TaskPage,
} from "./types";

function makeDefaultPage(id: string, name: string): TaskPage {
  return {
    id,
    name,
    sourceType: "manual",
    sheetUrl: "",
    lastUpdated: null,
    rows: [],
    columns: [],
    charts: [],
    pivots: [],
    matrices: [],
    cards: [],
    texts: [],
    measures: [],
    calculatedColumns: [],
    activeFilters: [],
  };
}

function makeDefaultDepartment(id: string, name: string): Department {
  return {
    id,
    name,
    pages: [makeDefaultPage(`${id}-overview`, "Overview")],
  };
}

function passesFilter(row: DataRow, f: FilterConfig): boolean {
  if (f.mode === "range") {
    const raw = row[f.column];
    const cellDate = new Date(String(raw));
    if (isNaN(cellDate.getTime())) return true;
    if (f.from) {
      const from = new Date(f.from);
      if (cellDate < from) return false;
    }
    if (f.to) {
      const to = new Date(f.to);
      to.setHours(23, 59, 59, 999);
      if (cellDate > to) return false;
    }
    return true;
  }
  return f.value === "All" || String(row[f.column]) === f.value;
}

function DashboardApp() {
  const { user } = useAuth();

  const [departments, setDepartments] = useState<Department[]>([makeDefaultDepartment("sales", "Sales")]);
  const [activeDeptId, setActiveDeptId] = useState("sales");
  const [activePageId, setActivePageId] = useState("sales-overview");
  const [stateReady, setStateReady] = useState(false);
  const [view, setView] = useState<"dashboard" | "dataSources" | "users">("dashboard");
  const [refreshing, setRefreshing] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [showDataModel, setShowDataModel] = useState(false);
  const [addDeptOpen, setAddDeptOpen] = useState(false);
  const [addPageForDept, setAddPageForDept] = useState<string | null>(null);
  const [renameDept, setRenameDept] = useState<string | null>(null);
  const [renamePageTarget, setRenamePageTarget] = useState<{ deptId: string; pageId: string } | null>(null);
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const loaded = await loadAllTeams();
      if (cancelled) return;
      if (loaded && loaded.length > 0) {
        setDepartments(loaded);
        setActiveDeptId((prev) => (loaded.some((d) => d.id === prev) ? prev : loaded[0].id));
        setActivePageId((prev) =>
          loaded.some((d) => d.pages.some((p) => p.id === prev)) ? prev : loaded[0].pages[0]?.id ?? ""
        );
      } else if (user?.role === "admin") {
        // Nothing saved yet (brand-new Supabase project) — seed the
        // starting default team/page so it's visible to everyone else too,
        // not just silently sitting unsaved in this one browser.
        for (const dept of departments) {
          await saveTeamRemote(dept);
          for (const page of dept.pages) await savePageRemote(page, dept.id);
        }
      }
      setStateReady(true);
    })();

    const unsubscribe = subscribeToTeamsChanges((loaded) => {
      if (loaded.length === 0) return;
      setDepartments(loaded);
      setActiveDeptId((prev) => (loaded.some((d) => d.id === prev) ? prev : loaded[0].id));
      setActivePageId((prev) =>
        loaded.some((d) => d.pages.some((p) => p.id === prev)) ? prev : loaded[0].pages[0]?.id ?? ""
      );
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  // Which team/page you're currently looking at is a personal navigation
  // preference, not shared data — kept in local storage only, never synced.
  useEffect(() => {
    const timer = setTimeout(() => {
      savePersistedState({ departments, activeDeptId, activePageId });
    }, 500);
    return () => clearTimeout(timer);
  }, [departments, activeDeptId, activePageId]);

  /** Saves one team's own row (name/id). Anyone who can manage teams/pages
   *  (Admin or Manager) can write this — it used to be Admin-only, which
   *  meant a Manager's new team/page silently never reached Supabase and
   *  only ever existed in that one browser tab. */
  async function syncTeam(dept: { id: string; name: string }) {
    if (canManageStructure(user?.role)) await saveTeamRemote(dept);
  }
  async function syncDeleteTeam(id: string) {
    if (canManageStructure(user?.role)) await deleteTeamRemote(id);
  }
  /** Saves one page's own config row. Same Admin/Manager tier as above. Row
   *  data is only sent for manual/imported pages or when includeRows is
   *  explicitly requested right after a live fetch — see savePageRemote's
   *  own doc comment. */
  async function syncPage(page: TaskPage, teamId: string, includeRows = false) {
    if (canManageStructure(user?.role) || canManageDataSources(user?.role)) {
      await savePageRemote(page, teamId, includeRows);
    }
  }
  async function syncDeletePage(id: string) {
    if (canManageStructure(user?.role)) await deletePageRemote(id);
  }
  /** Saves exactly one widget's own small row. Admin or Manager, matching
   *  canEditWidgets (the same permission that lets them edit it in the UI
   *  in the first place). */
  async function syncWidget(
    id: string,
    pageId: string,
    kind: "chart" | "pivot" | "matrix" | "card" | "text",
    config: ChartConfig | PivotConfig | MatrixConfig | CardConfig | TextConfig
  ) {
    if (canEditWidgets(user?.role)) await saveWidgetRemote(id, pageId, kind, config);
  }
  async function syncDeleteWidget(id: string) {
    if (canEditWidgets(user?.role)) await deleteWidgetRemote(id);
  }

  const activeDept = departments.find((d) => d.id === activeDeptId) ?? departments[0];
  const activePage = activeDept.pages.find((p) => p.id === activePageId) ?? activeDept.pages[0];

  const autoLoadAttemptedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Admin or Manager can both refresh data sources — either one having a
    // tab open is enough to keep things fresh for everyone else. (This used
    // to be Admin-only, which meant nothing auto-loaded at all whenever the
    // Admin simply wasn't logged in at that moment.)
    if (
      canManageDataSources(user?.role) &&
      activePage.sheetUrl &&
      activePage.rows.length === 0 &&
      !refreshing &&
      !autoLoadAttemptedRef.current.has(activePage.id)
    ) {
      autoLoadAttemptedRef.current.add(activePage.id);
      loadSheet(activePage.sheetUrl, activePage.sheetTabTitle, /* silent */ true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePage.id, activePage.sheetUrl, activePage.rows.length, user?.role]);

  // Global, clock-aligned sync instead of continuous per-edit updates: once
  // an hour (on the hour), re-fetch every sheet-connected page across every
  // team and push the result once. The rest of the time, everyone just
  // views whatever was last synced — no repeated fetching or writing.
  useEffect(() => {
    if (!canManageDataSources(user?.role)) return;

    async function syncAllSheetsNow() {
      let current = departments;
      for (const dept of current) {
        for (const page of dept.pages) {
          if (!page.sheetUrl) continue;
          try {
            const { rows, columns } = await fetchSheetAsRows(page.sheetUrl, page.sheetTabTitle);
            const stampedRows = stampRowIds(rows);
            const lastUpdated = new Date().toISOString();
            const updatedPage = { ...page, rows: stampedRows, columns, lastUpdated };
            current = current.map((d) =>
              d.id !== dept.id ? d : { ...d, pages: d.pages.map((p) => (p.id !== page.id ? p : updatedPage)) }
            );
            syncPage(updatedPage, dept.id, true);
          } catch (e) {
            console.warn(`Hourly sync: couldn't refresh "${page.name}" (not shown to the person):`, e);
          }
        }
      }
      setDepartments(current);
    }

    function msUntilNextHour() {
      const now = new Date();
      const next = new Date(now);
      next.setMinutes(0, 0, 0);
      next.setHours(now.getHours() + 1);
      return next.getTime() - now.getTime();
    }

    const timeoutId = setTimeout(function runAndReschedule() {
      syncAllSheetsNow();
    }, msUntilNextHour());
    const intervalId = setInterval(syncAllSheetsNow, 60 * 60 * 1000);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  function updatePage(patch: Partial<TaskPage>) {
    setDepartments((ds) =>
      ds.map((d) =>
        d.id !== activeDept.id
          ? d
          : { ...d, pages: d.pages.map((p) => (p.id === activePage.id ? { ...p, ...patch } : p)) }
      )
    );
  }

  async function handleConnectSheet(url: string, tabTitle?: string, sourceType: "csv-link" | "drive" = "csv-link") {
    updatePage({ sheetUrl: url, sheetTabTitle: tabTitle, sourceType });
    await loadSheet(url, tabTitle, false, sourceType);
  }

  async function loadSheet(url: string, tabTitle?: string, silent = false, sourceType?: "csv-link" | "drive") {
    if (!url) return;
    setRefreshing(true);
    try {
      const { rows, columns } = await fetchSheetAsRows(url, tabTitle ?? activePage.sheetTabTitle);
      const stampedRows = stampRowIds(rows);
      const lastUpdated = new Date().toISOString();

      // sheetUrl/sheetTabTitle/sourceType come from this call's own params
      // (not the activePage closure) — when called right after
      // handleConnectSheet, activePage may still reflect the pre-connect
      // state since updatePage's state change hasn't landed yet.
      const updatedPage: TaskPage = {
        ...activePage,
        sheetUrl: url,
        sheetTabTitle: tabTitle,
        ...(sourceType ? { sourceType } : {}),
        rows: stampedRows,
        columns,
        lastUpdated,
      };
      const updatedDepartments = departments.map((d) =>
        d.id !== activeDept.id
          ? d
          : { ...d, pages: d.pages.map((p) => (p.id !== activePage.id ? p : updatedPage)) }
      );
      setDepartments(updatedDepartments);

      // An explicit refresh is a deliberate, infrequent action — worth
      // saving immediately (with the real row data) rather than waiting
      // for the next hourly sync, so a manual refresh actually reflects for
      // everyone else right away. Only this one page's row needs writing.
      syncPage(updatedPage, activeDept.id, true);
    } catch (e) {
      if (silent) {
        console.warn("Silent auto-load of a connected sheet failed (not shown to the person):", e);
        return;
      }
      alert(
        e instanceof Error && e.message !== "Failed to fetch"
          ? e.message
          : "Couldn't load this sheet directly. It's probably private — either share it as \"Anyone with the link can view\", or use \"Browse from Drive\" to sign in and pick it without changing its sharing settings."
      );
    } finally {
      setRefreshing(false);
    }
  }

  function handleImportData(rows: DataRow[], columns: string[]) {
    const stampedRows = stampRowIds(rows);
    const lastUpdated = new Date().toISOString();
    const updatedPage: TaskPage = {
      ...activePage,
      rows: stampedRows,
      columns,
      sourceType: "manual",
      sheetUrl: "",
      sheetTabTitle: undefined,
      lastUpdated,
    };
    const updatedDepartments = departments.map((d) =>
      d.id !== activeDept.id
        ? d
        : { ...d, pages: d.pages.map((p) => (p.id !== activePage.id ? p : updatedPage)) }
    );
    setDepartments(updatedDepartments);
    // No live source to re-fetch this from later, so it has to be saved
    // right away rather than waiting for the hourly sync — otherwise it
    // would only exist in this browser until the next sync happened to run.
    syncPage(updatedPage, activeDept.id, true);
  }

  const debounceTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  function debouncedSync(key: string, fn: () => void, delay = 500) {
    const timers = debounceTimersRef.current;
    const existing = timers.get(key);
    if (existing) clearTimeout(existing);
    timers.set(
      key,
      setTimeout(() => {
        fn();
        timers.delete(key);
      }, delay)
    );
  }

  function handleEditCell(rid: string, column: string, value: string) {
    const isNumericCol = activePage.rows.some((r) => typeof r[column] === "number");
    const parsed = isNumericCol && value.trim() !== "" && !isNaN(Number(value)) ? Number(value) : value;
    const updatedRows = activePage.rows.map((r) => (r[ROW_ID_KEY] === rid ? { ...r, [column]: parsed } : r));
    updatePage({ rows: updatedRows });
    const pageId = activePage.id, deptId = activeDept.id;
    debouncedSync(`page:${pageId}`, () => {
      const page = departments.find((d) => d.id === deptId)?.pages.find((p) => p.id === pageId);
      if (page) syncPage({ ...page, rows: updatedRows }, deptId, true);
    });
  }

  // Calculated columns are derived on the fly from the raw rows, never stored redundantly.
  const effective = useMemo(
    () => applyCalculatedColumns(activePage.rows, activePage.columns, activePage.calculatedColumns),
    [activePage.rows, activePage.columns, activePage.calculatedColumns]
  );

  const filteredRows = useMemo(() => {
    return effective.rows.filter((row) => activePage.activeFilters.every((f) => passesFilter(row, f)));
  }, [effective.rows, activePage.activeFilters]);

  function setFilters(filters: FilterConfig[]) {
    updatePage({ activeFilters: filters });
    const pageId = activePage.id, deptId = activeDept.id;
    debouncedSync(`page:${pageId}`, () => syncPage({ ...activePage, activeFilters: filters }, deptId));
  }

  function handleCrossFilter(column: string, value: string) {
    const existing = activePage.activeFilters.find((f) => f.column === column && f.mode !== "range");
    if (existing && existing.value === value) {
      setFilters(activePage.activeFilters.filter((f) => f !== existing));
    } else if (existing) {
      setFilters(activePage.activeFilters.map((f) => (f === existing ? { ...f, value } : f)));
    } else {
      setFilters([...activePage.activeFilters, { column, mode: "equals", value }]);
    }
  }

  function getWidgetOrder(page: TaskPage): string[] {
    const allIds = [
      ...page.charts.map((c) => c.id),
      ...page.pivots.map((p) => p.id),
      ...page.matrices.map((m) => m.id),
      ...page.cards.map((c) => c.id),
      ...page.texts.map((t) => t.id),
    ];
    if (page.widgetOrder && page.widgetOrder.length === allIds.length) return page.widgetOrder;
    // Fall back to kind-grouped order (older pages, or an id got out of sync) and heal it.
    return allIds;
  }

  // --- Charts ---
  function updateChart(chart: ChartConfig) {
    updatePage({ charts: activePage.charts.map((c) => (c.id === chart.id ? chart : c)) });
    const pageId = activePage.id;
    debouncedSync(`widget:${chart.id}`, () => syncWidget(chart.id, pageId, "chart", chart));
  }
  function removeChart(id: string) {
    const nextOrder = getWidgetOrder(activePage).filter((w) => w !== id);
    updatePage({ charts: activePage.charts.filter((c) => c.id !== id), widgetOrder: nextOrder });
    syncDeleteWidget(id);
    syncPage({ ...activePage, widgetOrder: nextOrder }, activeDept.id);
  }
  function addChart() {
    const newChart: ChartConfig = {
      id: crypto.randomUUID(), title: "New chart", type: "bar",
      xKey: "", yKey: "",
    };
    const nextOrder = [...getWidgetOrder(activePage), newChart.id];
    updatePage({ charts: [...activePage.charts, newChart], widgetOrder: nextOrder });
    syncWidget(newChart.id, activePage.id, "chart", newChart);
    syncPage({ ...activePage, widgetOrder: nextOrder }, activeDept.id);
  }

  // --- Pivots ---
  function updatePivot(pivot: PivotConfig) {
    updatePage({ pivots: activePage.pivots.map((p) => (p.id === pivot.id ? pivot : p)) });
    const pageId = activePage.id;
    debouncedSync(`widget:${pivot.id}`, () => syncWidget(pivot.id, pageId, "pivot", pivot));
  }
  function removePivot(id: string) {
    const nextOrder = getWidgetOrder(activePage).filter((w) => w !== id);
    updatePage({ pivots: activePage.pivots.filter((p) => p.id !== id), widgetOrder: nextOrder });
    syncDeleteWidget(id);
    syncPage({ ...activePage, widgetOrder: nextOrder }, activeDept.id);
  }
  function addPivot() {
    const newPivot: PivotConfig = {
      id: crypto.randomUUID(), title: "New pivot table",
      groupCols: [effective.columns[0]],
      values: [{ id: crypto.randomUUID(), label: `sum ${effective.columns[1] ?? effective.columns[0]}`, source: { kind: "column", column: effective.columns[1] ?? effective.columns[0], agg: "sum" } }],
      sortDir: "desc", rangeStart: 1, rangeEnd: 10,
    };
    const nextOrder = [...getWidgetOrder(activePage), newPivot.id];
    updatePage({ pivots: [...activePage.pivots, newPivot], widgetOrder: nextOrder });
    syncWidget(newPivot.id, activePage.id, "pivot", newPivot);
    syncPage({ ...activePage, widgetOrder: nextOrder }, activeDept.id);
  }

  // --- Matrices ---
  function updateMatrix(matrix: MatrixConfig) {
    updatePage({ matrices: activePage.matrices.map((m) => (m.id === matrix.id ? matrix : m)) });
    const pageId = activePage.id;
    debouncedSync(`widget:${matrix.id}`, () => syncWidget(matrix.id, pageId, "matrix", matrix));
  }
  function removeMatrix(id: string) {
    const nextOrder = getWidgetOrder(activePage).filter((w) => w !== id);
    updatePage({ matrices: activePage.matrices.filter((m) => m.id !== id), widgetOrder: nextOrder });
    syncDeleteWidget(id);
    syncPage({ ...activePage, widgetOrder: nextOrder }, activeDept.id);
  }
  function addMatrix() {
    const newMatrix: MatrixConfig = {
      id: crypto.randomUUID(), title: "New matrix",
      rowCol: "", colCol: "",
      value: { kind: "column", column: "", agg: "sum" },
    };
    const nextOrder = [...getWidgetOrder(activePage), newMatrix.id];
    updatePage({ matrices: [...activePage.matrices, newMatrix], widgetOrder: nextOrder });
    syncWidget(newMatrix.id, activePage.id, "matrix", newMatrix);
    syncPage({ ...activePage, widgetOrder: nextOrder }, activeDept.id);
  }

  // --- Cards ---
  function updateCard(card: CardConfig) {
    updatePage({ cards: activePage.cards.map((c) => (c.id === card.id ? card : c)) });
    const pageId = activePage.id;
    debouncedSync(`widget:${card.id}`, () => syncWidget(card.id, pageId, "card", card));
  }
  function removeCard(id: string) {
    const nextOrder = getWidgetOrder(activePage).filter((w) => w !== id);
    updatePage({ cards: activePage.cards.filter((c) => c.id !== id), widgetOrder: nextOrder });
    syncDeleteWidget(id);
    syncPage({ ...activePage, widgetOrder: nextOrder }, activeDept.id);
  }
  function addCard() {
    const newCard: CardConfig = {
      id: crypto.randomUUID(), title: "New card",
      value: { kind: "column", column: effective.columns[0], agg: "sum" },
    };
    const nextOrder = [...getWidgetOrder(activePage), newCard.id];
    updatePage({ cards: [...activePage.cards, newCard], widgetOrder: nextOrder });
    syncWidget(newCard.id, activePage.id, "card", newCard);
    syncPage({ ...activePage, widgetOrder: nextOrder }, activeDept.id);
  }

  // --- Text/image widgets ---
  function updateText(text: TextConfig) {
    updatePage({ texts: activePage.texts.map((t) => (t.id === text.id ? text : t)) });
    const pageId = activePage.id;
    debouncedSync(`widget:${text.id}`, () => syncWidget(text.id, pageId, "text", text));
  }
  function removeText(id: string) {
    const nextOrder = getWidgetOrder(activePage).filter((w) => w !== id);
    updatePage({ texts: activePage.texts.filter((t) => t.id !== id), widgetOrder: nextOrder });
    syncDeleteWidget(id);
    syncPage({ ...activePage, widgetOrder: nextOrder }, activeDept.id);
  }
  function addText() {
    const newText: TextConfig = { id: crypto.randomUUID(), title: "", body: "" };
    const nextOrder = [...getWidgetOrder(activePage), newText.id];
    updatePage({ texts: [...activePage.texts, newText], widgetOrder: nextOrder });
    syncWidget(newText.id, activePage.id, "text", newText);
    syncPage({ ...activePage, widgetOrder: nextOrder }, activeDept.id);
  }

  // --- Measures & calculated columns ---
  function setMeasures(measures: Measure[]) {
    updatePage({ measures });
    const pageId = activePage.id, deptId = activeDept.id;
    debouncedSync(`page:${pageId}`, () => syncPage({ ...activePage, measures }, deptId));
  }
  function setCalculatedColumns(calculatedColumns: CalculatedColumn[]) {
    updatePage({ calculatedColumns });
    const pageId = activePage.id, deptId = activeDept.id;
    debouncedSync(`page:${pageId}`, () => syncPage({ ...activePage, calculatedColumns }, deptId));
  }

  // A single shared display order lets any widget kind sit next to any
  // other — charts, pivots, matrices, cards, and text can be freely
  // interleaved instead of always grouping by type.
  type WidgetRef =
    | { kind: "chart"; item: ChartConfig }
    | { kind: "pivot"; item: PivotConfig }
    | { kind: "matrix"; item: MatrixConfig }
    | { kind: "card"; item: CardConfig }
    | { kind: "text"; item: TextConfig };

  const widgetLookup = new Map<string, WidgetRef>();
  activePage.charts.forEach((c) => widgetLookup.set(c.id, { kind: "chart", item: c }));
  activePage.pivots.forEach((p) => widgetLookup.set(p.id, { kind: "pivot", item: p }));
  activePage.matrices.forEach((m) => widgetLookup.set(m.id, { kind: "matrix", item: m }));
  activePage.cards.forEach((c) => widgetLookup.set(c.id, { kind: "card", item: c }));
  activePage.texts.forEach((t) => widgetLookup.set(t.id, { kind: "text", item: t }));

  const orderedWidgets = getWidgetOrder(activePage)
    .map((id) => widgetLookup.get(id))
    .filter((w): w is WidgetRef => Boolean(w));

  function reorderWidgets(draggedId: string, targetId: string) {
    const order = getWidgetOrder(activePage);
    const from = order.indexOf(draggedId);
    const to = order.indexOf(targetId);
    if (from === -1 || to === -1) return;
    const next = [...order];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    updatePage({ widgetOrder: next });
    const pageId = activePage.id, deptId = activeDept.id;
    debouncedSync(`page:${pageId}`, () => syncPage({ ...activePage, widgetOrder: next }, deptId));
  }

  // --- Team/page structure: add, rename, delete ---
  function addDepartment(name: string) {
    const id = name.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now();
    const dept = makeDefaultDepartment(id, name);
    const next = [...departments, dept];
    setDepartments(next);
    setActiveDeptId(id);
    setActivePageId(dept.pages[0].id);
    setAddDeptOpen(false);
    setView("dashboard");
    syncTeam(dept);
    syncPage(dept.pages[0], dept.id);
  }

  function addPage(deptId: string, name: string) {
    const pageId = name.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now();
    const page = makeDefaultPage(pageId, name);
    const next = departments.map((d) => (d.id === deptId ? { ...d, pages: [...d.pages, page] } : d));
    setDepartments(next);
    setActiveDeptId(deptId);
    setActivePageId(pageId);
    setAddPageForDept(null);
    setView("dashboard");
    syncPage(page, deptId);
  }

  function renameDepartmentTo(deptId: string, name: string) {
    const next = departments.map((d) => (d.id === deptId ? { ...d, name } : d));
    setDepartments(next);
    setRenameDept(null);
    syncTeam({ id: deptId, name });
  }

  function deleteDepartment(deptId: string) {
    if (departments.length <= 1) {
      alert("You need at least one team.");
      return;
    }
    if (!confirm("Delete this team and all its pages? This can't be undone.")) return;
    const next = departments.filter((d) => d.id !== deptId);
    setDepartments(next);
    if (activeDeptId === deptId) {
      setActiveDeptId(next[0].id);
      setActivePageId(next[0].pages[0].id);
    }
    syncDeleteTeam(deptId); // cascades to that team's pages/widgets in the database too
  }

  function renamePageTo(deptId: string, pageId: string, name: string) {
    const next = departments.map((d) =>
      d.id === deptId ? { ...d, pages: d.pages.map((p) => (p.id === pageId ? { ...p, name } : p)) } : d
    );
    setDepartments(next);
    setRenamePageTarget(null);
    const updatedPage = next.find((d) => d.id === deptId)?.pages.find((p) => p.id === pageId);
    if (updatedPage) syncPage(updatedPage, deptId);
  }

  function deletePage(deptId: string, pageId: string) {
    const dept = departments.find((d) => d.id === deptId);
    if (!dept || dept.pages.length <= 1) {
      alert("A team needs at least one page.");
      return;
    }
    if (!confirm("Delete this page? This can't be undone.")) return;
    const next = departments.map((d) => (d.id === deptId ? { ...d, pages: d.pages.filter((p) => p.id !== pageId) } : d));
    setDepartments(next);
    if (activePageId === pageId) {
      const remaining = dept.pages.filter((p) => p.id !== pageId);
      setActivePageId(remaining[0].id);
    }
    syncDeletePage(pageId); // cascades to that page's widgets in the database too
  }

  const canEdit = canEditWidgets(user?.role);
  const canExportData = canExportPerm(user?.role);
  const canFilter = canUseFilters(user?.role);

  if (!stateReady) {
    return (
      <div className="min-h-svh flex items-center justify-center bg-[var(--bg)]">
        <p className="text-sm text-[var(--text-dim)]">Loading your dashboard…</p>
      </div>
    );
  }

  const currentDeptForRename = renameDept ? departments.find((d) => d.id === renameDept) : null;
  const currentPageForRename = renamePageTarget
    ? departments.find((d) => d.id === renamePageTarget.deptId)?.pages.find((p) => p.id === renamePageTarget.pageId)
    : null;

  return (
    <div className="flex bg-[var(--bg)] min-h-svh">
      <Sidebar
        departments={departments}
        activeDeptId={activeDeptId}
        activePageId={activePageId}
        showingDataSources={view === "dataSources"}
        showingUsers={view === "users"}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        onSelectPage={(deptId, pageId) => {
          setActiveDeptId(deptId);
          setActivePageId(pageId);
          setView("dashboard");
        }}
        onSelectDataSources={() => setView("dataSources")}
        onSelectUsers={() => setView("users")}
        onAddDepartment={() => setAddDeptOpen(true)}
        onAddPage={(deptId) => setAddPageForDept(deptId)}
        onRenameDepartment={(deptId) => setRenameDept(deptId)}
        onDeleteDepartment={deleteDepartment}
        onRenamePage={(deptId, pageId) => setRenamePageTarget({ deptId, pageId })}
        onDeletePage={deletePage}
        onOpenAssistant={() => setShowAssistant(true)}
      />

      <main className="flex-1 min-w-0">
        {view === "dataSources" ? (
          <DataSourcesView departments={departments} />
        ) : view === "users" ? (
          <UserManagement />
        ) : (
          <>
            <TopBar
              page={activePage}
              refreshing={refreshing}
              onRefresh={() => loadSheet(activePage.sheetUrl)}
              onConnectSheet={handleConnectSheet}
              onImportData={handleImportData}
              onOpenDataModel={() => setShowDataModel(true)}
            />

            <FilterBar
              columns={effective.columns}
              rows={effective.rows}
              filters={activePage.activeFilters}
              onChange={setFilters}
              readOnly={!canFilter}
            />

            <div className="p-6 space-y-4">
              {effective.columns.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--border)] py-16 text-center text-sm text-[var(--text-dim)]">
                  No data yet — connect a Google Sheet, import a file, or combine online sheets above to get started.
                </div>
              ) : (
                <div className="flex flex-wrap gap-4 items-start">
                  {orderedWidgets.map((w) => {
                    if (w.kind === "chart") {
                      return (
                        <WidgetShell
                          key={w.item.id} id={w.item.id} kind="chart" canEdit={canEdit} onReorder={reorderWidgets}
                          layout={w.item.layout} onResize={(size) => updateChart({ ...w.item, layout: size })}
                        >
                          <ChartCard
                            config={w.item} rows={filteredRows} columns={effective.columns}
                            canEdit={canEdit} canExport={canExportData}
                            onChange={updateChart} onRemove={() => removeChart(w.item.id)}
                            onCrossFilter={canFilter ? handleCrossFilter : undefined}
                          />
                        </WidgetShell>
                      );
                    }
                    if (w.kind === "pivot") {
                      return (
                        <WidgetShell
                          key={w.item.id} id={w.item.id} kind="pivot" canEdit={canEdit} onReorder={reorderWidgets}
                          layout={w.item.layout} onResize={(size) => updatePivot({ ...w.item, layout: size })}
                        >
                          <PivotCard
                            config={w.item} rows={filteredRows} columns={effective.columns} measures={activePage.measures}
                            canEdit={canEdit} canExport={canExportData}
                            onChange={updatePivot} onRemove={() => removePivot(w.item.id)}
                          />
                        </WidgetShell>
                      );
                    }
                    if (w.kind === "matrix") {
                      return (
                        <WidgetShell
                          key={w.item.id} id={w.item.id} kind="matrix" canEdit={canEdit} onReorder={reorderWidgets}
                          layout={w.item.layout} onResize={(size) => updateMatrix({ ...w.item, layout: size })}
                        >
                          <MatrixCard
                            config={w.item} rows={filteredRows} columns={effective.columns} measures={activePage.measures}
                            canEdit={canEdit} canExport={canExportData}
                            onChange={updateMatrix} onRemove={() => removeMatrix(w.item.id)}
                          />
                        </WidgetShell>
                      );
                    }
                    if (w.kind === "card") {
                      return (
                        <WidgetShell
                          key={w.item.id} id={w.item.id} kind="card" canEdit={canEdit} onReorder={reorderWidgets}
                          layout={w.item.layout} onResize={(size) => updateCard({ ...w.item, layout: size })}
                        >
                          <CardWidget
                            config={w.item} rows={filteredRows} columns={effective.columns} measures={activePage.measures}
                            canEdit={canEdit}
                            onChange={updateCard} onRemove={() => removeCard(w.item.id)}
                          />
                        </WidgetShell>
                      );
                    }
                    return (
                      <WidgetShell
                        key={w.item.id} id={w.item.id} kind="text" canEdit={canEdit} onReorder={reorderWidgets}
                        layout={w.item.layout} onResize={(size) => updateText({ ...w.item, layout: size })}
                      >
                        <TextWidget config={w.item} canEdit={canEdit} onChange={updateText} onRemove={() => removeText(w.item.id)} />
                      </WidgetShell>
                    );
                  })}
                  {canEdit && (
                    <div className="flex flex-wrap gap-2">
                      <button onClick={addChart} className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 min-h-40 rounded-xl border border-dashed border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent-border)] hover:text-[var(--text)] text-sm">
                        <Plus size={15} /> Chart
                      </button>
                      <button onClick={addPivot} className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 min-h-40 rounded-xl border border-dashed border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent-border)] hover:text-[var(--text)] text-sm">
                        <Plus size={15} /> Pivot table
                      </button>
                      <button onClick={addMatrix} className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 min-h-40 rounded-xl border border-dashed border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent-border)] hover:text-[var(--text)] text-sm">
                        <Plus size={15} /> Matrix
                      </button>
                      <button onClick={addCard} className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 min-h-40 rounded-xl border border-dashed border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent-border)] hover:text-[var(--text)] text-sm">
                        <Plus size={15} /> Card
                      </button>
                      <button onClick={addText} className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 min-h-40 rounded-xl border border-dashed border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent-border)] hover:text-[var(--text)] text-sm">
                        <Plus size={15} /> Text/Image
                      </button>
                    </div>
                  )}
                </div>
              )}

              {effective.columns.length > 0 && (
                <DataTable
                  rows={filteredRows}
                  columns={effective.columns}
                  editableColumns={activePage.columns}
                  canExport={canExportData}
                  canEdit={canEdit}
                  onEditCell={handleEditCell}
                />
              )}
            </div>
          </>
        )}
      </main>

      {showAssistant && (
        <AIAssistant
          departmentName={`${activeDept.name} — ${activePage.name}`}
          rows={filteredRows}
          columns={effective.columns}
          onClose={() => setShowAssistant(false)}
        />
      )}

      {showDataModel && (
        <DataModelPanel
          columns={activePage.columns}
          measures={activePage.measures}
          calculatedColumns={activePage.calculatedColumns}
          onChangeMeasures={setMeasures}
          onChangeCalculatedColumns={setCalculatedColumns}
          onClose={() => setShowDataModel(false)}
        />
      )}

      {addDeptOpen && (
        <NamePromptModal title="New team" placeholder="e.g. Marketing, Operations..." onClose={() => setAddDeptOpen(false)} onCreate={addDepartment} />
      )}
      {addPageForDept && (
        <NamePromptModal title="New task page" placeholder="e.g. Weekly targets, Regional breakdown..." onClose={() => setAddPageForDept(null)} onCreate={(name) => addPage(addPageForDept, name)} />
      )}
      {currentDeptForRename && (
        <NamePromptModal
          title="Rename team" placeholder="Team name" initialValue={currentDeptForRename.name} submitLabel="Save"
          onClose={() => setRenameDept(null)} onCreate={(name) => renameDepartmentTo(currentDeptForRename.id, name)}
        />
      )}
      {currentPageForRename && renamePageTarget && (
        <NamePromptModal
          title="Rename page" placeholder="Page name" initialValue={currentPageForRename.name} submitLabel="Save"
          onClose={() => setRenamePageTarget(null)} onCreate={(name) => renamePageTo(renamePageTarget.deptId, renamePageTarget.pageId, name)}
        />
      )}
    </div>
  );
}

function Gate() {
  const { user } = useAuth();
  return user ? <DashboardApp /> : <LoginScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
