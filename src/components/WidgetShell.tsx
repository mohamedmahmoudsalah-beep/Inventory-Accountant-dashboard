import { type ReactNode, useEffect, useRef, useState } from "react";
import { GripVertical } from "lucide-react";

interface Props {
  id: string;
  kind: "chart" | "pivot" | "matrix" | "card" | "text";
  canEdit: boolean;
  onReorder: (draggedId: string, targetId: string) => void;
  children: ReactNode;
}

const DEFAULT_SIZE: Record<Props["kind"], { width: number; height: number }> = {
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
 * The size is set imperatively once on mount (not via a style prop bound to
 * every render) — this component re-renders very often (any small edit
 * elsewhere on the page causes it), and a render-bound style prop would
 * silently overwrite the browser's own resize state on every one of those,
 * making manual resizing look like it "doesn't stick."
 */
export function WidgetShell({ id, kind, canEdit, onReorder, children }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const size = DEFAULT_SIZE[kind];
    el.style.width = `${size.width}px`;
    el.style.height = `${size.height}px`;
    // Deliberately runs once per mount only — see the note above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!canEdit) {
    const size = DEFAULT_SIZE[kind];
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
