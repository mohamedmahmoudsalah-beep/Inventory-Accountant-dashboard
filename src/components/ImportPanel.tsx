import { useEffect, useState } from "react";
import { X, Upload, Loader2, Link2, Plus, Trash2, ChevronDown } from "lucide-react";
import type { DataRow, ImportRecipe } from "../types";
import {
  parseFile, parseFiles, appendTables, mergeManyTables, aggregateForJoin, defaultPicksForKeys,
  type ParsedFile, type LookupJoin, type JoinAgg, type MergeMatchStats,
} from "../lib/importFiles";
import { fetchSheetAsRows, extractSheetId } from "../lib/sheets";
import { listSheetTabs, type SheetTab } from "../lib/googleDrive";
import { KeyPairsEditor, type KeyPair } from "./KeyPairsEditor";
import { ColumnPicksEditor } from "./ColumnPicksEditor";
import { showToast } from "../lib/toast";

interface Props {
  onApply: (rows: DataRow[], columns: string[], columnGroups?: Record<string, string>, importRecipe?: ImportRecipe) => void;
  onClose: () => void;
  /** The merge configuration that produced this page's current data, if
   *  any — reopening the panel replays it automatically (re-lists the
   *  sheet's tabs, re-picks the same base/linked tabs and key columns) so
   *  editing one thing about an existing merge doesn't mean starting over. */
  initialRecipe?: ImportRecipe;
}

type Mode = "replace" | "append" | "merge";
type MergeSource = "tabs" | "files";

interface TabLink {
  id: string;
  tabTitle: string;
  table: ParsedFile | null;
  keyPairs: KeyPair[];
  picks: Record<string, JoinAgg>;
  includeUnmatched: boolean;
  busy: boolean;
  error: string | null;
}

interface FileLink {
  id: string;
  table: ParsedFile | null;
  keyPairs: KeyPair[];
  picks: Record<string, JoinAgg>;
  includeUnmatched: boolean;
}

function newKeyPairs(): KeyPair[] {
  return [{ baseKey: "", otherKey: "" }];
}

