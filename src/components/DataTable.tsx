import { useMemo, useState } from "react";
import { Download, Search, ArrowUpDown, Hash, Calendar, Type } from "lucide-react";
import type { DataRow } from "../types";
import { exportRowsToExcel } from "../lib/exportExcel";
import { detectColumnType } from "../lib/columnTypes";
import { ROW_ID_KEY } from "../lib/rowIds";

interface Props {
  rows: DataRow[];
  columns: string[];
  editableColumns?: string[]; // columns the user is allowed to edit in place (raw, non-calculated)
  canExport?: boolean;
  canEdit?: boolean;
  onEditCell?: (rid: string, column: string, value: string) => void;
}

const TYPE_ICON = { number: Hash, date: Calendar, text: Type };

export function DataTable({ rows, columns, editableColumns = [], canExport = true, canEdit = false, onEditCell }: Props) {
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [editingCell, setEditingCell] = useState<{ rid: string; column: string } | null>(null);
  const [editValue, setEditValue] = useState("");

  const columnTypes = useMemo(() => {
    const map: Record<string, "number" | "date" | "text"> = {};
    columns.forEach((c) => (map[c] = detectColumnType(rows, c)));
    return map;
  }, [rows, columns]);

  const filtered = useMemo(() => {
    let result = rows;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((r) =>
        columns.some((c) => String(r[c]).toLowerCase().includes(q))
      );
    }
    if (sortCol) {
      result = [...result].sort((a, b) => {
        const av = a[sortCol], bv = b[sortCol];
        if (typeof av === "number" && typeof bv === "number") return (av - bv) * sortDir;
        return String(av).localeCompare(String(bv)) * sortDir;
      });
    }
    return result;
  }, [rows, columns, search, sortCol, sortDir]);

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir((d) => (d === 1 ? -1 : 1));
    else { setSortCol(col); setSortDir(1); }
  }

  function startEdit(rid: string, column: string, currentValue: unknown) {
    if (!canEdit || !editableColumns.includes(column)) return;
    setEditingCell({ rid, column });
    setEditValue(String(currentValue ?? ""));
  }

  function commitEdit() {
    if (editingCell && onEditCell) onEditCell(editingCell.rid, editingCell.column, editValue);
    setEditingCell(null);
  }

  const DISPLAY_LIMIT = 100;
  const displayed = filtered.slice(0, DISPLAY_LIMIT);

  return (
    <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 bg-[var(--panel-raised)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 w-64">
          <Search size={13} color="var(--text-dim)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rows..."
            className="bg-transparent text-sm outline-none flex-1 text-[var(--text)]"
          />
        </div>
        {canExport && (
          <button
            onClick={() => exportRowsToExcel(filtered, "table_data")}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-dim)] hover:bg-[var(--panel-raised)] hover:text-[var(--text-h)]"
          >
            <Download size={13} /> Export to Excel {filtered.length > DISPLAY_LIMIT ? `(all ${filtered.length} rows)` : ""}
          </button>
        )}
      </div>

      {filtered.length > DISPLAY_LIMIT && (
        <p className="text-xs text-[var(--text-dim)] mb-2">
          Showing the first {DISPLAY_LIMIT} of {filtered.length} rows for speed — use Export to get all of them.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              {columns.map((c) => {
                const Icon = TYPE_ICON[columnTypes[c]];
                const isCalc = !editableColumns.includes(c);
                return (
                  <th
                    key={c}
                    onClick={() => toggleSort(c)}
                    className="text-left px-3 py-2 text-xs uppercase tracking-wide text-[var(--text-dim)] cursor-pointer select-none whitespace-nowrap"
                  >
                    <span className="inline-flex items-center gap-1">
                      <Icon size={10} /> {c} {isCalc && <span className="text-[var(--accent)]" title="Calculated column">ƒ</span>} <ArrowUpDown size={11} />
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {displayed.map((row) => {
              const rid = String(row[ROW_ID_KEY] ?? "");
              return (
                <tr key={rid || JSON.stringify(row)} className="border-b border-[var(--border)]/50 hover:bg-[var(--panel-raised)]">
                  {columns.map((c) => {
                    const editable = canEdit && editableColumns.includes(c);
                    const isEditingThis = editingCell?.rid === rid && editingCell?.column === c;
                    return (
                      <td
                        key={c}
                        onClick={() => startEdit(rid, c, row[c])}
                        className={`px-3 py-2 num text-[var(--text)] whitespace-nowrap ${editable ? "cursor-text hover:bg-[var(--accent-dim)]" : ""}`}
                      >
                        {isEditingThis ? (
                          <input
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitEdit();
                              if (e.key === "Escape") setEditingCell(null);
                            }}
                            className="bg-[var(--panel)] border border-[var(--accent-border)] rounded px-1 py-0.5 w-full outline-none"
                          />
                        ) : (
                          String(row[c] ?? "")
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="text-center py-6 text-[var(--text-dim)] text-sm">
                  No rows match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
