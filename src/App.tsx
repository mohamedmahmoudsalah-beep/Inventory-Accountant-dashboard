import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { AuthProvider, useAuth } from "./lib/auth";
import { LoginScreen } from "./components/LoginScreen";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { FilterBar } from "./components/FilterBar";
import { ChartCard } from "./components/ChartCard";
import { DataTable } from "./components/DataTable";
import { AIAssistant } from "./components/AIAssistant";
import { NamePromptModal } from "./components/NamePromptModal";
import { fetchSheetAsRows } from "./lib/sheets";
import { sampleRows, sampleColumns } from "./data/sampleData";
import type { ChartConfig, DataRow, Department, FilterConfig, TaskPage } from "./types";

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

function DashboardApp() {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([
    makeDefaultDepartment("sales", "Sales"),
  ]);
  const [activeDeptId, setActiveDeptId] = useState("sales");
  const [activePageId, setActivePageId] = useState("sales-overview");
  const [refreshing, setRefreshing] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [addDeptOpen, setAddDeptOpen] = useState(false);
  const [addPageForDept, setAddPageForDept] = useState<string | null>(null);

  const activeDept = departments.find((d) => d.id === activeDeptId)!;
  const activePage = activeDept.pages.find((p) => p.id === activePageId) ?? activeDept.pages[0];

  function updatePage(patch: Partial<TaskPage>) {
    setDepartments((ds) =>
      ds.map((d) =>
        d.id !== activeDeptId
          ? d
          : { ...d, pages: d.pages.map((p) => (p.id === activePage.id ? { ...p, ...patch } : p)) }
      )
    );
  }

  async function handleConnectSheet(url: string) {
    updatePage({ sheetUrl: url });
    await loadSheet(url);
  }

  async function loadSheet(url: string) {
    if (!url) return;
    setRefreshing(true);
    try {
      const { rows, columns } = await fetchSheetAsRows(url);
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
      lastUpdated: new Date().toISOString(),
    });
  }

  const filteredRows = useMemo(() => {
    return activePage.rows.filter((row) =>
      activePage.activeFilters.every((f) => f.value === "All" || String(row[f.column]) === f.value)
    );
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

  function addDepartment(name: string) {
    const id = name.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now();
    const dept = makeDefaultDepartment(id, name);
    setDepartments((ds) => [...ds, dept]);
    setActiveDeptId(id);
    setActivePageId(dept.pages[0].id);
    setAddDeptOpen(false);
  }

  function addPage(deptId: string, name: string) {
    const pageId = name.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now();
    const page = makeDefaultPage(pageId, name);
    setDepartments((ds) => ds.map((d) => (d.id === deptId ? { ...d, pages: [...d.pages, page] } : d)));
    setActiveDeptId(deptId);
    setActivePageId(pageId);
    setAddPageForDept(null);
  }

  const canEdit = user?.role === "admin";

  return (
    <div className="flex bg-[var(--bg)] min-h-svh">
      <Sidebar
        departments={departments}
        activeDeptId={activeDeptId}
        activePageId={activePageId}
        onSelectPage={(deptId, pageId) => {
          setActiveDeptId(deptId);
          setActivePageId(pageId);
        }}
        onAddDepartment={() => setAddDeptOpen(true)}
        onAddPage={(deptId) => setAddPageForDept(deptId)}
        onOpenAssistant={() => setShowAssistant(true)}
      />

      <main className="flex-1 min-w-0">
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
        />

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activePage.charts.map((chart) => (
              <ChartCard
                key={chart.id}
                config={chart}
                rows={filteredRows}
                columns={activePage.columns}
                canEdit={canEdit}
                onChange={updateChart}
                onRemove={() => removeChart(chart.id)}
              />
            ))}
            {canEdit && (
              <button
                onClick={addChart}
                className="flex items-center justify-center gap-1.5 min-h-40 rounded-xl border border-dashed border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent-border)] hover:text-[var(--text)] text-sm"
              >
                <Plus size={15} /> Add chart
              </button>
            )}
          </div>

          <DataTable rows={filteredRows} columns={activePage.columns} />
        </div>
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
