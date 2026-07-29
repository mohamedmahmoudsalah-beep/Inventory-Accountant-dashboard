import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { AllowedUser, Role } from "../types";
import { getSupabase, getSupabaseForSignup, isSupabaseConfigured } from "./supabase";
import { logActivity } from "./remoteDb";

// --- Real authentication (Supabase Auth: email + password) ---
//
// This replaced the old "email-only allow-list" login. That version let
// anyone in who typed a known email — no password, and Supabase's anon key
// had full read/write on every table regardless of who (if anyone) was
// signed in. Real sessions plus row-level security (see README.md "Setting
// up shared storage" -> the RLS policies keyed off auth.jwt()) mean the
// database itself now enforces "you must be signed in, and your role
// decides what you can touch" — not just the UI.
//
// A person's ROLE still lives in the `app_users` table (looked up by their
// email), same as before — only the "prove it's really you" step changed.
// When Supabase isn't configured at all (no VITE_SUPABASE_URL set — e.g.
// running locally without setting up a project yet), this falls back to
// the old email-only allow-list stored in localStorage, purely so the app
// is still usable for a quick local trial without any setup.

const LOCAL_USERS_KEY = "breadfast-users-v1";
const USERS_TABLE = "app_users";

const DEFAULT_USERS: AllowedUser[] = [
  { email: "mohamed.mahmoudsalah@breadfast.com", role: "admin" },
  { email: "admin@example.com", role: "admin" },
  { email: "manager@example.com", role: "manager" },
  { email: "employee@example.com", role: "employee" },
  { email: "viewer@example.com", role: "viewer" },
];

function loadLocalUsers(): AllowedUser[] {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    if (raw) return JSON.parse(raw) as AllowedUser[];
  } catch {
    // ignore corrupt storage
  }
  return DEFAULT_USERS;
}

function saveLocalUsers(users: AllowedUser[]) {
  try {
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
  } catch {
    // ignore storage errors (private browsing, quota, etc.)
  }
}

async function fetchSupabaseUsers(): Promise<AllowedUser[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  // Only an Admin's session can actually read this table (see the RLS
  // policy on app_users) — a non-admin calling this just gets an empty
  // result, which is fine since only the Admin-gated "Manage Users" screen
  // ever calls it.
  const { data, error } = await supabase.from(USERS_TABLE).select("email, role").order("email");
  if (error || !data) return [];
  return data as AllowedUser[];
}

/** Looks up the CURRENTLY SIGNED-IN person's own role via a security-definer
 *  Postgres function (see README's RLS setup) — this works for every role,
 *  not just Admins, without needing broad SELECT access to the whole
 *  app_users table. Returns null if there's no session, or no matching
 *  app_users row (not on the list / access revoked). */
async function fetchMyRole(): Promise<Role | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("my_role");
  if (error) {
    console.warn("Couldn't look up your role (my_role RPC) — is the SQL from README's Supabase setup fully applied?", error);
    return null;
  }
  return (data as Role | null) ?? null;
}

type ActionResult = { ok: boolean; message?: string };

interface AuthState {
  user: AllowedUser | null;
  error: string | null;
  users: AllowedUser[];
  usersLoading: boolean;
  /** True once the initial "is there already a session?" check has finished
   *  — lets the app show a brief loading state instead of flashing the
   *  login screen for a moment on every reload. */
  authReady: boolean;
  usesRealAuth: boolean;
  login: (email: string, password: string) => Promise<ActionResult>;
  logout: () => void;
  addUser: (email: string, role: Role, password: string) => Promise<ActionResult>;
  updateUserRole: (email: string, role: Role) => Promise<ActionResult>;
  removeUser: (email: string) => Promise<ActionResult>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AllowedUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const usesRealAuth = isSupabaseConfigured();
  const [users, setUsers] = useState<AllowedUser[]>(usesRealAuth ? [] : loadLocalUsers());
  const [usersLoading, setUsersLoading] = useState(usesRealAuth);
  const [authReady, setAuthReady] = useState(!usesRealAuth);

  // --- Real-auth mode: restore/track the Supabase session ---
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let cancelled = false;

    async function syncFromSession(email: string | undefined) {
      if (!email) {
        if (!cancelled) setUser(null);
        return;
      }
      const role = await fetchMyRole();
      if (cancelled) return;
      if (!role) {
        // A valid Supabase login, but no (or no longer any) matching
        // app_users row — access was revoked, or never granted. Sign out
        // rather than leave a half-authenticated session sitting around.
        setError("Your account doesn't have an assigned role yet — ask an Admin to add you in Manage Users.");
        await supabase!.auth.signOut();
        setUser(null);
        return;
      }
      setUser({ email, role });
    }

