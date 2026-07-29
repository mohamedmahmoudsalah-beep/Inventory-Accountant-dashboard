import { useEffect, useState } from "react";
import { Clock, RefreshCw } from "lucide-react";
import { loadActivityLog, type ActivityLogEntry } from "../lib/remoteDb";

const ACTION_LABELS: Record<string, string> = {
  team_created: "created team",
  team_renamed: "renamed team to",
  team_deleted: "deleted team",
  page_created: "created page",
  page_renamed: "renamed page to",
  page_deleted: "deleted page",
  data_source_connected: "connected a data source on",
  data_refreshed: "refreshed data on",
  user_added: "added user",
  user_role_changed: "changed role for",
  user_removed: "removed user",
};

export function ActivityLogView() {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const data = await loadActivityLog(200);
    setEntries(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-[var(--text-h)] flex items-center gap-2">
          <Clock size={18} /> Activity Log
        </h1>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-sm text-[var(--text-dim)] hover:text-[var(--text-h)]"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      <p className="text-xs text-[var(--text-dim)] mb-4">
        Who did what, and when — team/page changes, data connections and refreshes, and user management. Only the
        last 200 entries are shown.
      </p>

      {loading && entries.length === 0 && <p className="text-sm text-[var(--text-dim)]">Loading…</p>}

      {!loading && entries.length === 0 && (
        <p className="text-sm text-[var(--text-dim)]">
          No activity recorded yet — this starts filling in from the moment the <code>activity_log</code> table
          exists in Supabase. See the README's Supabase setup section.
        </p>
      )}

      <div className="space-y-1">
        {entries.map((e) => (
          <div
            key={e.id}
            className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--border)] text-sm"
          >
            <div className="min-w-0">
              <span className="text-[var(--text-h)] font-medium">{e.actor_email}</span>{" "}
              <span className="text-[var(--text-dim)]">{ACTION_LABELS[e.action] ?? e.action}</span>{" "}
              {e.details && <span className="text-[var(--text)]">"{e.details}"</span>}
            </div>
            <span className="shrink-0 text-xs text-[var(--text-dim)]">
              {new Date(e.created_at).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
