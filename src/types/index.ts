import { UserRole, WidgetType, DataSourceType } from "@prisma/client";

export interface User {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: UserRole;
}

export interface BusinessUnit {
  id: string;
  name: string;
  nameAr: string | null;
  description: string | null;
  color: string;
  isActive: boolean;
  memberCount?: number;
}

export interface Dataset {
  id: string;
  name: string;
  description: string | null;
  type: DataSourceType;
  sourceConfig: any;
  refreshInterval: number | null;
  lastRefreshed: Date | null;
  rowCount: number | null;
  isActive: boolean;
  businessUnitId: string;
  createdById: string;
}

export interface Dashboard {
  id: string;
  name: string;
  description: string | null;
  layout: any;
  isPublished: boolean;
  isPublic: boolean;
  businessUnitId: string;
  createdById: string;
  widgetCount?: number;
}

export interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  config: any;
  position: { x: number; y: number; w: number; h: number };
  dashboardId: string;
  datasetId: string | null;
}

export interface ChartConfig {
  type: WidgetType;
  datasetId: string;
  xAxis?: string;
  yAxis?: string | string[];
  aggregation?: "sum" | "avg" | "count" | "min" | "max";
  filters?: FilterConfig[];
  colors?: string[];
}

export interface FilterConfig {
  column: string;
  operator: "equals" | "contains" | "greater" | "less" | "between";
  value: any;
}

export interface KPIData {
  title: string;
  value: number;
  previousValue?: number;
  format?: "number" | "currency" | "percentage";
  trend?: "up" | "down" | "neutral";
}

export interface TableColumn {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "currency";
  sortable?: boolean;
  width?: number;
}

export interface GoogleSheetConfig {
  spreadsheetId: string;
  range: string;
  sheetName?: string;
}

export interface GoogleDriveConfig {
  folderId: string;
  filePattern?: string;
}

export interface DataTransform {
  type: "append" | "merge" | "pivot" | "unpivot" | "groupBy" | "filter" | "sort" | "rename" | "replace" | "removeDuplicates" | "split" | "custom";
  config: any;
}
