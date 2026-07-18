import { useState } from "react";
import { useAuth } from "../lib/auth";

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
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="w-11 h-11 rounded-xl overflow-hidden">
            <img src="/breadfast-logo-magenta.png" alt="Breadfast" className="w-full h-full object-cover" />
          </div>
          <span className="text-lg font-semibold text-[var(--text-h)] text-center">General Report Inventory Accountant team</span>
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
            className="w-full bg-[var(--accent)] text-white font-medium rounded-lg py-2 text-sm hover:opacity-90 transition"
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}
