import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "../lib/auth";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login, error, usesRealAuth } = useAuth();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(email, password);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-svh relative flex items-center justify-center bg-[var(--bg)] px-4 overflow-hidden">
      {/* Two soft blurred color blobs — Concept C's "Daylight" signature.
          Deliberately faint in dark mode (via [data-theme="dark"] in
          index.css cascading through --accent-dim/--mint-dim) so this reads
          calm there instead of muddy. */}
      <div
        className="pointer-events-none absolute -top-36 -left-28 w-[420px] h-[420px] rounded-full blur-3xl opacity-[0.55]"
        style={{ background: "var(--accent-dim)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-36 -right-24 w-[360px] h-[360px] rounded-full blur-3xl opacity-[0.55]"
        style={{ background: "var(--mint-dim)" }}
      />

      <div className="w-full max-w-sm relative z-10">
        <form
          onSubmit={handleSubmit}
          className="bg-[var(--panel)] border border-[var(--border)] rounded-3xl px-9 pt-11 pb-8 text-center shadow-[0_30px_70px_-30px_rgba(30,20,25,0.25)]"
        >
          <div
            className="w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center text-white font-bold text-xl display"
            style={{
              background: "linear-gradient(155deg, var(--accent), var(--accent-2))",
              boxShadow: "0 14px 28px -12px var(--accent-border)",
            }}
          >
            GR
          </div>
          <h1 className="display text-2xl font-semibold text-[var(--text-h)] tracking-tight">General Report</h1>
          <p className="text-sm text-[var(--text-dim)] mt-1.5 mb-7">Inventory Accountant Team</p>

          <div className="text-left mb-3.5">
            <label className="block text-xs font-semibold text-[var(--text-dim)] mb-1.5">Email</label>
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--text-h)] outline-none focus:border-[var(--accent)] transition-colors"
            />
          </div>

          {usesRealAuth && (
            <div className="text-left mb-3.5">
              <label className="block text-xs font-semibold text-[var(--text-dim)] mb-1.5">Password</label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--text-h)] outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>
          )}

          {error && <p className="text-sm text-[var(--bad)] mb-3.5 text-left">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white mt-1 disabled:opacity-60 transition"
            style={{ background: "var(--accent)", boxShadow: "0 14px 26px -12px var(--accent-border)" }}
          >
            {submitting && <Loader2 size={15} className="animate-spin" />}
            Sign in
          </button>

          <p className="text-xs text-[var(--text-dim)] mt-5">
            {usesRealAuth
              ? "Ask an Admin if you don't have an account yet."
              : "Enter the email your admin added to the allow-list."}
          </p>
        </form>
      </div>
    </div>
  );
}
