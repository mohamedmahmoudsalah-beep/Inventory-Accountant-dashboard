import { getSupabase, isSupabaseConfigured } from "./supabase";
import { loadPersistedState, savePersistedState, type PersistedState } from "./persistence";

const ROW_ID = "singleton";
const TABLE = "app_state";

export { isSupabaseConfigured };

/** Loads the shared dashboard state. Uses Supabase when configured (shared
 *  across every device/browser); otherwise falls back to this browser's
 *  local storage only. */
export async function loadRemoteState(): Promise<PersistedState | null> {
  const supabase = getSupabase();
  if (!supabase) return loadPersistedState();

  const { data, error } = await supabase.from(TABLE).select("data").eq("id", ROW_ID).maybeSingle();
  if (error || !data) return loadPersistedState(); // fall back rather than blocking the app
  return data.data as PersistedState;
}

/** Saves the shared dashboard state. Writes to Supabase when configured (so
 *  every device/browser sees it), and always mirrors to local storage too
 *  as an offline fallback. */
export async function saveRemoteState(state: PersistedState): Promise<void> {
  savePersistedState(state); // local mirror, always
  const supabase = getSupabase();
  if (!supabase) return;

  await supabase.from(TABLE).upsert({ id: ROW_ID, data: state, updated_at: new Date().toISOString() });
}

/** Subscribes to live updates from other browsers/devices. Calls `onChange`
 *  with the freshly-saved state whenever anyone else writes to it. Returns
 *  an unsubscribe function. No-ops (returns a no-op unsubscribe) when
 *  Supabase isn't configured. */
export function subscribeToRemoteState(onChange: (state: PersistedState) => void): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => {};

  const channel = supabase
    .channel("app_state_changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: TABLE, filter: `id=eq.${ROW_ID}` },
      (payload) => {
        const row = payload.new as { data?: PersistedState } | undefined;
        if (row?.data) onChange(row.data);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
