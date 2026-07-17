import { LayoutDashboard, Plus, LogOut, Sparkles } from "lucide-react";
import type { Department } from "../types";
import { useAuth } from "../lib/auth";

interface Props {
  departments: Department[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onOpenAssistant: () => void;
}

export function Sidebar({ departments, activeId, onSelect, onAdd, onOpenAssistant }: Props) {
  const { user, logout } = useAuth();

  return (
    <aside className="w-60 shrink-0 bg-[var(--panel)] border-r border-[var(--border)] flex flex-col h-svh">
      <div className="flex items-center gap-2 px-4 h-14 border-b border-[var(--border)]">
        <div className="w-7 h-7 rounded-md bg-[var(--accent-dim)] border border-[var(--accent-border)] flex items-center justify-center shrink-0">
          <LayoutDashboard size={15} color="var(--accent)" />
        </div>
        <span className="text-sm font-semibold text-[var(--text-h)] truncate">Team Insights</span>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <p className="px-2 text-xs uppercase tracking-wide text-[var(--text-dim)] mb-2">
          Departments
        </p>
        {departments.map((d) => (
          <button
            key={d.id}
            onClick={() => onSelect(d.id)}
            className={`w-full text-left px-2.5 py-2 rounded-lg text-sm mb-0.5 transition ${
              d.id === activeId
                ? "bg-[var(--accent-dim)] text-[var(--text-h)] border border-[var(--accent-border)]"
                : "text-[var(--text-dim)] hover:bg-[var(--panel-raised)] border border-transparent"
            }`}
          >
            {d.name}
          </button>
        ))}

        {user?.role === "admin" && (
          <button
            onClick={onAdd}
            className="w-full flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm mt-1 text-[var(--text-dim)] hover:bg-[var(--panel-raised)]"
          >
            <Plus size={15} /> Add department
          </button>
        )}
      </nav>

      <div className="p-2 border-t border-[var(--border)]">
        <button
          onClick={onOpenAssistant}
          className="w-full flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm mb-1 text-[var(--text-dim)] hover:bg-[var(--panel-raised)]"
        >
          <Sparkles size={15} color="var(--accent)" /> AI Assistant
        </button>
        <div className="flex items-center justify-between px-2.5 py-2">
          <div className="min-w-0">
            <p className="text-xs text-[var(--text)] truncate">{user?.email}</p>
            <p className="text-[10px] text-[var(--text-dim)] uppercase">{user?.role}</p>
          </div>
          <button onClick={logout} className="text-[var(--text-dim)] hover:text-[var(--bad)]">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
