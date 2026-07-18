import { useState } from "react";
import { RefreshCw, Link2, Loader2, FolderOpen, FileUp, Combine, Sigma } from "lucide-react";
import type { DataRow, TaskPage } from "../types";
import { useAuth } from "../lib/auth";
import { canManageDataSources } from "../lib/permissions";
import {
  pickGoogleSheet,
  pickGoogleSheets,
  isGoogleDriveConfigured,
  listSheetTabs,
  type SheetTab,
} from "../lib/googleDrive";
import { extractSheetId, fetchMultipleSheets } from "../lib/sheets";
import { appendTables } from "../lib/importFiles";
import { ImportPanel } from "./ImportPanel";
import { SheetTabPicker } from "./SheetTabPicker";

interface Props {
  page: TaskPage;
  refreshing: boolean;
  onRefresh: () => void;
  onConnectSheet: (url: string, tabTitle?: string, sourceType?: "csv-link" | "drive") => void;
  onImportData: (rows: DataRow[], columns: string[]) => void;
  onOpenDataModel: () => void;
}

export function TopBar({ page, refreshing, onRefresh, onConnectSheet, onImportData, onOpenDataModel }: Props) {
  const { user } = useAuth();
  const [showConnect, setShowConnect] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [urlInput, setUrlInput] = useState(page.sheetUrl);
  const [pickerBusy, setPickerBusy] = useState(false);
  const [combineBusy, setCombineBusy] = useState(false);
  const [tabPicker, setTabPicker] = useState<{ fileName: string; url: string; tabs: SheetTab[] } | null>(null);

  function reportError(e: unknown, fallback: string) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.startsWith("WRONG_ACCOUNT:")) {
      const wrongEmail = msg.split(":")[1];
      alert(
        `This Drive connection is limited to mohamed.mahmoudsalah@breadfast.com.\nYou signed in as ${wrongEmail}. Please try again and pick the right account.`
      );
    } else {
      alert(msg || fallback);
    }
  }

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
      if (!picked) return;

      const id = extractSheetId(picked.url);
      if (id) {
        try {
          const tabs = await listSheetTabs(id);
          if (tabs.length > 1) {
            setTabPicker({ fileName: picked.name, url: picked.url, tabs });
            return;
          }
          if (tabs.length === 1) {
            onConnectSheet(picked.url, tabs[0].title, "drive");
            return;
          }
        } catch {
          // Couldn't list tabs — fall through and connect without a specific tab.
        }
      }
      onConnectSheet(picked.url, undefined, "drive");
    } catch (e) {
      reportError(e, "Couldn't open Google Drive picker");
    } finally {
      setPickerBusy(false);
    }
  }

  async function handleCombineSheets() {
    if (!isGoogleDriveConfigured()) {
      alert(
        "Google Drive isn't connected yet. An admin needs to add VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_API_KEY — see README.md 'Setting up real Google Drive access'."
      );
      return;
    }
    setCombineBusy(true);
    try {
      const picked = await pickGoogleSheets();
      if (!picked || picked.length === 0) return;
      if (picked.length === 1) {
        onConnectSheet(picked[0].url, undefined, "drive");
        return;
      }
      const tables = await fetchMultipleSheets(picked);
      const { rows, columns } = appendTables(tables);
      onImportData(rows, columns);
    } catch (e) {
      reportError(e, "Couldn't combine those sheets");
    } finally {
      setCombineBusy(false);
    }
  }

  return (
    <div className="border-b border-[var(--border)] px-6 py-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg">{page.name}</h1>
          <p className="text-xs text-[var(--text-dim)] mt-0.5">
            {page.lastUpdated
              ? `Last updated ${new Date(page.lastUpdated).toLocaleString()}${page.sheetTabTitle ? ` — tab "${page.sheetTabTitle}"` : ""}`
              : "Showing sample data — connect a Google Sheet to load real data"}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {canManageDataSources(user?.role) && (
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
                onClick={handleCombineSheets}
                disabled={combineBusy}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text)] hover:bg-[var(--panel-raised)] disabled:opacity-50"
              >
                {combineBusy ? <Loader2 size={14} className="animate-spin" /> : <Combine size={14} />}
                Combine online sheets
              </button>
              <button
                onClick={() => setShowImport(true)}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text)] hover:bg-[var(--panel-raised)]"
              >
                <FileUp size={14} /> Import file
              </button>
              <button
                onClick={() => setShowConnect((s) => !s)}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text)] hover:bg-[var(--panel-raised)]"
              >
                <Link2 size={14} /> {page.sheetUrl ? "Edit sheet link" : "Paste sheet link"}
              </button>
              <button
                onClick={onOpenDataModel}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text)] hover:bg-[var(--panel-raised)]"
              >
                <Sigma size={14} /> Data model
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

      {showImport && (
        <ImportPanel
          onApply={(rows, columns) => onImportData(rows, columns)}
          onClose={() => setShowImport(false)}
        />
      )}

      {tabPicker && (
        <SheetTabPicker
          fileName={tabPicker.fileName}
          tabs={tabPicker.tabs}
          onClose={() => setTabPicker(null)}
          onPick={(tabTitle) => {
            onConnectSheet(tabPicker.url, tabTitle, "drive");
            setTabPicker(null);
          }}
        />
      )}
    </div>
  );
}
