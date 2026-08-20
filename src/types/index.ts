import type { NumberFormatMode } from "../lib/numeric";

export type Role = "admin" | "manager" | "employee" | "viewer";

export interface AllowedUser {
  email: string;
  role: Role;
  /** Which page IDs this person can see — only meaningful for Employee/
   *  Viewer (Admin/Manager always see everything regardless of this list).
   *  Undefined/absent means "no pages assigned yet", not "all pages". */
  pageAccess?: string[];
}

export type ChartType = "bar" | "line" | "area" | "pie" | "scatter" | "radar" | "treemap";

/** Position and size on the free-form drag grid, in grid units (not
 *  pixels) — x/y is the top-left cell, w/h is how many columns/rows it
 *  spans. See App.tsx's grid setup (12 columns) for how these translate to
 *  actual pixels on screen. */
export interface WidgetLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ChartConfig {
  id: string;
  title: string;
  type: ChartType;
  xKey: string;
  yKey: string;
  showValues?: boolean;
  layout?: WidgetLayout;
  /** Top/Bottom-N ranking, same idea as Pivot's rangeStart/rangeEnd. Left
   *  undefined on older charts (created before this existed) means "show
   *  everything", so nothing already-configured silently gets truncated. */
  sortDir?: "asc" | "desc";
  rangeStart?: number; // 1-based rank to start showing from
  rangeEnd?: number; // 1-based rank to stop showing at (inclusive)
  /** How the Y-axis and value labels display numbers. Undefined = "auto" (compact: K/M/B). */
  numberFormat?: NumberFormatMode;
}

export interface FilterConfig {
  column: string;
  mode?: "equals" | "range"; // defaults to "equals" when absent
  value: string; // "All" means no filter (equals mode)
  from?: string; // range mode
  to?: string; // range mode
}

/** A filter scoped to one widget only (Pivot, Matrix, Card), on top of
 *  whatever the page's own filter bar already applies. Absent/undefined
 *  means the widget uses the page's rows as-is. For text columns only
 *  "equals" makes sense (value = the exact match). For number columns,
 *  "gt"/"lt" compare against `value`, and "between" uses `value` as the
 *  lower bound and `value2` as the upper bound (inclusive). */
export interface WidgetFilter {
  column: string;
  mode?: "equals" | "gt" | "lt" | "between"; // defaults to "equals" when absent
  value: string;
  value2?: string; // upper bound, "between" only
}

export interface DataRow {
  [column: string]: string | number;
}

export type PivotAgg = "sum" | "avg" | "count" | "max" | "min" | "distinct";

/** A value can come straight from a column+aggregation, or reuse a saved Measure. */
export type ValueSource =
  | { kind: "column"; column: string; agg: PivotAgg }
  | { kind: "measure"; measureId: string };

export interface PivotValueMetric {
  id: string;
  label: string;
  source: ValueSource;
}

export interface PivotConfig {
  id: string;
  title: string;
  groupCols: string[]; // any number of columns to group by (nested rows)
  values: PivotValueMetric[]; // one or more aggregated value columns
  sortByValueId?: string; // which value metric drives the ranking; defaults to values[0]
  sortDir: "desc" | "asc";
  rangeStart: number; // 1-based rank to start showing from
  rangeEnd: number; // 1-based rank to stop showing at (inclusive)
  layout?: WidgetLayout;
  numberFormat?: NumberFormatMode;
  filter?: WidgetFilter;
}

export interface MatrixConfig {
  id: string;
  title: string;
  rowCol: string;
  colCol: string;
  value: ValueSource;
  layout?: WidgetLayout;
  numberFormat?: NumberFormatMode;
  filter?: WidgetFilter;
}

export interface CardConfig {
  id: string;
  title: string;
  value: ValueSource;
  layout?: WidgetLayout;
  numberFormat?: NumberFormatMode;
  filter?: WidgetFilter;
  /** Highlights the card red/green when its value crosses a threshold —
   *  e.g. "alert if stock valuation drops below 50,000,000". */
  alertThreshold?: { direction: "below" | "above"; value: number };
  /** Shows this month's value vs the previous month's, using `compareDateColumn`
   *  to bucket rows by month (same aggregation as the main value). */
  compareEnabled?: boolean;
  compareDateColumn?: string;
}

export interface TextConfig {
  id: string;
  title: string;
  body: string;
  imageUrl?: string;
  layout?: WidgetLayout;
}

/** A reusable named aggregation (optionally conditional, like a simple SUMIF), 
 *  selectable wherever a value column can be picked. */
export interface Measure {
  id: string;
  name: string;
  column: string;
  agg: PivotAgg;
  conditionColumn?: string;
  conditionValue?: string;
  /** When set, this measure is computed from a formula referencing OTHER
   *  measures and/or columns instead of a single column+aggregation — e.g.
   *  "[Total Revenue] / [Total Cost] * 100" for a margin %. Column names
   *  used this way mean sum(column) over the widget's rows; measure names
   *  mean that measure's own already-computed value. When `formula` is set,
   *  `column`/`agg`/`conditionColumn`/`conditionValue` are ignored. */
  formula?: string;
}

export interface CalculatedColumn {
  id: string;
  name: string;
  formula: string;
}

export interface TaskPage {
  id: string;
  name: string;
  sourceType?: "manual" | "csv-link" | "drive";
  sheetUrl: string;
  sheetTabTitle?: string;
  autoRefresh?: boolean;
  lastUpdated: string | null;
  rows: DataRow[]; // raw rows as fetched/imported (calculated columns are derived, not stored here)
  columns: string[]; // raw column names
  /** Which sheet/tab a column came from, when this page's data was built
   *  via Import → Merge (join): column name -> source table label (e.g.
   *  "Sales", "Scrap"). Column pickers throughout the app group by this
   *  when present — the same idea as Excel's PivotTable field list
   *  grouping fields by their source table — falling back to splitting on
   *  "/" in the column name itself (e.g. Odoo-style "Stock move/Product/
   *  Name" exports) when a page was never merged and this is absent. */
  columnGroups?: Record<string, string>;
  /** The exact "tabs in one Google Sheet" merge configuration that
   *  produced this page's current data — remembered so reopening Import →
   *  Merge to tweak something doesn't mean re-entering the sheet link and
   *  every relationship from scratch. */
  importRecipe?: ImportRecipe;
  charts: ChartConfig[];
  pivots: PivotConfig[];
  matrices: MatrixConfig[];
  cards: CardConfig[];
  texts: TextConfig[];
  widgetOrder?: string[]; // display order of widget ids across all kinds; falls back to grouped-by-kind order if absent
  measures: Measure[];
  calculatedColumns: CalculatedColumn[];
  activeFilters: FilterConfig[];
}

export interface ImportRecipe {
  sheetUrl: string;
  baseTab: string;
  /** Which of the base tab's own columns to keep, and how each combines
   *  when the chosen key repeats — column name -> aggregation. */
  basePicks?: Record<string, string>;
  links: {
    tabTitle: string;
    keyPairs: { baseKey: string; otherKey: string }[];
    /** Same idea as basePicks, for this linked tab's own columns. */
    picks?: Record<string, string>;
  }[];
}

export interface Department {
  id: string;
  name: string;
  pages: TaskPage[];
}
