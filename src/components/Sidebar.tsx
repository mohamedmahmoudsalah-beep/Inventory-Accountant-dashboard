import { useState } from "react";
import { Plus, LogOut, Sparkles, ChevronDown, ChevronRight, FileText } from "lucide-react";
import type { Department } from "../types";
import { useAuth } from "../lib/auth";
import { BrandMark } from "./BrandMark";

interface Props {
  departments: Department[];
  activeDeptId: string;
  activePageId: string;
  onSelectPage: (deptId: string, pageId: string) => void;
  onAddDepartment: () => void;
  onAddPage: (deptId: string) => void;
  onOpenAssistant: () => void;
}

export function Sidebar({
  departments, activeDeptId, activePageId,
  onSelectPage, onAddDepartment, onAddPage, onOpenAssistant,
}: Props) {
  const { user, logout } = useAuth();
  const [expanded, setExpanded] = useState<Set<string>>(new Set([activeDeptId]));
  const canEdit = user?.role === "admin";

  function toggle(deptId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(deptId) ? next.delete(deptId) : next.add(deptId);
      return next;
    });
  }

  return (
    <aside className="w-64 shrink-0 bg-[var(--panel)] border-r border-[var(--border)] flex flex-col h-svh">
      <div className="flex items-center gap-2 px-4 h-14 border-b border-[var(--border)]">
        <div className="w-7 h-7 rounded-md bg-[var(--accent-dim)] border border-[var(--accent-border)] flex items-center justify-center shrink-0">
          <BrandMark size={16} />
        </div>
        <span className="text-sm font-semibold text-[var(--text-h)] truncate">Breadfast Insights</span>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <p className="px-2 text-xs uppercase tracking-wide text-[var(--text-dim)] mb-2">Teams</p>

        {departments.map((dept) => {
          const isExpanded = expanded.has(dept.id);
          return (
            <div key={dept.id} className="mb-0.5">
              <button
                onClick={() => toggle(dept.id)}
                className="w-full flex items-center gap-1.5 px-2 py-2 rounded-lg text-sm text-[var(--text)] hover:bg-[var(--panel-raised)]"
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span className="truncate font-medium">{dept.name}</span>
              </button>

              {isExpanded && (
                <div className="ml-4 pl-2 border-l border-[var(--border)] mt-0.5 mb-1">
                  {dept.pages.map((page) => (
                    <button
                      key={page.id}
                      onClick={() => onSelectPage(dept.id, page.id)}
                      className={`w-full flex items-center gap-1.5 text-left px-2 py-1.5 rounded-md text-sm mb-0.5 transition ${
                        dept.id === activeDeptId && page.id === activePageId
                          ? "bg-[var(--accent-dim)] text-[var(--text-h)] border border-[var(--accent-border)]"
                          : "text-[var(--text-dim)] hover:bg-[var(--panel-raised)] border border-transparent"
                      }`}
                    >
                      <FileText size={13} className="shrink-0" />
                      <span className="truncate">{page.name}</span>
                    </button>
                  ))}
                  {canEdit && (
                    <button
                      onClick={() => onAddPage(dept.id)}
                      className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-[var(--text-dim)] hover:bg-[var(--panel-raised)]"
                    >
                      <Plus size={12} /> Add task page
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {canEdit && (
          <button
            onClick={onAddDepartment}
            className="w-full flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm mt-2 text-[var(--text-dim)] hover:bg-[var(--panel-raised)]"
          >
            <Plus size={15} /> Add team
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
