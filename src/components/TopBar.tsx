import { useState } from "react";
import { RefreshCw, Link2, Loader2, FolderOpen, FileUp, Combine, Sigma, CloudUpload, Check, FileDown } from "lucide-react";
import type { DataRow, TaskPage } from "../types";
import { useAuth } from "../lib/auth";
import { canManageDataSources, canConnectNewData, canExport } from "../lib/permissions";
import { showToast } from "../lib/toast";
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
  /** Set once a fetch/import has updated this page locally but hasn't been
   *  written to the shared database yet — shows the "Save to shared
   *  database" button. */
  hasPendingSave: boolean;
  /** Set while that save is actually in progress; null the rest of the time. */
  saveProgress: { done: number; total: number } | null;
  onSaveNow: () => void;
  onExportPdf: () => void;
  exportingPdf: boolean;
}

export function TopBar({
  page, refreshing, onRefresh, onConnectSheet, onImportData, onOpenDataModel,
  hasPendingSave, saveProgress, onSaveNow, onExportPdf, exportingPdf,
}: Props) {
  const { user } = useAuth();
  const [showConnect, setShowConnect] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [urlInput, setUrlInput] = useState(page.sheetUrl);
  const [tabInput, setTabInput] = useState(page.sheetTabTitle ?? "");
  const [pickerBusy, setPickerBusy] = useState(false);
  const [combineBusy, setCombineBusy] = useState(false);
  const [tabPicker, setTabPicker] = useState<{ fileName: string; url: string; tabs: SheetTab[] } | null>(null);

  function reportError(e: unknown, fallback: string) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.startsWith("WRONG_ACCOUNT:")) {
      const wrongEmail = msg.split(":")[1];
      showToast(
        `This Drive connection is limited to mohamed.mahmoudsalah@breadfast.com. You signed in as ${wrongEmail}. Please try again and pick the right account.`,
        { type: "error", durationMs: 8000 }
      );
    } else {
      showToast(msg || fallback, { type: "error" });
    }
  }

  async function handleBrowseDrive() {
    if (!isGoogleDriveConfigured()) {
      showToast(
        "Google Drive isn't connected yet. An admin needs to add VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_API_KEY — see README.md 'Setting up real Google Drive access'.",
        { type: "error", durationMs: 7000 }
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
      showToast(
        "Google Drive isn't connected yet. An admin needs to add VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_API_KEY — see README.md 'Setting up real Google Drive access'.",
        { type: "error", durationMs: 7000 }
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

  const canConnect = canConnectNewData(user?.role);
  const canRefresh = canManageDataSources(user?.role);

  return (
    <div className="border-b border-[var(--border)] px-6 py-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="display text-lg">{page.name}</h1>
          <p className="text-xs text-[var(--text-dim)] mt-0.5">
            {hasPendingSave
              ? "Fetched — not saved to the shared database yet. Click \"Save to shared database\" below when you're ready."
              : page.lastUpdated
                ? `Last updated ${new Date(page.lastUpdated).toLocaleString()}${page.sheetTabTitle ? ` — tab "${page.sheetTabTitle}"` : ""}`
                : "Showing sample data — connect a Google Sheet to load real data"}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {canConnect && (
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
          {canExport(user?.role) && (
            <button
              onClick={onExportPdf}
              disabled={exportingPdf}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text)] hover:bg-[var(--panel-raised)] disabled:opacity-50"
              title="Export everything on this page as a PDF"
            >
              {exportingPdf ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
              Export page to PDF
            </button>
          )}
          {canRefresh && (
            <button
              onClick={onRefresh}
              disabled={refreshing || !page.sheetUrl}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-[var(--accent-dim)] border border-[var(--accent-border)] text-[var(--text-h)] hover:opacity-90 disabled:opacity-40"
            >
              {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Refresh data
            </button>
          )}
          {canRefresh && hasPendingSave && (
            <button
              onClick={onSaveNow}
              disabled={saveProgress !== null}
              title="Nothing you've just fetched/imported is visible to anyone else until you save it"
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white font-medium hover:opacity-90 disabled:opacity-70 animate-pulse disabled:animate-none"
            >
              {saveProgress ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  {saveProgress.total > 0 ? `Saving ${saveProgress.done}/${saveProgress.total}…` : "Saving…"}
                </>
              ) : (
                <>
                  <CloudUpload size={14} /> Save to shared database
                </>
              )}
            </button>
          )}
          {canRefresh && !hasPendingSave && saveProgress === null && page.lastUpdated && (
            <span className="flex items-center gap-1 text-xs text-[var(--text-dim)]" title="Everything here is saved to the shared database">
              <Check size={13} /> Saved
            </span>
          )}
        </div>
      </div>

      {showConnect && canConnect && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onConnectSheet(urlInput, tabInput.trim() || undefined);
            setShowConnect(false);
          }}
          className="mt-3 flex flex-wrap gap-2"
        >
          <input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Paste the Google Sheet share link (must be set to 'Anyone with the link can view')"
            className="flex-1 min-w-[220px] bg-[var(--panel-raised)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--accent-border)]"
          />
          <input
            value={tabInput}
            onChange={(e) => setTabInput(e.target.value)}
            placeholder="Tab name (needs 'Browse from Drive' signed in first; otherwise paste a link with #gid=... for a specific tab)"
            className="w-64 bg-[var(--panel-raised)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--accent-border)]"
          />
          <button
            type="submit"
            className="px-3 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium"
          >
            Connect
          </button>
        </form>
      )}

      {showImport && canConnect && (
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
