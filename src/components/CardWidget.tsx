import { useState } from "react";
import { Trash2, TrendingUp, TrendingDown, AlertTriangle, Settings2 } from "lucide-react";
import type { CardConfig, DataRow, Measure } from "../types";
import { aggregateColumn } from "../lib/aggregate";
import { computeMeasureValue } from "../lib/measures";
import { formatNumber } from "../lib/numeric";
import { applyWidgetFilter } from "../lib/widgetFilter";
import { WidgetFilterControl } from "./WidgetFilterControl";

interface Props {
  config: CardConfig;
  rows: DataRow[];
  columns: string[];
  measures: Measure[];
  canEdit: boolean;
  onChange: (config: CardConfig) => void;
  onRemove: () => void;
}

function computeValue(subset: DataRow[], config: CardConfig, measures: Measure[]): number {
  if (config.value.kind === "column") return aggregateColumn(subset, config.value.column, config.value.agg);
  const m = measures.find((mm) => mm.id === (config.value as { measureId: string }).measureId);
  return m ? computeMeasureValue(m, subset, measures) : 0;
}

function monthKey(dateStr: unknown): string | null {
  if (!dateStr) return null;
  const d = new Date(String(dateStr));
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function CardWidget({ config, rows, columns, measures, canEdit, onChange, onRemove }: Props) {
  const [showEditor, setShowEditor] = useState(false);

  const filteredRows = applyWidgetFilter(rows, config.filter);
  const value = computeValue(filteredRows, config, measures);

  const alert = config.alertThreshold
    ? config.alertThreshold.direction === "below"
      ? value < config.alertThreshold.value
      : value > config.alertThreshold.value
    : false;

  // Period-over-period: bucket the filtered rows by month (via the chosen
  // date column), then compare the two most recent months that actually
  // appear in the data. Silently hides itself if there aren't at least two
  // distinct months present — no fake "0% change" noise.
  let comparison: { delta: number; pctText: string; up: boolean } | null = null;
  if (config.compareEnabled && config.compareDateColumn) {
    const byMonth = new Map<string, DataRow[]>();
    for (const r of filteredRows) {
      const key = monthKey(r[config.compareDateColumn]);
      if (!key) continue;
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key)!.push(r);
    }
    const months = Array.from(byMonth.keys()).sort();
    if (months.length >= 2) {
      const current = months[months.length - 1];
      const previous = months[months.length - 2];
      const currentVal = computeValue(byMonth.get(current)!, config, measures);
      const previousVal = computeValue(byMonth.get(previous)!, config, measures);
      const delta = currentVal - previousVal;
      const pct = previousVal !== 0 ? (delta / Math.abs(previousVal)) * 100 : 0;
      comparison = { delta, pctText: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`, up: delta >= 0 };
    }
  }

  return (
    <div
      className={`bg-[var(--panel)] border rounded-xl p-4 flex flex-col justify-between h-full transition-colors ${
        alert ? "border-[var(--bad)] bg-[var(--bad)]/5" : "border-[var(--border)]"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        {canEdit ? (
          <input
            value={config.title}
            onChange={(e) => onChange({ ...config, title: e.target.value })}
            className="bg-transparent text-sm font-medium text-[var(--text-h)] outline-none flex-1"
          />
        ) : (
          <h3 className="text-sm flex items-center gap-1.5">
            {alert && <AlertTriangle size={13} className="text-[var(--bad)]" />}
            {config.title}
          </h3>
        )}
        {canEdit && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setShowEditor((s) => !s)} title="Edit"
              className="p-1.5 rounded-md text-[var(--text-dim)] hover:bg-[var(--panel-raised)] hover:text-[var(--text-h)]">
              <Settings2 size={14} />
            </button>
            <button onClick={onRemove} title="Remove" className="p-1.5 rounded-md text-[var(--text-dim)] hover:bg-[var(--panel-raised)] hover:text-[var(--bad)]">
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      {canEdit && showEditor && (
        <div className="mb-2 space-y-2">
          <select
            value={config.value.kind === "column" ? `column:${config.value.column}:${config.value.agg}` : `measure:${config.value.measureId}`}
            onChange={(e) => {
              const val = e.target.value;
              if (val.startsWith("measure:")) onChange({ ...config, value: { kind: "measure", measureId: val.slice(8) } });
              else {
                const [, col, agg] = val.split(":");
                onChange({ ...config, value: { kind: "column", column: col, agg: agg as "sum" | "avg" | "count" | "distinct" | "max" | "min" } });
              }
            }}
            className="w-full bg-[var(--panel-raised)] border border-[var(--border)] rounded-md px-2 py-1 text-xs text-[var(--text)]"
          >
            <optgroup label="Columns">
              {columns.flatMap((col) =>
                (["sum", "avg", "count", "distinct", "max", "min"] as const).map((agg) => (
                  <option key={`${col}:${agg}`} value={`column:${col}:${agg}`}>{agg} {col}</option>
                ))
              )}
            </optgroup>
            {measures.length > 0 && (
              <optgroup label="Measures">
                {measures.map((m) => <option key={m.id} value={`measure:${m.id}`}>★ {m.name}</option>)}
              </optgroup>
            )}
          </select>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <select
              value={config.numberFormat ?? "auto"}
              onChange={(e) => onChange({ ...config, numberFormat: e.target.value as "auto" | "full" })}
              className="bg-[var(--panel-raised)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]"
            >
              <option value="auto">Auto (1.2K / 3.4M)</option>
              <option value="full">Full number</option>
            </select>
            <WidgetFilterControl
              columns={columns}
              rows={rows}
              filter={config.filter}
              onChange={(filter) => onChange({ ...config, filter })}
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs border-t border-[var(--border)] pt-2">
            <select
              value={config.alertThreshold?.direction ?? ""}
              onChange={(e) => {
                const dir = e.target.value as "" | "below" | "above";
                if (!dir) onChange({ ...config, alertThreshold: undefined });
                else onChange({ ...config, alertThreshold: { direction: dir, value: config.alertThreshold?.value ?? 0 } });
              }}
              className="bg-[var(--panel-raised)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]"
            >
              <option value="">No alert</option>
              <option value="below">Alert if below</option>
              <option value="above">Alert if above</option>
            </select>
            {config.alertThreshold && (
              <input
                type="number"
                value={config.alertThreshold.value}
                onChange={(e) => onChange({ ...config, alertThreshold: { direction: config.alertThreshold!.direction, value: Number(e.target.value) } })}
                className="w-28 bg-[var(--panel-raised)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]"
              />
            )}
            <label className="flex items-center gap-1 text-[var(--text-dim)] cursor-pointer ml-1">
              <input
                type="checkbox"
                checked={config.compareEnabled ?? false}
                onChange={(e) => onChange({ ...config, compareEnabled: e.target.checked })}
              />
              vs last month
            </label>
            {config.compareEnabled && (
              <select
                value={config.compareDateColumn ?? ""}
                onChange={(e) => onChange({ ...config, compareDateColumn: e.target.value })}
                className="bg-[var(--panel-raised)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]"
              >
                <option value="">date column…</option>
                {columns.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center py-4 gap-1">
        <span className="num text-4xl font-semibold text-[var(--text-h)]">
          {formatNumber(value, config.numberFormat)}
        </span>
        {comparison && (
          <span className={`flex items-center gap-1 text-xs font-medium ${comparison.up ? "text-[var(--good,#57c99a)]" : "text-[var(--bad)]"}`}>
            {comparison.up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {comparison.pctText} vs last month
          </span>
        )}
      </div>
    </div>
  );
}
