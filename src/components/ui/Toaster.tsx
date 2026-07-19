"use client";

import { useToast } from "@/hooks/useToast";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast: any) => (
        <div
          key={toast.id}
          className="px-4 py-3 rounded-xl bg-card border border-border shadow-lg text-sm font-medium text-foreground min-w-[300px]"
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
