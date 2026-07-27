import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { GripVertical } from "lucide-react";

interface Props extends HTMLAttributes<HTMLDivElement> {
  canEdit: boolean;
  children: ReactNode;
}

/**
 * A free-form drag grid (react-grid-layout) owns positioning, dragging, and
 * resizing now — this component just needs to be a plain div that accepts
 * whatever style/className/event-handler props the grid clones onto its
 * direct children, plus a forwarded ref so the grid can measure it.
 *
 * Dragging is restricted to the small grip handle (via react-grid-layout's
 * `draggableHandle=".widget-drag-handle"` in App.tsx) rather than the whole
 * widget, so clicking dropdowns/buttons/text inside a widget never
 * accidentally starts a drag.
 */
export const WidgetShell = forwardRef<HTMLDivElement, Props>(function WidgetShell(
  { canEdit, children, className, ...rest },
  ref
) {
  return (
    <div ref={ref} className={`${className ?? ""} group/widget`} {...rest}>
      {canEdit && (
        <div
          className="widget-drag-handle absolute top-2 right-8 z-10 p-1 rounded cursor-grab active:cursor-grabbing text-[var(--text-dim)] opacity-0 group-hover/widget:opacity-90 hover:!opacity-100 hover:bg-[var(--panel-raised)] transition-opacity"
          title="Drag to move"
        >
          <GripVertical size={14} />
        </div>
      )}
      {children}
    </div>
  );
});
