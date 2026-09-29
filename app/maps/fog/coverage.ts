/** Whether an area can be seen through the fog. */
import type { Point } from "../types";
import { cellsInPolygon } from "./shapes";
import type { FogMask } from "./types";

/**
 * Players see an area once at least half of it is revealed: enough to recognise the place, and
 * a brush grazing its edge doesn't give its name away.
 */
export const AREA_SEEN_SHARE = 0.5;

/** The share of the area's cells that are revealed, 0 to 1. */
export function revealedShare(mask: FogMask, outline: readonly Point[]): number {
  const cells = cellsInPolygon(mask, outline);
  if (cells.length === 0) return 0;
  const revealed = cells.reduce((count, index) => count + mask.cells[index], 0);
  return revealed / cells.length;
}

export function areaRevealed(mask: FogMask, outline: readonly Point[]): boolean {
  return revealedShare(mask, outline) >= AREA_SEEN_SHARE;
}
