export type Role = "admin" | "viewer";

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
  value: string; // "All" means no filter
}

export interface DataRow {
  [column: string]: string | number;
}

export interface TaskPage {
  id: string;
  name: string;
  sourceType?: "manual" | "csv-link" | "drive";
  sheetUrl: string;
  lastUpdated: string | null;
  rows: DataRow[];
  columns: string[];
  charts: ChartConfig[];
  activeFilters: FilterConfig[];
}

export interface Department {
  id: string;
  name: string;
  pages: TaskPage[];
}
