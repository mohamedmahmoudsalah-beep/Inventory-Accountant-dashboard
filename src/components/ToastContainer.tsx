import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { subscribeToasts, dismissToast, type Toast } from "../lib/toast";

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const COLORS = {
  success: "var(--good, #57c99a)",
  error: "var(--bad)",
  info: "var(--accent)",
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => subscribeToasts(setToasts), []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => {
        const Icon = ICONS[t.type];
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-2 bg-[var(--panel-raised)] border border-[var(--border)] rounded-lg shadow-lg px-3 py-2.5 text-sm text-[var(--text)] animate-in fade-in slide-in-from-bottom-2"
          >
            <Icon size={16} color={COLORS[t.type]} className="shrink-0 mt-0.5" />
            <span className="flex-1 min-w-0">{t.message}</span>
            {t.action && (
              <button
                onClick={() => {
                  t.action!.onClick();
                  dismissToast(t.id);
                }}
                className="shrink-0 text-[var(--accent)] font-medium hover:opacity-80"
              >
                {t.action.label}
              </button>
            )}
            <button onClick={() => dismissToast(t.id)} className="shrink-0 text-[var(--text-dim)] hover:text-[var(--text-h)]">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