export function ImportPanel({ onApply, onClose, initialRecipe }: Props) {
  const [mode, setMode] = useState<Mode>(initialRecipe ? "merge" : "replace");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedFromRecipe, setLoadedFromRecipe] = useState(false);

  // replace / append
  const [tables, setTables] = useState<ParsedFile[]>([]);
  const [appendLinkUrl, setAppendLinkUrl] = useState("");

  // merge — "tabs" sub-mode: one spreadsheet, pick tabs from a list
  const [mergeSource, setMergeSource] = useState<MergeSource>("tabs");
  const [sheetUrl, setSheetUrl] = useState("");
  const [tabs, setTabs] = useState<SheetTab[] | null>(null);
  const [baseTabTitle, setBaseTabTitle] = useState<string | null>(null);
  const [base, setBase] = useState<ParsedFile | null>(null);
  const [basePicks, setBasePicks] = useState<Record<string, JoinAgg>>({});
  const [tabLinks, setTabLinks] = useState<TabLink[]>([]);

  // merge — "files" sub-mode: uploaded files instead of a shared spreadsheet
  const [fileBase, setFileBase] = useState<ParsedFile | null>(null);
  const [fileBasePicks, setFileBasePicks] = useState<Record<string, JoinAgg>>({});
  const [fileLinks, setFileLinks] = useState<FileLink[]>([]);

  // Every base key column across every configured link — used both to
  // aggregate the base table before merging (see apply()) and as the
  // "don't offer these as pickable value columns" exclusion list for
  // ColumnPicksEditor, since a key column is already always carried
  // through.
  const baseKeyColumns = [...new Set(tabLinks.flatMap((l) => l.keyPairs.map((p) => p.baseKey).filter(Boolean)))];
  const fileBaseKeyColumns = [...new Set(fileLinks.flatMap((l) => l.keyPairs.map((p) => p.baseKey).filter(Boolean)))];

  // Replays the last merge automatically on open — see initialRecipe doc.
  useEffect(() => {
    if (!initialRecipe) return;
    (async () => {
      setBusy(true);
      setError(null);
      try {
        setSheetUrl(initialRecipe.sheetUrl);
        const id = extractSheetId(initialRecipe.sheetUrl);
        if (!id) throw new Error("Saved sheet link looks invalid.");
        const list = await listSheetTabs(id);
        setTabs(list);

        setBaseTabTitle(initialRecipe.baseTab);
        const baseData = await fetchSheetAsRows(initialRecipe.sheetUrl, initialRecipe.baseTab);
        const baseTable: ParsedFile = { fileName: initialRecipe.baseTab, rows: baseData.rows, columns: baseData.columns };
        setBase(baseTable);
        setBasePicks((initialRecipe.basePicks as Record<string, JoinAgg> | undefined) ?? defaultPicksForKeys(baseTable, []));

        const restoredLinks = await Promise.all(
          initialRecipe.links.map(async (link) => {
            const id2 = crypto.randomUUID();
            try {
              const data = await fetchSheetAsRows(initialRecipe.sheetUrl, link.tabTitle);
              const table: ParsedFile = { fileName: link.tabTitle, rows: data.rows, columns: data.columns };
              return {
                id: id2,
                tabTitle: link.tabTitle,
                table,
                keyPairs: link.keyPairs,
                picks: (link.picks as Record<string, JoinAgg> | undefined) ?? defaultPicksForKeys(table, []),
                includeUnmatched: link.includeUnmatched ?? false,
                busy: false,
                error: null,
              } satisfies TabLink;
            } catch (e) {
              return {
                id: id2,
                tabTitle: link.tabTitle,
                table: null,
                keyPairs: link.keyPairs,
                picks: {},
                includeUnmatched: link.includeUnmatched ?? false,
                busy: false,
                error: e instanceof Error ? e.message : "Couldn't reload this tab",
              } satisfies TabLink;
            }
          })
        );
        setTabLinks(restoredLinks);
        setLoadedFromRecipe(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't reload the previous import settings — start fresh below.");
      } finally {
        setBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetAll() {
    setError(null);
    setTables([]);
    setAppendLinkUrl("");
    setSheetUrl("");
    setTabs(null);
    setBaseTabTitle(null);
    setBase(null);
    setBasePicks({});
    setTabLinks([]);
    setFileBase(null);
    setFileBasePicks({});
    setFileLinks([]);
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
      const { rows, columns } = await fetchSheetAsRows(appendLinkUrl.trim());
      setTables((prev) => [...prev, { fileName: `Sheet ${prev.length + 1}`, rows, columns }]);
      setAppendLinkUrl("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't fetch that sheet");
    } finally {
      setBusy(false);
    }
  }

  // ---- merge / tabs sub-mode ----

  async function handleFetchTabs() {
    const id = extractSheetId(sheetUrl.trim());
    if (!id) {
      setError("That doesn't look like a Google Sheet link.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const list = await listSheetTabs(id);
      setTabs(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read this spreadsheet's tabs — make sure Google Drive is connected (see README).");
    } finally {
      setBusy(false);
    }
  }

  async function handlePickBaseTab(title: string) {
    setBaseTabTitle(title);
    setBase(null);
    setBusy(true);
    setError(null);
    try {
      const { rows, columns } = await fetchSheetAsRows(sheetUrl.trim(), title);
      const table: ParsedFile = { fileName: title, rows, columns };
      setBase(table);
      setBasePicks(defaultPicksForKeys(table, []));
    } catch (e) {
      setError(e instanceof Error ? e.message : `Couldn't read the "${title}" tab`);
    } finally {
      setBusy(false);
    }
  }

  function addTabLink() {
    const unused = (tabs ?? []).find((t) => t.title !== baseTabTitle && !tabLinks.some((l) => l.tabTitle === t.title));
    if (!unused) return;
    const id = crypto.randomUUID();
    setTabLinks((prev) => [...prev, { id, tabTitle: unused.title, table: null, keyPairs: newKeyPairs(), picks: {}, includeUnmatched: false, busy: true, error: null }]);
    fetchTabLinkData(id, unused.title);
  }

  async function fetchTabLinkData(id: string, tabTitle: string) {
    try {
      const { rows, columns } = await fetchSheetAsRows(sheetUrl.trim(), tabTitle);
      const table: ParsedFile = { fileName: tabTitle, rows, columns };
      setTabLinks((prev) => prev.map((l) => (l.id === id ? { ...l, table, picks: defaultPicksForKeys(table, []), busy: false } : l)));
    } catch (e) {
      setTabLinks((prev) => prev.map((l) => (l.id === id ? { ...l, error: e instanceof Error ? e.message : "Couldn't load this tab", busy: false } : l)));
    }
  }

  async function changeTabLinkTitle(id: string, newTitle: string) {
    setTabLinks((prev) => prev.map((l) => (l.id === id ? { ...l, tabTitle: newTitle, table: null, keyPairs: newKeyPairs(), picks: {}, busy: true, error: null } : l)));
    await fetchTabLinkData(id, newTitle);
  }

  // ---- merge / files sub-mode ----

  async function handleFileBase(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const table = await parseFile(fileList[0]);
      setFileBase(table);
      setFileBasePicks(defaultPicksForKeys(table, []));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file");
    } finally {
      setBusy(false);
    }
  }

  function addFileLink() {
    setFileLinks((prev) => [...prev, { id: crypto.randomUUID(), table: null, keyPairs: newKeyPairs(), picks: {}, includeUnmatched: false }]);
  }

  async function handleFileLinkFile(id: string, fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    try {
      const parsed = await parseFile(fileList[0]);
      setFileLinks((prev) => prev.map((l) => (l.id === id ? { ...l, table: parsed, picks: defaultPicksForKeys(parsed, []) } : l)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file");
    }
  }

function describeMatchStats(stats: MergeMatchStats[]): string | null {
  const problems = stats.filter((s) => s.unmatchedBaseRows > 0 || s.unmatchedLookupRows > 0);
  if (problems.length === 0) return null;
  return problems
    .map((s) => {
      const parts: string[] = [];
      if (s.unmatchedBaseRows > 0) parts.push(`${s.unmatchedBaseRows} of ${s.totalBaseRows} base rows found no match`);
      if (s.unmatchedLookupRows > 0) parts.push(`${s.unmatchedLookupRows} of ${s.totalLookupRows} "${s.tableFileName}" entries were never used`);
      return `${s.tableFileName}: ${parts.join(", ")}.`;
    })
    .join(" ");
}

function apply() {
    if (mode === "replace" && tables[0]) {
      onApply(tables[0].rows, tables[0].columns);
    } else if (mode === "append" && tables.length > 0) {
      const { rows, columns } = appendTables(tables);
      onApply(rows, columns);
    } else if (mode === "merge" && mergeSource === "tabs" && base) {
      const ready = tabLinks.filter((l): l is TabLink & { table: ParsedFile } => !!l.table && l.keyPairs.every((p) => p.baseKey && p.otherKey));
      // Every side gets collapsed to one row per its own matching key(s)
      // first — a no-op when a side already has unique keys, and exactly
      // what prevents a value from getting copied onto more rows than it
      // should when a side naturally has several rows per key (e.g.
      // several transactions on the same day for the same item). Only the
      // columns explicitly checked in each side's picker are kept —
      // everything else (e.g. a raw export's mostly-empty columns nobody
      // asked for) is dropped, keeping the merged result small and exact.
      const mergeBaseKeys = [...new Set(ready.flatMap((l) => l.keyPairs.map((p) => p.baseKey)))];
      const basePickCols = Object.keys(basePicks).filter((c) => !mergeBaseKeys.includes(c));
      const aggregatedBase = aggregateForJoin(base, mergeBaseKeys, { keepColumns: basePickCols, aggOverrides: basePicks });
      const joins: LookupJoin[] = ready.map((l) => {
        const otherKeys = l.keyPairs.map((p) => p.otherKey);
        const pickCols = Object.keys(l.picks).filter((c) => !otherKeys.includes(c));
        return {
          table: aggregateForJoin(l.table, otherKeys, { keepColumns: pickCols, aggOverrides: l.picks }),
          baseKeys: l.keyPairs.map((p) => p.baseKey),
          otherKeys,
          includeUnmatched: l.includeUnmatched,
        };
      });
      const { rows, columns, columnGroups, matchStats } = mergeManyTables(aggregatedBase, joins);
      const summary = describeMatchStats(matchStats);
      if (summary) showToast(summary, { type: "info", durationMs: 12000 });
      const recipe: ImportRecipe = {
        sheetUrl: sheetUrl.trim(),
        baseTab: baseTabTitle ?? "",
        basePicks,
        links: ready.map((l) => ({ tabTitle: l.tabTitle, keyPairs: l.keyPairs, picks: l.picks, includeUnmatched: l.includeUnmatched })),
      };
      onApply(rows, columns, columnGroups, recipe);
    } else if (mode === "merge" && mergeSource === "files" && fileBase) {
      const ready = fileLinks.filter((l): l is FileLink & { table: ParsedFile } => !!l.table && l.keyPairs.every((p) => p.baseKey && p.otherKey));
      const mergeBaseKeys = [...new Set(ready.flatMap((l) => l.keyPairs.map((p) => p.baseKey)))];
      const basePickCols = Object.keys(fileBasePicks).filter((c) => !mergeBaseKeys.includes(c));
      const aggregatedBase = aggregateForJoin(fileBase, mergeBaseKeys, { keepColumns: basePickCols, aggOverrides: fileBasePicks });
      const joins: LookupJoin[] = ready.map((l) => {
        const otherKeys = l.keyPairs.map((p) => p.otherKey);
        const pickCols = Object.keys(l.picks).filter((c) => !otherKeys.includes(c));
        return {
          table: aggregateForJoin(l.table, otherKeys, { keepColumns: pickCols, aggOverrides: l.picks }),
          baseKeys: l.keyPairs.map((p) => p.baseKey),
          otherKeys,
          includeUnmatched: l.includeUnmatched,
        };
      });
      const { rows, columns, columnGroups, matchStats } = mergeManyTables(aggregatedBase, joins);
      const summary = describeMatchStats(matchStats);
      if (summary) showToast(summary, { type: "info", durationMs: 12000 });
      onApply(rows, columns, columnGroups);
    }
    onClose();
  }

  const tabsReadyCount = tabLinks.filter((l) => l.table && l.keyPairs.every((p) => p.baseKey && p.otherKey)).length;
  const filesReadyCount = fileLinks.filter((l) => l.table && l.keyPairs.every((p) => p.baseKey && p.otherKey)).length;
  const canApply =
    (mode === "replace" && tables.length > 0) ||
    (mode === "append" && tables.length > 0) ||
    (mode === "merge" && mergeSource === "tabs" && base !== null && tabsReadyCount > 0) ||
    (mode === "merge" && mergeSource === "files" && fileBase !== null && filesReadyCount > 0);

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
            <div className="flex gap-1 bg-[var(--panel-raised)] p-1 rounded-lg text-xs">
              {([
                { key: "tabs" as MergeSource, label: "Tabs in one Google Sheet" },
                { key: "files" as MergeSource, label: "Separate files" },
              ]).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => {
                    setMergeSource(opt.key);
                    setError(null);
                  }}
                  className={`flex-1 py-1.5 rounded-md ${
                    mergeSource === opt.key ? "bg-[var(--accent-dim)] border border-[var(--accent-border)] text-[var(--text-h)]" : "text-[var(--text-dim)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <p className="text-[11px] text-[var(--text-dim)]">
              Rows sharing the same matching value(s) get totaled together automatically before linking (e.g. several transactions on the
              same day for the same item become one summed row) — so matching by more than one column together (e.g. Product AND Day) still
              gives you correct totals even when either sheet has several rows per key.
            </p>

            {mergeSource === "tabs" ? (
              <div className="space-y-3">
                {loadedFromRecipe && (
                  <p className="text-[11px] text-[var(--accent)] flex items-center gap-1">
                    <Link2 size={11} /> Loaded your last saved import settings for this page — edit anything below and re-apply.
                  </p>
                )}
                <p className="text-xs text-[var(--text-dim)]">
                  Paste one Google Sheet link, pick which tab is your main table, then pick any other tabs in that same
                  sheet to link onto it.
                </p>

                <div className="flex gap-2">
                  <input
                    type="url"
                    value={sheetUrl}
                    onChange={(e) => {
                      setSheetUrl(e.target.value);
                      setTabs(null);
                      setBaseTabTitle(null);
                      setBase(null);
                      setTabLinks([]);
                    }}
                    placeholder="Paste the Google Sheet link..."
                    className="flex-1 bg-[var(--panel-raised)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-sm"
                  />
                  <button
                    onClick={handleFetchTabs}
                    disabled={busy || !sheetUrl.trim()}
                    className="px-3 rounded-lg bg-[var(--panel-raised)] border border-[var(--border)] text-sm text-[var(--text-dim)] hover:text-[var(--text-h)] disabled:opacity-40 flex items-center gap-1 shrink-0"
                  >
                    {busy ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />} List tabs
                  </button>
                </div>

                {tabs && tabs.length > 0 && (
                  <>
                    <div>
                      <p className="text-[10px] text-[var(--text-dim)] mb-1">Main table (base tab)</p>
                      <div className="relative">
                        <select
                          value={baseTabTitle ?? ""}
                          onChange={(e) => handlePickBaseTab(e.target.value)}
                          className="w-full appearance-none bg-[var(--panel-raised)] border border-[var(--border)] rounded-lg px-2.5 py-2 text-sm"
                        >
                          <option value="" disabled>Pick a tab...</option>
                          {tabs.map((t) => <option key={t.sheetId} value={t.title}>{t.title}</option>)}
                        </select>
                        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)] pointer-events-none" />
                      </div>
                      {base && (
                        <p className="text-xs text-[var(--text-dim)] mt-1">{base.rows.length} rows · {base.columns.length} cols</p>
                      )}
                    </div>

                    {base && (
                      <ColumnPicksEditor
                        table={base}
                        keyColumns={baseKeyColumns}
                        picks={basePicks}
                        onChange={setBasePicks}
                      />
                    )}

                    {base && (
                      <div className="space-y-3">
                        <p className="text-xs text-[var(--text-dim)]">Linked tabs</p>
                        {tabLinks.map((link) => (
                          <div key={link.id} className="border border-[var(--border)] rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="relative flex-1">
                                <select
                                  value={link.tabTitle}
                                  onChange={(e) => changeTabLinkTitle(link.id, e.target.value)}
                                  className="w-full appearance-none bg-[var(--panel-raised)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-sm"
                                >
                                  {tabs
                                    .filter((t) => t.title === link.tabTitle || (t.title !== baseTabTitle && !tabLinks.some((l) => l.tabTitle === t.title)))
                                    .map((t) => <option key={t.sheetId} value={t.title}>{t.title}</option>)}
                                </select>
                                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)] pointer-events-none" />
                              </div>
                              <button onClick={() => setTabLinks((prev) => prev.filter((l) => l.id !== link.id))} className="text-[var(--text-dim)] hover:text-[var(--bad)] shrink-0">
                                <Trash2 size={13} />
                              </button>
                            </div>
                            {link.busy && <p className="text-xs text-[var(--text-dim)] flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> Loading tab...</p>}
                            {link.error && <p className="text-xs text-[var(--bad)]">{link.error}</p>}
                            {link.table && (
                              <>
                                <KeyPairsEditor
                                  baseColumns={base.columns}
                                  otherColumns={link.table.columns}
                                  baseLabel="Base column"
                                  otherLabel="Matches this tab's column"
                                  pairs={link.keyPairs}
                                  onChange={(pairs) => setTabLinks((prev) => prev.map((l) => (l.id === link.id ? { ...l, keyPairs: pairs } : l)))}
                                />
                                <ColumnPicksEditor
                                  table={link.table}
                                  keyColumns={link.keyPairs.map((p) => p.otherKey).filter(Boolean)}
                                  picks={link.picks}
                                  onChange={(picks) => setTabLinks((prev) => prev.map((l) => (l.id === link.id ? { ...l, picks } : l)))}
                                />
                                <label className="flex items-center gap-2 text-[11px] text-[var(--text-dim)]">
                                  <input
                                    type="checkbox"
                                    checked={link.includeUnmatched}
                                    onChange={(e) => setTabLinks((prev) => prev.map((l) => (l.id === link.id ? { ...l, includeUnmatched: e.target.checked } : l)))}
                                  />
                                  Also keep "{link.tabTitle}" entries that don't have a matching row in the base table (as extra rows)
                                </label>
                              </>
                            )}
                          </div>
                        ))}
                        {tabLinks.length < tabs.length - 1 && (
                          <button
                            onClick={addTabLink}
                            className="w-full flex items-center justify-center gap-1.5 border border-dashed border-[var(--border)] rounded-lg py-2 text-xs text-[var(--text-dim)] hover:border-[var(--accent-border)] hover:text-[var(--text-h)]"
                          >
                            <Plus size={13} /> Link another tab
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-[var(--text-dim)]">
                  Upload one base file, then upload any number of other files to link onto it by matching column(s).
                </p>
                <div>
                  <p className="text-[10px] text-[var(--text-dim)] mb-1">Main table (base file)</p>
                  {!fileBase ? (
                    <label className="flex items-center justify-center gap-2 border border-dashed border-[var(--border)] rounded-lg py-3 text-sm text-[var(--text-dim)] cursor-pointer hover:border-[var(--accent-border)]">
                      <Upload size={14} />
                      {busy ? "Reading..." : "Choose file"}
                      <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => handleFileBase(e.target.files)} />
                    </label>
                  ) : (
                    <div className="flex items-center justify-between bg-[var(--panel-raised)] rounded-md px-2.5 py-1.5 text-xs">
                      <span>{fileBase.fileName} — {fileBase.rows.length} rows · {fileBase.columns.length} cols</span>
                      <button onClick={() => setFileBase(null)} className="text-[var(--text-dim)] hover:text-[var(--bad)]">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>

                {fileBase && (
                  <ColumnPicksEditor
                    table={fileBase}
                    keyColumns={fileBaseKeyColumns}
                    picks={fileBasePicks}
                    onChange={setFileBasePicks}
                  />
                )}

                {fileBase && (
                  <div className="space-y-3">
                    <p className="text-xs text-[var(--text-dim)]">Linked files</p>
                    {fileLinks.map((link) => (
                      <div key={link.id} className="border border-[var(--border)] rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-[var(--text-dim)]">Linked file</span>
                          <button onClick={() => setFileLinks((prev) => prev.filter((l) => l.id !== link.id))} className="text-[var(--text-dim)] hover:text-[var(--bad)]">
                            <Trash2 size={13} />
                          </button>
                        </div>
                        {!link.table ? (
                          <label className="flex items-center justify-center gap-2 border border-dashed border-[var(--border)] rounded-lg py-2.5 text-sm text-[var(--text-dim)] cursor-pointer hover:border-[var(--accent-border)]">
                            <Upload size={14} />
                            Choose file
                            <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => handleFileLinkFile(link.id, e.target.files)} />
                          </label>
                        ) : (
                          <>
                            <div className="flex items-center justify-between bg-[var(--panel-raised)] rounded-md px-2.5 py-1.5 text-xs">
                              <span>{link.table.fileName} — {link.table.rows.length} rows · {link.table.columns.length} cols</span>
                              <button onClick={() => setFileLinks((prev) => prev.map((l) => (l.id === link.id ? { ...l, table: null, keyPairs: newKeyPairs(), picks: {} } : l)))} className="text-[var(--text-dim)] hover:text-[var(--bad)]">
                                <Trash2 size={13} />
                              </button>
                            </div>
                            <KeyPairsEditor
                              baseColumns={fileBase.columns}
                              otherColumns={link.table.columns}
                              baseLabel="Base column"
                              otherLabel="Matches this file's column"
                              pairs={link.keyPairs}
                              onChange={(pairs) => setFileLinks((prev) => prev.map((l) => (l.id === link.id ? { ...l, keyPairs: pairs } : l)))}
                            />
                            <ColumnPicksEditor
                              table={link.table}
                              keyColumns={link.keyPairs.map((p) => p.otherKey).filter(Boolean)}
                              picks={link.picks}
                              onChange={(picks) => setFileLinks((prev) => prev.map((l) => (l.id === link.id ? { ...l, picks } : l)))}
                            />
                            <label className="flex items-center gap-2 text-[11px] text-[var(--text-dim)]">
                              <input
                                type="checkbox"
                                checked={link.includeUnmatched}
                                onChange={(e) => setFileLinks((prev) => prev.map((l) => (l.id === link.id ? { ...l, includeUnmatched: e.target.checked } : l)))}
                              />
                              Also keep entries from this file that don't have a matching row in the base table (as extra rows)
                            </label>
                          </>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={addFileLink}
                      className="w-full flex items-center justify-center gap-1.5 border border-dashed border-[var(--border)] rounded-lg py-2 text-xs text-[var(--text-dim)] hover:border-[var(--accent-border)] hover:text-[var(--text-h)]"
                    >
                      <Plus size={13} /> Add another file to link
                    </button>
                  </div>
                )}
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
