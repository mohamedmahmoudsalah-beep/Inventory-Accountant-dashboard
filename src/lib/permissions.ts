import type { AllowedUser, Department, Role } from "../types";

/** Add/remove users and change their roles. */
export function canManageUsers(role?: Role): boolean {
  return role === "admin";
}

/** Add/remove/rename teams and task pages. */
export function canManageStructure(role?: Role): boolean {
  return role === "admin" || role === "manager";
}

/** Refresh an already-connected data source. Admin-only — the Admin account
 *  (mohamed.mahmoudsalah@breadfast.com) is the one who connects and refreshes
 *  every sheet; Managers can edit charts/pivots but don't touch data sources. */
export function canManageDataSources(role?: Role): boolean {
  return role === "admin";
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
  return role === "admin" || role === "manager" || role === "employee";
}

/** Use the AI assistant. */
export function canUseAssistant(role?: Role): boolean {
  return role !== "viewer";
}

/** Whether this role is restricted to an explicit per-page allow-list at
 *  all — Admin and Manager always see every team/page regardless of what's
 *  in `user_page_access` / `AllowedUser.pageAccess`. Only Employee/Viewer
 *  are scoped down to specific pages. */
export function isPageAccessRestricted(role?: Role): boolean {
  return role === "employee" || role === "viewer";
}

/** Filters the full department/page tree down to what a signed-in person is
 *  actually allowed to see.
 *
 *  - Admin/Manager: untouched, always the full tree.
 *  - Real-auth (Supabase) mode, Employee/Viewer: `departments` here was
 *    already built from rows Postgres RLS allowed through in the first
 *    place (see `can_access_page()` in README's SQL) — so every page
 *    already IS one this person can see. This just drops teams left with
 *    zero visible pages, so the sidebar doesn't show empty team names with
 *    nothing to click into.
 *  - Local (no-Supabase) fallback, Employee/Viewer: there's no database to
 *    enforce this, so it's mirrored here client-side against
 *    `user.pageAccess`.
 *
 *  `pageAccess === undefined` (never set — an account created before this
 *  feature existed) is treated as "sees everything, same as before",
 *  matching the real-auth grandfather-in migration in README.md so an
 *  existing Employee/Viewer's access never silently changes. Only an
 *  explicit array (even an empty one, from unchecking every box in Manage
 *  Users) actually restricts what they see. New users created after this
 *  feature always start with pageAccess: [] explicitly (see auth.tsx),
 *  which is why they start seeing nothing until assigned. */
export function filterDepartmentsForUser(
  departments: Department[],
  user: AllowedUser | null,
  usesRealAuth: boolean
): Department[] {
  if (!user || !isPageAccessRestricted(user.role)) return departments;

  if (usesRealAuth) {
    return departments.filter((d) => d.pages.length > 0);
  }

  if (user.pageAccess === undefined) return departments;

  const allowed = new Set(user.pageAccess);
  return departments
    .map((d) => ({ ...d, pages: d.pages.filter((p) => allowed.has(p.id)) }))
    .filter((d) => d.pages.length > 0);
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  manager: "Manager",
  employee: "Employee",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: "Everything: manage users, teams/pages, data sources, exports, and widgets.",
  manager: "Add/rename/remove teams & pages, edit charts/pivots, and export — can't connect or refresh data sources, and can't manage users.",
  employee: "View dashboards, use filters, export chart/pivot data, and use the AI assistant. Can't edit widgets or connect data.",
  viewer: "Read-only: can view dashboards exactly as configured.",
};
