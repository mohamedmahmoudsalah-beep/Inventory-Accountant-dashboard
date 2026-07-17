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
import { AddDepartmentModal } from "./components/AddDepartmentModal";
import { fetchSheetAsRows } from "./lib/sheets";
import { sampleRows, sampleColumns } from "./data/sampleData";
import type { ChartConfig, Department, FilterConfig } from "./types";

function makeDefaultDepartment(id: string, name: string): Department {
  return {
    id,
    name,
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

function DashboardApp() {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([
    makeDefaultDepartment("sales", "Sales"),
  ]);
  const [activeId, setActiveId] = useState("sales");
  const [refreshing, setRefreshing] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [showAddDept, setShowAddDept] = useState(false);

  const active = departments.find((d) => d.id === activeId)!;

  function updateActive(patch: Partial<Department>) {
    setDepartments((ds) => ds.map((d) => (d.id === activeId ? { ...d, ...patch } : d)));
  }

  async function handleConnectSheet(url: string) {
    updateActive({ sheetUrl: url });
    await loadSheet(url);
  }

  async function loadSheet(url: string) {
    if (!url) return;
    setRefreshing(true);
    try {
      const { rows, columns } = await fetchSheetAsRows(url);
      updateActive({ rows, columns, lastUpdated: new Date().toISOString() });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to load the sheet");
    } finally {
      setRefreshing(false);
    }
  }

  const filteredRows = useMemo(() => {
    return active.rows.filter((row) =>
      active.activeFilters.every((f) => f.value === "All" || String(row[f.column]) === f.value)
    );
  }, [active.rows, active.activeFilters]);

  function setFilters(filters: FilterConfig[]) {
    updateActive({ activeFilters: filters });
  }

  function updateChart(chart: ChartConfig) {
    updateActive({ charts: active.charts.map((c) => (c.id === chart.id ? chart : c)) });
  }

  function removeChart(id: string) {
    updateActive({ charts: active.charts.filter((c) => c.id !== id) });
  }

  function addChart() {
    const newChart: ChartConfig = {
      id: crypto.randomUUID(),
      title: "New chart",
      type: "bar",
      xKey: active.columns[0],
      yKey: active.columns[1] ?? active.columns[0],
    };
    updateActive({ charts: [...active.charts, newChart] });
  }

  function addDepartment(name: string) {
    const id = name.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now();
    setDepartments((ds) => [...ds, makeDefaultDepartment(id, name)]);
    setActiveId(id);
    setShowAddDept(false);
  }

  const canEdit = user?.role === "admin";

  return (
    <div className="flex bg-[var(--bg)] min-h-svh">
      <Sidebar
        departments={departments}
        activeId={activeId}
        onSelect={setActiveId}
        onAdd={() => setShowAddDept(true)}
        onOpenAssistant={() => setShowAssistant(true)}
      />

      <main className="flex-1 min-w-0">
        <TopBar
          department={active}
          refreshing={refreshing}
          onRefresh={() => loadSheet(active.sheetUrl)}
          onConnectSheet={handleConnectSheet}
        />

        <FilterBar
          columns={active.columns}
          rows={active.rows}
          filters={active.activeFilters}
          onChange={setFilters}
        />

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {active.charts.map((chart) => (
              <ChartCard
                key={chart.id}
                config={chart}
                rows={filteredRows}
                columns={active.columns}
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

          <DataTable rows={filteredRows} columns={active.columns} />
        </div>
      </main>

      {showAssistant && (
        <AIAssistant
          departmentName={active.name}
          rows={filteredRows}
          columns={active.columns}
          onClose={() => setShowAssistant(false)}
        />
      )}

      {showAddDept && (
        <AddDepartmentModal onClose={() => setShowAddDept(false)} onCreate={addDepartment} />
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
