"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { BarChart, LineChart, PieChart, Table2, Type, Plus, Save } from "lucide-react";
import { BarChartComponent } from "@/components/charts/BarChart";
import { LineChartComponent } from "@/components/charts/LineChart";
import { PieChartComponent } from "@/components/charts/PieChart";
import { DataTable } from "@/components/charts/DataTable";
import { KPICard } from "@/components/charts/KPICard";

const widgetTypes = [
  { type: "BAR_CHART", icon: BarChart, label: "Bar Chart" },
  { type: "LINE_CHART", icon: LineChart, label: "Line Chart" },
  { type: "PIE_CHART", icon: PieChart, label: "Pie Chart" },
  { type: "TABLE", icon: Table2, label: "Table" },
  { type: "KPI_CARD", icon: Type, label: "KPI" },
  { type: "TEXT", icon: Type, label: "Text" },
];

export default function DashboardViewPage() {
  const { id } = useParams();
  const t = useTranslations();
  const [widgets, setWidgets] = useState<any[]>([]);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [showAddWidget, setShowAddWidget] = useState(false);

  useEffect(() => {
    fetchWidgets();
    fetchDatasets();
  }, [id]);

  const fetchWidgets = async () => {
    const res = await fetch(`/api/widgets?dashboardId=${id}`);
    const data = await res.json();
    setWidgets(data.widgets || []);
  };

  const fetchDatasets = async () => {
    const res = await fetch("/api/datasets");
    const data = await res.json();
    setDatasets(data.datasets || []);
  };

  const addWidget = async (type: string) => {
    const widget = {
      type,
      title: `New ${type}`,
      config: JSON.stringify({ datasetId: datasets[0]?.id }),
      position: JSON.stringify({ x: 0, y: 0, w: 6, h: 4 }),
      dashboardId: id,
    };

    await fetch("/api/widgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(widget),
    });

    setShowAddWidget(false);
    fetchWidgets();
  };

  const renderWidget = (widget: any) => {
    const config = JSON.parse(widget.config || "{}");
    const data: any[] = [];

    switch (widget.type) {
      case "BAR_CHART":
        return <BarChartComponent data={data} config={config} />;
      case "LINE_CHART":
        return <LineChartComponent data={data} config={config} />;
      case "PIE_CHART":
        return <PieChartComponent data={data} config={config} />;
      case "TABLE":
        return <DataTable data={data} />;
      case "KPI_CARD":
        return <KPICard title={widget.title} value={0} />;
      default:
        return <div className="p-4 text-muted-foreground">Widget: {widget.type}</div>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddWidget(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Widget
          </button>
          <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent text-foreground rounded-xl font-medium hover:bg-accent/80 transition-colors">
            <Save className="w-4 h-4" />
            Save
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {widgets.map((widget) => (
          <div key={widget.id} className="glass-card rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="font-medium text-foreground">{widget.title}</h3>
            </div>
            <div className="p-4 h-64">{renderWidget(widget)}</div>
          </div>
        ))}
      </div>

      {widgets.length === 0 && (
        <div className="glass-card rounded-2xl p-12 text-center">
          <p className="text-muted-foreground mb-4">No widgets yet. Add your first widget!</p>
          <button
            onClick={() => setShowAddWidget(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Widget
          </button>
        </div>
      )}

      {showAddWidget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-foreground mb-4">Add Widget</h2>
            <div className="grid grid-cols-2 gap-3">
              {widgetTypes.map((wt) => (
                <button
                  key={wt.type}
                  onClick={() => addWidget(wt.type)}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all"
                >
                  <wt.icon className="w-6 h-6 text-primary" />
                  <span className="text-sm font-medium text-foreground">{wt.label}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowAddWidget(false)}
              className="mt-4 w-full py-2.5 bg-accent text-foreground rounded-xl font-medium hover:bg-accent/80 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
