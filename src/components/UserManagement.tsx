import { useState } from "react";
import { Trash2, UserPlus } from "lucide-react";
import { useAuth } from "../lib/auth";
import { ROLE_LABELS, ROLE_DESCRIPTIONS } from "../lib/permissions";
import type { Role } from "../types";

const ROLES: Role[] = ["admin", "manager", "employee", "viewer"];

export function UserManagement() {
  const { users, addUser, updateUserRole, removeUser } = useAuth();
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<Role>("employee");
  const [error, setError] = useState<string | null>(null);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const result = addUser(newEmail, newRole);
    if (!result.ok) {
      setError(result.message ?? "Couldn't add that user.");
      return;
    }
    setError(null);
    setNewEmail("");
    setNewRole("employee");
  }

  function handleRoleChange(email: string, role: Role) {
    const result = updateUserRole(email, role);
    if (!result.ok) alert(result.message);
  }

  function handleRemove(email: string) {
    const result = removeUser(email);
    if (!result.ok) alert(result.message);
  }

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-lg mb-1">Manage Users</h1>
      <p className="text-xs text-[var(--text-dim)] mb-5">
        Add teammates by email and set what they can do. Changes apply immediately in this browser.
      </p>

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
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.email} className="border-b border-[var(--border)]/50 hover:bg-[var(--panel-raised)]">
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
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => handleRemove(u.email)}
                    className="p-1.5 rounded-md text-[var(--text-dim)] hover:bg-[var(--panel-raised)] hover:text-[var(--bad)]"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
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
