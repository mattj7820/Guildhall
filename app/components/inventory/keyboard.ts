import type { KeyboardCoordinateGetter, UniqueIdentifier } from "@dnd-kit/core";
import { useEffect, useState, type RefObject } from "react";

const STEPS: Record<string, (columns: number) => number> = {
  ArrowLeft: () => -1,
  ArrowRight: () => 1,
  ArrowUp: (columns) => -columns,
  ArrowDown: (columns) => columns,
};

/**
 * Keyboard moves follow the bag's order, like the arrow keys do between tiles: Left at the start
 * of a row goes to the end of the row above. (dnd-kit's own version moves by position on screen,
 * so it can't leave the first or last column.)
 */
export function listOrderCoordinates(columns: number): KeyboardCoordinateGetter {
  return (event, { context: { active, over, droppableRects } }) => {
    const step = STEPS[event.code];
    if (!step) return undefined;
    event.preventDefault();
    const order: UniqueIdentifier[] = active?.data.current?.sortable?.items ?? [];
    const from = order.indexOf(over?.id ?? active?.id ?? "");
    if (from < 0) return undefined;
    const to = Math.max(0, Math.min(order.length - 1, from + step(columns)));
    const rect = droppableRects.get(order[to]);
    return rect ? { x: rect.left, y: rect.top } : undefined;
  };
}

/** How many columns the responsive grid has right now, for arrow keys and empty slots. */
export function useColumns(ref: RefObject<HTMLElement | null>): number {
  const [columns, setColumns] = useState(6);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const tracks = getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean);
      setColumns(Math.max(1, tracks.length));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return columns;
}
