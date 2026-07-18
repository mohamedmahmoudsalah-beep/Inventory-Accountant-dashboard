export type Role = "admin" | "manager" | "employee" | "viewer";

export interface AllowedUser {
  email: string;
  role: Role;
}

export type ChartType = "bar" | "line" | "area" | "pie" | "scatter" | "radar" | "treemap";

export interface ChartConfig {
  id: string;
  title: string;
  type: ChartType;
  xKey: string;
  yKey: string;
  showValues?: boolean;
}

export interface FilterConfig {
  column: string;
  mode?: "equals" | "range"; // defaults to "equals" when absent
  value: string; // "All" means no filter (equals mode)
  from?: string; // range mode
  to?: string; // range mode
}

export interface DataRow {
  [column: string]: string | number;
}

export type PivotAgg = "sum" | "avg" | "count" | "max" | "min";

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
  sortByValueId?: string; // which value metric drives Top/Bottom N; defaults to values[0]
  sortDir: "desc" | "asc";
  limit: number; // Top/Bottom N
}

export interface MatrixConfig {
  id: string;
  title: string;
  rowCol: string;
  colCol: string;
  value: ValueSource;
}

export interface CardConfig {
  id: string;
  title: string;
  value: ValueSource;
}

export interface TextConfig {
  id: string;
  title: string;
  body: string;
  imageUrl?: string;
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
  lastUpdated: string | null;
  rows: DataRow[]; // raw rows as fetched/imported (calculated columns are derived, not stored here)
  columns: string[]; // raw column names
  charts: ChartConfig[];
  pivots: PivotConfig[];
  matrices: MatrixConfig[];
  cards: CardConfig[];
  texts: TextConfig[];
  measures: Measure[];
  calculatedColumns: CalculatedColumn[];
  activeFilters: FilterConfig[];
}

export interface Department {
  id: string;
  name: string;
  pages: TaskPage[];
}
