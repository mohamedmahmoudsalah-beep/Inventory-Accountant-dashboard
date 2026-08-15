import { useState } from "react";
import { X } from "lucide-react";
import type { ParsedFile, LookupJoin } from "../lib/importFiles";
import { appendTables, mergeManyTables } from "../lib/importFiles";
import type { DataRow } from "../types";

interface Props {
  tables: ParsedFile[]; // already fetched — tables[0] is treated as the main sheet if "link" is chosen
  onApply: (rows: DataRow[], columns: string[]) => void;
  onClose: () => void;
}

type Choice = "stack" | "link";

interface Link {
  baseKey: string;
  otherKey: string;
}

/** The simple "how should these sheets go together?" step shown right
 *  after picking 2+ sheets from Drive in "Combine online sheets" — this is
 *  where people actually look for a multi-sheet feature, so the choice
 *  lives here rather than buried in a separate Import panel. Defaults to
 *  "stack" (today's plain behavior) so clicking straight through works
 *  exactly like before; "link" is one click away for anyone who wants
 *  relationships between the sheets instead. */
export function CombineSheetsModal({ tables, onApply, onClose }: Props) {
  const [choice, setChoice] = useState<Choice>("stack");
  const [links, setLinks] = useState<Link[]>(tables.slice(1).map(() => ({ baseKey: "", otherKey: "" })));

  const base = tables[0];
  const canApply = choice === "stack" || links.every((l) => l.baseKey && l.otherKey);

  function updateLink(i: number, patch: Partial<Link>) {
    setLinks((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function apply() {
    if (choice === "stack") {
      const { rows, columns } = appendTables(tables);
      onApply(rows, columns);
    } else {
      const joins: LookupJoin[] = tables.slice(1).map((table, i) => ({ table, baseKey: links[i].baseKey, otherKey: links[i].otherKey }));
      const { rows, columns } = mergeManyTables(base, joins);
      onApply(rows, columns);
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-5 w-full max-w-md">
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
            <p className="text-xs mt-0.5">Pick a matching column between "{base.fileName}" and each other sheet — like a VLOOKUP.</p>
          </button>
        </div>

        {choice === "link" && (
          <div className="space-y-3 mb-4">
            {tables.slice(1).map((t, i) => (
              <div key={i} className="border border-[var(--border)] rounded-lg p-3">
                <p className="text-xs text-[var(--text-dim)] mb-2">{t.fileName}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] text-[var(--text-dim)] mb-1">Column in "{base.fileName}"</p>
                    <select
                      value={links[i].baseKey}
                      onChange={(e) => updateLink(i, { baseKey: e.target.value })}
                      className="w-full bg-[var(--panel-raised)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-sm"
                    >
                      <option value="" disabled>Pick column...</option>
                      {base.columns.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <p className="text-[10px] text-[var(--text-dim)] mb-1">Matching column in "{t.fileName}"</p>
                    <select
                      value={links[i].otherKey}
                      onChange={(e) => updateLink(i, { otherKey: e.target.value })}
                      className="w-full bg-[var(--panel-raised)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-sm"
                    >
                      <option value="" disabled>Pick column...</option>
                      {t.columns.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
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
