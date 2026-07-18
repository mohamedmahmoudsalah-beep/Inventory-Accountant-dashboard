import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import type { CalculatedColumn, Measure, PivotAgg } from "../types";

interface Props {
  columns: string[];
  measures: Measure[];
  calculatedColumns: CalculatedColumn[];
  onChangeMeasures: (measures: Measure[]) => void;
  onChangeCalculatedColumns: (cols: CalculatedColumn[]) => void;
  onClose: () => void;
}

const AGGS: PivotAgg[] = ["sum", "avg", "count", "max", "min"];

export function DataModelPanel({
  columns, measures, calculatedColumns, onChangeMeasures, onChangeCalculatedColumns, onClose,
}: Props) {
  const [tab, setTab] = useState<"measures" | "columns">("measures");

  function addMeasure() {
    const m: Measure = { id: crypto.randomUUID(), name: "New measure", column: columns[0], agg: "sum" };
    onChangeMeasures([...measures, m]);
  }
  function updateMeasure(i: number, patch: Partial<Measure>) {
    onChangeMeasures(measures.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  }
  function removeMeasure(i: number) {
    onChangeMeasures(measures.filter((_, idx) => idx !== i));
  }

  function addCalcCol() {
    const c: CalculatedColumn = { id: crypto.randomUUID(), name: "New column", formula: columns[0] ?? "0" };
    onChangeCalculatedColumns([...calculatedColumns, c]);
  }
  function updateCalcCol(i: number, patch: Partial<CalculatedColumn>) {
    onChangeCalculatedColumns(calculatedColumns.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function removeCalcCol(i: number) {
    onChangeCalculatedColumns(calculatedColumns.filter((_, idx) => idx !== i));
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-5 w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm">Data model</h3>
          <button onClick={onClose} className="text-[var(--text-dim)] hover:text-[var(--text-h)]"><X size={16} /></button>
        </div>

        <div className="flex gap-1 mb-4 bg-[var(--panel-raised)] p-1 rounded-lg text-xs">
          <button onClick={() => setTab("measures")} className={`flex-1 py-1.5 rounded-md ${tab === "measures" ? "bg-[var(--accent-dim)] border border-[var(--accent-border)] text-[var(--text-h)]" : "text-[var(--text-dim)]"}`}>Measures</button>
          <button onClick={() => setTab("columns")} className={`flex-1 py-1.5 rounded-md ${tab === "columns" ? "bg-[var(--accent-dim)] border border-[var(--accent-border)] text-[var(--text-h)]" : "text-[var(--text-dim)]"}`}>Calculated columns</button>
        </div>

        {tab === "measures" ? (
          <div>
            <p className="text-xs text-[var(--text-dim)] mb-3">
              A measure is a saved aggregation you can reuse as a value in any Pivot, Matrix, or Card widget — e.g. "Cairo Revenue = sum(revenue) where region = Cairo".
            </p>
            <div className="space-y-2">
              {measures.map((m, i) => (
                <div key={m.id} className="p-3 rounded-lg bg-[var(--panel-raised)] border border-[var(--border)] flex flex-wrap items-center gap-2 text-xs">
                  <input value={m.name} onChange={(e) => updateMeasure(i, { name: e.target.value })}
                    className="flex-1 min-w-[120px] bg-[var(--panel)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]" placeholder="Measure name" />
                  <select value={m.agg} onChange={(e) => updateMeasure(i, { agg: e.target.value as PivotAgg })}
                    className="bg-[var(--panel)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]">
                    {AGGS.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <select value={m.column} onChange={(e) => updateMeasure(i, { column: e.target.value })}
                    className="bg-[var(--panel)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]">
                    {columns.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <span className="text-[var(--text-dim)]">where</span>
                  <select value={m.conditionColumn ?? ""} onChange={(e) => updateMeasure(i, { conditionColumn: e.target.value || undefined })}
                    className="bg-[var(--panel)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]">
                    <option value="">(none)</option>
                    {columns.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <span className="text-[var(--text-dim)]">=</span>
                  <input value={m.conditionValue ?? ""} onChange={(e) => updateMeasure(i, { conditionValue: e.target.value })}
                    placeholder="value" disabled={!m.conditionColumn}
                    className="w-24 bg-[var(--panel)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)] disabled:opacity-40" />
                  <button onClick={() => removeMeasure(i)} className="text-[var(--text-dim)] hover:text-[var(--bad)]"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            <button onClick={addMeasure} className="flex items-center gap-1 text-xs text-[var(--accent)] hover:opacity-80 mt-3">
              <Plus size={13} /> Add measure
            </button>
          </div>
        ) : (
          <div>
            <p className="text-xs text-[var(--text-dim)] mb-3">
              Add a new column computed from existing ones. Reference column names directly (use [Column Name] if it has spaces), with +, -, *, /, comparisons, and IF(condition, ifTrue, ifFalse). Example: <code className="text-[var(--text)]">IF(region == "Cairo", revenue * 1.1, revenue)</code>
            </p>
            <div className="space-y-2">
              {calculatedColumns.map((c, i) => (
                <div key={c.id} className="p-3 rounded-lg bg-[var(--panel-raised)] border border-[var(--border)] flex flex-wrap items-center gap-2 text-xs">
                  <input value={c.name} onChange={(e) => updateCalcCol(i, { name: e.target.value })}
                    className="w-36 bg-[var(--panel)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]" placeholder="Column name" />
                  <span className="text-[var(--text-dim)]">=</span>
                  <input value={c.formula} onChange={(e) => updateCalcCol(i, { formula: e.target.value })}
                    className="flex-1 min-w-[160px] bg-[var(--panel)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)] font-mono" placeholder="formula" />
                  <button onClick={() => removeCalcCol(i)} className="text-[var(--text-dim)] hover:text-[var(--bad)]"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            <button onClick={addCalcCol} className="flex items-center gap-1 text-xs text-[var(--accent)] hover:opacity-80 mt-3">
              <Plus size={13} /> Add calculated column
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
