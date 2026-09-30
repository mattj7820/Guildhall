import { useMemo } from "react";
import { gridPath, toPixels, type MapGrid } from "~/maps/grid/grid";
import type { Size } from "~/maps/types";

/**
 * A map's battle grid: thin lines that keep their width at every zoom, as strong as the map says
 * (not at all, if it says 0). Drawn under areas and tokens.
 */
export function GridLayer({ grid, size }: { grid: MapGrid; size: Size }) {
  const d = useMemo(() => gridPath(toPixels(grid, size), size), [grid, size]);
  if (grid.lines === 0) return null;
  return (
    <path
      d={d}
      aria-hidden="true"
      className="pointer-events-none stroke-stone-950"
      strokeOpacity={grid.lines}
      strokeWidth={1}
      fill="none"
      vectorEffect="non-scaling-stroke"
    />
  );
}
