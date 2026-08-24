import { useState } from "react";
import { X, Send, Sparkles, Loader2, LayoutDashboard } from "lucide-react";
import type { DataRow } from "../types";
import { askAssistant, autoBuildDashboard, type AutoWidgetSpec } from "../lib/assistant";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  departmentName: string;
  rows: DataRow[];
  columns: string[];
  onClose: () => void;
  /** Only Admins see/use this — auto-build creates real widgets on the
   *  page, so it's deliberately tighter than normal widget-editing rights
   *  (App.tsx passes `user?.role === "admin"` here). */
  canBuild: boolean;
  /** Turns an AI plan into real widgets on the current page (App.tsx). */
  onApplyAutoBuild: (widgets: AutoWidgetSpec[]) => void;
}

export function AIAssistant({ departmentName, rows, columns, onClose, canBuild, onApplyAutoBuild }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Hi! Ask me anything about the "${departmentName}" data — trends, totals, or which chart would show something best.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  // Set while waiting on the user's answer to a clarifying question the AI
  // asked before it could build the dashboard (see autoBuildDashboard's doc
  // comment) — the next thing the user types is routed there instead of the
  // normal free-text chat.
  const [pendingClarification, setPendingClarification] = useState<string | null>(null);

  async function send() {
    const question = input.trim();
    if (!question || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: question }]);

    if (pendingClarification) {
      await runAutoBuild([{ question: pendingClarification, answer: question }]);
      return;
    }

    setLoading(true);
    try {
      const answer = await askAssistant(question, { departmentName, rows, columns });
      setMessages((m) => [...m, { role: "assistant", content: answer }]);
    } catch (e) {
      const reason = e instanceof Error ? e.message : "unknown error";
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: `I couldn't reach the assistant backend (${reason}). If you haven't set it up yet, see README.md "Wiring up the AI assistant".`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function runAutoBuild(clarification?: { question: string; answer: string }[]) {
    setLoading(true);
    setPendingClarification(null);
    try {
      const result = await autoBuildDashboard({ departmentName, rows, columns }, clarification);
      if (result.clarifyingQuestions.length > 0) {
        const q = result.clarifyingQuestions[0]; // one at a time keeps the back-and-forth simple
        setPendingClarification(q);
        setMessages((m) => [...m, { role: "assistant", content: q }]);
        return;
      }
      if (result.widgets.length === 0) {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: "معرفتش أبني حاجة مفيدة من الأعمدة دي — جرب تتأكد إن الصفحة فيها بيانات." },
        ]);
        return;
      }
      onApplyAutoBuild(result.widgets);
      setMessages((m) => [...m, { role: "assistant", content: result.summary || "تم بناء الداشبورد." }]);
    } catch (e) {
      const reason = e instanceof Error ? e.message : "unknown error";
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: `مقدرتش أبني الداشبورد دلوقتي (${reason}). لو الـ AI backend لسه مش متظبط، شوف README.md "Wiring up the AI assistant".`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed right-0 top-0 h-svh w-96 bg-[var(--panel)] border-l border-[var(--border)] flex flex-col z-50 shadow-2xl">
      <div className="flex items-center justify-between px-4 h-14 border-b border-[var(--border)]">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Sparkles size={15} color="var(--accent)" /> AI Assistant
        </span>
        <button onClick={onClose} className="text-[var(--text-dim)] hover:text-[var(--text-h)]">
          <X size={16} />
        </button>
      </div>

      {canBuild && (
        <div className="px-4 pt-3">
          <button
            onClick={() => {
              setMessages((m) => [...m, { role: "user", content: "ابنِ لي Dashboard تلقائي من بيانات الصفحة دي" }]);
              runAutoBuild();
            }}
            disabled={loading || columns.length === 0}
            title={columns.length === 0 ? "الصفحة لسه مفيهاش بيانات" : ""}
            dir="rtl"
            className="w-full flex items-center justify-center gap-2 text-sm font-medium rounded-lg px-3 py-2 bg-[var(--accent-dim)] border border-[var(--accent-border)] text-[var(--text-h)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LayoutDashboard size={15} /> ابنِ Dashboard تلقائي
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`text-sm rounded-lg px-3 py-2 max-w-[90%] ${
              m.role === "user"
                ? "bg-[var(--accent-dim)] border border-[var(--accent-border)] ml-auto text-[var(--text-h)]"
                : "bg-[var(--panel-raised)] border border-[var(--border)] text-[var(--text)]"
            }`}
          >
            {m.content}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-[var(--text-dim)]">
            <Loader2 size={13} className="animate-spin" /> Thinking...
          </div>
        )}
      </div>

      <div className="p-3 border-t border-[var(--border)] flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={pendingClarification ? "اكتب إجابتك هنا..." : "Ask about this data..."}
          dir={pendingClarification ? "rtl" : undefined}
          className="flex-1 bg-[var(--panel-raised)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--accent-border)]"
        />
        <button
          onClick={send}
          className="px-3 rounded-lg bg-[var(--accent)] text-white hover:opacity-90"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}
