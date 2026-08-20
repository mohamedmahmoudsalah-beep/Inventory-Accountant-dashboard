import { useMemo } from "react";

export interface ExtraOptionGroup {
  label: string;
  options: { value: string; label: string }[];
}

interface Props {
  columns: string[];
  value: string;
  onChange: (value: string) => void;
  extraGroup?: ExtraOptionGroup;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  /** An optional selectable (not disabled) leading option, e.g. "No widget
   *  filter" — distinct from `placeholder`, which renders disabled. */
  noneOption?: { value: string; label: string };
  /** Column name -> source sheet/table label (see TaskPage.columnGroups) —
   *  when this page's data came from Import → Merge (join), this is the
   *  real, explicit grouping to use: every column tagged with which sheet
   *  it actually came from (e.g. "Sales", "Scrap"), the same idea as
   *  Excel's PivotTable field list grouping fields by their source table.
   *  Falls back to splitting on "/" in the column name (Odoo-style
   *  exports) only when this is absent, e.g. a page that was never
   *  merged. */
  groups?: Record<string, string>;
}

/** Groups options by their real source sheet when `groups` is provided
 *  (see TaskPage.columnGroups) — falling back to treating everything
 *  before the first "/" in a column name as a group header (Odoo-style
 *  "Stock move/Product/Name" exports) only when no explicit grouping
 *  exists for this page. Mirrors Excel's PivotTable field list, where
 *  fields are grouped by the table they came from. */
export function GroupedColumnSelect({ columns, value, onChange, extraGroup, className, placeholder, disabled, noneOption, groups: sourceGroups }: Props) {
  const { ungrouped, groups } = useMemo(() => {
    if (sourceGroups && Object.keys(sourceGroups).length > 0) {
      const groupMap = new Map<string, string[]>();
      const flat: string[] = [];
      columns.forEach((col) => {
        const label = sourceGroups[col];
        if (!label) {
          flat.push(col);
        } else {
          const arr = groupMap.get(label);
          if (arr) arr.push(col);
          else groupMap.set(label, [col]);
        }
      });
      return { ungrouped: flat, groups: [...groupMap.entries()].map(([label, cols]) => [label, cols, false] as const) };
    }

    const groupMap = new Map<string, string[]>();
    const flat: string[] = [];
    columns.forEach((col) => {
      const slash = col.indexOf("/");
      if (slash === -1) {
        flat.push(col);
      } else {
        const label = col.slice(0, slash);
        const arr = groupMap.get(label);
        if (arr) arr.push(col);
        else groupMap.set(label, [col]);
      }
    });
    return { ungrouped: flat, groups: [...groupMap.entries()].map(([label, cols]) => [label, cols, true] as const) };
  }, [columns, sourceGroups]);

  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={className ?? "bg-[var(--panel)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--text)]"}
    >
      {placeholder && <option value="" disabled>{placeholder}</option>}
      {noneOption && <option value={noneOption.value}>{noneOption.label}</option>}
      {ungrouped.map((c) => <option key={c} value={c}>{c}</option>)}
      {groups.map(([label, cols, stripPrefix]) => (
        <optgroup key={label} label={label}>
          {cols.map((c) => <option key={c} value={c}>{stripPrefix ? c.slice(label.length + 1) : c}</option>)}
        </optgroup>
      ))}
      {extraGroup && extraGroup.options.length > 0 && (
        <optgroup label={extraGroup.label}>
          {extraGroup.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </optgroup>
      )}
    </select>
  );
}
