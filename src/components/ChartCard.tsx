import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { Download, Trash2 } from "lucide-react";
import type { ChartConfig, DataRow } from "../types";
import { exportRowsToExcel } from "../lib/exportExcel";

const COLORS = ["#e8a33d", "#4fb286", "#7aa2e8", "#e0664f", "#c084fc", "#5fc8d8"];

interface Props {
  config: ChartConfig;
  rows: DataRow[];
  columns: string[];
  canEdit: boolean;
  onChange: (config: ChartConfig) => void;
  onRemove: () => void;
}

export function ChartCard({ config, rows, columns, canEdit, onChange, onRemove }: Props) {
  // Aggregate rows by xKey, summing yKey — keeps charts readable when the
  // sheet has repeated categories (e.g. multiple rows per month).
  const aggregated = Object.values(
    rows.reduce<Record<string, DataRow>>((acc, row) => {
      const key = String(row[config.xKey]);
      const yVal = Number(row[config.yKey]) || 0;
      if (!acc[key]) acc[key] = { [config.xKey]: key, [config.yKey]: 0 };
      acc[key][config.yKey] = (acc[key][config.yKey] as number) + yVal;
      return acc;
    }, {})
  );

  return (
    <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-4 flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-3">
        {canEdit ? (
          <input
            value={config.title}
            onChange={(e) => onChange({ ...config, title: e.target.value })}
            className="bg-transparent text-sm font-medium text-[var(--text-h)] outline-none flex-1"
          />
        ) : (
          <h3 className="text-sm">{config.title}</h3>
        )}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => exportRowsToExcel(aggregated, config.title.replace(/\s+/g, "_"))}
            title="Export to Excel"
            className="p-1.5 rounded-md text-[var(--text-dim)] hover:bg-[var(--panel-raised)] hover:text-[var(--text-h)]"
          >
            <Download size={14} />
          </button>
          {canEdit && (
            <button
              onClick={onRemove}
              title="Remove chart"
              className="p-1.5 rounded-md text-[var(--text-dim)] hover:bg-[var(--panel-raised)] hover:text-[var(--bad)]"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {canEdit && (
        <div className="flex flex-wrap gap-2 mb-3 text-xs">
          <select
            value={config.type}
            onChange={(e) => onChange({ ...config, type: e.target.value as ChartConfig["type"] })}
            className="bg-[var(--panel-raised)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]"
          >
            <option value="bar">Bar</option>
            <option value="line">Line</option>
            <option value="pie">Pie</option>
          </select>
          <select
            value={config.xKey}
            onChange={(e) => onChange({ ...config, xKey: e.target.value })}
            className="bg-[var(--panel-raised)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]"
          >
            {columns.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={config.yKey}
            onChange={(e) => onChange({ ...config, yKey: e.target.value })}
            className="bg-[var(--panel-raised)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]"
          >
            {columns.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}

      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          {config.type === "bar" ? (
            <BarChart data={aggregated}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey={config.xKey} stroke="var(--text-dim)" fontSize={11} />
              <YAxis stroke="var(--text-dim)" fontSize={11} />
              <Tooltip contentStyle={{ background: "var(--panel-raised)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Bar dataKey={config.yKey} fill="var(--accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : config.type === "line" ? (
            <LineChart data={aggregated}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey={config.xKey} stroke="var(--text-dim)" fontSize={11} />
              <YAxis stroke="var(--text-dim)" fontSize={11} />
              <Tooltip contentStyle={{ background: "var(--panel-raised)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Line type="monotone" dataKey={config.yKey} stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          ) : (
            <PieChart>
              <Tooltip contentStyle={{ background: "var(--panel-raised)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Pie
                data={aggregated}
                dataKey={config.yKey}
                nameKey={config.xKey}
                outerRadius={80}
                label={(props: { name?: string }) => props.name ?? ""}
              >
                {aggregated.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
