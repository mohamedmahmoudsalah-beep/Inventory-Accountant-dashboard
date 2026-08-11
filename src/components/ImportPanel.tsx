import { useState } from "react";
import { X, Upload, Loader2, Link2, Plus, Trash2 } from "lucide-react";
import type { DataRow } from "../types";
import { parseFile, parseFiles, appendTables, mergeManyTables, type ParsedFile, type LookupJoin } from "../lib/importFiles";
import { fetchSheetAsRows } from "../lib/sheets";

interface Props {
  onApply: (rows: DataRow[], columns: string[]) => void;
  onClose: () => void;
}

type Mode = "replace" | "append" | "merge";

/** A source that hasn't been fetched/parsed into a table yet — either an
 *  uploaded file or a pasted Google Sheet link. Kept separate from
 *  ParsedFile so the UI can show a link input + "Fetch" button before the
 *  table exists yet. */
interface PendingLookup {
  id: string;
  table: ParsedFile | null;
  baseKey: string;
  otherKey: string;
  linkUrl: string;
  busy: boolean;
  error: string | null;
}

function newPendingLookup(): PendingLookup {
  return { id: crypto.randomUUID(), table: null, baseKey: "", otherKey: "", linkUrl: "", busy: false, error: null };
}

async function fetchSheetAsTable(url: string): Promise<ParsedFile> {
  const { rows, columns } = await fetchSheetAsRows(url);
  if (rows.length === 0 && columns.length === 0) {
    throw new Error("That link didn't return any data — check it's a valid, shared Google Sheet link.");
  }
  const name = url.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1]?.slice(0, 8) ?? "Sheet";
  return { fileName: `Sheet ${name}`, columns, rows };
}

