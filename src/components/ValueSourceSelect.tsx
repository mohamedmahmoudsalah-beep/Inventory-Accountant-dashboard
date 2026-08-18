import type { Measure, PivotAgg, ValueSource } from "../types";
import { GroupedColumnSelect } from "./GroupedColumnSelect";

const AGG_LABELS: Record<PivotAgg, string> = {
  sum: "Sum",
  avg: "Average",
  count: "Count",
  distinct: "Distinct count",
  max: "Max",
  min: "Min",
};

interface Props {
  columns: string[];
  measures: Measure[];
  value: ValueSource;
  onChange: (value: ValueSource) => void;
  className?: string;
}

/** Replaces the old single dropdown that combined every column with every
 *  aggregation ("sum X", "avg X", "count X", ... for every column — 6×N
 *  entries) with two separate, much shorter pickers: field first (grouped,
 *  see GroupedColumnSelect), then function — the same two-step flow as
 *  Excel/Power BI's field list, and every other Value picker in this app
 *  (PivotCard, MatrixCard, CardWidget) now shares this one component so
 *  they stay consistent. */
export function ValueSourceSelect({ columns, measures, value, onChange, className }: Props) {
  const isMeasure = value.kind === "measure";
  const selectedColumn = value.kind === "column" ? value.column : "";
  const selectedAgg: PivotAgg = value.kind === "column" ? value.agg : "sum";

  return (
    <div className={`flex items-center gap-1.5 ${className ?? ""}`}>
      <GroupedColumnSelect
        columns={columns}
        value={isMeasure ? `measure:${value.measureId}` : selectedColumn}
        onChange={(v) => {
          if (v.startsWith("measure:")) onChange({ kind: "measure", measureId: v.slice("measure:".length) });
          else onChange({ kind: "column", column: v, agg: selectedAgg });
        }}
        extraGroup={
          measures.length > 0
            ? { label: "Measures", options: measures.map((m) => ({ value: `measure:${m.id}`, label: `★ ${m.name}` })) }
            : undefined
        }
        className="flex-1 min-w-[140px] bg-[var(--panel)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]"
      />
      {!isMeasure && (
        <select
          value={selectedAgg}
          onChange={(e) => onChange({ kind: "column", column: selectedColumn, agg: e.target.value as PivotAgg })}
          className="bg-[var(--panel)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)] shrink-0"
        >
          {(Object.keys(AGG_LABELS) as PivotAgg[]).map((agg) => (
            <option key={agg} value={agg}>{AGG_LABELS[agg]}</option>
          ))}
        </select>
      )}
    </div>
  );
}
