import { useState } from "react";
import { X, Plus, Trash2, Sparkles } from "lucide-react";
import type { CalculatedColumn, Measure, PivotAgg } from "../types";

interface Props {
  columns: string[];
  measures: Measure[];
  calculatedColumns: CalculatedColumn[];
  onChangeMeasures: (measures: Measure[]) => void;
  onChangeCalculatedColumns: (cols: CalculatedColumn[]) => void;
  onClose: () => void;
}

const AGGS: PivotAgg[] = ["sum", "avg", "count", "distinct", "max", "min"];

interface Recipe {
  title: string;
  problem: string; // plain-language: "when you'd reach for this"
  howItWorks: string; // plain-language: what it actually does
  kind: "measure" | "column";
  create: (columns: string[]) => Measure | CalculatedColumn;
}

const RECIPES: Recipe[] = [
  {
    title: "Count how many separate times something happened",
    problem:
      'Example: a person visited a branch 3 times this month, and each visit has several product rows — a Pivot naturally shows all 160 products they touched, but "count" on those rows gives you 160, not 3, because every product is its own row. You want the number of separate visits, not the number of rows.',
    howItWorks:
      'Use "distinct" instead of "count" on whichever column uniquely identifies one visit (a visit ID, or a date/time column if each visit has its own timestamp). "distinct" counts how many different values that column has — repeats collapse into one, so 160 product rows from 3 visits correctly comes out as 3.',
    kind: "measure",
    create: (columns) => ({
      id: crypto.randomUUID(),
      name: "Visit count",
      column: columns[0],
      agg: "distinct",
    }),
  },
  {
    title: "Total only where a condition is true (like Excel's SUMIF)",
    problem: 'Example: total revenue, but only for orders from Cairo — not every order in the sheet.',
    howItWorks:
      'A Measure with "where" set: pick sum on the revenue column, then set "where region = Cairo". Every other row is ignored for this one number.',
    kind: "measure",
    create: (columns) => ({
      id: crypto.randomUUID(),
      name: "Filtered total",
      column: columns[0],
      agg: "sum",
      conditionColumn: columns[1] ?? columns[0],
      conditionValue: "",
    }),
  },
  {
    title: "How many different categories appear (not how many rows)",
    problem: "Example: how many different branches show up in this data at all — not how many rows/orders there are.",
    howItWorks: '"distinct" on the branch/category column itself — same idea as the visit-count recipe above, just applied to a category instead of a visit ID.',
    kind: "measure",
    create: (columns) => ({
      id: crypto.randomUUID(),
      name: "Distinct count",
      column: columns[0],
      agg: "distinct",
    }),
  },
  {
    title: "Difference between two columns",
    problem: "Example: cost minus revenue, as its own column you can chart or filter on.",
    howItWorks: "A Calculated column with a simple subtraction formula, referencing both column names.",
    kind: "column",
    create: (columns) => ({
      id: crypto.randomUUID(),
      name: "Difference",
      formula: columns.length > 1 ? `[${columns[0]}] - [${columns[1]}]` : `[${columns[0]}]`,
    }),
  },
  {
    title: "A value that depends on a condition (like Excel's IF)",
    problem: 'Example: add 10% to revenue, but only for Cairo orders — everything else stays as-is.',
    howItWorks: 'A Calculated column using IF(condition, valueIfTrue, valueIfFalse) — condition can use ==, >, < against a column.',
    kind: "column",
    create: (columns) => ({
      id: crypto.randomUUID(),
      name: "Adjusted value",
      formula: `IF(${columns[1] ?? columns[0]} == "value", ${columns[0]} * 1.1, ${columns[0]})`,
    }),
  },
  {
    title: "Percentage of a total",
    problem: "Example: what % of total cost does this row's cost represent.",
    howItWorks: "A Calculated column dividing the row's value by a fixed total, times 100. (For a % of a filtered/grouped total instead, that needs a Measure as the denominator — ask the AI assistant for the exact formula for your specific case.)",
    kind: "column",
    create: (columns) => ({
      id: crypto.randomUUID(),
      name: "% of total",
      formula: `${columns[0]} / 1000 * 100`,
    }),
  },
];

