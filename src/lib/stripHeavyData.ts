import type { Department } from "../types";

/**
 * A page connected to a live Google Sheet can always re-fetch its data
 * (that's what Refresh/Auto-refresh already do), so there's no need to
 * also cram potentially thousands of rows into the shared Supabase blob on
 * every single edit — that bloats the payload enormously and was likely
 * the actual cause of intermittent 500 errors on save. Only pages with no
 * live source (manually imported files) need their rows persisted, since
 * there's nowhere else to re-fetch them from.
 */
export function stripHeavyRowsForSharedStorage(departments: Department[]): Department[] {
  return departments.map((dept) => ({
    ...dept,
    pages: dept.pages.map((page) =>
      page.sheetUrl ? { ...page, rows: [] } : page
    ),
  }));
}
