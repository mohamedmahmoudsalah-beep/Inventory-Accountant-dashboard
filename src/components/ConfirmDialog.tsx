import { AlertTriangle } from "lucide-react";

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** A plain "are you sure?" gate shown before an action that can't be
 *  casually undone via a toast (deleting a whole page or team, not a
 *  single widget) — separate from the existing "Undo" toast pattern used
 *  elsewhere, since this stops the deletion from happening at all until
 *  someone explicitly confirms, rather than letting it happen and offering
 *  a few seconds to reverse it. */
export function ConfirmDialog({ title, message, confirmLabel = "Delete", onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-5 w-full max-w-sm">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 rounded-full bg-[var(--bad)]/15 text-[var(--bad)] shrink-0">
            <AlertTriangle size={18} />
          </div>
          <div>
            <h3 className="text-sm text-[var(--text-h)] mb-1">{title}</h3>
            <p className="text-xs text-[var(--text-dim)]">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg text-sm text-[var(--text-dim)] hover:bg-[var(--panel-raised)]"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 rounded-lg text-sm bg-[var(--bad)] text-white hover:opacity-90"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