export function ImportPanel({ onApply, onClose }: Props) {
  const [mode, setMode] = useState<Mode>("replace");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // replace / append
  const [tables, setTables] = useState<ParsedFile[]>([]);
  const [appendLinkUrl, setAppendLinkUrl] = useState("");

  // merge — one base table, then any number of lookup sheets joined onto it
  const [base, setBase] = useState<ParsedFile | null>(null);
  const [baseLinkUrl, setBaseLinkUrl] = useState("");
  const [lookups, setLookups] = useState<PendingLookup[]>([newPendingLookup()]);

  function resetAll() {
    setError(null);
    setTables([]);
    setAppendLinkUrl("");
    setBase(null);
    setBaseLinkUrl("");
    setLookups([newPendingLookup()]);
  }

  async function handleReplaceOrAppendFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const parsed = await parseFiles(Array.from(fileList));
      setTables(mode === "append" ? [...tables, ...parsed] : parsed.slice(0, 1));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file");
    } finally {
      setBusy(false);
    }
  }

  async function handleAppendLink() {
    if (!appendLinkUrl.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const table = await fetchSheetAsTable(appendLinkUrl.trim());
      setTables((prev) => [...prev, table]);
      setAppendLinkUrl("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't fetch that sheet");
    } finally {
      setBusy(false);
    }
  }

  async function handleBaseFile(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const parsed = await parseFile(fileList[0]);
      setBase(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file");
    } finally {
      setBusy(false);
    }
  }

  async function handleBaseLink() {
    if (!baseLinkUrl.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setBase(await fetchSheetAsTable(baseLinkUrl.trim()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't fetch that sheet");
    } finally {
      setBusy(false);
    }
  }

  function updateLookup(id: string, patch: Partial<PendingLookup>) {
    setLookups((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  async function handleLookupFile(id: string, fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    updateLookup(id, { busy: true, error: null });
    try {
      const parsed = await parseFile(fileList[0]);
      updateLookup(id, { table: parsed, otherKey: parsed.columns[0] ?? "", busy: false });
    } catch (e) {
      updateLookup(id, { error: e instanceof Error ? e.message : "Couldn't read that file", busy: false });
    }
  }

  async function handleLookupLink(id: string) {
    const lookup = lookups.find((l) => l.id === id);
    if (!lookup?.linkUrl.trim()) return;
    updateLookup(id, { busy: true, error: null });
    try {
      const table = await fetchSheetAsTable(lookup.linkUrl.trim());
      updateLookup(id, { table, otherKey: table.columns[0] ?? "", busy: false });
    } catch (e) {
      updateLookup(id, { error: e instanceof Error ? e.message : "Couldn't fetch that sheet", busy: false });
    }
  }

  function apply() {
    if (mode === "replace" && tables[0]) {
      onApply(tables[0].rows, tables[0].columns);
    } else if (mode === "append" && tables.length > 0) {
      const { rows, columns } = appendTables(tables);
      onApply(rows, columns);
    } else if (mode === "merge" && base) {
      const joins: LookupJoin[] = lookups
        .filter((l): l is PendingLookup & { table: ParsedFile } => !!l.table && !!l.baseKey && !!l.otherKey)
        .map((l) => ({ table: l.table, baseKey: l.baseKey, otherKey: l.otherKey }));
      const { rows, columns } = mergeManyTables(base, joins);
      onApply(rows, columns);
    }
    onClose();
  }

  const readyLookupCount = lookups.filter((l) => l.table && l.baseKey && l.otherKey).length;
  const canApply =
    (mode === "replace" && tables.length > 0) ||
    (mode === "append" && tables.length > 0) ||
    (mode === "merge" && base !== null && readyLookupCount > 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm">Import data</h3>
          <button onClick={onClose} className="text-[var(--text-dim)] hover:text-[var(--text-h)]">
            <X size={16} />
          </button>
        </div>

        <div className="flex gap-1 mb-4 bg-[var(--panel-raised)] p-1 rounded-lg text-xs">
          {(["replace", "append", "merge"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                resetAll();
              }}
              className={`flex-1 py-1.5 rounded-md capitalize ${
                mode === m ? "bg-[var(--accent-dim)] border border-[var(--accent-border)] text-[var(--text-h)]" : "text-[var(--text-dim)]"
              }`}
            >
              {m === "replace" ? "Replace" : m === "append" ? "Append (stack rows)" : "Merge (join)"}
            </button>
          ))}
        </div>

        {mode !== "merge" ? (
          <div>
            <p className="text-xs text-[var(--text-dim)] mb-2">
              {mode === "replace"
                ? "Upload one .xlsx, .xls, or .csv file, or paste a Google Sheet link. It will replace this page's current data."
                : "Upload files and/or paste Google Sheet links with similar columns — their rows get stacked into a single table."}
            </p>
            <label className="flex items-center justify-center gap-2 border border-dashed border-[var(--border)] rounded-lg py-6 text-sm text-[var(--text-dim)] cursor-pointer hover:border-[var(--accent-border)]">
              <Upload size={16} />
              {busy ? "Reading..." : "Choose file(s)"}
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                multiple={mode === "append"}
                className="hidden"
                onChange={(e) => handleReplaceOrAppendFiles(e.target.files)}
              />
            </label>

            {mode === "append" && (
              <div className="flex gap-2 mt-2">
                <input
                  type="url"
                  value={appendLinkUrl}
                  onChange={(e) => setAppendLinkUrl(e.target.value)}
                  placeholder="Or paste a Google Sheet link..."
                  className="flex-1 bg-[var(--panel-raised)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-sm"
                />
                <button
                  onClick={handleAppendLink}
                  disabled={busy || !appendLinkUrl.trim()}
                  className="px-3 rounded-lg bg-[var(--panel-raised)] border border-[var(--border)] text-sm text-[var(--text-dim)] hover:text-[var(--text-h)] disabled:opacity-40 flex items-center gap-1"
                >
                  <Link2 size={13} /> Fetch
                </button>
              </div>
            )}

            {tables.length > 0 && (
              <div className="mt-3 space-y-1 text-xs text-[var(--text)]">
                {tables.map((t, i) => (
                  <div key={i} className="flex justify-between bg-[var(--panel-raised)] rounded-md px-2.5 py-1.5">
                    <span>{t.fileName}</span>
                    <span className="text-[var(--text-dim)]">{t.rows.length} rows · {t.columns.length} cols</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-[var(--text-dim)]">
              Pick one base/main sheet, then link any number of other sheets onto it by a matching column (e.g. "Branch ID" in the base sheet
              matched against "ID" in a branches sheet) — each linked sheet adds its columns onto every base row.
            </p>

            <div>
              <p className="text-xs text-[var(--text-dim)] mb-1">Base sheet (the main table)</p>
              {!base ? (
                <>
                  <label className="flex items-center justify-center gap-2 border border-dashed border-[var(--border)] rounded-lg py-3 text-sm text-[var(--text-dim)] cursor-pointer hover:border-[var(--accent-border)]">
                    <Upload size={14} />
                    {busy ? "Reading..." : "Choose file"}
                    <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => handleBaseFile(e.target.files)} />
                  </label>
                  <div className="flex gap-2 mt-2">
                    <input
                      type="url"
                      value={baseLinkUrl}
                      onChange={(e) => setBaseLinkUrl(e.target.value)}
                      placeholder="Or paste a Google Sheet link..."
                      className="flex-1 bg-[var(--panel-raised)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-sm"
                    />
                    <button
                      onClick={handleBaseLink}
                      disabled={busy || !baseLinkUrl.trim()}
                      className="px-3 rounded-lg bg-[var(--panel-raised)] border border-[var(--border)] text-sm text-[var(--text-dim)] hover:text-[var(--text-h)] disabled:opacity-40 flex items-center gap-1"
                    >
                      <Link2 size={13} /> Fetch
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between bg-[var(--panel-raised)] rounded-md px-2.5 py-1.5 text-xs">
                  <span>{base.fileName} — {base.rows.length} rows · {base.columns.length} cols</span>
                  <button onClick={() => setBase(null)} className="text-[var(--text-dim)] hover:text-[var(--bad)]">
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>

            {base && (
              <div className="space-y-3">
                <p className="text-xs text-[var(--text-dim)]">Linked sheets</p>
                {lookups.map((lookup, i) => (
                  <div key={lookup.id} className="border border-[var(--border)] rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--text-dim)]">Sheet {i + 1}</span>
                      {lookups.length > 1 && (
                        <button
                          onClick={() => setLookups((prev) => prev.filter((l) => l.id !== lookup.id))}
                          className="text-[var(--text-dim)] hover:text-[var(--bad)]"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>

                    {!lookup.table ? (
                      <>
                        <label className="flex items-center justify-center gap-2 border border-dashed border-[var(--border)] rounded-lg py-2.5 text-sm text-[var(--text-dim)] cursor-pointer hover:border-[var(--accent-border)]">
                          <Upload size={14} />
                          {lookup.busy ? "Reading..." : "Choose file"}
                          <input
                            type="file"
                            accept=".csv,.xlsx,.xls"
                            className="hidden"
                            onChange={(e) => handleLookupFile(lookup.id, e.target.files)}
                          />
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="url"
                            value={lookup.linkUrl}
                            onChange={(e) => updateLookup(lookup.id, { linkUrl: e.target.value })}
                            placeholder="Or paste a Google Sheet link..."
                            className="flex-1 bg-[var(--panel-raised)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-sm"
                          />
                          <button
                            onClick={() => handleLookupLink(lookup.id)}
                            disabled={lookup.busy || !lookup.linkUrl.trim()}
                            className="px-3 rounded-lg bg-[var(--panel-raised)] border border-[var(--border)] text-sm text-[var(--text-dim)] hover:text-[var(--text-h)] disabled:opacity-40 flex items-center gap-1"
                          >
                            <Link2 size={13} /> Fetch
                          </button>
                        </div>
                        {lookup.error && <p className="text-xs text-[var(--bad)]">{lookup.error}</p>}
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between bg-[var(--panel-raised)] rounded-md px-2.5 py-1.5 text-xs">
                          <span>{lookup.table.fileName} — {lookup.table.rows.length} rows · {lookup.table.columns.length} cols</span>
                          <button onClick={() => updateLookup(lookup.id, { table: null, baseKey: "", otherKey: "" })} className="text-[var(--text-dim)] hover:text-[var(--bad)]">
                            <Trash2 size={13} />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-[10px] text-[var(--text-dim)] mb-1">Base column</p>
                            <select
                              value={lookup.baseKey}
                              onChange={(e) => updateLookup(lookup.id, { baseKey: e.target.value })}
                              className="w-full bg-[var(--panel-raised)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-sm"
                            >
                              {base.columns.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                          <div>
                            <p className="text-[10px] text-[var(--text-dim)] mb-1">Matches this sheet's column</p>
                            <select
                              value={lookup.otherKey}
                              onChange={(e) => updateLookup(lookup.id, { otherKey: e.target.value })}
                              className="w-full bg-[var(--panel-raised)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-sm"
                            >
                              {lookup.table.columns.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => setLookups((prev) => [...prev, newPendingLookup()])}
                  className="w-full flex items-center justify-center gap-1.5 border border-dashed border-[var(--border)] rounded-lg py-2 text-xs text-[var(--text-dim)] hover:border-[var(--accent-border)] hover:text-[var(--text-h)]"
                >
                  <Plus size={13} /> Add another sheet to link
                </button>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-sm text-[var(--bad)] mt-3">{error}</p>}

        <button
          onClick={apply}
          disabled={!canApply || busy}
          className="w-full mt-5 bg-[var(--accent)] text-white font-medium rounded-lg py-2 text-sm hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {busy && <Loader2 size={14} className="animate-spin" />}
          Apply
        </button>
      </div>
    </div>
  );
}
