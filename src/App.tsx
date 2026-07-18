import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { AuthProvider, useAuth } from "./lib/auth";
import { LoginScreen } from "./components/LoginScreen";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { FilterBar } from "./components/FilterBar";
import { ChartCard } from "./components/ChartCard";
import { PivotCard } from "./components/PivotCard";
import { WidgetShell } from "./components/WidgetShell";
import { DataTable } from "./components/DataTable";
import { AIAssistant } from "./components/AIAssistant";
import { NamePromptModal } from "./components/NamePromptModal";
import { DataSourcesView } from "./components/DataSourcesView";
import { UserManagement } from "./components/UserManagement";
import { canEditWidgets, canExport as canExportPerm, canUseFilters } from "./lib/permissions";
import { fetchSheetAsRows } from "./lib/sheets";
import { sampleRows, sampleColumns } from "./data/sampleData";
import { loadPersistedState, savePersistedState } from "./lib/persistence";
import type { ChartConfig, DataRow, Department, FilterConfig, PivotConfig, TaskPage } from "./types";

function makeDefaultPage(id: string, name: string): TaskPage {
  return {
    id,
    name,
    sourceType: "manual",
    sheetUrl: "",
    lastUpdated: null,
    rows: sampleRows,
    columns: sampleColumns,
    charts: [
      { id: crypto.randomUUID(), title: "Revenue by month", type: "bar", xKey: "month", yKey: "revenue" },
      { id: crypto.randomUUID(), title: "Orders by region", type: "pie", xKey: "region", yKey: "orders" },
    ],
    pivots: [],
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
    if (isNaN(cellDate.getTime())) return true; // can't parse - don't exclude
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
  const persisted = loadPersistedState();

  const [departments, setDepartments] = useState<Department[]>(
    persisted?.departments ?? [makeDefaultDepartment("sales", "Sales")]
  );
  const [activeDeptId, setActiveDeptId] = useState(persisted?.activeDeptId ?? "sales");
  const [activePageId, setActivePageId] = useState(persisted?.activePageId ?? "sales-overview");
  const [view, setView] = useState<"dashboard" | "dataSources" | "users">("dashboard");
  const [refreshing, setRefreshing] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [addDeptOpen, setAddDeptOpen] = useState(false);
  const [addPageForDept, setAddPageForDept] = useState<string | null>(null);

  useEffect(() => {
    savePersistedState({ departments, activeDeptId, activePageId });
  }, [departments, activeDeptId, activePageId]);

  const activeDept = departments.find((d) => d.id === activeDeptId) ?? departments[0];
  const activePage = activeDept.pages.find((p) => p.id === activePageId) ?? activeDept.pages[0];

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
      updatePage({ rows, columns, lastUpdated: new Date().toISOString() });
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
      rows,
      columns,
      sourceType: "manual",
      sheetUrl: "",
      sheetTabTitle: undefined,
      lastUpdated: new Date().toISOString(),
    });
  }

  const filteredRows = useMemo(() => {
    return activePage.rows.filter((row) => activePage.activeFilters.every((f) => passesFilter(row, f)));
  }, [activePage.rows, activePage.activeFilters]);

  function setFilters(filters: FilterConfig[]) {
    updatePage({ activeFilters: filters });
  }

  function updateChart(chart: ChartConfig) {
    updatePage({ charts: activePage.charts.map((c) => (c.id === chart.id ? chart : c)) });
  }

  function removeChart(id: string) {
    updatePage({ charts: activePage.charts.filter((c) => c.id !== id) });
  }

  function addChart() {
    const newChart: ChartConfig = {
      id: crypto.randomUUID(),
      title: "New chart",
      type: "bar",
      xKey: activePage.columns[0],
      yKey: activePage.columns[1] ?? activePage.columns[0],
    };
    updatePage({ charts: [...activePage.charts, newChart] });
  }

  function updatePivot(pivot: PivotConfig) {
    updatePage({ pivots: activePage.pivots.map((p) => (p.id === pivot.id ? pivot : p)) });
  }

  function removePivot(id: string) {
    updatePage({ pivots: activePage.pivots.filter((p) => p.id !== id) });
  }

  function addPivot() {
    const newPivot: PivotConfig = {
      id: crypto.randomUUID(),
      title: "New pivot table",
      groupCols: [activePage.columns[0]],
      valueCol: activePage.columns[1] ?? activePage.columns[0],
      agg: "sum",
      sortDir: "desc",
      limit: 10,
    };
    updatePage({ pivots: [...activePage.pivots, newPivot] });
  }

  // Widgets (charts + pivots) share one reorder list so drag targets can
  // land on either kind.
  type WidgetRef = { kind: "chart"; item: ChartConfig } | { kind: "pivot"; item: PivotConfig };
  const widgetOrder: WidgetRef[] = [
    ...activePage.charts.map((c): WidgetRef => ({ kind: "chart", item: c })),
    ...activePage.pivots.map((p): WidgetRef => ({ kind: "pivot", item: p })),
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
    });
  }

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

  const canEdit = canEditWidgets(user?.role);
  const canExportData = canExportPerm(user?.role);
  const canFilter = canUseFilters(user?.role);

  return (
    <div className="flex bg-[var(--bg)] min-h-svh">
      <Sidebar
        departments={departments}
        activeDeptId={activeDeptId}
        activePageId={activePageId}
        showingDataSources={view === "dataSources"}
        showingUsers={view === "users"}
        onSelectPage={(deptId, pageId) => {
          setActiveDeptId(deptId);
          setActivePageId(pageId);
          setView("dashboard");
        }}
        onSelectDataSources={() => setView("dataSources")}
        onSelectUsers={() => setView("users")}
        onAddDepartment={() => setAddDeptOpen(true)}
        onAddPage={(deptId) => setAddPageForDept(deptId)}
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
            />

            <FilterBar
              columns={activePage.columns}
              rows={activePage.rows}
              filters={activePage.activeFilters}
              onChange={setFilters}
              readOnly={!canFilter}
            />

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activePage.charts.map((chart) => (
                  <WidgetShell key={chart.id} id={chart.id} canEdit={canEdit} onReorder={reorderWidgets}>
                    <ChartCard
                      config={chart}
                      rows={filteredRows}
                      columns={activePage.columns}
                      canEdit={canEdit}
                      canExport={canExportData}
                      onChange={updateChart}
                      onRemove={() => removeChart(chart.id)}
                    />
                  </WidgetShell>
                ))}
                {activePage.pivots.map((pivot) => (
                  <WidgetShell key={pivot.id} id={pivot.id} canEdit={canEdit} onReorder={reorderWidgets}>
                    <PivotCard
                      config={pivot}
                      rows={filteredRows}
                      columns={activePage.columns}
                      canEdit={canEdit}
                      canExport={canExportData}
                      onChange={updatePivot}
                      onRemove={() => removePivot(pivot.id)}
                    />
                  </WidgetShell>
                ))}
                {canEdit && (
                  <div className="flex gap-2">
                    <button
                      onClick={addChart}
                      className="flex-1 flex items-center justify-center gap-1.5 min-h-40 rounded-xl border border-dashed border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent-border)] hover:text-[var(--text)] text-sm"
                    >
                      <Plus size={15} /> Add chart
                    </button>
                    <button
                      onClick={addPivot}
                      className="flex-1 flex items-center justify-center gap-1.5 min-h-40 rounded-xl border border-dashed border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent-border)] hover:text-[var(--text)] text-sm"
                    >
                      <Plus size={15} /> Add pivot table
                    </button>
                  </div>
                )}
              </div>

              <DataTable rows={filteredRows} columns={activePage.columns} canExport={canExportData} />
            </div>
          </>
        )}
      </main>

      {showAssistant && (
        <AIAssistant
          departmentName={`${activeDept.name} — ${activePage.name}`}
          rows={filteredRows}
          columns={activePage.columns}
          onClose={() => setShowAssistant(false)}
        />
      )}

      {addDeptOpen && (
        <NamePromptModal
          title="New team"
          placeholder="e.g. Marketing, Operations..."
          onClose={() => setAddDeptOpen(false)}
          onCreate={addDepartment}
        />
      )}

      {addPageForDept && (
        <NamePromptModal
          title="New task page"
          placeholder="e.g. Weekly targets, Regional breakdown..."
          onClose={() => setAddPageForDept(null)}
          onCreate={(name) => addPage(addPageForDept, name)}
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
