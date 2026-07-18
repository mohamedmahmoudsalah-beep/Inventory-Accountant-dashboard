export type Role = "admin" | "manager" | "employee" | "viewer";

export interface AllowedUser {
  email: string;
  role: Role;
}

export type ChartType = "bar" | "line" | "area" | "pie" | "scatter" | "radar";

export interface ChartConfig {
  id: string;
  title: string;
  type: ChartType;
  xKey: string;
  yKey: string;
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

export interface PivotConfig {
  id: string;
  title: string;
  groupCols: string[]; // 1-2 columns to group by (nested)
  valueCol: string;
  agg: PivotAgg;
  sortDir: "desc" | "asc";
  limit: number; // Top/Bottom N
}

export interface TaskPage {
  id: string;
  name: string;
  sourceType?: "manual" | "csv-link" | "drive";
  sheetUrl: string;
  sheetTabTitle?: string;
  lastUpdated: string | null;
  rows: DataRow[];
  columns: string[];
  charts: ChartConfig[];
  pivots: PivotConfig[];
  activeFilters: FilterConfig[];
}

export interface Department {
  id: string;
  name: string;
  pages: TaskPage[];
}
