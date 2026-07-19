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
import { loadRemoteState, saveRemoteState, subscribeToRemoteState } from "./lib/remoteState";
import { canEditWidgets, canExport as canExportPerm, canUseFilters } from "./lib/permissions";
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

  const receivedLiveUpdateRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const persisted = await loadRemoteState();
      if (cancelled) return;
      // If a realtime update already arrived while this initial fetch was
      // still in flight, that update is newer — don't let this stale fetch
      // stomp on it (this was silently reverting people's edits before).
      if (persisted && !receivedLiveUpdateRef.current) {
        setDepartments(persisted.departments);
        setActiveDeptId(persisted.activeDeptId);
        setActivePageId(persisted.activePageId);
      }
      setStateReady(true);
    })();

    const unsubscribe = subscribeToRemoteState((state) => {
      receivedLiveUpdateRef.current = true;
      setDepartments(state.departments);
      setActiveDeptId(state.activeDeptId);
      setActivePageId(state.activePageId);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!stateReady) return;
    const timer = setTimeout(() => {
      saveRemoteState({ departments, activeDeptId, activePageId });
    }, 600);
    return () => clearTimeout(timer);
  }, [departments, activeDeptId, activePageId, stateReady]);

  const activeDept = departments.find((d) => d.id === activeDeptId) ?? departments[0];
  const activePage = activeDept.pages.find((p) => p.id === activePageId) ?? activeDept.pages[0];

  useEffect(() => {
    if (!activePage.autoRefresh || !activePage.sheetUrl) return;
    const interval = setInterval(() => {
      loadSheet(activePage.sheetUrl, activePage.sheetTabTitle);
    }, 60_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePage.autoRefresh, activePage.sheetUrl, activePage.sheetTabTitle, activePage.id]);

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
    await loadSheet(url, tabTitle);
  }

  async function loadSheet(url: string, tabTitle?: string) {
    if (!url) return;
    setRefreshing(true);
    try {
      const { rows, columns } = await fetchSheetAsRows(url, tabTitle ?? activePage.sheetTabTitle);
      updatePage({ rows: stampRowIds(rows), columns, lastUpdated: new Date().toISOString() });
    } catch (e) {
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
    updatePage({
      rows: stampRowIds(rows),
      columns,
      sourceType: "manual",
      sheetUrl: "",
      sheetTabTitle: undefined,
      lastUpdated: new Date().toISOString(),
    });
  }

  function handleEditCell(rid: string, column: string, value: string) {
    const isNumericCol = activePage.rows.some((r) => typeof r[column] === "number");
    const parsed = isNumericCol && value.trim() !== "" && !isNaN(Number(value)) ? Number(value) : value;
    updatePage({
      rows: activePage.rows.map((r) => (r[ROW_ID_KEY] === rid ? { ...r, [column]: parsed } : r)),
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

  // --- Charts ---
  function updateChart(chart: ChartConfig) {
    updatePage({ charts: activePage.charts.map((c) => (c.id === chart.id ? chart : c)) });
  }
  function removeChart(id: string) {
    updatePage({ charts: activePage.charts.filter((c) => c.id !== id) });
  }
  function addChart() {
    const newChart: ChartConfig = {
      id: crypto.randomUUID(), title: "New chart", type: "bar",
      xKey: effective.columns[0], yKey: effective.columns[1] ?? effective.columns[0],
    };
    updatePage({ charts: [...activePage.charts, newChart] });
  }

  // --- Pivots ---
  function updatePivot(pivot: PivotConfig) {
    updatePage({ pivots: activePage.pivots.map((p) => (p.id === pivot.id ? pivot : p)) });
  }
  function removePivot(id: string) {
    updatePage({ pivots: activePage.pivots.filter((p) => p.id !== id) });
  }
  function addPivot() {
    const newPivot: PivotConfig = {
      id: crypto.randomUUID(), title: "New pivot table",
      groupCols: [effective.columns[0]],
      values: [{ id: crypto.randomUUID(), label: `sum ${effective.columns[1] ?? effective.columns[0]}`, source: { kind: "column", column: effective.columns[1] ?? effective.columns[0], agg: "sum" } }],
      sortDir: "desc", limit: 10,
    };
    updatePage({ pivots: [...activePage.pivots, newPivot] });
  }

  // --- Matrices ---
  function updateMatrix(matrix: MatrixConfig) {
    updatePage({ matrices: activePage.matrices.map((m) => (m.id === matrix.id ? matrix : m)) });
  }
  function removeMatrix(id: string) {
    updatePage({ matrices: activePage.matrices.filter((m) => m.id !== id) });
  }
  function addMatrix() {
    const newMatrix: MatrixConfig = {
      id: crypto.randomUUID(), title: "New matrix",
      rowCol: effective.columns[0], colCol: effective.columns[1] ?? effective.columns[0],
      value: { kind: "column", column: effective.columns[2] ?? effective.columns[0], agg: "sum" },
    };
    updatePage({ matrices: [...activePage.matrices, newMatrix] });
  }

  // --- Cards ---
  function updateCard(card: CardConfig) {
    updatePage({ cards: activePage.cards.map((c) => (c.id === card.id ? card : c)) });
  }
  function removeCard(id: string) {
    updatePage({ cards: activePage.cards.filter((c) => c.id !== id) });
  }
  function addCard() {
    const newCard: CardConfig = {
      id: crypto.randomUUID(), title: "New card",
      value: { kind: "column", column: effective.columns[0], agg: "sum" },
    };
    updatePage({ cards: [...activePage.cards, newCard] });
  }

  // --- Text/image widgets ---
  function updateText(text: TextConfig) {
    updatePage({ texts: activePage.texts.map((t) => (t.id === text.id ? text : t)) });
  }
  function removeText(id: string) {
    updatePage({ texts: activePage.texts.filter((t) => t.id !== id) });
  }
  function addText() {
    const newText: TextConfig = { id: crypto.randomUUID(), title: "", body: "" };
    updatePage({ texts: [...activePage.texts, newText] });
  }

  // --- Measures & calculated columns ---
  function setMeasures(measures: Measure[]) {
    updatePage({ measures });
  }
  function setCalculatedColumns(calculatedColumns: CalculatedColumn[]) {
    updatePage({ calculatedColumns });
  }

  // Widgets (charts + pivots + matrices + cards + texts) share one reorder list.
  type WidgetRef =
    | { kind: "chart"; item: ChartConfig }
    | { kind: "pivot"; item: PivotConfig }
    | { kind: "matrix"; item: MatrixConfig }
    | { kind: "card"; item: CardConfig }
    | { kind: "text"; item: TextConfig };

  const widgetOrder: WidgetRef[] = [
    ...activePage.charts.map((c): WidgetRef => ({ kind: "chart", item: c })),
    ...activePage.pivots.map((p): WidgetRef => ({ kind: "pivot", item: p })),
    ...activePage.matrices.map((m): WidgetRef => ({ kind: "matrix", item: m })),
    ...activePage.cards.map((c): WidgetRef => ({ kind: "card", item: c })),
    ...activePage.texts.map((t): WidgetRef => ({ kind: "text", item: t })),
  ];

  function reorderWidgets(draggedId: string, targetId: string) {
    const ids = widgetOrder.map((w) => w.item.id);
    const from = ids.indexOf(draggedId);
    const to = ids.indexOf(targetId);
    if (from === -1 || to === -1) return;
    const reordered = [...widgetOrder];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    updatePage({
      charts: reordered.filter((w): w is { kind: "chart"; item: ChartConfig } => w.kind === "chart").map((w) => w.item),
      pivots: reordered.filter((w): w is { kind: "pivot"; item: PivotConfig } => w.kind === "pivot").map((w) => w.item),
      matrices: reordered.filter((w): w is { kind: "matrix"; item: MatrixConfig } => w.kind === "matrix").map((w) => w.item),
      cards: reordered.filter((w): w is { kind: "card"; item: CardConfig } => w.kind === "card").map((w) => w.item),
      texts: reordered.filter((w): w is { kind: "text"; item: TextConfig } => w.kind === "text").map((w) => w.item),
    });
  }

  // --- Team/page structure: add, rename, delete ---
  function addDepartment(name: string) {
    const id = name.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now();
    const dept = makeDefaultDepartment(id, name);
    setDepartments((ds) => [...ds, dept]);
    setActiveDeptId(id);
    setActivePageId(dept.pages[0].id);
    setAddDeptOpen(false);
    setView("dashboard");
  }

  function addPage(deptId: string, name: string) {
    const pageId = name.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now();
    const page = makeDefaultPage(pageId, name);
    setDepartments((ds) => ds.map((d) => (d.id === deptId ? { ...d, pages: [...d.pages, page] } : d)));
    setActiveDeptId(deptId);
    setActivePageId(pageId);
    setAddPageForDept(null);
    setView("dashboard");
  }

  function renameDepartmentTo(deptId: string, name: string) {
    setDepartments((ds) => ds.map((d) => (d.id === deptId ? { ...d, name } : d)));
    setRenameDept(null);
  }

  function deleteDepartment(deptId: string) {
    if (departments.length <= 1) {
      alert("You need at least one team.");
      return;
    }
    if (!confirm("Delete this team and all its pages? This can't be undone.")) return;
    setDepartments((ds) => {
      const next = ds.filter((d) => d.id !== deptId);
      if (activeDeptId === deptId) {
        setActiveDeptId(next[0].id);
        setActivePageId(next[0].pages[0].id);
      }
      return next;
    });
  }

  function renamePageTo(deptId: string, pageId: string, name: string) {
    setDepartments((ds) =>
      ds.map((d) => (d.id === deptId ? { ...d, pages: d.pages.map((p) => (p.id === pageId ? { ...p, name } : p)) } : d))
    );
    setRenamePageTarget(null);
  }

  function deletePage(deptId: string, pageId: string) {
    const dept = departments.find((d) => d.id === deptId);
    if (!dept || dept.pages.length <= 1) {
      alert("A team needs at least one page.");
      return;
    }
    if (!confirm("Delete this page? This can't be undone.")) return;
    setDepartments((ds) =>
      ds.map((d) => (d.id === deptId ? { ...d, pages: d.pages.filter((p) => p.id !== pageId) } : d))
    );
    if (activePageId === pageId) {
      const remaining = dept.pages.filter((p) => p.id !== pageId);
      setActivePageId(remaining[0].id);
    }
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
              onToggleAutoRefresh={(enabled) => updatePage({ autoRefresh: enabled })}
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
                  {activePage.charts.map((chart) => (
                    <WidgetShell key={chart.id} id={chart.id} canEdit={canEdit} onReorder={reorderWidgets}>
                      <ChartCard
                        config={chart} rows={filteredRows} columns={effective.columns}
                        canEdit={canEdit} canExport={canExportData}
                        onChange={updateChart} onRemove={() => removeChart(chart.id)}
                        onCrossFilter={canFilter ? handleCrossFilter : undefined}
                      />
                    </WidgetShell>
                  ))}
                  {activePage.pivots.map((pivot) => (
                    <WidgetShell key={pivot.id} id={pivot.id} canEdit={canEdit} onReorder={reorderWidgets}>
                      <PivotCard
                        config={pivot} rows={filteredRows} columns={effective.columns} measures={activePage.measures}
                        canEdit={canEdit} canExport={canExportData}
                        onChange={updatePivot} onRemove={() => removePivot(pivot.id)}
                      />
                    </WidgetShell>
                  ))}
                  {activePage.matrices.map((matrix) => (
                    <WidgetShell key={matrix.id} id={matrix.id} canEdit={canEdit} onReorder={reorderWidgets}>
                      <MatrixCard
                        config={matrix} rows={filteredRows} columns={effective.columns} measures={activePage.measures}
                        canEdit={canEdit} canExport={canExportData}
                        onChange={updateMatrix} onRemove={() => removeMatrix(matrix.id)}
                      />
                    </WidgetShell>
                  ))}
                  {activePage.cards.map((card) => (
                    <WidgetShell key={card.id} id={card.id} canEdit={canEdit} onReorder={reorderWidgets}>
                      <CardWidget
                        config={card} rows={filteredRows} columns={effective.columns} measures={activePage.measures}
                        canEdit={canEdit}
                        onChange={updateCard} onRemove={() => removeCard(card.id)}
                      />
                    </WidgetShell>
                  ))}
                  {activePage.texts.map((text) => (
                    <WidgetShell key={text.id} id={text.id} canEdit={canEdit} onReorder={reorderWidgets}>
                      <TextWidget config={text} canEdit={canEdit} onChange={updateText} onRemove={() => removeText(text.id)} />
                    </WidgetShell>
                  ))}
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
