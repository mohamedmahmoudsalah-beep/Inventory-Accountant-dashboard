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
      {/* Subtle brand watermark — the real logo, large and very low-opacity,
          purely decorative (no pointer events) so it never competes with the
          actual sign-in form. */}
      <img
        src="/breadfast-logo-magenta.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none select-none absolute -right-24 -bottom-24 w-[32rem] h-[32rem] object-contain opacity-[0.06] rotate-[-8deg]"
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 500px at 15% -10%, var(--accent-dim), transparent), radial-gradient(700px 450px at 100% 110%, var(--mint-dim), transparent)",
        }}
      />

      <div className="w-full max-w-sm relative">
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="w-11 h-11 rounded-xl overflow-hidden">
            <img src="/breadfast-logo-magenta.png" alt="Breadfast" className="w-full h-full object-cover" />
          </div>
          <span className="text-lg font-semibold text-[var(--text-h)] text-center">General Report Inventory Accountant team</span>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.25)]"
        >
          <h2 className="text-base mb-1">Sign in</h2>
          <p className="text-sm text-[var(--text-dim)] mb-5">
            {usesRealAuth
              ? "Sign in with the email and password an Admin set up for you."
              : "Enter the email your admin added to the allow-list."}
          </p>
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="w-full bg-[var(--panel-raised)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent-border)] mb-3"
          />
          {usesRealAuth && (
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full bg-[var(--panel-raised)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent-border)] mb-3"
            />
          )}
          {error && (
            <p className="text-sm text-[var(--bad)] mb-3">{error}</p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-[var(--accent)] text-white font-medium rounded-lg py-2 text-sm hover:opacity-90 transition disabled:opacity-60"
          >
            {submitting && <Loader2 size={15} className="animate-spin" />}
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}
