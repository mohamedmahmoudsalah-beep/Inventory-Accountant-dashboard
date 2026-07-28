import type { NumberFormatMode } from "../lib/numeric";

export type Role = "admin" | "manager" | "employee" | "viewer";

export interface AllowedUser {
  email: string;
  role: Role;
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

/** A simple "column equals value" filter scoped to one widget only (Pivot,
 *  Matrix, Card), on top of whatever the page's own filter bar already
 *  applies. Absent/undefined means the widget uses the page's rows as-is. */
export interface WidgetFilter {
  column: string;
  value: string;
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

export interface Department {
  id: string;
  name: string;
  pages: TaskPage[];
}
