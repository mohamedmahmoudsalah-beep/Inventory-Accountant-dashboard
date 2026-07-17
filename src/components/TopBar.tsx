import { useState } from "react";
import { RefreshCw, Link2, Loader2 } from "lucide-react";
import type { Department } from "../types";
import { useAuth } from "../lib/auth";

interface Props {
  department: Department;
  refreshing: boolean;
  onRefresh: () => void;
  onConnectSheet: (url: string) => void;
}

export function TopBar({ department, refreshing, onRefresh, onConnectSheet }: Props) {
  const { user } = useAuth();
  const [showConnect, setShowConnect] = useState(false);
  const [urlInput, setUrlInput] = useState(department.sheetUrl);

  return (
    <div className="border-b border-[var(--border)] px-6 py-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg">{department.name}</h1>
          <p className="text-xs text-[var(--text-dim)] mt-0.5">
            {department.lastUpdated
              ? `Last updated ${new Date(department.lastUpdated).toLocaleString()}`
              : "Showing sample data — connect a Google Sheet to load real data"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {user?.role === "admin" && (
            <button
              onClick={() => setShowConnect((s) => !s)}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text)] hover:bg-[var(--panel-raised)]"
            >
              <Link2 size={14} /> {department.sheetUrl ? "Edit sheet link" : "Connect Google Sheet"}
            </button>
          )}
          <button
            onClick={onRefresh}
            disabled={refreshing || !department.sheetUrl}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-[var(--accent-dim)] border border-[var(--accent-border)] text-[var(--text-h)] hover:opacity-90 disabled:opacity-40"
          >
            {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Refresh data
          </button>
        </div>
      </div>

      {showConnect && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onConnectSheet(urlInput);
            setShowConnect(false);
          }}
          className="mt-3 flex gap-2"
        >
          <input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Paste the Google Sheet share link (must be set to 'Anyone with the link can view')"
            className="flex-1 bg-[var(--panel-raised)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--accent-border)]"
          />
          <button
            type="submit"
            className="px-3 py-2 rounded-lg bg-[var(--accent)] text-[#1c1305] text-sm font-medium"
          >
            Connect
          </button>
        </form>
      )}
    </div>
  );
}
