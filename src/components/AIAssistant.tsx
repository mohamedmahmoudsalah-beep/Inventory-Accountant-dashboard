import { useState } from "react";
import { X, Send, Sparkles, Loader2 } from "lucide-react";
import type { DataRow } from "../types";
import { askAssistant } from "../lib/assistant";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  departmentName: string;
  rows: DataRow[];
  columns: string[];
  onClose: () => void;
}

export function AIAssistant({ departmentName, rows, columns, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Hi! Ask me anything about the "${departmentName}" data — trends, totals, or which chart would show something best.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function send() {
    const question = input.trim();
    if (!question || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: question }]);
    setLoading(true);
    try {
      const answer = await askAssistant(question, { departmentName, rows, columns });
      setMessages((m) => [...m, { role: "assistant", content: answer }]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "I couldn't reach the assistant backend. See README.md to set up the API proxy." },
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
          placeholder="Ask about this data..."
          className="flex-1 bg-[var(--panel-raised)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--accent-border)]"
        />
        <button
          onClick={send}
          className="px-3 rounded-lg bg-[var(--accent)] text-[#1c1305] hover:opacity-90"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}
