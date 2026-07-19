import { useState } from "react";
import { Download, Trash2, Settings2, Plus, X, ArrowUpDown } from "lucide-react";
import type { DataRow, Measure, PivotConfig, PivotValueMetric } from "../types";
import { exportRowsToExcel } from "../lib/exportExcel";
import { aggregateColumn } from "../lib/aggregate";

interface Props {
  config: PivotConfig;
  rows: DataRow[];
  columns: string[];
  measures: Measure[];
  canEdit: boolean;
  canExport?: boolean;
  onChange: (config: PivotConfig) => void;
  onRemove: () => void;
}

function metricValue(rows: DataRow[], metric: PivotValueMetric, measures: Measure[]): number {
  const source = metric.source;
  if (source.kind === "column") {
    return aggregateColumn(rows, source.column, source.agg);
  }
  const measure = measures.find((m) => m.id === source.measureId);
  if (!measure) return 0;
  return aggregateColumn(rows, measure.column, measure.agg, measure.conditionColumn, measure.conditionValue);
}

export function PivotCard({ config, rows, columns, measures, canEdit, canExport = true, onChange, onRemove }: Props) {
  const [showEditor, setShowEditor] = useState(false);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  const groupCols = config.groupCols.filter(Boolean);
  const values = config.values.length > 0 ? config.values : [];

  const groups = new Map<string, { keys: string[]; rows: DataRow[] }>();
  rows.forEach((row) => {
    const keys = groupCols.map((c) => String(row[c] ?? ""));
    const key = keys.join(" \u25b8 ");
    if (!groups.has(key)) groups.set(key, { keys, rows: [] });
    groups.get(key)!.rows.push(row);
  });

  let result = Array.from(groups.values()).map((g) => ({
    keys: g.keys,
    metrics: values.map((v) => metricValue(g.rows, v, measures)),
  }));

  const sortMetricIdx = Math.max(0, values.findIndex((v) => v.id === config.sortByValueId));
  result.sort((a, b) =>
    config.sortDir === "desc"
      ? (b.metrics[sortMetricIdx] ?? 0) - (a.metrics[sortMetricIdx] ?? 0)
      : (a.metrics[sortMetricIdx] ?? 0) - (b.metrics[sortMetricIdx] ?? 0)
  );
  result = result.slice(Math.max(0, config.rangeStart - 1), config.rangeEnd);

  if (sortCol) {
    const colIdx = groupCols.indexOf(sortCol);
    const valIdx = values.findIndex((v) => v.label === sortCol);
    result = [...result].sort((a, b) => {
      if (colIdx >= 0) return a.keys[colIdx].localeCompare(b.keys[colIdx]) * sortDir;
      if (valIdx >= 0) return ((a.metrics[valIdx] ?? 0) - (b.metrics[valIdx] ?? 0)) * sortDir;
      return 0;
    });
  }

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir((d) => (d === 1 ? -1 : 1));
    else { setSortCol(col); setSortDir(1); }
  }

  const exportRows: DataRow[] = result.map((r) => {
    const row: DataRow = {};
    groupCols.forEach((c, i) => (row[c] = r.keys[i]));
    values.forEach((v, i) => (row[v.label] = r.metrics[i]));
    return row;
  });

  function addGroupCol() {
    const unused = columns.find((c) => !groupCols.includes(c)) ?? columns[0];
    onChange({ ...config, groupCols: [...config.groupCols, unused] });
  }
  function updateGroupCol(i: number, col: string) {
    const next = [...config.groupCols];
    next[i] = col;
    onChange({ ...config, groupCols: next });
  }
  function removeGroupCol(i: number) {
    onChange({ ...config, groupCols: config.groupCols.filter((_, idx) => idx !== i) });
  }

  function addValue() {
    const metric: PivotValueMetric = {
      id: crypto.randomUUID(),
      label: columns[1] ?? columns[0],
      source: { kind: "column", column: columns[1] ?? columns[0], agg: "sum" },
    };
    onChange({ ...config, values: [...config.values, metric] });
  }
  function updateValue(i: number, metric: PivotValueMetric) {
    const next = [...config.values];
    next[i] = metric;
    onChange({ ...config, values: next });
  }
  function removeValue(i: number) {
    onChange({ ...config, values: config.values.filter((_, idx) => idx !== i) });
  }

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
            <button onClick={() => exportRowsToExcel(exportRows, config.title.replace(/\s+/g, "_"))} title="Export to Excel"
              className="p-1.5 rounded-md text-[var(--text-dim)] hover:bg-[var(--panel-raised)] hover:text-[var(--text-h)]">
              <Download size={14} />
            </button>
          )}
          {canEdit && (
            <>
              <button onClick={() => setShowEditor((s) => !s)} title="Edit"
                className="p-1.5 rounded-md text-[var(--text-dim)] hover:bg-[var(--panel-raised)] hover:text-[var(--text-h)]">
                <Settings2 size={14} />
              </button>
              <button onClick={onRemove} title="Remove"
                className="p-1.5 rounded-md text-[var(--text-dim)] hover:bg-[var(--panel-raised)] hover:text-[var(--bad)]">
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
          <select
            value={config.sortDir}
            onChange={(e) => onChange({ ...config, sortDir: e.target.value as "desc" | "asc" })}
            className="bg-[var(--panel-raised)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]"
          >
            <option value="desc">Highest first</option>
            <option value="asc">Lowest first</option>
          </select>
          <span className="text-[var(--text-dim)]">rank</span>
          <input
            type="number" min={1} value={config.rangeStart}
            onChange={(e) => onChange({ ...config, rangeStart: Math.max(1, Number(e.target.value) || 1) })}
            className="w-14 bg-[var(--panel-raised)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]"
          />
          <span className="text-[var(--text-dim)]">to</span>
          <input
            type="number" min={1} value={config.rangeEnd}
            onChange={(e) => onChange({ ...config, rangeEnd: Math.max(config.rangeStart, Number(e.target.value) || config.rangeStart) })}
            className="w-14 bg-[var(--panel-raised)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]"
          />
          {values.length > 1 && (
            <select
              value={config.sortByValueId ?? values[0]?.id}
              onChange={(e) => onChange({ ...config, sortByValueId: e.target.value })}
              className="bg-[var(--panel-raised)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]"
            >
              {values.map((v) => <option key={v.id} value={v.id}>by {v.label}</option>)}
            </select>
          )}
        </div>
      )}

      {canEdit && showEditor && (
        <div className="mb-3 p-3 rounded-lg bg-[var(--panel-raised)] border border-[var(--border)] space-y-3 text-xs">
          <div>
            <p className="text-[var(--text-dim)] mb-1.5">Group by (rows)</p>
            <div className="space-y-1.5">
              {config.groupCols.map((c, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <select value={c} onChange={(e) => updateGroupCol(i, e.target.value)}
                    className="flex-1 bg-[var(--panel)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]">
                    {columns.map((col) => <option key={col} value={col}>{col}</option>)}
                  </select>
                  <button onClick={() => removeGroupCol(i)} className="text-[var(--text-dim)] hover:text-[var(--bad)]"><X size={13} /></button>
                </div>
              ))}
              <button onClick={addGroupCol} className="flex items-center gap-1 text-[var(--accent)] hover:opacity-80">
                <Plus size={12} /> Add group column
              </button>
            </div>
          </div>

          <div>
            <p className="text-[var(--text-dim)] mb-1.5">Values</p>
            <div className="space-y-1.5">
              {config.values.map((v, i) => (
                <div key={v.id} className="flex items-center gap-1.5 flex-wrap">
                  <select
                    value={v.source.kind === "measure" ? `measure:${v.source.measureId}` : `column:${v.source.column}:${v.source.agg}`}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.startsWith("measure:")) {
                        const measureId = val.slice("measure:".length);
                        const m = measures.find((mm) => mm.id === measureId);
                        updateValue(i, { ...v, label: m?.name ?? v.label, source: { kind: "measure", measureId } });
                      } else {
                        const [, col, agg] = val.split(":");
                        updateValue(i, { ...v, label: `${agg} ${col}`, source: { kind: "column", column: col, agg: agg as PivotValueMetric["source"] extends { agg: infer A } ? A : never } });
                      }
                    }}
                    className="flex-1 min-w-[160px] bg-[var(--panel)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]"
                  >
                    <optgroup label="Columns">
                      {columns.flatMap((col) =>
                        (["sum", "avg", "count", "max", "min"] as const).map((agg) => (
                          <option key={`${col}:${agg}`} value={`column:${col}:${agg}`}>{agg} {col}</option>
                        ))
                      )}
                    </optgroup>
                    {measures.length > 0 && (
                      <optgroup label="Measures">
                        {measures.map((m) => <option key={m.id} value={`measure:${m.id}`}>\u2605 {m.name}</option>)}
                      </optgroup>
                    )}
                  </select>
                  <input
                    value={v.label}
                    onChange={(e) => updateValue(i, { ...v, label: e.target.value })}
                    className="w-28 bg-[var(--panel)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]"
                    placeholder="label"
                  />
                  <button onClick={() => removeValue(i)} className="text-[var(--text-dim)] hover:text-[var(--bad)]"><X size={13} /></button>
                </div>
              ))}
              <button onClick={addValue} className="flex items-center gap-1 text-[var(--accent)] hover:opacity-80">
                <Plus size={12} /> Add value
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto min-h-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              {groupCols.map((c) => (
                <th key={c} onClick={() => toggleSort(c)}
                  className="text-left px-2 py-1.5 text-xs uppercase tracking-wide text-[var(--text-dim)] cursor-pointer select-none">
                  <span className="inline-flex items-center gap-1">{c} <ArrowUpDown size={10} /></span>
                </th>
              ))}
              {values.map((v) => (
                <th key={v.id} onClick={() => toggleSort(v.label)}
                  className="text-right px-2 py-1.5 text-xs uppercase tracking-wide text-[var(--text-dim)] cursor-pointer select-none">
                  <span className="inline-flex items-center gap-1">{v.label} <ArrowUpDown size={10} /></span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.map((r, i) => (
              <tr key={i} className="border-b border-[var(--border)]/50 hover:bg-[var(--panel-raised)]">
                {r.keys.map((k, j) => <td key={j} className="px-2 py-1.5 text-[var(--text)]">{k}</td>)}
                {r.metrics.map((m, j) => (
                  <td key={j} className="px-2 py-1.5 text-right num text-[var(--text)]">
                    {m.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
