import { Trash2 } from "lucide-react";
import type { CardConfig, DataRow, Measure } from "../types";
import { aggregateColumn } from "../lib/aggregate";

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
  const value =
    config.value.kind === "column"
      ? aggregateColumn(rows, config.value.column, config.value.agg)
      : (() => {
          const m = measures.find((mm) => mm.id === (config.value as { measureId: string }).measureId);
          return m ? aggregateColumn(rows, m.column, m.agg, m.conditionColumn, m.conditionValue) : 0;
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
              onChange({ ...config, value: { kind: "column", column: col, agg: agg as "sum" | "avg" | "count" | "max" | "min" } });
            }
          }}
          className="mb-3 bg-[var(--panel-raised)] border border-[var(--border)] rounded-md px-2 py-1 text-xs text-[var(--text)]"
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
              {measures.map((m) => <option key={m.id} value={`measure:${m.id}`}>★ {m.name}</option>)}
            </optgroup>
          )}
        </select>
      )}

      <div className="flex-1 flex items-center justify-center py-4">
        <span className="num text-4xl font-semibold text-[var(--text-h)]">
          {value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );
}