export function DataModelPanel({
  columns, measures, calculatedColumns, onChangeMeasures, onChangeCalculatedColumns, onClose,
}: Props) {
  const [tab, setTab] = useState<"recipes" | "measures" | "columns">("recipes");

  function applyRecipe(recipe: Recipe) {
    if (recipe.kind === "measure") {
      onChangeMeasures([...measures, recipe.create(columns) as Measure]);
      setTab("measures");
    } else {
      onChangeCalculatedColumns([...calculatedColumns, recipe.create(columns) as CalculatedColumn]);
      setTab("columns");
    }
  }

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
          <button onClick={() => setTab("recipes")} className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1 ${tab === "recipes" ? "bg-[var(--accent-dim)] border border-[var(--accent-border)] text-[var(--text-h)]" : "text-[var(--text-dim)]"}`}>
            <Sparkles size={12} /> Recipes
          </button>
          <button onClick={() => setTab("measures")} className={`flex-1 py-1.5 rounded-md ${tab === "measures" ? "bg-[var(--accent-dim)] border border-[var(--accent-border)] text-[var(--text-h)]" : "text-[var(--text-dim)]"}`}>Measures</button>
          <button onClick={() => setTab("columns")} className={`flex-1 py-1.5 rounded-md ${tab === "columns" ? "bg-[var(--accent-dim)] border border-[var(--accent-border)] text-[var(--text-h)]" : "text-[var(--text-dim)]"}`}>Calculated columns</button>
        </div>

        {tab === "recipes" ? (
          <div>
            <p className="text-xs text-[var(--text-dim)] mb-3">
              Not sure which tool to reach for? Find the situation closest to what you're trying to do below — each one explains it in plain language and can set up a starting point for you to adjust.
            </p>
            <div className="space-y-2">
              {RECIPES.map((r) => (
                <div key={r.title} className="p-3 rounded-lg bg-[var(--panel-raised)] border border-[var(--border)]">
                  <p className="text-sm text-[var(--text-h)] mb-1">{r.title}</p>
                  <p className="text-xs text-[var(--text-dim)] mb-1.5">{r.problem}</p>
                  <p className="text-xs text-[var(--text-dim)] mb-2"><span className="text-[var(--text)]">How it works:</span> {r.howItWorks}</p>
                  <button
                    onClick={() => applyRecipe(r)}
                    className="flex items-center gap-1 text-xs text-[var(--accent)] hover:opacity-80"
                  >
                    <Plus size={13} /> Set this up (as a {r.kind === "measure" ? "measure" : "calculated column"} you can then adjust)
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs text-[var(--text-dim)] mt-3">
              Something more specific than these? Describe exactly what you want in plain language to the AI assistant (e.g. "count how many different months each branch had at least one order") and ask it which of Measures/Calculated columns to use and the exact settings.
            </p>
          </div>
        ) : tab === "measures" ? (
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
              Works like an Excel formula. Reference column names directly (wrap in [Brackets] if the name has spaces), and use +, -, *, /, ==, &gt;, &lt;, and IF(condition, ifTrue, ifFalse). A few examples:
            </p>
            <ul className="text-xs text-[var(--text-dim)] mb-3 space-y-1 list-disc list-inside">
              <li><code className="text-[var(--text)]">[Total Cost] - [Total Revenue]</code> — simple subtraction</li>
              <li><code className="text-[var(--text)]">price * qty</code> — simple multiplication</li>
              <li><code className="text-[var(--text)]">IF(region == "Cairo", revenue * 1.1, revenue)</code> — conditional, like Excel's IF()</li>
            </ul>
            <p className="text-xs text-[var(--text-dim)] mb-3">
              Not sure how to write one? Just describe what you want in plain language in your chat with Claude (e.g. "add 10% to revenue only for Cairo orders") and ask it to give you the exact formula to paste here.
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
