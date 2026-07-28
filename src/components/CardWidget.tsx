import { Trash2, X } from "lucide-react";
import type { CardConfig, DataRow, Measure } from "../types";
import { aggregateColumn } from "../lib/aggregate";
import { formatNumber } from "../lib/numeric";

interface Props {
  config: CardConfig;
  rows: DataRow[];
  columns: string[];
  measures: Measure[];
  canEdit: boolean;
  onChange: (config: CardConfig) => void;
  onRemove: () => void;
}

export function CardWidget({ config, rows, columns, measures, canEdit, onChange, onRemove }: Props) {
  const filteredRows = config.filter
    ? rows.filter((r) => String(r[config.filter!.column] ?? "") === config.filter!.value)
    : rows;

  const value =
    config.value.kind === "column"
      ? aggregateColumn(filteredRows, config.value.column, config.value.agg)
      : (() => {
          const m = measures.find((mm) => mm.id === (config.value as { measureId: string }).measureId);
          return m ? aggregateColumn(filteredRows, m.column, m.agg, m.conditionColumn, m.conditionValue) : 0;
        })();

  return (
    <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-4 flex flex-col justify-between h-full">
      <div className="flex items-start justify-between gap-2 mb-2">
        {canEdit ? (
          <input
            value={config.title}
            onChange={(e) => onChange({ ...config, title: e.target.value })}
            className="bg-transparent text-sm font-medium text-[var(--text-h)] outline-none flex-1"
          />
        ) : (
          <h3 className="text-sm">{config.title}</h3>
        )}
        {canEdit && (
          <button onClick={onRemove} title="Remove" className="p-1.5 rounded-md text-[var(--text-dim)] hover:bg-[var(--panel-raised)] hover:text-[var(--bad)]">
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {canEdit && (
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
          className="mb-3 bg-[var(--panel-raised)] border border-[var(--border)] rounded-md px-2 py-1 text-xs text-[var(--text)]"
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
      )}

      {canEdit && (
        <div className="flex flex-wrap items-center gap-1.5 mb-2 text-xs">
          <select
            value={config.numberFormat ?? "auto"}
            onChange={(e) => onChange({ ...config, numberFormat: e.target.value as "auto" | "full" })}
            className="bg-[var(--panel-raised)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]"
          >
            <option value="auto">Auto (1.2K / 3.4M)</option>
            <option value="full">Full number</option>
          </select>
          <select
            value={config.filter?.column ?? ""}
            onChange={(e) => {
              const col = e.target.value;
              if (!col) onChange({ ...config, filter: undefined });
              else {
                const firstVal = String(rows.find((r) => r[col] !== undefined)?.[col] ?? "");
                onChange({ ...config, filter: { column: col, value: firstVal } });
              }
            }}
            className="bg-[var(--panel-raised)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]"
          >
            <option value="">No widget filter</option>
            {columns.map((c) => <option key={c} value={c}>filter: {c}</option>)}
          </select>
          {config.filter && (
            <>
              <select
                value={config.filter.value}
                onChange={(e) => onChange({ ...config, filter: { column: config.filter!.column, value: e.target.value } })}
                className="bg-[var(--panel-raised)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]"
              >
                {Array.from(new Set(rows.map((r) => String(r[config.filter!.column] ?? "")))).sort().map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
              <button onClick={() => onChange({ ...config, filter: undefined })} className="text-[var(--text-dim)] hover:text-[var(--bad)]"><X size={13} /></button>
            </>
          )}
        </div>
      )}

      <div className="flex-1 flex items-center justify-center py-4">
        <span className="num text-4xl font-semibold text-[var(--text-h)]">
          {formatNumber(value, config.numberFormat)}
        </span>
      </div>
    </div>
  );
}