    supabase.auth.getSession().then(({ data }) => {
      syncFromSession(data.session?.user?.email).finally(() => {
        if (!cancelled) setAuthReady(true);
      });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      syncFromSession(session?.user?.email);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // --- Real-auth mode: load the full user list (Admins only — see RLS) ---
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let cancelled = false;

    async function refreshUsers() {
      const list = await fetchSupabaseUsers();
      if (!cancelled) {
        setUsers(list);
        setUsersLoading(false);
      }
    }
    refreshUsers();

    const channel = supabase
      .channel("app_users_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: USERS_TABLE }, refreshUsers)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user?.email]); // re-check after login, since a non-admin gets an empty list until then

  // --- Local fallback mode (no Supabase configured) ---
  useEffect(() => {
    if (!usesRealAuth) saveLocalUsers(users);
  }, [usesRealAuth, users]);

  async function login(email: string, password: string): Promise<ActionResult> {
    setError(null);

    if (!usesRealAuth) {
      // Local demo fallback: no password check, matches the old behavior.
      const match = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
      if (!match) {
        const msg = "This email isn't on the allow-list yet. Ask the admin to add it.";
        setError(msg);
        return { ok: false, message: msg };
      }
      setUser(match);
      return { ok: true };
    }

    const supabase = getSupabase();
    if (!supabase) return { ok: false, message: "Supabase isn't configured." };
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (signInError) {
      const msg =
        signInError.message.toLowerCase().includes("invalid") || signInError.message.toLowerCase().includes("credentials")
          ? "Wrong email or password."
          : signInError.message;
      setError(msg);
      return { ok: false, message: msg };
    }
    const role = await fetchMyRole();
    if (!role) {
      const msg = "Your account doesn't have an assigned role yet — ask an Admin to add you in Manage Users.";
      setError(msg);
      await supabase.auth.signOut();
      return { ok: false, message: msg };
    }
    setUser({ email: data.user!.email!, role });
    return { ok: true };
  }

  async function logout() {
    if (usesRealAuth) {
      const supabase = getSupabase();
      if (supabase) await supabase.auth.signOut();
    }
    setUser(null);
  }

  async function addUser(email: string, role: Role, password: string): Promise<ActionResult> {
    const clean = email.trim().toLowerCase();
    if (!clean || !clean.includes("@")) return { ok: false, message: "Enter a valid email." };
    if (users.some((u) => u.email.toLowerCase() === clean)) {
      return { ok: false, message: "That email is already on the list." };
    }

    if (usesRealAuth) {
      if (!password || password.length < 8) {
        return { ok: false, message: "Set a temporary password of at least 8 characters — they can change it later." };
      }
      // Uses the SEPARATE signup-only client (see supabase.ts) so this
      // doesn't touch/replace the Admin's own current session.
      const signupClient = getSupabaseForSignup();
      if (!signupClient) return { ok: false, message: "Supabase isn't configured." };
      const { error: signUpError } = await signupClient.auth.signUp({ email: clean, password });
      if (signUpError) return { ok: false, message: signUpError.message };

      const supabase = getSupabase();
      if (supabase) {
        const { error: roleError } = await supabase.from(USERS_TABLE).upsert({ email: clean, role });
        if (roleError) return { ok: false, message: roleError.message };
      }
      setUsers((prev) => [...prev, { email: clean, role }]);
    } else {
      setUsers((prev) => [...prev, { email: clean, role }]);
    }
    if (user?.email) logActivity(user.email, "user_added", `${clean} (${role})`);
    return { ok: true };
  }

  async function updateUserRole(email: string, role: Role): Promise<ActionResult> {
    const admins = users.filter((u) => u.role === "admin");
    const target = users.find((u) => u.email === email);
    if (target?.role === "admin" && role !== "admin" && admins.length <= 1) {
      return { ok: false, message: "Can't demote the last remaining admin." };
    }

    if (usesRealAuth) {
      const supabase = getSupabase();
      if (supabase) {
        const { error } = await supabase.from(USERS_TABLE).update({ role }).eq("email", email);
        if (error) return { ok: false, message: error.message };
      }
    }
    setUsers((prev) => prev.map((u) => (u.email === email ? { ...u, role } : u)));
    if (user?.email) logActivity(user.email, "user_role_changed", `${email} → ${role}`);
    return { ok: true };
  }

  async function removeUser(email: string): Promise<ActionResult> {
    if (user?.email === email) {
      return { ok: false, message: "You can't remove the account you're signed in with." };
    }
    const target = users.find((u) => u.email === email);
    const admins = users.filter((u) => u.role === "admin");
    if (target?.role === "admin" && admins.length <= 1) {
      return { ok: false, message: "Can't remove the last remaining admin." };
    }

    if (usesRealAuth) {
      const supabase = getSupabase();
      if (supabase) {
        // This revokes app access (no app_users row = no role = RLS blocks
        // every table, and login itself refuses them) but does NOT delete
        // their underlying Supabase Auth login credential — that needs the
        // service_role key, which the browser never has. To fully delete
        // the auth account too: Supabase Dashboard -> Authentication ->
        // Users -> find them -> Delete.
        const { error } = await supabase.from(USERS_TABLE).delete().eq("email", email);
        if (error) return { ok: false, message: error.message };
      }
    }
    setUsers((prev) => prev.filter((u) => u.email !== email));
    if (user?.email) logActivity(user.email, "user_removed", email);
    return { ok: true };
  }

  return (
    <AuthContext.Provider
      value={{ user, error, users, usersLoading, authReady, usesRealAuth, login, logout, addUser, updateUserRole, removeUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
