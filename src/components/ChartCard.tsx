import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  ScatterChart, Scatter, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Treemap, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LabelList,
} from "recharts";
import { Download, Trash2 } from "lucide-react";
import type { ChartConfig, DataRow } from "../types";
import { exportRowsToExcel } from "../lib/exportExcel";
import { parseNumeric } from "../lib/numeric";

const COLORS = ["#c81e94", "#57c99a", "#e94fb0", "#7aa2e8", "#f2b807", "#8a5fd6"];

interface Props {
  config: ChartConfig;
  rows: DataRow[];
  columns: string[];
  canEdit: boolean;
  canExport?: boolean;
  onChange: (config: ChartConfig) => void;
  onRemove: () => void;
  onCrossFilter?: (column: string, value: string) => void;
}

const tooltipStyle = { background: "var(--panel-raised)", border: "1px solid var(--border)", borderRadius: 8 };

export function ChartCard({ config, rows, columns, canEdit, canExport = true, onChange, onRemove, onCrossFilter }: Props) {
  // Aggregate rows by xKey, summing yKey — keeps charts readable when the
  // sheet has repeated categories (e.g. multiple rows per month).
  const aggregated = Object.values(
    rows.reduce<Record<string, DataRow>>((acc, row) => {
      const key = String(row[config.xKey]);
      const yVal = parseNumeric(row[config.yKey]);
      if (!acc[key]) acc[key] = { [config.xKey]: key, [config.yKey]: 0 };
      acc[key][config.yKey] = (acc[key][config.yKey] as number) + yVal;
      return acc;
    }, {})
  );

  const treemapData = aggregated
    .map((row) => ({ name: String(row[config.xKey]), size: Number(row[config.yKey]) || 0 }))
    .sort((a, b) => b.size - a.size);

  return (
    <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-4 flex flex-col h-full">
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
          {canExport && (
            <button
              onClick={() => exportRowsToExcel(aggregated, config.title.replace(/\s+/g, "_"))}
              title="Export to Excel"
              className="p-1.5 rounded-md text-[var(--text-dim)] hover:bg-[var(--panel-raised)] hover:text-[var(--text-h)]"
            >
              <Download size={14} />
            </button>
          )}
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
        <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
          <select
            value={config.type}
            onChange={(e) => onChange({ ...config, type: e.target.value as ChartConfig["type"] })}
            className="bg-[var(--panel-raised)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]"
          >
            <option value="bar">Bar</option>
            <option value="line">Line</option>
            <option value="area">Area</option>
            <option value="pie">Pie</option>
            <option value="scatter">Scatter</option>
            <option value="radar">Radar</option>
            <option value="treemap">Treemap</option>
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
          {config.type !== "treemap" && config.type !== "pie" && (
            <label className="flex items-center gap-1 text-[var(--text-dim)] cursor-pointer">
              <input
                type="checkbox"
                checked={config.showValues ?? false}
                onChange={(e) => onChange({ ...config, showValues: e.target.checked })}
              />
              Show values
            </label>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          {config.type === "bar" ? (
            <BarChart data={aggregated}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey={config.xKey} stroke="var(--text-dim)" fontSize={11} />
              <YAxis stroke="var(--text-dim)" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar
                dataKey={config.yKey}
                fill="var(--accent)"
                radius={[4, 4, 0, 0]}
                cursor={onCrossFilter ? "pointer" : undefined}
                onClick={(data: any) => onCrossFilter?.(config.xKey, String(data?.[config.xKey]))}
              >
                {config.showValues && <LabelList dataKey={config.yKey} position="top" fontSize={10} fill="var(--text)" />}
              </Bar>
            </BarChart>
          ) : config.type === "line" ? (
            <LineChart data={aggregated}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey={config.xKey} stroke="var(--text-dim)" fontSize={11} />
              <YAxis stroke="var(--text-dim)" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey={config.yKey} stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }}>
                {config.showValues && <LabelList dataKey={config.yKey} position="top" fontSize={10} fill="var(--text)" />}
              </Line>
            </LineChart>
          ) : config.type === "area" ? (
            <AreaChart data={aggregated}>
              <defs>
                <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey={config.xKey} stroke="var(--text-dim)" fontSize={11} />
              <YAxis stroke="var(--text-dim)" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey={config.yKey} stroke="var(--accent)" strokeWidth={2} fill="url(#areaFill)">
                {config.showValues && <LabelList dataKey={config.yKey} position="top" fontSize={10} fill="var(--text)" />}
              </Area>
            </AreaChart>
          ) : config.type === "scatter" ? (
            <ScatterChart>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey={config.xKey} stroke="var(--text-dim)" fontSize={11} name={config.xKey} />
              <YAxis dataKey={config.yKey} stroke="var(--text-dim)" fontSize={11} name={config.yKey} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: "3 3" }} />
              <Scatter data={aggregated} fill="var(--accent)" />
            </ScatterChart>
          ) : config.type === "radar" ? (
            <RadarChart data={aggregated}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey={config.xKey} stroke="var(--text-dim)" fontSize={11} />
              <PolarRadiusAxis stroke="var(--text-dim)" fontSize={10} />
              <Tooltip contentStyle={tooltipStyle} />
              <Radar dataKey={config.yKey} stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.4} />
            </RadarChart>
          ) : config.type === "treemap" ? (
            <Treemap data={treemapData} dataKey="size" stroke="var(--panel)" fill="var(--accent)">
              {treemapData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
              <Tooltip contentStyle={tooltipStyle} />
            </Treemap>
          ) : (
            <PieChart>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Pie
                data={aggregated}
                dataKey={config.yKey}
                nameKey={config.xKey}
                outerRadius={80}
                label={(props: { name?: string }) => props.name ?? ""}
                cursor={onCrossFilter ? "pointer" : undefined}
                onClick={(data: { name?: string }) => data.name && onCrossFilter?.(config.xKey, data.name)}
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
