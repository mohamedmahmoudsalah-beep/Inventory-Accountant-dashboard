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
}

/** Groups options the same way it groups anything: everything before the
 *  first "/" in a column name becomes a group header, the rest becomes the
 *  option's label within it — so "Stock move/Product/Name" and "Stock
 *  move/Reference" land together under a "Stock move" group instead of
 *  sitting as two unrelated entries in one long alphabetical list. Columns
 *  with no "/" (e.g. a plain "Date" or "Category" from a merged lookup
 *  sheet) stay as flat top-level options — this is exactly the shape
 *  Odoo-style exports and this app's own Merge/Link feature already
 *  produce, so no extra tagging or configuration is needed to get grouping
 *  "for free". Mirrors Excel's PivotTable field list, where fields are
 *  grouped by the table they came from. */
export function GroupedColumnSelect({ columns, value, onChange, extraGroup, className, placeholder, disabled, noneOption }: Props) {
  const { ungrouped, groups } = useMemo(() => {
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
    return { ungrouped: flat, groups: [...groupMap.entries()] };
  }, [columns]);

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
      {groups.map(([label, cols]) => (
        <optgroup key={label} label={label}>
          {cols.map((c) => <option key={c} value={c}>{c.slice(label.length + 1)}</option>)}
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
