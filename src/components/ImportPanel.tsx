import { useState } from "react";
import { X, Upload, Loader2 } from "lucide-react";
import type { DataRow } from "../types";
import { parseFile, parseFiles, appendTables, mergeTables, type ParsedFile } from "../lib/importFiles";

interface Props {
  onApply: (rows: DataRow[], columns: string[]) => void;
  onClose: () => void;
}

type Mode = "replace" | "append" | "merge";

export function ImportPanel({ onApply, onClose }: Props) {
  const [mode, setMode] = useState<Mode>("replace");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // replace / append
  const [tables, setTables] = useState<ParsedFile[]>([]);

  // merge
  const [tableA, setTableA] = useState<ParsedFile | null>(null);
  const [tableB, setTableB] = useState<ParsedFile | null>(null);
  const [keyA, setKeyA] = useState("");
  const [keyB, setKeyB] = useState("");

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

  async function handleMergeFile(which: "A" | "B", fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const parsed = await parseFile(fileList[0]);
      if (which === "A") {
        setTableA(parsed);
        setKeyA(parsed.columns[0] ?? "");
      } else {
        setTableB(parsed);
        setKeyB(parsed.columns[0] ?? "");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file");
    } finally {
      setBusy(false);
    }
  }

  function apply() {
    if (mode === "replace" && tables[0]) {
      onApply(tables[0].rows, tables[0].columns);
    } else if (mode === "append" && tables.length > 0) {
      const { rows, columns } = appendTables(tables);
      onApply(rows, columns);
    } else if (mode === "merge" && tableA && tableB && keyA && keyB) {
      const { rows, columns } = mergeTables(tableA, tableB, keyA, keyB);
      onApply(rows, columns);
    }
    onClose();
  }

  const canApply =
    (mode === "replace" && tables.length > 0) ||
    (mode === "append" && tables.length > 0) ||
    (mode === "merge" && tableA && tableB && keyA && keyB);

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
                setError(null);
                setTables([]);
                setTableA(null);
                setTableB(null);
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
                ? "Upload one .xlsx, .xls, or .csv file. It will replace this page's current data."
                : "Upload one or more files with similar columns — their rows get stacked into a single table."}
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
              Upload two files and pick the matching column in each (e.g. "Employee ID" in both) — columns from file B get added onto file A's rows.
            </p>

            <div>
              <p className="text-xs text-[var(--text-dim)] mb-1">File A (base table)</p>
              <label className="flex items-center justify-center gap-2 border border-dashed border-[var(--border)] rounded-lg py-3 text-sm text-[var(--text-dim)] cursor-pointer hover:border-[var(--accent-border)]">
                <Upload size={14} />
                {tableA ? tableA.fileName : "Choose file"}
                <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => handleMergeFile("A", e.target.files)} />
              </label>
              {tableA && (
                <select
                  value={keyA}
                  onChange={(e) => setKeyA(e.target.value)}
                  className="mt-2 w-full bg-[var(--panel-raised)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-sm"
                >
                  {tableA.columns.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </div>

            <div>
              <p className="text-xs text-[var(--text-dim)] mb-1">File B (adds columns onto A)</p>
              <label className="flex items-center justify-center gap-2 border border-dashed border-[var(--border)] rounded-lg py-3 text-sm text-[var(--text-dim)] cursor-pointer hover:border-[var(--accent-border)]">
                <Upload size={14} />
                {tableB ? tableB.fileName : "Choose file"}
                <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => handleMergeFile("B", e.target.files)} />
              </label>
              {tableB && (
                <select
                  value={keyB}
                  onChange={(e) => setKeyB(e.target.value)}
                  className="mt-2 w-full bg-[var(--panel-raised)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-sm"
                >
                  {tableB.columns.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </div>
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
