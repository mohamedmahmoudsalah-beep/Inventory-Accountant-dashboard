import { useState } from "react";
import {
  Plus, LogOut, Sparkles, ChevronDown, ChevronRight, ChevronsLeft, ChevronsRight,
  FileText, Database, Users, Pencil, Trash2, Sun, Moon,
} from "lucide-react";
import type { Department } from "../types";
import { useAuth } from "../lib/auth";
import { canManageStructure, canManageUsers, canUseAssistant, ROLE_LABELS } from "../lib/permissions";
import type { Theme } from "../lib/theme";

interface Props {
  departments: Department[];
  activeDeptId: string;
  activePageId: string;
  showingDataSources: boolean;
  showingUsers: boolean;
  theme: Theme;
  onToggleTheme: () => void;
  onSelectPage: (deptId: string, pageId: string) => void;
  onSelectDataSources: () => void;
  onSelectUsers: () => void;
  onAddDepartment: () => void;
  onAddPage: (deptId: string) => void;
  onRenameDepartment: (deptId: string) => void;
  onDeleteDepartment: (deptId: string) => void;
  onRenamePage: (deptId: string, pageId: string) => void;
  onDeletePage: (deptId: string, pageId: string) => void;
  onOpenAssistant: () => void;
}

export function Sidebar({
  departments, activeDeptId, activePageId, showingDataSources, showingUsers, theme, onToggleTheme,
  onSelectPage, onSelectDataSources, onSelectUsers, onAddDepartment, onAddPage,
  onRenameDepartment, onDeleteDepartment, onRenamePage, onDeletePage, onOpenAssistant,
}: Props) {
  const { user, logout } = useAuth();
  const [expanded, setExpanded] = useState<Set<string>>(new Set([activeDeptId]));
  const [collapsed, setCollapsed] = useState(false);
  const canEditStructure = canManageStructure(user?.role);

  function toggle(deptId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(deptId) ? next.delete(deptId) : next.add(deptId);
      return next;
    });
  }

  if (collapsed) {
    return (
      <aside className="w-14 shrink-0 bg-[var(--panel)] border-r border-[var(--border)] flex flex-col items-center h-svh py-3 gap-3">
        <button onClick={() => setCollapsed(false)} title="Expand sidebar" className="text-[var(--text-dim)] hover:text-[var(--text-h)]">
          <ChevronsRight size={18} />
        </button>
        <div className="w-8 h-8 rounded-lg overflow-hidden">
          <img src="/breadfast-logo-magenta.png" alt="Breadfast" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1" />
        <button onClick={onSelectDataSources} title="Data Sources" className="text-[var(--text-dim)] hover:text-[var(--text-h)]"><Database size={17} /></button>
        {canManageUsers(user?.role) && (
          <button onClick={onSelectUsers} title="Manage Users" className="text-[var(--text-dim)] hover:text-[var(--text-h)]"><Users size={17} /></button>
        )}
        {canUseAssistant(user?.role) && (
          <button onClick={onOpenAssistant} title="AI Assistant" className="text-[var(--accent)] hover:opacity-80"><Sparkles size={17} /></button>
        )}
        <button onClick={onToggleTheme} title="Toggle theme" className="text-[var(--text-dim)] hover:text-[var(--text-h)]">
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <button onClick={logout} title="Log out" className="text-[var(--text-dim)] hover:text-[var(--bad)]"><LogOut size={17} /></button>
      </aside>
    );
  }

  return (
    <aside className="w-64 shrink-0 bg-[var(--panel)] border-r border-[var(--border)] flex flex-col h-svh">
      <div className="flex items-center gap-2 px-4 h-14 border-b border-[var(--border)]">
        <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0">
          <img src="/breadfast-logo-magenta.png" alt="Breadfast" className="w-full h-full object-cover" />
        </div>
        <span className="text-sm font-semibold text-[var(--text-h)] truncate flex-1">General Report Inventory Accountant team</span>
        <button onClick={() => setCollapsed(true)} title="Collapse sidebar" className="text-[var(--text-dim)] hover:text-[var(--text-h)] shrink-0">
          <ChevronsLeft size={16} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <p className="px-2 text-xs uppercase tracking-wide text-[var(--text-dim)] mb-2">Teams</p>

        {departments.map((dept) => {
          const isExpanded = expanded.has(dept.id);
          return (
            <div key={dept.id} className="mb-0.5 group">
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => toggle(dept.id)}
                  className="flex-1 flex items-center gap-1.5 px-2 py-2 rounded-lg text-sm text-[var(--text)] hover:bg-[var(--panel-raised)] min-w-0"
                >
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span className="truncate font-medium">{dept.name}</span>
                </button>
                {canEditStructure && (
                  <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                    <button onClick={() => onRenameDepartment(dept.id)} className="p-1 text-[var(--text-dim)] hover:text-[var(--text-h)]"><Pencil size={12} /></button>
                    <button onClick={() => onDeleteDepartment(dept.id)} className="p-1 text-[var(--text-dim)] hover:text-[var(--bad)]"><Trash2 size={12} /></button>
                  </div>
                )}
              </div>

              {isExpanded && (
                <div className="ml-4 pl-2 border-l border-[var(--border)] mt-0.5 mb-1">
                  {dept.pages.map((page) => (
                    <div key={page.id} className="flex items-center gap-0.5 group/page">
                      <button
                        onClick={() => onSelectPage(dept.id, page.id)}
                        className={`flex-1 flex items-center gap-1.5 text-left px-2 py-1.5 rounded-md text-sm mb-0.5 transition min-w-0 ${
                          dept.id === activeDeptId && page.id === activePageId && !showingDataSources && !showingUsers
                            ? "bg-[var(--accent-dim)] text-[var(--text-h)] border border-[var(--accent-border)]"
                            : "text-[var(--text-dim)] hover:bg-[var(--panel-raised)] border border-transparent"
                        }`}
                      >
                        <FileText size={13} className="shrink-0" />
                        <span className="truncate">{page.name}</span>
                      </button>
                      {canEditStructure && (
                        <div className="hidden group-hover/page:flex items-center gap-0.5 shrink-0">
                          <button onClick={() => onRenamePage(dept.id, page.id)} className="p-1 text-[var(--text-dim)] hover:text-[var(--text-h)]"><Pencil size={11} /></button>
                          <button onClick={() => onDeletePage(dept.id, page.id)} className="p-1 text-[var(--text-dim)] hover:text-[var(--bad)]"><Trash2 size={11} /></button>
                        </div>
                      )}
                    </div>
                  ))}
                  {canEditStructure && (
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

        {canEditStructure && (
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
          onClick={onSelectDataSources}
          className={`w-full flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm mb-1 ${
            showingDataSources
              ? "bg-[var(--accent-dim)] text-[var(--text-h)] border border-[var(--accent-border)]"
              : "text-[var(--text-dim)] hover:bg-[var(--panel-raised)]"
          }`}
        >
          <Database size={15} /> Data Sources
        </button>
        {canManageUsers(user?.role) && (
          <button
            onClick={onSelectUsers}
            className={`w-full flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm mb-1 ${
              showingUsers
                ? "bg-[var(--accent-dim)] text-[var(--text-h)] border border-[var(--accent-border)]"
                : "text-[var(--text-dim)] hover:bg-[var(--panel-raised)]"
            }`}
          >
            <Users size={15} /> Manage Users
          </button>
        )}
        {canUseAssistant(user?.role) && (
          <button
            onClick={onOpenAssistant}
            className="w-full flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm mb-1 text-[var(--text-dim)] hover:bg-[var(--panel-raised)]"
          >
            <Sparkles size={15} color="var(--accent)" /> AI Assistant
          </button>
        )}
        <button
          onClick={onToggleTheme}
          className="w-full flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm mb-1 text-[var(--text-dim)] hover:bg-[var(--panel-raised)]"
        >
          {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />} {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
        <div className="flex items-center justify-between px-2.5 py-2">
          <div className="min-w-0">
            <p className="text-xs text-[var(--text)] truncate">{user?.email}</p>
            <p className="text-[10px] text-[var(--text-dim)] uppercase">{user ? ROLE_LABELS[user.role] : ""}</p>
          </div>
          <button onClick={logout} className="text-[var(--text-dim)] hover:text-[var(--bad)]">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
