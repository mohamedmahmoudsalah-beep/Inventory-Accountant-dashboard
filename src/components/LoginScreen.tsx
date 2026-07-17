import { useState } from "react";
import { useAuth } from "../lib/auth";
import { LayoutDashboard } from "lucide-react";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const { login, error } = useAuth();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    login(email);
  }

  return (
    <div className="min-h-svh flex items-center justify-center bg-[var(--bg)] px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-9 h-9 rounded-lg bg-[var(--accent-dim)] border border-[var(--accent-border)] flex items-center justify-center">
            <LayoutDashboard size={18} color="var(--accent)" />
          </div>
          <span className="text-lg font-semibold text-[var(--text-h)]">Team Insights</span>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-6"
        >
          <h2 className="text-base mb-1">Sign in</h2>
          <p className="text-sm text-[var(--text-dim)] mb-5">
            Enter the email your admin added to the allow-list.
          </p>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="w-full bg-[var(--panel-raised)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent-border)] mb-3"
          />
          {error && (
            <p className="text-sm text-[var(--bad)] mb-3">{error}</p>
          )}
          <button
            type="submit"
            className="w-full bg-[var(--accent)] text-[#1c1305] font-medium rounded-lg py-2 text-sm hover:opacity-90 transition"
          >
            Continue
          </button>
          <p className="text-xs text-[var(--text-dim)] mt-4">
            Demo accounts: admin@example.com (admin), manager@example.com (viewer)
          </p>
        </form>
      </div>
    </div>
  );
}
