import { Download, Trash2 } from "lucide-react";
import type { DataRow, PivotAgg, PivotConfig } from "../types";
import { exportRowsToExcel } from "../lib/exportExcel";

interface Props {
  config: PivotConfig;
  rows: DataRow[];
  columns: string[];
  canEdit: boolean;
  canExport?: boolean;
  onChange: (config: PivotConfig) => void;
  onRemove: () => void;
}

function aggregate(values: number[], agg: PivotAgg): number {
  if (values.length === 0) return 0;
  switch (agg) {
    case "sum": return values.reduce((a, b) => a + b, 0);
    case "avg": return values.reduce((a, b) => a + b, 0) / values.length;
    case "count": return values.length;
    case "max": return Math.max(...values);
    case "min": return Math.min(...values);
  }
}

export function PivotCard({ config, rows, columns, canEdit, canExport = true, onChange, onRemove }: Props) {
  const groupCols = config.groupCols.filter(Boolean);
  const groups = new Map<string, { keys: string[]; values: number[] }>();

  rows.forEach((row) => {
    const keys = groupCols.map((c) => String(row[c] ?? ""));
    const groupKey = keys.join(" ▸ ");
    if (!groups.has(groupKey)) groups.set(groupKey, { keys, values: [] });
    groups.get(groupKey)!.values.push(Number(row[config.valueCol]) || 0);
  });

  let result = Array.from(groups.values()).map((g) => ({
    keys: g.keys,
    value: aggregate(g.values, config.agg),
  }));

  result.sort((a, b) => (config.sortDir === "desc" ? b.value - a.value : a.value - b.value));
  result = result.slice(0, config.limit);

  const exportRows: DataRow[] = result.map((r) => {
    const row: DataRow = {};
    groupCols.forEach((c, i) => (row[c] = r.keys[i]));
    row[`${config.agg}_${config.valueCol}`] = r.value;
    return row;
  });

  function updateGroupCol(index: number, col: string) {
    const next = [...config.groupCols];
    next[index] = col;
    onChange({ ...config, groupCols: next });
  }

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
          {canExport && (
            <button
              onClick={() => exportRowsToExcel(exportRows, config.title.replace(/\s+/g, "_"))}
              title="Export to Excel"
              className="p-1.5 rounded-md text-[var(--text-dim)] hover:bg-[var(--panel-raised)] hover:text-[var(--text-h)]"
            >
              <Download size={14} />
            </button>
          )}
          {canEdit && (
            <button
              onClick={onRemove}
              title="Remove pivot"
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
            value={config.groupCols[0] ?? columns[0]}
            onChange={(e) => updateGroupCol(0, e.target.value)}
            className="bg-[var(--panel-raised)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]"
          >
            {columns.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={config.groupCols[1] ?? ""}
            onChange={(e) => updateGroupCol(1, e.target.value)}
            className="bg-[var(--panel-raised)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]"
          >
            <option value="">+ sub-group (optional)</option>
            {columns.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={config.valueCol}
            onChange={(e) => onChange({ ...config, valueCol: e.target.value })}
            className="bg-[var(--panel-raised)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]"
          >
            {columns.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={config.agg}
            onChange={(e) => onChange({ ...config, agg: e.target.value as PivotAgg })}
            className="bg-[var(--panel-raised)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]"
          >
            <option value="sum">Sum</option>
            <option value="avg">Average</option>
            <option value="count">Count</option>
            <option value="max">Max</option>
            <option value="min">Min</option>
          </select>
          <select
            value={config.sortDir}
            onChange={(e) => onChange({ ...config, sortDir: e.target.value as "desc" | "asc" })}
            className="bg-[var(--panel-raised)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]"
          >
            <option value="desc">Top</option>
            <option value="asc">Bottom</option>
          </select>
          <input
            type="number"
            min={1}
            value={config.limit}
            onChange={(e) => onChange({ ...config, limit: Math.max(1, Number(e.target.value) || 1) })}
            className="w-14 bg-[var(--panel-raised)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]"
          />
        </div>
      )}

      <div className="overflow-y-auto max-h-72">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              {groupCols.map((c) => (
                <th key={c} className="text-left px-2 py-1.5 text-xs uppercase tracking-wide text-[var(--text-dim)]">{c}</th>
              ))}
              <th className="text-right px-2 py-1.5 text-xs uppercase tracking-wide text-[var(--text-dim)]">
                {config.agg} {config.valueCol}
              </th>
            </tr>
          </thead>
          <tbody>
            {result.map((r, i) => (
              <tr key={i} className="border-b border-[var(--border)]/50 hover:bg-[var(--panel-raised)]">
                {r.keys.map((k, j) => (
                  <td key={j} className="px-2 py-1.5 text-[var(--text)]">{k}</td>
                ))}
                <td className="px-2 py-1.5 text-right num text-[var(--text)]">
                  {r.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
