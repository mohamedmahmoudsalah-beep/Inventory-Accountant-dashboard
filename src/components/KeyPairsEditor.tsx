import { Plus, Trash2 } from "lucide-react";

export interface KeyPair {
  baseKey: string;
  otherKey: string;
}

interface Props {
  baseColumns: string[];
  otherColumns: string[];
  baseLabel: string;
  otherLabel: string;
  pairs: KeyPair[];
  onChange: (pairs: KeyPair[]) => void;
}

/** Lets someone pick one or more column pairs to match a lookup sheet
 *  against the base sheet. A single pair is a plain match (e.g. Product ID
 *  ↔ Product ID). Adding a second pair makes it a composite match — both
 *  have to agree for a row to be considered the same (e.g. Product AND
 *  Month together) — needed whenever a single column repeats across
 *  multiple real-world rows on the lookup side (matching on too few
 *  columns is the most common reason a merge quietly multiplies totals:
 *  see mergeTables' doc comment in importFiles.ts). */
export function KeyPairsEditor({ baseColumns, otherColumns, baseLabel, otherLabel, pairs, onChange }: Props) {
  function updatePair(i: number, patch: Partial<KeyPair>) {
    onChange(pairs.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  return (
    <div className="space-y-2">
      {pairs.map((pair, i) => (
        <div key={i} className="flex items-end gap-2">
          <div className="flex-1">
            <p className="text-[10px] text-[var(--text-dim)] mb-1">{i === 0 ? baseLabel : ""}</p>
            <select
              value={pair.baseKey}
              onChange={(e) => updatePair(i, { baseKey: e.target.value })}
              className="w-full bg-[var(--panel-raised)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-sm"
            >
              <option value="" disabled>Pick column...</option>
              {baseColumns.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <p className="text-[10px] text-[var(--text-dim)] mb-1">{i === 0 ? otherLabel : ""}</p>
            <select
              value={pair.otherKey}
              onChange={(e) => updatePair(i, { otherKey: e.target.value })}
              className="w-full bg-[var(--panel-raised)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-sm"
            >
              <option value="" disabled>Pick column...</option>
              {otherColumns.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {pairs.length > 1 && (
            <button onClick={() => onChange(pairs.filter((_, idx) => idx !== i))} className="text-[var(--text-dim)] hover:text-[var(--bad)] mb-1.5 shrink-0">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      ))}
      <button
        onClick={() => onChange([...pairs, { baseKey: "", otherKey: "" }])}
        className="flex items-center gap-1 text-[11px] text-[var(--text-dim)] hover:text-[var(--text-h)]"
      >
        <Plus size={11} /> Also match by another column (needed if one column repeats — e.g. match Product AND Month together)
      </button>
    </div>
  );
}
