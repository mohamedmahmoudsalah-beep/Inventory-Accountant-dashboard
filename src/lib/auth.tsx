import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { AllowedUser, Role } from "../types";
import { getSupabase, isSupabaseConfigured } from "./supabase";

// When Supabase is configured (see README.md "Setting up shared storage"),
// the user allow-list lives in a real shared database — every browser and
// device sees the same list, and changes made by one admin appear for
// everyone live. Without Supabase configured, this falls back to this
// browser's own localStorage only (not shared across devices) — see
// README.md "Making it production-ready" for what that means security-wise.
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
  const supabase = getSupabase()!;
  const { data, error } = await supabase.from(USERS_TABLE).select("email, role").order("email");
  if (error || !data || data.length === 0) return [];
  return data as AllowedUser[];
}

async function seedSupabaseUsersIfEmpty() {
  const supabase = getSupabase()!;
  const { count } = await supabase.from(USERS_TABLE).select("*", { count: "exact", head: true });
  if (!count) {
    await supabase.from(USERS_TABLE).insert(DEFAULT_USERS);
  }
}

type ActionResult = { ok: boolean; message?: string };

interface AuthState {
  user: AllowedUser | null;
  error: string | null;
  users: AllowedUser[];
  usersLoading: boolean;
  login: (email: string) => void;
  logout: () => void;
  addUser: (email: string, role: Role) => Promise<ActionResult>;
  updateUserRole: (email: string, role: Role) => Promise<ActionResult>;
  removeUser: (email: string) => Promise<ActionResult>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AllowedUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shared = isSupabaseConfigured();
  const [users, setUsers] = useState<AllowedUser[]>(shared ? [] : loadLocalUsers());
  const [usersLoading, setUsersLoading] = useState(shared);

  useEffect(() => {
    if (!shared) return;
    const supabase = getSupabase()!;
    let cancelled = false;

    (async () => {
      await seedSupabaseUsersIfEmpty();
      const list = await fetchSupabaseUsers();
      if (!cancelled) {
        setUsers(list.length > 0 ? list : DEFAULT_USERS);
        setUsersLoading(false);
      }
    })();

    const channel = supabase
      .channel("app_users_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: USERS_TABLE }, async () => {
        const list = await fetchSupabaseUsers();
        if (!cancelled) setUsers(list);
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [shared]);

  useEffect(() => {
    if (!shared) saveLocalUsers(users);
  }, [shared, users]);

  function login(email: string) {
    const match = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!match) {
      setError("This email isn't on the allow-list yet. Ask the admin to add it.");
      return;
    }
    setError(null);
    setUser(match);
  }

  function logout() {
    setUser(null);
  }

  async function addUser(email: string, role: Role): Promise<ActionResult> {
    const clean = email.trim().toLowerCase();
    if (!clean || !clean.includes("@")) return { ok: false, message: "Enter a valid email." };
    if (users.some((u) => u.email.toLowerCase() === clean)) {
      return { ok: false, message: "That email is already on the list." };
    }

    if (shared) {
      const supabase = getSupabase()!;
      const { error } = await supabase.from(USERS_TABLE).insert({ email: clean, role });
      if (error) return { ok: false, message: error.message };
      // Realtime subscription will refresh `users`, but update optimistically too.
      setUsers((prev) => [...prev, { email: clean, role }]);
    } else {
      setUsers((prev) => [...prev, { email: clean, role }]);
    }
    return { ok: true };
  }

  async function updateUserRole(email: string, role: Role): Promise<ActionResult> {
    const admins = users.filter((u) => u.role === "admin");
    const target = users.find((u) => u.email === email);
    if (target?.role === "admin" && role !== "admin" && admins.length <= 1) {
      return { ok: false, message: "Can't demote the last remaining admin." };
    }

    if (shared) {
      const supabase = getSupabase()!;
      const { error } = await supabase.from(USERS_TABLE).update({ role }).eq("email", email);
      if (error) return { ok: false, message: error.message };
    }
    setUsers((prev) => prev.map((u) => (u.email === email ? { ...u, role } : u)));
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

    if (shared) {
      const supabase = getSupabase()!;
      const { error } = await supabase.from(USERS_TABLE).delete().eq("email", email);
      if (error) return { ok: false, message: error.message };
    }
    setUsers((prev) => prev.filter((u) => u.email !== email));
    return { ok: true };
  }

  return (
    <AuthContext.Provider
      value={{ user, error, users, usersLoading, login, logout, addUser, updateUserRole, removeUser }}
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
