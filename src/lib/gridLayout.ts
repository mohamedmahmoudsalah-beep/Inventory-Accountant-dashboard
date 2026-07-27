import type { WidgetLayout } from "../types";

/** 12 columns is a common, flexible choice — divides evenly into halves,
 *  thirds, and quarters, which covers most reasonable widget widths. */
export const GRID_COLS = 12;
/** Small row unit (px) so dragging/resizing feels smooth/continuous rather
 *  than snapping in big visible jumps. */
export const GRID_ROW_HEIGHT = 24;
export const GRID_MARGIN: [number, number] = [16, 16];

export type WidgetKind = "chart" | "pivot" | "matrix" | "card" | "text";

/** Roughly matches each widget kind's old fixed pixel default, translated
 *  into grid units — used only the first time a widget is placed, before
 *  it has a saved position of its own. */
export const DEFAULT_GRID_SIZE: Record<WidgetKind, { w: number; h: number }> = {
  chart: { w: 6, h: 15 },
  pivot: { w: 6, h: 15 },
  matrix: { w: 6, h: 15 },
  card: { w: 3, h: 7 },
  text: { w: 4, h: 9 },
};

/** Prevents a widget from being resized down into something unreadable —
 *  e.g. a chart small enough that its axis labels overlap into mush. */
export const MIN_GRID_SIZE: Record<WidgetKind, { minW: number; minH: number }> = {
  chart: { minW: 3, minH: 6 },
  pivot: { minW: 3, minH: 6 },
  matrix: { minW: 3, minH: 6 },
  card: { minW: 2, minH: 4 },
  text: { minW: 2, minH: 4 },
};

/** True only for the new {x,y,w,h} grid-position shape — guards against an
 *  old widget that still has the previous {width,height} pixel-based shape
 *  saved from before the drag-grid existed (those get treated the same as
 *  "no layout yet" and re-placed with sensible defaults). */
export function hasGridLayout(layout: unknown): layout is WidgetLayout {
  return (
    !!layout &&
    typeof layout === "object" &&
    "x" in layout &&
    "y" in layout &&
    "w" in layout &&
    "h" in layout
  );
}
