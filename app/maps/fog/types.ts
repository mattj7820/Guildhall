/**
 * Fog of war: which parts of a map players can see. Isomorphic: the DM's browser paints changes
 * at once, and the server applies the same changes to what's stored.
 */
import type { Point } from "../types";

/**
 * A coarse grid over the image, in fractions like outlines, so it still lines up when the map is
 * re-exported at another resolution. Cells are (nearly) square in image pixels.
 */
export interface FogGrid {
  cols: number;
  rows: number;
}

/** One byte per cell, row by row: 1 revealed, 0 hidden. */
export interface FogMask extends FogGrid {
  cells: Uint8Array;
}

export type FogMode = "reveal" | "hide";

export type FogShape =
  /** A brush stroke through the points; the radius is a fraction of the image's longer side. */
  | { kind: "stroke"; points: Point[]; radius: number }
  /** An area's outline, or a rectangle. */
  | { kind: "polygon"; points: Point[] }
  | { kind: "all" };

/**
 * Every change to the fog. `paint` is what the tools send. `cells` sets listed cells, and is what
 * undo sends: the inverse of a paint, so undoing never touches cells someone else changed since.
 */
export type FogChange =
  | { type: "paint"; mode: FogMode; shape: FogShape }
  | { type: "cells"; mode: FogMode; ranges: CellRanges };

/** Cell indexes as `[start, length, start, length, …]`, ascending. */
export type CellRanges = number[];
