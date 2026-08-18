import { useMemo, useState } from "react";
import { Download, Trash2, Settings2 } from "lucide-react";
import type { DataRow, FilterConfig, Measure, MatrixConfig } from "../types";
import { exportRowsToExcel } from "../lib/exportExcel";
import { aggregateColumn } from "../lib/aggregate";
import { computeMeasureValue } from "../lib/measures";
import { formatNumber } from "../lib/numeric";
import { applyWidgetFilter } from "../lib/widgetFilter";
import { WidgetFilterControl } from "./WidgetFilterControl";
import { ExplainButton } from "./ExplainButton";
import { GroupedColumnSelect } from "./GroupedColumnSelect";
import { ValueSourceSelect } from "./ValueSourceSelect";

interface Props {
  config: MatrixConfig;
  rows: DataRow[];
  columns: string[];
  measures: Measure[];
  canEdit: boolean;
  canExport?: boolean;
  onChange: (config: MatrixConfig) => void;
  onRemove: () => void;
  /** Click a row or column label to filter every other widget on the page
   *  by that value — the same cross-filtering Chart already has. */
  onCrossFilter?: (column: string, value: string) => void;
  activeFilters?: FilterConfig[];
  /** Department/team name, used only to give the AI explain button a bit
   *  more context — purely cosmetic if omitted. */
  deptName?: string;
}

function cellValue(rows: DataRow[], config: MatrixConfig, measures: Measure[]): number {
  const source = config.value;
  if (source.kind === "column") {
    return aggregateColumn(rows, source.column, source.agg);
  }
  const measure = measures.find((m) => m.id === source.measureId);
  if (!measure) return 0;
  return computeMeasureValue(measure, rows, measures);
}

function explainMatrixPrompt(config: MatrixConfig, measures: Measure[]): string {
  const source = config.value;
  const valueLabel =
    source.kind === "column"
      ? `${source.agg} على عمود "${source.column}"`
      : `المقياس (Measure) "${measures.find((m) => m.id === source.measureId)?.name ?? source.measureId}"`;
  return `جاوب باللغة العربية العامية البسيطة فقط، من غير مصطلحات تقنية. اشرح للمستخدم إيه اللي جدول المصفوفة (Matrix) اسمه "${config.title}" ده بيعمله بالظبط: هو بيوري تقاطع "${config.rowCol}" في الصفوف مع "${config.colCol}" في الأعمدة، وكل خلية فيه قيمتها هي ${valueLabel}. وضّح ده كله ببساطة زي ما تشرحله لزميل مش تقني، وإيه فايدته تحديدًا في شغله، في 3 إلى 4 جمل بسيطة وقصيرة.`;
}

