import type { DataRow } from "../types";

export const ROW_ID_KEY = "__rid";

/** Gives every row a stable hidden id (if it doesn't have one yet) so edits
 *  made after filtering/calculated-columns still know which original row
 *  to update. Never shown in the columns list. */
export function stampRowIds(rows: DataRow[]): DataRow[] {
  return rows.map((r) =>
    r[ROW_ID_KEY] !== undefined ? r : { ...r, [ROW_ID_KEY]: crypto.randomUUID() }
  );
}
