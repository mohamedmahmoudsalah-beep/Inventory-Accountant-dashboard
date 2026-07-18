import type { Role } from "../types";

/** Add/remove users and change their roles. */
export function canManageUsers(role?: Role): boolean {
  return role === "admin";
}

/** Add/remove teams and task pages. */
export function canManageStructure(role?: Role): boolean {
  return role === "admin";
}

/** Connect/import/combine/refresh data sources for a page. */
export function canManageDataSources(role?: Role): boolean {
  return role === "admin" || role === "manager";
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
  return role !== "viewer";
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
  admin: "Everything: manage users, teams/pages, data sources, and widgets.",
  manager: "Connect data sources and edit charts/pivots, but can't manage users or teams.",
  employee: "View dashboards, use filters, export, and use the AI assistant. Can't edit widgets.",
  viewer: "Read-only: can view dashboards exactly as configured.",
};
