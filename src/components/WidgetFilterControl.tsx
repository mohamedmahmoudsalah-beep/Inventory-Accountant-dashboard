import { X } from "lucide-react";
import type { DataRow, WidgetFilter } from "../types";
import { detectColumnType } from "../lib/columnTypes";
import { GroupedColumnSelect } from "./GroupedColumnSelect";

interface Props {
  columns: string[];
  rows: DataRow[];
  filter: WidgetFilter | undefined;
  onChange: (filter: WidgetFilter | undefined) => void;
  /** Tailwind classes for each select/input, so callers can match their own sizing. */
  className?: string;
  columnGroups?: Record<string, string>;
}

/** "Filter this widget" control shared by Pivot/Matrix/Card. Text columns
 *  get a plain "equals one of these values" dropdown (like before). Number
 *  columns get real comparison operators — greater than, less than, or
 *  between two values — since an exact-match dropdown on a number column
 *  (e.g. every distinct price) is rarely what anyone actually wants. */
export function WidgetFilterControl({ columns, rows, filter, onChange, className, columnGroups }: Props) {
  const cls = className ?? "bg-[var(--panel-raised)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]";
  const isNumberColumn = filter ? detectColumnType(rows, filter.column) === "number" : false;

  function pickColumn(col: string) {
    if (!col) {
      onChange(undefined);
      return;
    }
    const numeric = detectColumnType(rows, col) === "number";
    if (numeric) {
      onChange({ column: col, mode: "gt", value: "0" });
    } else {
      const firstVal = String(rows.find((r) => r[col] !== undefined)?.[col] ?? "");
      onChange({ column: col, mode: "equals", value: firstVal });
    }
  }

  return (
    <>
      <GroupedColumnSelect
        columns={columns}
        value={filter?.column ?? ""}
        onChange={pickColumn}
        noneOption={{ value: "", label: "No widget filter" }}
        groups={columnGroups}
        className={cls}
      />

      {filter && isNumberColumn && (
        <>
          <select
            value={filter.mode ?? "gt"}
            onChange={(e) => onChange({ ...filter, mode: e.target.value as WidgetFilter["mode"] })}
            className={cls}
          >
            <option value="gt">greater than</option>
            <option value="lt">less than</option>
            <option value="between">between</option>
          </select>
          <input
            type="number"
            value={filter.value}
            onChange={(e) => onChange({ ...filter, value: e.target.value })}
            className={`w-20 ${cls}`}
          />
          {filter.mode === "between" && (
            <>
              <span className="text-[var(--text-dim)]">and</span>
              <input
                type="number"
                value={filter.value2 ?? ""}
                onChange={(e) => onChange({ ...filter, value2: e.target.value })}
                className={`w-20 ${cls}`}
              />
            </>
          )}
        </>
      )}

      {filter && !isNumberColumn && (
        <select
          value={filter.value}
          onChange={(e) => onChange({ ...filter, mode: "equals", value: e.target.value })}
          className={cls}
        >
          {Array.from(new Set(rows.map((r) => String(r[filter.column] ?? "")))).sort().map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      )}

      {filter && (
        <button onClick={() => onChange(undefined)} className="text-[var(--text-dim)] hover:text-[var(--bad)]">
          <X size={13} />
        </button>
      )}
    </>
  );
}
