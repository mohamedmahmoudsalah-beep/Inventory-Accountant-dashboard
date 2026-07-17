import type { DataRow } from "../types";

export const sampleRows: DataRow[] = [
  { month: "Jan", region: "Cairo", revenue: 42000, orders: 310 },
  { month: "Feb", region: "Cairo", revenue: 45500, orders: 335 },
  { month: "Mar", region: "Cairo", revenue: 51000, orders: 360 },
  { month: "Jan", region: "Alexandria", revenue: 21000, orders: 150 },
  { month: "Feb", region: "Alexandria", revenue: 23500, orders: 165 },
  { month: "Mar", region: "Alexandria", revenue: 26000, orders: 178 },
  { month: "Jan", region: "Giza", revenue: 18000, orders: 120 },
  { month: "Feb", region: "Giza", revenue: 19500, orders: 128 },
  { month: "Mar", region: "Giza", revenue: 22500, orders: 140 },
];

export const sampleColumns = ["month", "region", "revenue", "orders"];
