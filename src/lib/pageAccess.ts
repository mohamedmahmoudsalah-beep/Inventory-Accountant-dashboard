import { getSupabase } from "./supabase";

const USER_PAGE_ACCESS = "user_page_access";

/** Loads every {email -> page_id[]} assignment in one go. Only an Admin or
 *  Manager's session can actually read across every row here (see the RLS
 *  policy on `user_page_access` in README.md) — a non-admin/manager calling
 *  this just gets an empty result, which is fine since only the
 *  admin-gated Manage Users screen ever calls it. */
export async function loadAllPageAccess(): Promise<Record<string, string[]>> {
  const supabase = getSupabase();
  if (!supabase) return {};
  const { data, error } = await supabase.from(USER_PAGE_ACCESS).select("email, page_id");
  if (error) {
    console.warn("Couldn't load page access assignments — is the SQL from README's Supabase setup fully applied?", error);
    return {};
  }
  const map: Record<string, string[]> = {};
  (data ?? []).forEach((row) => {
    const r = row as { email: string; page_id: string };
    (map[r.email] ??= []).push(r.page_id);
  });
  return map;
}

/** Replaces one person's entire set of accessible pages with `pageIds`.
 *  Simple delete-then-insert rather than a fine-grained diff — a person's
 *  assignment list is small (at most a few dozen pages), so this is never
 *  more than two small requests. */
export async function savePageAccessForUser(
  email: string,
  pageIds: string[]
): Promise<{ ok: boolean; message?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: true }; // local fallback mode: caller persists this itself (see auth.tsx)

  const { error: deleteError } = await supabase.from(USER_PAGE_ACCESS).delete().eq("email", email);
  if (deleteError) return { ok: false, message: deleteError.message };

  if (pageIds.length === 0) return { ok: true };

  const { error: insertError } = await supabase
    .from(USER_PAGE_ACCESS)
    .insert(pageIds.map((page_id) => ({ email, page_id })));
  if (insertError) return { ok: false, message: insertError.message };

  return { ok: true };
}
