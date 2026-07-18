import { Download, Trash2 } from "lucide-react";
import type { DataRow, Measure, MatrixConfig } from "../types";
import { exportRowsToExcel } from "../lib/exportExcel";
import { aggregateColumn } from "../lib/aggregate";

interface Props {
  config: MatrixConfig;
  rows: DataRow[];
  columns: string[];
  measures: Measure[];
  canEdit: boolean;
  canExport?: boolean;
  onChange: (config: MatrixConfig) => void;
  onRemove: () => void;
}

function cellValue(rows: DataRow[], config: MatrixConfig, measures: Measure[]): number {
  const source = config.value;
  if (source.kind === "column") {
    return aggregateColumn(rows, source.column, source.agg);
  }
  const measure = measures.find((m) => m.id === source.measureId);
  if (!measure) return 0;
  return aggregateColumn(rows, measure.column, measure.agg, measure.conditionColumn, measure.conditionValue);
}

export function MatrixCard({ config, rows, columns, measures, canEdit, canExport = true, onChange, onRemove }: Props) {
  const rowKeys = Array.from(new Set(rows.map((r) => String(r[config.rowCol] ?? "")))).sort();
  const colKeys = Array.from(new Set(rows.map((r) => String(r[config.colCol] ?? "")))).sort();

  const grid = rowKeys.map((rk) =>
    colKeys.map((ck) => {
      const cellRows = rows.filter((r) => String(r[config.rowCol] ?? "") === rk && String(r[config.colCol] ?? "") === ck);
      return cellValue(cellRows, config, measures);
    })
  );

  const exportRows: DataRow[] = rowKeys.map((rk, i) => {
    const row: DataRow = { [config.rowCol]: rk };
    colKeys.forEach((ck, j) => (row[ck] = grid[i][j]));
    return row;
  });

  const valueLabel =
    config.value.kind === "column"
      ? `${config.value.agg} ${config.value.column}`
      : measures.find((m) => m.id === (config.value as { measureId: string }).measureId)?.name ?? "value";

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
            <button onClick={() => exportRowsToExcel(exportRows, config.title.replace(/\s+/g, "_"))} title="Export to Excel"
              className="p-1.5 rounded-md text-[var(--text-dim)] hover:bg-[var(--panel-raised)] hover:text-[var(--text-h)]">
              <Download size={14} />
            </button>
          )}
          {canEdit && (
            <button onClick={onRemove} title="Remove"
              className="p-1.5 rounded-md text-[var(--text-dim)] hover:bg-[var(--panel-raised)] hover:text-[var(--bad)]">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {canEdit && (
        <div className="flex flex-wrap gap-2 mb-3 text-xs">
          <select value={config.rowCol} onChange={(e) => onChange({ ...config, rowCol: e.target.value })}
            className="bg-[var(--panel-raised)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]">
            {columns.map((c) => <option key={c} value={c}>rows: {c}</option>)}
          </select>
          <select value={config.colCol} onChange={(e) => onChange({ ...config, colCol: e.target.value })}
            className="bg-[var(--panel-raised)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]">
            {columns.map((c) => <option key={c} value={c}>cols: {c}</option>)}
          </select>
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
            className="bg-[var(--panel-raised)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]"
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
        </div>
      )}

      <div className="overflow-auto max-h-80">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left px-2 py-1.5 text-xs uppercase tracking-wide text-[var(--text-dim)] sticky left-0 bg-[var(--panel)]">
                {config.rowCol} \ {config.colCol}
              </th>
              {colKeys.map((ck) => (
                <th key={ck} className="text-right px-2 py-1.5 text-xs uppercase tracking-wide text-[var(--text-dim)] whitespace-nowrap">{ck}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowKeys.map((rk, i) => (
              <tr key={rk} className="border-b border-[var(--border)]/50 hover:bg-[var(--panel-raised)]">
                <td className="px-2 py-1.5 text-[var(--text)] sticky left-0 bg-[var(--panel)] font-medium">{rk}</td>
                {grid[i].map((v, j) => (
                  <td key={j} className="px-2 py-1.5 text-right num text-[var(--text)]">
                    {v.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-[var(--text-dim)] mt-2">Values: {valueLabel}</p>
    </div>
  );
}
