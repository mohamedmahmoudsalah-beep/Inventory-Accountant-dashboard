import type { ParsedFile, JoinAgg } from "../lib/importFiles";
import { guessAggForColumn } from "../lib/importFiles";

const AGG_LABELS: Record<JoinAgg, string> = {
  sum: "Sum",
  avg: "Average",
  count: "Count",
  max: "Max",
  min: "Min",
  distinct: "Distinct count",
  first: "First value",
};

interface Props {
  table: ParsedFile;
  keyColumns: string[];
  picks: Record<string, JoinAgg>;
  onChange: (picks: Record<string, JoinAgg>) => void;
}

/** Picks exactly which of a sheet's other columns make it into the merged
 *  result, and how each one combines when its key repeats. Unchecked
 *  columns are dropped entirely, not just left un-aggregated — the point
 *  is to end up with a small, exact result instead of dragging in every
 *  column a raw export happens to have (which is also where noisy, mostly
 *  -empty columns like Odoo's "Stock move/…" fields come from). */
export function ColumnPicksEditor({ table, keyColumns, picks, onChange }: Props) {
  const otherColumns = table.columns.filter((c) => !keyColumns.includes(c));

  function toggle(col: string, checked: boolean) {
    const next = { ...picks };
    if (checked) next[col] = guessAggForColumn(table, col);
    else delete next[col];
    onChange(next);
  }

  return (
    <div>
      <p className="text-[10px] text-[var(--text-dim)] mb-1">Columns to bring in from "{table.fileName}"</p>
      <div className="space-y-1 max-h-40 overflow-y-auto border border-[var(--border)] rounded-lg p-2">
        {otherColumns.map((c) => (
          <div key={c} className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={c in picks} onChange={(e) => toggle(c, e.target.checked)} className="shrink-0" />
            <span className="flex-1 truncate text-[var(--text)]">{c}</span>
            {c in picks && (
              <select
                value={picks[c]}
                onChange={(e) => onChange({ ...picks, [c]: e.target.value as JoinAgg })}
                className="bg-[var(--panel-raised)] border border-[var(--border)] rounded px-1.5 py-0.5 text-[11px] text-[var(--text)] shrink-0"
              >
                {(Object.keys(AGG_LABELS) as JoinAgg[]).map((a) => <option key={a} value={a}>{AGG_LABELS[a]}</option>)}
              </select>
            )}
          </div>
        ))}
        {otherColumns.length === 0 && <p className="text-[11px] text-[var(--text-dim)] italic">No other columns in this sheet.</p>}
      </div>
    </div>
  );
}
