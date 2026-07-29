/** A tiny pub-sub toast system — no extra dependency needed. Replaces the
 *  old `alert()` popups (which block the whole tab and look dated) with a
 *  small dismissible notification in the corner of the screen. See
 *  ToastContainer.tsx for the actual rendered UI. */

export type ToastType = "info" | "success" | "error";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  action?: ToastAction;
}

let toasts: Toast[] = [];
type Listener = (toasts: Toast[]) => void;
let listeners: Listener[] = [];

function notify() {
  listeners.forEach((l) => l(toasts));
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.push(listener);
  listener(toasts);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function showToast(
  message: string,
  opts?: { type?: ToastType; durationMs?: number; action?: ToastAction }
): string {
  const id = crypto.randomUUID();
  const toast: Toast = { id, message, type: opts?.type ?? "info", action: opts?.action };
  toasts = [...toasts, toast];
  notify();
  // Toasts with an action (like "Undo") stay up longer so there's time to click it.
  const duration = opts?.durationMs ?? (opts?.action ? 6000 : 4000);
  window.setTimeout(() => dismissToast(id), duration);
  return id;
}

export function dismissToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}
