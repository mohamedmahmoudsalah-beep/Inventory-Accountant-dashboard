import { Plus, X, CalendarRange } from "lucide-react";
import type { DataRow, FilterConfig } from "../types";

interface Props {
  columns: string[];
  rows: DataRow[];
  filters: FilterConfig[];
  onChange: (filters: FilterConfig[]) => void;
  readOnly?: boolean;
}

export function FilterBar({ columns, rows, filters, onChange, readOnly = false }: Props) {
  function addFilter() {
    const unused = columns.find((c) => !filters.some((f) => f.column === c));
    if (!unused) return;
    onChange([...filters, { column: unused, mode: "equals", value: "All" }]);
  }

  function addDateRangeFilter() {
    const unused = columns.find((c) => !filters.some((f) => f.column === c)) ?? columns[0];
    onChange([...filters, { column: unused, mode: "range", value: "All", from: "", to: "" }]);
  }

  function updateFilter(index: number, patch: Partial<FilterConfig>) {
    const next = filters.map((f, i) => (i === index ? { ...f, ...patch } : f));
    onChange(next);
  }

  function removeFilter(index: number) {
    onChange(filters.filter((_, i) => i !== index));
  }

  function optionsFor(column: string) {
    const set = new Set<string>();
    rows.forEach((r) => set.add(String(r[column])));
    return Array.from(set).sort();
  }

  if (readOnly && filters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-b border-[var(--border)]">
      {filters.map((f, i) => (
        <div
          key={`${f.column}-${i}`}
          className="flex items-center gap-1 bg-[var(--panel-raised)] border border-[var(--border)] rounded-lg pl-2 pr-1 py-1"
        >
          <select
            value={f.column}
            disabled={readOnly}
            onChange={(e) => updateFilter(i, { column: e.target.value, value: "All" })}
            className="bg-transparent text-xs text-[var(--text-dim)] outline-none disabled:opacity-70"
          >
            {columns.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {f.mode === "range" ? (
            <>
              <CalendarRange size={12} color="var(--text-dim)" />
              <input
                type="date"
                disabled={readOnly}
                value={f.from ?? ""}
                onChange={(e) => updateFilter(i, { from: e.target.value })}
                className="bg-transparent text-xs text-[var(--text-h)] outline-none w-[110px] disabled:opacity-70"
              />
              <span className="text-[var(--text-dim)] text-xs">→</span>
              <input
                type="date"
                disabled={readOnly}
                value={f.to ?? ""}
                onChange={(e) => updateFilter(i, { to: e.target.value })}
                className="bg-transparent text-xs text-[var(--text-h)] outline-none w-[110px] disabled:opacity-70"
              />
            </>
          ) : (
            <select
              value={f.value}
              disabled={readOnly}
              onChange={(e) => updateFilter(i, { value: e.target.value })}
              className="bg-transparent text-xs text-[var(--text-h)] outline-none disabled:opacity-70"
            >
              <option value="All">All</option>
              {optionsFor(f.column).map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          )}

          {!readOnly && (
            <button onClick={() => removeFilter(i)} className="text-[var(--text-dim)] hover:text-[var(--bad)] ml-1">
              <X size={13} />
            </button>
          )}
        </div>
      ))}

      {!readOnly && filters.length < columns.length && (
        <button
          onClick={addFilter}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-dashed border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent-border)] hover:text-[var(--text)]"
        >
          <Plus size={13} /> Add filter
        </button>
      )}
      {!readOnly && (
        <button
          onClick={addDateRangeFilter}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-dashed border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent-border)] hover:text-[var(--text)]"
        >
          <CalendarRange size={13} /> Add date range
        </button>
      )}
    </div>
  );
}
