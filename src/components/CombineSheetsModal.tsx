import { useState } from "react";
import { X } from "lucide-react";
import type { ParsedFile, LookupJoin } from "../lib/importFiles";
import { appendTables, mergeManyTables, aggregateForJoin } from "../lib/importFiles";
import type { DataRow } from "../types";
import { KeyPairsEditor, type KeyPair } from "./KeyPairsEditor";

interface Props {
  tables: ParsedFile[]; // already fetched — tables[0] is treated as the main sheet if "link" is chosen
  onApply: (rows: DataRow[], columns: string[], columnGroups?: Record<string, string>) => void;
  onClose: () => void;
}

type Choice = "stack" | "link";

/** The simple "how should these sheets go together?" step shown right
 *  after picking 2+ sheets from Drive in "Combine online sheets" — this is
 *  where people actually look for a multi-sheet feature, so the choice
 *  lives here rather than buried in a separate Import panel. Defaults to
 *  "stack" (today's plain behavior) so clicking straight through works
 *  exactly like before; "link" is one click away for anyone who wants
 *  relationships between the sheets instead. */
export function CombineSheetsModal({ tables, onApply, onClose }: Props) {
  const [choice, setChoice] = useState<Choice>("stack");
  const [links, setLinks] = useState<KeyPair[][]>(tables.slice(1).map(() => [{ baseKey: "", otherKey: "" }]));

  const base = tables[0];
  const canApply = choice === "stack" || links.every((pairs) => pairs.every((p) => p.baseKey && p.otherKey));

  function apply() {
    if (choice === "stack") {
      const { rows, columns } = appendTables(tables);
      onApply(rows, columns);
    } else {
      // Every side gets collapsed to one row per its own matching key(s)
      // first — a no-op when a side already has unique keys, and exactly
      // what prevents a value from getting copied onto more rows than it
      // should (and any SUM over it coming out inflated) when a side
      // naturally has several rows per key, e.g. several transactions on
      // the same day for the same item. Always on — there's no case where
      // linking un-aggregated data directly is the right call.
      const baseKeyColumns = [...new Set(links.flatMap((pairs) => pairs.map((p) => p.baseKey)))];
      const aggregatedBase = aggregateForJoin(base, baseKeyColumns);
      const joins: LookupJoin[] = tables.slice(1).map((table, i) => ({
        table: aggregateForJoin(table, links[i].map((p) => p.otherKey)),
        baseKeys: links[i].map((p) => p.baseKey),
        otherKeys: links[i].map((p) => p.otherKey),
      }));
      const { rows, columns, columnGroups } = mergeManyTables(aggregatedBase, joins);
      onApply(rows, columns, columnGroups);
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-5 w-full max-w-md max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm">{tables.length} sheets picked — how should they go together?</h3>
          <button onClick={onClose} className="text-[var(--text-dim)] hover:text-[var(--text-h)]">
            <X size={16} />
          </button>
        </div>
        <div className="text-xs text-[var(--text-dim)] mb-4 space-y-0.5">
          {tables.map((t, i) => <p key={i}>{i === 0 && choice === "link" ? "★ " : "• "}{t.fileName} — {t.rows.length} rows</p>)}
        </div>

        <div className="space-y-2 mb-4">
          <button
            onClick={() => setChoice("stack")}
            className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm ${
              choice === "stack" ? "bg-[var(--accent-dim)] border-[var(--accent-border)] text-[var(--text-h)]" : "border-[var(--border)] text-[var(--text-dim)]"
            }`}
          >
            <span className="font-medium text-[var(--text-h)]">Put them together normally</span>
            <p className="text-xs mt-0.5">Stack every sheet's rows into one table — the usual, simplest option.</p>
          </button>
          <button
            onClick={() => setChoice("link")}
            className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm ${
              choice === "link" ? "bg-[var(--accent-dim)] border-[var(--accent-border)] text-[var(--text-h)]" : "border-[var(--border)] text-[var(--text-dim)]"
            }`}
          >
            <span className="font-medium text-[var(--text-h)]">Link them by a relationship (optional)</span>
            <p className="text-xs mt-0.5">Pick matching column(s) between "{base.fileName}" and each other sheet — like a VLOOKUP.</p>
          </button>
        </div>

        {choice === "link" && (
          <div className="space-y-3 mb-4">
            <p className="text-[11px] text-[var(--text-dim)] -mt-2">
              Rows sharing the same matching value(s) get totaled together automatically before linking (e.g. several transactions on the
              same day for the same item become one summed row) — so matching by more than one column together (e.g. Product AND Day) still
              gives you correct totals even when either sheet has several rows per key.
            </p>
            {tables.slice(1).map((t, i) => (
              <div key={i} className="border border-[var(--border)] rounded-lg p-3">
                <p className="text-xs text-[var(--text-dim)] mb-2">{t.fileName}</p>
                <KeyPairsEditor
                  baseColumns={base.columns}
                  otherColumns={t.columns}
                  baseLabel={`Column in "${base.fileName}"`}
                  otherLabel={`Matching column in "${t.fileName}"`}
                  pairs={links[i]}
                  onChange={(pairs) => setLinks((prev) => prev.map((l, idx) => (idx === i ? pairs : l)))}
                />
              </div>
            ))}
          </div>
        )}

        <button
          onClick={apply}
          disabled={!canApply}
          className="w-full bg-[var(--accent)] text-white font-medium rounded-lg py-2 text-sm hover:opacity-90 disabled:opacity-40"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
