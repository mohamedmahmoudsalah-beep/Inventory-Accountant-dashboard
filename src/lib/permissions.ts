import type { Role } from "../types";

/** Add/remove users and change their roles. */
export function canManageUsers(role?: Role): boolean {
  return role === "admin";
}

/** Add/remove/rename teams and task pages. */
export function canManageStructure(role?: Role): boolean {
  return role === "admin" || role === "manager";
}

/** Refresh an already-connected data source. */
export function canManageDataSources(role?: Role): boolean {
  return role === "admin" || role === "manager";
}

/** Connect a NEW data source: Browse Drive, paste a link, import a file, combine sheets, or edit the data model. */
export function canConnectNewData(role?: Role): boolean {
  return role === "admin";
}

/** Add/edit/remove charts and pivot tables. */
export function canEditWidgets(role?: Role): boolean {
  return role === "admin" || role === "manager";
}

/** Change filter values/ranges. */
export function canUseFilters(role?: Role): boolean {
  return role !== "viewer";
}

/** Export to Excel. */
export function canExport(role?: Role): boolean {
  return role === "admin";
}

/** Use the AI assistant. */
export function canUseAssistant(role?: Role): boolean {
  return role !== "viewer";
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  manager: "Manager",
  employee: "Employee",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: "Everything: manage users, teams/pages, data sources, exports, and widgets.",
  manager: "Refresh already-connected data and edit charts/pivots — can't connect new sources, export, or manage users/teams.",
  employee: "View dashboards, use filters, and use the AI assistant. Can't edit widgets, export, or connect data.",
  viewer: "Read-only: can view dashboards exactly as configured.",
};
