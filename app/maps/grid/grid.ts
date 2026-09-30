/**
 * The battle grid laid over a map: squares 5 ft across, in fractions of the image like everything
 * else on a map, so it still lines up when the image is re-exported at another size. Isomorphic
 * and pure.
 */
import type { Point, Size } from "../types";

/** A square's side, in the rules. */
export const FEET_PER_SQUARE = 5;

export interface MapGrid {
  /** A square's side, as a fraction of the image's width. */
  square: number;
  /** Where two grid lines cross, as fractions of the image (anywhere on it; the lines repeat). */
  origin: Point;
  /** How strongly the lines are drawn: 0 hides them (the grid still counts), 1 is solid. */
  lines: number;
}

/** A grid in image pixels, for drawing and the maths. */
export interface PixelGrid {
  square: number;
  x: number;
  y: number;
}

/** Common pixels a square in exported battle maps: Dungeondraft's default first. */
export const COMMON_SQUARES = [256, 200, 140, 128, 100, 70] as const;

/** Fewer squares than this along the longer side isn't much of a battle map. */
const FEWEST_SQUARES = 10;

/** Squares no smaller than this many image pixels, so the grid stays usable. */
export const SMALLEST_SQUARE = 4;

export function toPixels(grid: MapGrid, size: Size): PixelGrid {
  const square = grid.square * size.width;
  // The first line at or after the image's edge, so drawing starts there.
  const first = (at: number) => ((at % square) + square) % square;
  return {
    square,
    x: first(grid.origin[0] * size.width),
    y: first(grid.origin[1] * size.height),
  };
}

/** A grid from pixels, as stored: fractions of the image. */
export function fromPixels({ square, x, y }: PixelGrid, size: Size, lines: number): MapGrid {
  return { square: square / size.width, origin: [x / size.width, y / size.height], lines };
}

/**
 * A square size that fits the image exactly, as an export's grid does, with enough squares to
 * be a battle map: the first of the common sizes that divides both sides.
 */
export function suggestSquare({ width, height }: Size): number | undefined {
  return COMMON_SQUARES.find(
    (side) =>
      width % side === 0 && height % side === 0 && Math.max(width, height) / side >= FEWEST_SQUARES,
  );
}

/** A new grid for an image: the suggested size if there is one, else about 20 squares across. */
export function startingGrid(size: Size): MapGrid {
  const square = suggestSquare(size) ?? Math.max(SMALLEST_SQUARE, Math.round(size.width / 20));
  return fromPixels({ square, x: 0, y: 0 }, size, 0.35);
}

/** How many squares across and down the image, roughly. */
export function squaresAcross(grid: PixelGrid, size: Size): [number, number] {
  return [Math.round(size.width / grid.square), Math.round(size.height / grid.square)];
}

/** The column and row of the square an image point (pixels) is in. */
export function squareAt(grid: PixelGrid, [x, y]: [number, number]): [number, number] {
  return [Math.floor((x - grid.x) / grid.square), Math.floor((y - grid.y) / grid.square)];
}

/** The centre of a square, in image pixels. */
export function squareCentre(grid: PixelGrid, [col, row]: [number, number]): [number, number] {
  return [grid.x + (col + 0.5) * grid.square, grid.y + (row + 0.5) * grid.square];
}

/**
 * Where a token of this many squares settles near an image point (pixels): an odd-sized one in
 * the middle of a square, an even-sized one (Large) on the corner where four squares meet.
 */
export function snapToGrid(grid: PixelGrid, [x, y]: [number, number], size = 1): [number, number] {
  if (size % 2 === 1) return squareCentre(grid, squareAt(grid, [x, y]));
  return [
    grid.x + Math.round((x - grid.x) / grid.square) * grid.square,
    grid.y + Math.round((y - grid.y) / grid.square) * grid.square,
  ];
}

/** The grid lines over an image, as one SVG path. */
export function gridPath(grid: PixelGrid, size: Size): string {
  const parts: string[] = [];
  for (let x = grid.x; x <= size.width; x += grid.square) parts.push(`M${x},0V${size.height}`);
  for (let y = grid.y; y <= size.height; y += grid.square) parts.push(`M0,${y}H${size.width}`);
  return parts.join("");
}
