/**
 * Distances on a battle map: a line's true length at the grid's scale, where a square's side is
 * 5 ft. Not the rules' square counting: measuring is for seeing how far things really are, and
 * the DM isn't strict. Isomorphic and pure.
 */
import { FEET_PER_SQUARE, type PixelGrid } from "./grid";

type Pixels = readonly [number, number];

/** Feet from one image point (pixels) to another, in a straight line. */
export function feetBetween(grid: PixelGrid, a: Pixels, b: Pixels): number {
  return (Math.hypot(b[0] - a[0], b[1] - a[1]) / grid.square) * FEET_PER_SQUARE;
}

/** Feet along a path of points, turn by turn. */
export function feetAlong(grid: PixelGrid, points: readonly Pixels[]): number {
  let feet = 0;
  for (let i = 1; i < points.length; i++) feet += feetBetween(grid, points[i - 1], points[i]);
  return feet;
}

/** "17.5 ft": to the nearest half foot, which is as close as a table needs. */
export function formatFeet(feet: number): string {
  return `${Math.round(feet * 2) / 2} ft`;
}
