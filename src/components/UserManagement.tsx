import { showToast } from "../lib/toast";
import { Fragment, useState } from "react";
import { Trash2, UserPlus, Globe, HardDrive, ChevronDown, ChevronRight, LockKeyhole } from "lucide-react";
import { useAuth } from "../lib/auth";
import { ROLE_LABELS, ROLE_DESCRIPTIONS, isPageAccessRestricted } from "../lib/permissions";
import { isSupabaseConfigured } from "../lib/supabase";
import type { Department, Role } from "../types";

const ROLES: Role[] = ["admin", "manager", "employee", "viewer"];

interface Props {
  departments: Department[];
}

export function UserManagement({ departments }: Props) {
  const { users, usersLoading, addUser, updateUserRole, updatePageAccess, removeUser, usesRealAuth } = useAuth();
  const [expandedAccess, setExpandedAccess] = useState<Set<string>>(new Set());
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<Role>("employee");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const shared = isSupabaseConfigured();

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const result = await addUser(newEmail, newRole, newPassword);
    if (!result.ok) {
      setError(result.message ?? "Couldn't add that user.");
      return;
    }
    setError(null);
    setNewEmail("");
    setNewRole("employee");
    setNewPassword("");
    if (usesRealAuth) {
      showToast(`Added ${newEmail} — share their password with them directly (not over an unsecured channel).`, { type: "success", durationMs: 6000 });
    }
  }

  async function handleRoleChange(email: string, role: Role) {
    const result = await updateUserRole(email, role);
    if (!result.ok) showToast(result.message ?? "Something went wrong.", { type: "error" });
  }

  async function handleRemove(email: string) {
    const result = await removeUser(email);
    if (!result.ok) showToast(result.message ?? "Something went wrong.", { type: "error" });
    else if (usesRealAuth) {
      showToast(
        "Removed — their access is revoked. Their login credential still technically exists in Supabase; delete it fully from Supabase Dashboard → Authentication → Users if needed.",
        { type: "info", durationMs: 8000 }
      );
    }
  }

  function toggleAccessRow(email: string) {
    setExpandedAccess((prev) => {
      const next = new Set(prev);
      next.has(email) ? next.delete(email) : next.add(email);
      return next;
    });
  }

  async function handlePageToggle(email: string, pageId: string, currentAccess: string[], checked: boolean) {
    const next = checked ? [...currentAccess, pageId] : currentAccess.filter((id) => id !== pageId);
    const result = await updatePageAccess(email, next);
    if (!result.ok) showToast(result.message ?? "Couldn't update page access.", { type: "error" });
  }

  async function handleTeamToggle(email: string, teamPageIds: string[], currentAccess: string[], checked: boolean) {
    const next = checked
      ? Array.from(new Set([...currentAccess, ...teamPageIds]))
      : currentAccess.filter((id) => !teamPageIds.includes(id));
    const result = await updatePageAccess(email, next);
    if (!result.ok) showToast(result.message ?? "Couldn't update page access.", { type: "error" });
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg mb-1">Manage Users</h1>
          <p className="text-xs text-[var(--text-dim)]">
            Add teammates by email and set what they can do.
          </p>
        </div>
        <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
          shared
            ? "border-[var(--mint)] text-[var(--mint)]"
            : "border-[var(--border)] text-[var(--text-dim)]"
        }`}>
          {shared ? <Globe size={12} /> : <HardDrive size={12} />}
          {shared ? "Shared across everyone" : "This browser only"}
        </span>
      </div>

      {usersLoading && <p className="text-sm text-[var(--text-dim)] mb-3">Loading users…</p>}

      <form onSubmit={handleAdd} className="flex flex-wrap gap-2 mb-3">
        <input
          type="email"
          required
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder="teammate@breadfast.com"
          className="flex-1 min-w-[220px] bg-[var(--panel-raised)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--accent-border)]"
        />
        <select
          value={newRole}
          onChange={(e) => setNewRole(e.target.value as Role)}
          className="bg-[var(--panel-raised)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"
        >
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
        {usesRealAuth && (
          <input
            type="text"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Temporary password (8+ chars)"
            className="min-w-[200px] bg-[var(--panel-raised)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--accent-border)]"
          />
        )}
        <button
          type="submit"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90"
        >
          <UserPlus size={14} /> Add
        </button>
      </form>
      {error && <p className="text-sm text-[var(--bad)] mb-3">{error}</p>}

      <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl overflow-hidden mb-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left px-4 py-2.5 text-xs uppercase tracking-wide text-[var(--text-dim)]">Email</th>
              <th className="text-left px-4 py-2.5 text-xs uppercase tracking-wide text-[var(--text-dim)]">Role</th>
              <th className="text-left px-4 py-2.5 text-xs uppercase tracking-wide text-[var(--text-dim)]">Page access</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const restricted = isPageAccessRestricted(u.role);
              const isExpanded = expandedAccess.has(u.email);
              // Local mode only: an account created before this feature
              // existed has pageAccess === undefined, which means "sees
              // everything, same as always" (see filterDepartmentsForUser)
              // — reflect that here as every page checked, rather than
              // showing a misleading "no pages assigned". The moment an
              // Admin touches any checkbox it becomes an explicit list.
              const isLegacyFullAccess = !usesRealAuth && u.pageAccess === undefined;
              const access = isLegacyFullAccess
                ? departments.flatMap((d) => d.pages.map((p) => p.id))
                : u.pageAccess ?? [];
              return (
                <Fragment key={u.email}>
                  <tr className="border-b border-[var(--border)]/50 hover:bg-[var(--panel-raised)]">
                    <td className="px-4 py-2.5 text-[var(--text)]">{u.email}</td>
                    <td className="px-4 py-2.5">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.email, e.target.value as Role)}
                        className="bg-[var(--panel-raised)] border border-[var(--border)] rounded-md px-2 py-1 text-sm"
                      >
                        {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2.5">
                      {restricted && (
                        <button
                          onClick={() => toggleAccessRow(u.email)}
                          className="flex items-center gap-1 text-xs text-[var(--text-dim)] hover:text-[var(--text)] px-2 py-1 rounded-md hover:bg-[var(--panel-raised)]"
                        >
                          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          <LockKeyhole size={12} />
                          {isLegacyFullAccess
                            ? "All pages (not yet restricted)"
                            : access.length === 0
                            ? "No pages assigned"
                            : `${access.length} page${access.length === 1 ? "" : "s"}`}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => handleRemove(u.email)}
                        className="p-1.5 rounded-md text-[var(--text-dim)] hover:bg-[var(--panel-raised)] hover:text-[var(--bad)]"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                  {restricted && isExpanded && (
                    <tr className="border-b border-[var(--border)]/50 bg-[var(--panel-raised)]/40">
                      <td colSpan={4} className="px-4 py-3">
                        <p className="text-xs text-[var(--text-dim)] mb-2">
                          Pick exactly which pages {u.email} can see. Everything else stays hidden to them.
                        </p>
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                          {departments.map((d) => {
                            const teamPageIds = d.pages.map((p) => p.id);
                            const allChecked = teamPageIds.length > 0 && teamPageIds.every((id) => access.includes(id));
                            return (
                              <div key={d.id} className="text-sm">
                                <label className="flex items-center gap-2 font-medium text-[var(--text)] cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={allChecked}
                                    onChange={(e) => handleTeamToggle(u.email, teamPageIds, access, e.target.checked)}
                                  />
                                  {d.name}
                                </label>
                                <div className="pl-6 mt-1 space-y-1">
                                  {d.pages.map((p) => (
                                    <label key={p.id} className="flex items-center gap-2 text-[var(--text-dim)] cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={access.includes(p.id)}
                                        onChange={(e) => handlePageToggle(u.email, p.id, access, e.target.checked)}
                                      />
                                      {p.name}
                                    </label>
                                  ))}
                                  {d.pages.length === 0 && (
                                    <p className="text-xs text-[var(--text-dim)] italic">No pages in this team yet.</p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          {departments.length === 0 && (
                            <p className="text-xs text-[var(--text-dim)] italic">No teams/pages exist yet.</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-2">
        {ROLES.map((r) => (
          <p key={r} className="text-xs text-[var(--text-dim)]">
            <span className="text-[var(--text)] font-medium">{ROLE_LABELS[r]}:</span> {ROLE_DESCRIPTIONS[r]}
          </p>
        ))}
      </div>
    </div>
  );
}
