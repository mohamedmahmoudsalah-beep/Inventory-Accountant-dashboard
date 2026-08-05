import { useEffect, useRef, useState } from "react";
import { Sparkles, Loader2, X } from "lucide-react";
import { askAssistant } from "../lib/assistant";
import type { DataRow } from "../types";

interface Props {
  /** The exact question to send — build this per-filter/per-widget with the
   *  specific column/value/config baked in (see FilterBar.tsx/PivotCard.tsx
   *  for examples), including an instruction to answer in Arabic. */
  prompt: string;
  context: { departmentName: string; rows: DataRow[]; columns: string[] };
  className?: string;
  /** Where the popover opens relative to the button — right-aligned by
   *  default (works well for header icon rows that read left-to-right),
   *  pass "left" for spots closer to the right edge of the screen. */
  align?: "left" | "right";
}

/** A small "explain this with AI" button — available to every role
 *  (unlike the full chat AI Assistant, which is Admin/Manager/Employee
 *  only). Deliberately scoped to explaining ONE specific filter or widget
 *  rather than opening a general chat, so anyone (including Viewer) can use
 *  it without touching anything they can't otherwise access. Reuses the
 *  same /api/assistant endpoint as the full Assistant — no separate setup
 *  needed; if that endpoint isn't configured yet, this shows the same
 *  "ask an Admin to wire it up" message the Assistant panel already gives. */
export function ExplainButton({ prompt, context, className, align = "right" }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function handleToggle() {
    const next = !open;
    setOpen(next);
    if (!next || answer || loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await askAssistant(prompt, context);
      setAnswer(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر الحصول على شرح دلوقتي — جرب تاني بعد شوية.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <button
        onClick={handleToggle}
        title="اشرحلي ده بالذكاء الاصطناعي"
        className="p-1 rounded-md text-[var(--text-dim)] hover:bg-[var(--panel-raised)] hover:text-[var(--accent)] shrink-0"
      >
        <Sparkles size={12} />
      </button>
      {open && (
        <div
          dir="rtl"
          className={`absolute z-30 top-full mt-1 ${align === "right" ? "right-0" : "left-0"} w-72 max-h-64 overflow-y-auto bg-[var(--panel)] border border-[var(--border)] rounded-lg shadow-xl p-3 text-xs text-[var(--text)]`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="flex items-center gap-1 text-[var(--accent)] font-medium">
              <Sparkles size={12} /> شرح بالذكاء الاصطناعي
            </span>
            <button onClick={() => setOpen(false)} className="text-[var(--text-dim)] hover:text-[var(--text)]">
              <X size={12} />
            </button>
          </div>
          {loading && (
            <div className="flex items-center gap-2 text-[var(--text-dim)]">
              <Loader2 size={12} className="animate-spin" /> بيحضّر الشرح...
            </div>
          )}
          {error && <p className="text-[var(--bad)] leading-relaxed">{error}</p>}
          {answer && <p className="whitespace-pre-wrap leading-relaxed">{answer}</p>}
        </div>
      )}
    </div>
  );
}
