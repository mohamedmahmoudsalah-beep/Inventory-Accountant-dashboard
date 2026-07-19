import { type ReactNode, useState } from "react";
import { GripVertical } from "lucide-react";

interface Props {
  id: string;
  kind: "chart" | "pivot" | "matrix" | "card" | "text";
  canEdit: boolean;
  onReorder: (draggedId: string, targetId: string) => void;
  children: ReactNode;
}

const DEFAULT_SIZE: Record<Props["kind"], { width: number; height: number; minW: number; minH: number }> = {
  chart: { width: 460, height: 360, minW: 300, minH: 240 },
  pivot: { width: 460, height: 360, minW: 300, minH: 240 },
  matrix: { width: 460, height: 360, minW: 300, minH: 240 },
  card: { width: 220, height: 160, minW: 160, minH: 120 },
  text: { width: 320, height: 220, minW: 220, minH: 140 },
};

/**
 * v1 layout controls: drag the handle to reorder widgets (any kind can sit
 * next to any other — order is a single shared list, not grouped by type),
 * and drag the bottom-right corner (native CSS resize) to make a widget
 * bigger or smaller. This is a lighter-weight stand-in for a full
 * free-position drag-and-drop canvas — good enough to rearrange and resize
 * a dashboard, but widgets still flow left-to-right/wrap rather than
 * floating at an arbitrary x/y position.
 */
export function WidgetShell({ id, kind, canEdit, onReorder, children }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const size = DEFAULT_SIZE[kind];

  if (!canEdit) {
    return <div style={{ width: size.width }} className="max-w-full min-w-0">{children}</div>;
  }

  return (
    <div
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
      style={{ width: size.width, height: size.height }}
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
