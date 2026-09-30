import { useCallback, useEffect, useState } from "react";

export type MapTool = "select" | "measure" | "area";

type Point = [number, number];

/** A ruler being drawn: its turns so far, and where the pointer is now (image pixels). */
export interface Ruler {
  points: Point[];
  cursor: Point;
  dragging: boolean;
}

const SHORTCUTS: Record<string, MapTool> = { v: "select", m: "measure", a: "area" };

/**
 * Which map tool is in use, and what the measuring tool has drawn. Changing tool tidies away what
 * the last one drew; V, M and A choose tools; Escape clears; Space adds a turn to a ruler while
 * it's being dragged. `enabled` is false while other tools own the keys (the DM's fog tools).
 */
export function useMapTools(enabled: boolean) {
  const [tool, setTool] = useState<MapTool>("select");
  const [ruler, setRuler] = useState<Ruler>();

  const choose = useCallback(
    (next: MapTool) => {
      if (next === tool) return;
      setTool(next);
      setRuler(undefined);
    },
    [tool],
  );

  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable]")) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "Escape") return setRuler(undefined);
      if (event.key === " " && ruler?.dragging) {
        event.preventDefault();
        return setRuler({ ...ruler, points: [...ruler.points, ruler.cursor] });
      }
      const next = SHORTCUTS[event.key.toLowerCase()];
      if (next) choose(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, ruler, choose]);

  return {
    tool: enabled ? tool : ("select" as const),
    choose,
    ruler,
    measure: {
      start: (at: Point) => setRuler({ points: [at], cursor: at, dragging: true }),
      move: (at: Point) =>
        setRuler((current) => (current?.dragging ? { ...current, cursor: at } : current)),
      end: () => setRuler((current) => current && { ...current, dragging: false }),
    },
  };
}
