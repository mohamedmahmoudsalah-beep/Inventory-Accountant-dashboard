import { type ReactNode, useEffect, useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import type { WidgetLayout } from "../types";

interface Props {
  id: string;
  kind: "chart" | "pivot" | "matrix" | "card" | "text";
  canEdit: boolean;
  layout?: WidgetLayout;
  onReorder: (draggedId: string, targetId: string) => void;
  /** Called (debounced) whenever the person finishes dragging the resize
   *  handle, so the new size can be saved onto the widget's own config and
   *  synced like any other widget edit. */
  onResize?: (size: WidgetLayout) => void;
  children: ReactNode;
}

const DEFAULT_SIZE: Record<Props["kind"], WidgetLayout> = {
  chart: { width: 460, height: 360 },
  pivot: { width: 460, height: 360 },
  matrix: { width: 460, height: 360 },
  card: { width: 220, height: 160 },
  text: { width: 320, height: 220 },
};

/**
 * v1 layout controls: drag the handle to reorder widgets (any kind can sit
 * next to any other — order is a single shared list, not grouped by type),
 * and drag the bottom-right corner (native CSS resize) to make a widget
 * bigger or smaller. This is a lighter-weight stand-in for a full
 * free-position drag-and-drop canvas — good enough to rearrange and resize
 * a dashboard, but widgets still flow left-to-right/wrap rather than
 * floating at an arbitrary x/y position.
 *
 * The size the person picked is persisted on the widget's own config
 * (`layout`), so it comes back from the saved `layout` prop after a reload
 * instead of always resetting to DEFAULT_SIZE. A ResizeObserver watches the
 * element for size changes coming from the native CSS `resize` handle and
 * reports them upward (debounced) via onResize.
 */
export function WidgetShell({ id, kind, canEdit, layout, onReorder, onResize, children }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks the size we last set/reported ourselves, so the ResizeObserver
  // doesn't treat our own initial sizing (or an incoming prop update) as if
  // the person had just dragged the handle.
  const lastKnownSizeRef = useRef<WidgetLayout | null>(null);

  const size = layout ?? DEFAULT_SIZE[kind];

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.width = `${size.width}px`;
    el.style.height = `${size.height}px`;
    lastKnownSizeRef.current = size;
    // Re-applies whenever the saved layout itself changes (e.g. it just
    // arrived from Supabase/realtime) — but never fights an in-progress
    // manual resize, since that only touches lastKnownSizeRef, not this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !canEdit || !onResize) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      const last = lastKnownSizeRef.current;
      if (last && last.width === width && last.height === height) return;

      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = setTimeout(() => {
        lastKnownSizeRef.current = { width, height };
        onResize({ width, height });
      }, 400);
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, onResize]);

  if (!canEdit) {
    return <div style={{ width: size.width }} className="max-w-full min-w-0">{children}</div>;
  }

  return (
    <div
      ref={ref}
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/widget-id", id)}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const draggedId = e.dataTransfer.getData("text/widget-id");
        if (draggedId && draggedId !== id) onReorder(draggedId, id);
      }}
      className={`relative resize overflow-auto max-w-full rounded-xl transition ${
        dragOver ? "ring-2 ring-[var(--accent)]" : ""
      }`}
    >
      <div className="absolute top-2 right-8 z-10 text-[var(--text-dim)] opacity-40 hover:opacity-90 cursor-grab active:cursor-grabbing">
        <GripVertical size={14} />
      </div>
      {children}
    </div>
  );
}
