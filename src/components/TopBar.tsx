import { useState } from "react";
import { RefreshCw, Link2, Loader2, FolderOpen } from "lucide-react";
import type { TaskPage } from "../types";
import { useAuth } from "../lib/auth";
import { pickGoogleSheet, isGoogleDriveConfigured } from "../lib/googleDrive";

interface Props {
  page: TaskPage;
  refreshing: boolean;
  onRefresh: () => void;
  onConnectSheet: (url: string) => void;
}

export function TopBar({ page, refreshing, onRefresh, onConnectSheet }: Props) {
  const { user } = useAuth();
  const [showConnect, setShowConnect] = useState(false);
  const [urlInput, setUrlInput] = useState(page.sheetUrl);
  const [pickerBusy, setPickerBusy] = useState(false);

  async function handleBrowseDrive() {
    if (!isGoogleDriveConfigured()) {
      alert(
        "Google Drive isn't connected yet. An admin needs to add VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_API_KEY — see README.md 'Setting up real Google Drive access'."
      );
      return;
    }
    setPickerBusy(true);
    try {
      const picked = await pickGoogleSheet();
      if (picked) onConnectSheet(picked.url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Couldn't open Google Drive picker");
    } finally {
      setPickerBusy(false);
    }
  }

  return (
    <div className="border-b border-[var(--border)] px-6 py-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg">{page.name}</h1>
          <p className="text-xs text-[var(--text-dim)] mt-0.5">
            {page.lastUpdated
              ? `Last updated ${new Date(page.lastUpdated).toLocaleString()}`
              : "Showing sample data — connect a Google Sheet to load real data"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {user?.role === "admin" && (
            <>
              <button
                onClick={handleBrowseDrive}
                disabled={pickerBusy}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text)] hover:bg-[var(--panel-raised)] disabled:opacity-50"
              >
                {pickerBusy ? <Loader2 size={14} className="animate-spin" /> : <FolderOpen size={14} />}
                Browse from Drive
              </button>
              <button
                onClick={() => setShowConnect((s) => !s)}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text)] hover:bg-[var(--panel-raised)]"
              >
                <Link2 size={14} /> {page.sheetUrl ? "Edit sheet link" : "Paste sheet link"}
              </button>
            </>
          )}
          <button
            onClick={onRefresh}
            disabled={refreshing || !page.sheetUrl}
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
            className="px-3 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium"
          >
            Connect
          </button>
        </form>
      )}
    </div>
  );
}
