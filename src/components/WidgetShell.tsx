import { type ReactNode, useState } from "react";
import { GripVertical } from "lucide-react";

interface Props {
  id: string;
  canEdit: boolean;
  onReorder: (draggedId: string, targetId: string) => void;
  children: ReactNode;
}

/**
 * v1 layout controls: drag the handle to reorder widgets within the grid,
 * and drag the bottom-right corner (native CSS resize) to make a widget
 * bigger or smaller. This is a lighter-weight stand-in for a full
 * free-position drag-and-drop canvas — good enough to rearrange and resize
 * a dashboard, but widgets still snap back into the grid flow rather than
 * floating at an arbitrary x/y position.
 */
export function WidgetShell({ id, canEdit, onReorder, children }: Props) {
  const [dragOver, setDragOver] = useState(false);

  if (!canEdit) {
    return <div className="w-full sm:w-[460px] min-w-0">{children}</div>;
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
      style={{ width: 460, height: 360 }}
      className={`relative resize overflow-auto min-w-[300px] min-h-[240px] max-w-full rounded-xl transition ${
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
