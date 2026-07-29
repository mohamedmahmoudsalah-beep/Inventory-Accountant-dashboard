import { useMemo, useRef, useState } from "react";

interface Suggestion {
  name: string;
  kind: "measure" | "column";
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  suggestions: Suggestion[];
  placeholder?: string;
  className?: string;
}

/** A plain text input for writing formulas (measures/calculated columns)
 *  that shows a live, filterable dropdown of available measure/column
 *  names as you type — so you don't need to remember or type an exact name
 *  yourself. Type any letter and matching names show up; click one (or
 *  press Enter/Tab) to insert it wrapped in [Brackets] at the cursor. */
export function FormulaInput({ value, onChange, suggestions, placeholder, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [highlighted, setHighlighted] = useState(0);

  // The "current word" being typed: whatever's inside an unclosed [ ... ,
  // or (failing that) the last run of word/space characters right before
  // the cursor — so typing a bare "reven" without brackets still matches
  // "Revenue".
  const { query, queryStart } = useMemo(() => {
    const cursor = inputRef.current?.selectionStart ?? value.length;
    const before = value.slice(0, cursor);
    const openBracket = before.lastIndexOf("[");
    const closeBracket = before.lastIndexOf("]");
    if (openBracket > closeBracket) {
      return { query: before.slice(openBracket + 1), queryStart: openBracket + 1 };
    }
    const match = /[A-Za-z0-9_ ]*$/.exec(before);
    const start = match ? cursor - match[0].length : cursor;
    return { query: (match?.[0] ?? "").trim(), queryStart: start };
  }, [value]);

  const matches = useMemo(() => {
    if (!query) return [];
    const q = query.toLowerCase();
    return suggestions.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 8);
  }, [query, suggestions]);

  function insert(name: string) {
    const cursor = inputRef.current?.selectionStart ?? value.length;
    const before = value.slice(0, queryStart);
    const after = value.slice(cursor);
    // Consume a trailing "]" too if the user had already typed one (so we
    // don't end up with a stray extra bracket after inserting).
    const afterTrimmed = after.startsWith("]") ? after.slice(1) : after;
    const next = `${before}[${name}]${afterTrimmed}`;
    onChange(next);
    setHighlighted(0);
    requestAnimationFrame(() => {
      const pos = before.length + name.length + 2;
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="relative flex-1 min-w-[160px]">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 120)} // let a click on a suggestion register first
        onKeyDown={(e) => {
          if (matches.length === 0) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted((h) => (h + 1) % matches.length); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHighlighted((h) => (h - 1 + matches.length) % matches.length); }
          else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insert(matches[highlighted].name); }
          else if (e.key === "Escape") { setFocused(false); }
        }}
        placeholder={placeholder}
        className={className ?? "w-full bg-[var(--panel)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)] font-mono"}
      />
      {focused && matches.length > 0 && (
        <div className="absolute top-full left-0 mt-1 w-full max-w-xs bg-[var(--panel)] border border-[var(--border)] rounded-lg shadow-xl z-30 py-1 max-h-48 overflow-y-auto">
          {matches.map((m, i) => (
            <button
              key={`${m.kind}-${m.name}`}
              onMouseDown={(e) => { e.preventDefault(); insert(m.name); }}
              className={`w-full text-left px-2.5 py-1.5 text-xs flex items-center justify-between gap-2 ${
                i === highlighted ? "bg-[var(--accent-dim)] text-[var(--text-h)]" : "text-[var(--text)] hover:bg-[var(--panel-raised)]"
              }`}
            >
              <span className="truncate">{m.name}</span>
              <span className="shrink-0 text-[10px] uppercase tracking-wide text-[var(--text-dim)]">
                {m.kind === "measure" ? "★ measure" : "column"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
