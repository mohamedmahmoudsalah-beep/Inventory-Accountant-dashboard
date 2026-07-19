// One random id per open tab/session. Used so this tab can tell the
// difference between "someone else just changed something" (apply it) and
// "that's just Supabase echoing my own write back to me, possibly after
// I've already made further local edits" (ignore it, or it would silently
// revert whatever the person just did).
export const TAB_SESSION_ID: string = crypto.randomUUID();
