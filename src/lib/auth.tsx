import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { AllowedUser, Role } from "../types";

// DEMO-GRADE AUTH: this allow-list lives in the browser's localStorage, not
// on a server — anyone who reads devtools on this machine could see or edit
// it, and it won't be shared across different browsers/devices. It's a real
// improvement over hard-coding users in source (an admin can now manage
// people from inside the app instead of editing code and redeploying), but
// it is NOT a substitute for real server-side auth. See README.md "Making
// auth real" before relying on this for anything sensitive.
const USERS_KEY = "breadfast-users-v1";

const DEFAULT_USERS: AllowedUser[] = [
  { email: "mohamed.mahmoudsalah@breadfast.com", role: "admin" },
  { email: "admin@example.com", role: "admin" },
  { email: "manager@example.com", role: "manager" },
  { email: "employee@example.com", role: "employee" },
  { email: "viewer@example.com", role: "viewer" },
];

function loadUsers(): AllowedUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (raw) return JSON.parse(raw) as AllowedUser[];
  } catch {
    // ignore corrupt storage
  }
  return DEFAULT_USERS;
}

function saveUsers(users: AllowedUser[]) {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch {
    // ignore storage errors (private browsing, quota, etc.)
  }
}

interface AuthState {
  user: AllowedUser | null;
  error: string | null;
  users: AllowedUser[];
  login: (email: string) => void;
  logout: () => void;
  addUser: (email: string, role: Role) => { ok: boolean; message?: string };
  updateUserRole: (email: string, role: Role) => { ok: boolean; message?: string };
  removeUser: (email: string) => { ok: boolean; message?: string };
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AllowedUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<AllowedUser[]>(loadUsers);

  useEffect(() => {
    saveUsers(users);
  }, [users]);

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

  function addUser(email: string, role: Role): { ok: boolean; message?: string } {
    const clean = email.trim().toLowerCase();
    if (!clean || !clean.includes("@")) return { ok: false, message: "Enter a valid email." };
    if (users.some((u) => u.email.toLowerCase() === clean)) {
      return { ok: false, message: "That email is already on the list." };
    }
    setUsers((prev) => [...prev, { email: clean, role }]);
    return { ok: true };
  }

  function updateUserRole(email: string, role: Role): { ok: boolean; message?: string } {
    const admins = users.filter((u) => u.role === "admin");
    const target = users.find((u) => u.email === email);
    if (target?.role === "admin" && role !== "admin" && admins.length <= 1) {
      return { ok: false, message: "Can't demote the last remaining admin." };
    }
    setUsers((prev) => prev.map((u) => (u.email === email ? { ...u, role } : u)));
    return { ok: true };
  }

  function removeUser(email: string): { ok: boolean; message?: string } {
    if (user?.email === email) {
      return { ok: false, message: "You can't remove the account you're signed in with." };
    }
    const target = users.find((u) => u.email === email);
    const admins = users.filter((u) => u.role === "admin");
    if (target?.role === "admin" && admins.length <= 1) {
      return { ok: false, message: "Can't remove the last remaining admin." };
    }
    setUsers((prev) => prev.filter((u) => u.email !== email));
    return { ok: true };
  }

  return (
    <AuthContext.Provider value={{ user, error, users, login, logout, addUser, updateUserRole, removeUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
