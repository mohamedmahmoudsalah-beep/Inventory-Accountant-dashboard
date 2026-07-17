import { createContext, useContext, useState, type ReactNode } from "react";
import type { AllowedUser } from "../types";

// DEMO ONLY: this allow-list lives in the frontend bundle, so it is not a real
// security boundary — anyone who reads the JS can see these emails and roles.
// Swap this for a real backend (e.g. Supabase Auth with a `users` table and
// row-level security) before sharing this app outside your team.
// See README.md "Making auth real" for the migration steps.
const ALLOWED_USERS: AllowedUser[] = [
  { email: "mohamed.mahmoudsalah@breadfast.com", role: "admin" },
  { email: "admin@example.com", role: "admin" },
  { email: "manager@example.com", role: "viewer" },
];

interface AuthState {
  user: AllowedUser | null;
  error: string | null;
  login: (email: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AllowedUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  function login(email: string) {
    const match = ALLOWED_USERS.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase()
    );
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

  return (
    <AuthContext.Provider value={{ user, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