export function MatrixCard({ config, rows, columns, measures, canEdit, canExport = true, onChange, onRemove, onCrossFilter, activeFilters = [], deptName = "" }: Props) {
  // Starts open for a brand-new matrix (no columns picked yet), same as Chart.
  const [showEditor, setShowEditor] = useState(
    !config.rowCol || !config.colCol || (config.value.kind === "column" && !config.value.column)
  );
  const hasColumns = Boolean(
    config.rowCol && config.colCol && (config.value.kind !== "column" || config.value.column)
  );

  // Memoized: this used to recompute the full row/col cross-tab (an O(rows
  // × rowKeys × colKeys) scan) on every render, including ones triggered by
  // just typing in the title — that's what made editing feel like it froze
  // the page on large sheets.
  const filteredRows = applyWidgetFilter(rows, config.filter);

  const { rowKeys, colKeys, grid } = useMemo(() => {
    if (!hasColumns) return { rowKeys: [] as string[], colKeys: [] as string[], grid: [] as number[][] };
    const rk = Array.from(new Set(filteredRows.map((r) => String(r[config.rowCol] ?? "")))).sort();
    const ck = Array.from(new Set(filteredRows.map((r) => String(r[config.colCol] ?? "")))).sort();
    const g = rk.map((r) =>
      ck.map((c) => {
        const cellRows = filteredRows.filter((row) => String(row[config.rowCol] ?? "") === r && String(row[config.colCol] ?? "") === c);
        return cellValue(cellRows, config, measures);
      })
    );
    return { rowKeys: rk, colKeys: ck, grid: g };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredRows, config.rowCol, config.colCol, config.value, measures, hasColumns]);

  const exportRows: DataRow[] = rowKeys.map((rk, i) => {
    const row: DataRow = { [config.rowCol]: rk };
    colKeys.forEach((ck, j) => (row[ck] = grid[i][j]));
    return row;
  });

  const valueLabel =
    config.value.kind === "column"
      ? `${config.value.agg} ${config.value.column}`
      : measures.find((m) => m.id === (config.value as { measureId: string }).measureId)?.name ?? "value";

  return (
    <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-4 flex flex-col h-full">
      <div className="flex items-start justify-between gap-2 mb-3">
        {canEdit ? (
          <input
            value={config.title}
            onChange={(e) => onChange({ ...config, title: e.target.value })}
            className="bg-transparent text-sm font-medium text-[var(--text-h)] outline-none flex-1"
          />
        ) : (
          <h3 className="text-sm">{config.title}</h3>
        )}
        <div className="flex items-center gap-1 shrink-0">
          <ExplainButton
            prompt={explainMatrixPrompt(config, measures)}
            context={{ departmentName: deptName, rows, columns }}
          />
          {canExport && (
            <button onClick={() => exportRowsToExcel(exportRows, config.title.replace(/\s+/g, "_"))} title="Export to Excel"
              className="p-1.5 rounded-md text-[var(--text-dim)] hover:bg-[var(--panel-raised)] hover:text-[var(--text-h)]">
              <Download size={14} />
            </button>
          )}
          {canEdit && (
            <>
              <button onClick={() => setShowEditor((s) => !s)} title="Edit"
                className="p-1.5 rounded-md text-[var(--text-dim)] hover:bg-[var(--panel-raised)] hover:text-[var(--text-h)]">
                <Settings2 size={14} />
              </button>
              <button onClick={onRemove} title="Remove"
                className="p-1.5 rounded-md text-[var(--text-dim)] hover:bg-[var(--panel-raised)] hover:text-[var(--bad)]">
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {canEdit && showEditor && (
        <div className="mb-3 p-3 rounded-lg bg-[var(--panel-raised)] border border-[var(--border)] flex flex-wrap gap-2 text-xs">
          <GroupedColumnSelect
            columns={columns}
            value={config.rowCol}
            onChange={(v) => onChange({ ...config, rowCol: v })}
            placeholder="rows…"
            className="bg-[var(--panel)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]"
          />
          <GroupedColumnSelect
            columns={columns}
            value={config.colCol}
            onChange={(v) => onChange({ ...config, colCol: v })}
            placeholder="cols…"
            className="bg-[var(--panel)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]"
          />
          <ValueSourceSelect columns={columns} measures={measures} value={config.value} onChange={(value) => onChange({ ...config, value })} />
          <select
            value={config.numberFormat ?? "auto"}
            onChange={(e) => onChange({ ...config, numberFormat: e.target.value as "auto" | "full" })}
            className="bg-[var(--panel)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]"
          >
            <option value="auto">Auto (1.2K / 3.4M)</option>
            <option value="full">Full number</option>
          </select>
          <WidgetFilterControl
            columns={columns}
            rows={rows}
            filter={config.filter}
            onChange={(filter) => onChange({ ...config, filter })}
            className="bg-[var(--panel)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]"
          />
        </div>
      )}

      {!hasColumns ? (
        <div className="flex-1 min-h-0 flex items-center justify-center text-center text-xs text-[var(--text-dim)] border border-dashed border-[var(--border)] rounded-lg p-4">
          Pick rows, columns, and a value above to build this matrix.
        </div>
      ) : (
      <div className="flex-1 overflow-auto min-h-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left px-2 py-1.5 text-xs uppercase tracking-wide text-[var(--text-dim)] sticky left-0 bg-[var(--panel)]">
                {config.rowCol} \ {config.colCol}
              </th>
              {colKeys.map((ck) => {
                const isActive = activeFilters.some(
                  (f) => f.column === config.colCol && (f.mode ?? "equals") === "equals" && f.value === ck
                );
                return (
                  <th
                    key={ck}
                    onClick={() => onCrossFilter?.(config.colCol, ck)}
                    title={onCrossFilter ? `Click to filter by ${config.colCol} = ${ck}` : undefined}
                    className={`text-right px-2 py-1.5 text-xs uppercase tracking-wide whitespace-nowrap ${
                      isActive ? "text-[var(--accent)]" : "text-[var(--text-dim)]"
                    } ${onCrossFilter ? "cursor-pointer hover:underline" : ""}`}
                  >
                    {ck}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rowKeys.map((rk, i) => {
              const isRowActive = activeFilters.some(
                (f) => f.column === config.rowCol && (f.mode ?? "equals") === "equals" && f.value === rk
              );
              return (
                <tr key={rk} className="border-b border-[var(--border)]/50 hover:bg-[var(--panel-raised)]">
                  <td
                    onClick={() => onCrossFilter?.(config.rowCol, rk)}
                    title={onCrossFilter ? `Click to filter by ${config.rowCol} = ${rk}` : undefined}
                    className={`px-2 py-1.5 sticky left-0 bg-[var(--panel)] font-medium ${
                      isRowActive ? "text-[var(--accent)]" : "text-[var(--text)]"
                    } ${onCrossFilter ? "cursor-pointer hover:underline" : ""}`}
                  >
                    {rk}
                  </td>
                  {grid[i].map((v, j) => (
                    <td key={j} className="px-2 py-1.5 text-right num text-[var(--text)]">
                      {formatNumber(v, config.numberFormat)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}
      <p className="text-[10px] text-[var(--text-dim)] mt-2">Values: {hasColumns ? valueLabel : "—"}</p>
    </div>
  );
}
