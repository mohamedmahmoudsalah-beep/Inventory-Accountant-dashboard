import { useMemo, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  ScatterChart, Scatter, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Treemap, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LabelList,
} from "recharts";
import { Download, Trash2, Settings2 } from "lucide-react";
import type { ChartConfig, DataRow } from "../types";
import { exportRowsToExcel } from "../lib/exportExcel";
import { parseNumeric, formatNumber } from "../lib/numeric";

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
  // Starts open for a brand-new chart (no columns picked yet) so the person
  // is dropped straight into picking them, instead of the chart silently
  // guessing the first two columns.
  const [showEditor, setShowEditor] = useState(!config.xKey || !config.yKey);
  const hasColumns = Boolean(config.xKey && config.yKey);

  // Groups rows by xKey, summing yKey — keeps charts readable when the
  // sheet has repeated categories (e.g. multiple rows per month).
  // Memoized: this used to re-run over every row on every keystroke (even
  // typing in the title field triggers a re-render), which is what made
  // typing feel like it "hung" the page on large sheets. Now it only
  // recomputes when the actual data or chart-shape inputs change.
  const grouped = useMemo(() => {
    if (!hasColumns) return [];
    return Object.values(
      rows.reduce<Record<string, DataRow>>((acc, row) => {
        const key = String(row[config.xKey]);
        const yVal = parseNumeric(row[config.yKey]);
        if (!acc[key]) acc[key] = { [config.xKey]: key, [config.yKey]: 0 };
        acc[key][config.yKey] = (acc[key][config.yKey] as number) + yVal;
        return acc;
      }, {})
    );
  }, [rows, config.xKey, config.yKey, hasColumns]);

  // Top/Bottom-N ranking — same idea as Pivot's rangeStart/rangeEnd. Left
  // undefined (older charts) means "show everything", unranked, exactly
  // like before this existed.
  const aggregated = useMemo(() => {
    if (!hasColumns) return [];
    if (config.rangeStart === undefined && config.rangeEnd === undefined) return grouped;
    const sorted = [...grouped].sort((a, b) => {
      const av = Number(a[config.yKey]) || 0;
      const bv = Number(b[config.yKey]) || 0;
      return config.sortDir === "asc" ? av - bv : bv - av;
    });
    const start = Math.max(0, (config.rangeStart ?? 1) - 1);
    const end = config.rangeEnd ?? sorted.length;
    return sorted.slice(start, end);
  }, [grouped, config.yKey, config.sortDir, config.rangeStart, config.rangeEnd, hasColumns]);

  const treemapData = useMemo(
    () => aggregated.map((row) => ({ name: String(row[config.xKey]), size: Number(row[config.yKey]) || 0 })),
    [aggregated, config.xKey, config.yKey]
  );

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
            <>
              <button
                onClick={() => setShowEditor((s) => !s)}
                title="Edit"
                className="p-1.5 rounded-md text-[var(--text-dim)] hover:bg-[var(--panel-raised)] hover:text-[var(--text-h)]"
              >
                <Settings2 size={14} />
              </button>
              <button
                onClick={onRemove}
                title="Remove chart"
                className="p-1.5 rounded-md text-[var(--text-dim)] hover:bg-[var(--panel-raised)] hover:text-[var(--bad)]"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {canEdit && showEditor && (
        <div className="mb-3 p-3 rounded-lg bg-[var(--panel-raised)] border border-[var(--border)] flex flex-wrap items-center gap-2 text-xs">
          <select
            value={config.type}
            onChange={(e) => onChange({ ...config, type: e.target.value as ChartConfig["type"] })}
            className="bg-[var(--panel)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]"
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
            className="bg-[var(--panel)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]"
          >
            <option value="" disabled>X axis…</option>
            {columns.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={config.yKey}
            onChange={(e) => onChange({ ...config, yKey: e.target.value })}
            className="bg-[var(--panel)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]"
          >
            <option value="" disabled>Y axis…</option>
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
          <select
            value={config.numberFormat ?? "auto"}
            onChange={(e) => onChange({ ...config, numberFormat: e.target.value as "auto" | "full" })}
            className="bg-[var(--panel)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]"
          >
            <option value="auto">Auto (1.2K / 3.4M)</option>
            <option value="full">Full number</option>
          </select>
          <span className="w-full basis-full h-0" />
          <select
            value={config.sortDir ?? "desc"}
            onChange={(e) => onChange({ ...config, sortDir: e.target.value as "desc" | "asc", rangeStart: config.rangeStart ?? 1, rangeEnd: config.rangeEnd ?? 10 })}
            className="bg-[var(--panel)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]"
          >
            <option value="desc">Highest first</option>
            <option value="asc">Lowest first</option>
          </select>
          <span className="text-[var(--text-dim)]">rank</span>
          <input
            type="number" min={1} value={config.rangeStart ?? 1}
            onChange={(e) => onChange({ ...config, rangeStart: Math.max(1, Number(e.target.value) || 1), rangeEnd: config.rangeEnd ?? grouped.length, sortDir: config.sortDir ?? "desc" })}
            className="w-14 bg-[var(--panel)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]"
          />
          <span className="text-[var(--text-dim)]">to</span>
          <input
            type="number" min={1} value={config.rangeEnd ?? grouped.length}
            onChange={(e) => onChange({ ...config, rangeEnd: Math.max(config.rangeStart ?? 1, Number(e.target.value) || (config.rangeStart ?? 1)), rangeStart: config.rangeStart ?? 1, sortDir: config.sortDir ?? "desc" })}
            className="w-14 bg-[var(--panel)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]"
          />
          {(config.rangeStart !== undefined || config.rangeEnd !== undefined) && (
            <button
              onClick={() => onChange({ ...config, sortDir: undefined, rangeStart: undefined, rangeEnd: undefined })}
              className="text-[var(--accent)] hover:opacity-80"
              title="Go back to showing every category, unranked"
            >
              Show all
            </button>
          )}
        </div>
      )}

      {!hasColumns ? (
        <div className="flex-1 min-h-0 flex items-center justify-center text-center text-xs text-[var(--text-dim)] border border-dashed border-[var(--border)] rounded-lg p-4">
          Pick an X and Y column above to build this chart.
        </div>
      ) : (
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          {config.type === "bar" ? (
            <BarChart data={aggregated}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey={config.xKey} stroke="var(--text-dim)" fontSize={11} />
              <YAxis stroke="var(--text-dim)" fontSize={11} tickFormatter={(v) => formatNumber(Number(v), config.numberFormat)} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar
                dataKey={config.yKey}
                fill="var(--accent)"
                radius={[4, 4, 0, 0]}
                cursor={onCrossFilter ? "pointer" : undefined}
                onClick={(data: any) => onCrossFilter?.(config.xKey, String(data?.[config.xKey]))}
              >
                {config.showValues && (
                  <LabelList
                    dataKey={config.yKey}
                    position="top"
                    fontSize={10}
                    fill="var(--text)"
                    formatter={(v: unknown) => formatNumber(Number(v), config.numberFormat)}
                  />
                )}
              </Bar>
            </BarChart>
          ) : config.type === "line" ? (
            <LineChart data={aggregated}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey={config.xKey} stroke="var(--text-dim)" fontSize={11} />
              <YAxis stroke="var(--text-dim)" fontSize={11} tickFormatter={(v) => formatNumber(Number(v), config.numberFormat)} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey={config.yKey} stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }}>
                {config.showValues && (
                  <LabelList
                    dataKey={config.yKey}
                    position="top"
                    fontSize={10}
                    fill="var(--text)"
                    formatter={(v: unknown) => formatNumber(Number(v), config.numberFormat)}
                  />
                )}
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
              <YAxis stroke="var(--text-dim)" fontSize={11} tickFormatter={(v) => formatNumber(Number(v), config.numberFormat)} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey={config.yKey} stroke="var(--accent)" strokeWidth={2} fill="url(#areaFill)">
                {config.showValues && (
                  <LabelList
                    dataKey={config.yKey}
                    position="top"
                    fontSize={10}
                    fill="var(--text)"
                    formatter={(v: unknown) => formatNumber(Number(v), config.numberFormat)}
                  />
                )}
              </Area>
            </AreaChart>
          ) : config.type === "scatter" ? (
            <ScatterChart>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey={config.xKey} stroke="var(--text-dim)" fontSize={11} name={config.xKey} />
              <YAxis dataKey={config.yKey} stroke="var(--text-dim)" fontSize={11} name={config.yKey} tickFormatter={(v) => formatNumber(Number(v), config.numberFormat)} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: "3 3" }} />
              <Scatter data={aggregated} fill="var(--accent)" />
            </ScatterChart>
          ) : config.type === "radar" ? (
            <RadarChart data={aggregated}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey={config.xKey} stroke="var(--text-dim)" fontSize={11} />
              <PolarRadiusAxis stroke="var(--text-dim)" fontSize={10} tickFormatter={(v) => formatNumber(Number(v), config.numberFormat)} />
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
      )}
    </div>
  );
}
