/**
 * How the fog turns into pixels, and which tiles of the image players may have. The rule that
 * keeps hidden parts hidden: a pixel in a hidden cell is always fully transparent. Inside revealed
 * cells the edge fades in, so the soft edge only ever eats into what's revealed, never out.
 */
import type { Size } from "../types";
import type { FogGrid, FogMask } from "./types";

/** Players' images are cut into tiles this many image pixels square. */
export const TILE_SIZE = 512;
/**
 * Each tile carries one more pixel on its right and bottom edges, drawn under its neighbours, so
 * no hairline shows between tiles.
 */
export const TILE_OVERLAP = 1;
/** How far, in cells, the edge of a reveal fades in. */
export const FEATHER_CELLS = 2.5;

const OPAQUE = 255;

/**
 * Each cell's opacity, 0 to 255: 0 for hidden cells, rising with the distance to the nearest
 * hidden cell until it's fully opaque `FEATHER_CELLS` in. The image's own edges don't fade.
 */
export function cellAlpha(mask: FogMask): Uint8Array {
  const { cols, rows, cells } = mask;
  const alpha = new Uint8Array(cols * rows);
  const reach = Math.ceil(FEATHER_CELLS + 0.5);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      if (!cells[index]) continue;
      let nearest = Infinity;
      for (let r = Math.max(0, row - reach); r <= Math.min(rows - 1, row + reach); r++) {
        for (let c = Math.max(0, col - reach); c <= Math.min(cols - 1, col + reach); c++) {
          if (!cells[r * cols + c]) nearest = Math.min(nearest, Math.hypot(c - col, r - row));
        }
      }
      // Distance from this cell's centre to the hidden cell's nearest edge.
      const share = Math.min(1, (nearest - 0.5) / FEATHER_CELLS);
      alpha[index] = Math.round(share * OPAQUE);
    }
  }
  return alpha;
}

/** A rectangle of image pixels: `[x, y, width, height]`. */
export type PixelRect = [x: number, y: number, width: number, height: number];

/**
 * The opacity of each pixel in the rectangle, row by row, for an image of the given size: 0 in a
 * hidden cell, otherwise the cells' opacities blended smoothly.
 */
export function pixelAlpha(
  grid: FogGrid,
  alpha: Uint8Array,
  image: Size,
  [x0, y0, width, height]: PixelRect,
): Uint8Array {
  const { cols, rows } = grid;
  const out = new Uint8Array(width * height);
  const at = (col: number, row: number) =>
    alpha[Math.min(rows - 1, Math.max(0, row)) * cols + Math.min(cols - 1, Math.max(0, col))];
  for (let y = 0; y < height; y++) {
    const v = ((y0 + y + 0.5) / image.height) * rows;
    const ownRow = Math.min(rows - 1, Math.floor(v));
    const top = Math.floor(v - 0.5);
    const fy = v - 0.5 - top;
    for (let x = 0; x < width; x++) {
      const u = ((x0 + x + 0.5) / image.width) * cols;
      const ownCol = Math.min(cols - 1, Math.floor(u));
      if (alpha[ownRow * cols + ownCol] === 0) continue; // A hidden cell: always transparent.
      const left = Math.floor(u - 0.5);
      const fx = u - 0.5 - left;
      const blended =
        (at(left, top) * (1 - fx) + at(left + 1, top) * fx) * (1 - fy) +
        (at(left, top + 1) * (1 - fx) + at(left + 1, top + 1) * fx) * fy;
      out[y * width + x] = Math.round(blended);
    }
  }
  return out;
}

/** A tile players may have: `key` is "full", or a hash of the fog that shapes it. */
export interface TileState {
  x: number;
  y: number;
  key: string;
}

export const FULL_TILE = "full";

/** The pixels a tile covers, overlap included. */
export function tileRect(image: Size, x: number, y: number, size = TILE_SIZE): PixelRect {
  const left = x * size;
  const top = y * size;
  return [
    left,
    top,
    Math.min(image.width, left + size + TILE_OVERLAP) - left,
    Math.min(image.height, top + size + TILE_OVERLAP) - top,
  ];
}

export function tileCount(image: Size, size = TILE_SIZE): { columns: number; rows: number } {
  return { columns: Math.ceil(image.width / size), rows: Math.ceil(image.height / size) };
}

/**
 * One tile's state, or undefined if all of it is hidden. A partial tile's key changes exactly when
 * the fog around it does, so players fetch again only the tiles a reveal touched.
 */
export function tileState(
  grid: FogGrid,
  alpha: Uint8Array,
  image: Size,
  x: number,
  y: number,
  size = TILE_SIZE,
): TileState | undefined {
  const [left, top, width, height] = tileRect(image, x, y, size);
  const toCol = (px: number) => (px / image.width) * grid.cols;
  const toRow = (px: number) => (px / image.height) * grid.rows;
  // Every cell a pixel in the tile can take its opacity from, including blended neighbours.
  const firstCol = Math.max(0, Math.floor(toCol(left + 0.5) - 0.5));
  const lastCol = Math.min(grid.cols - 1, Math.floor(toCol(left + width - 0.5) - 0.5) + 1);
  const firstRow = Math.max(0, Math.floor(toRow(top + 0.5) - 0.5));
  const lastRow = Math.min(grid.rows - 1, Math.floor(toRow(top + height - 0.5) - 0.5) + 1);

  let anyShown = false;
  let allOpaque = true;
  let hash = hashStart(`${firstCol},${firstRow},${lastCol},${lastRow}`);
  for (let row = firstRow; row <= lastRow; row++) {
    for (let col = firstCol; col <= lastCol; col++) {
      const value = alpha[row * grid.cols + col];
      if (value > 0) anyShown = true;
      if (value < OPAQUE) allOpaque = false;
      hash = hashByte(hash, value);
    }
  }
  if (!anyShown || !ownCellShown(grid, alpha, image, [left, top, width, height])) return undefined;
  return { x, y, key: allOpaque ? FULL_TILE : hashText(hash) };
}

/**
 * Whether any pixel in the rectangle sits in a revealed cell. If none does, the tile shows
 * nothing, even beside revealed cells.
 */
function ownCellShown(
  grid: FogGrid,
  alpha: Uint8Array,
  image: Size,
  [left, top, width, height]: PixelRect,
): boolean {
  const col = (px: number) => Math.min(grid.cols - 1, Math.floor((px / image.width) * grid.cols));
  const row = (px: number) => Math.min(grid.rows - 1, Math.floor((px / image.height) * grid.rows));
  for (let r = row(top + 0.5); r <= row(top + height - 0.5); r++) {
    for (let c = col(left + 0.5); c <= col(left + width - 0.5); c++) {
      if (alpha[r * grid.cols + c] > 0) return true;
    }
  }
  return false;
}

/** Every tile players may have, row by row. */
export function tileStates(
  grid: FogGrid,
  alpha: Uint8Array,
  image: Size,
  size = TILE_SIZE,
): TileState[] {
  const { columns, rows } = tileCount(image, size);
  const tiles: TileState[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const state = tileState(grid, alpha, image, x, y, size);
      if (state) tiles.push(state);
    }
  }
  return tiles;
}

// A 53-bit hash (cyrb53): plenty to tell fog states of one tile apart, and the same everywhere.
type Hash = [number, number];

function hashStart(text: string): Hash {
  let hash: Hash = [0xdeadbeef, 0x41c6ce57];
  for (let i = 0; i < text.length; i++) hash = hashByte(hash, text.charCodeAt(i));
  return hash;
}

function hashByte([h1, h2]: Hash, byte: number): Hash {
  return [Math.imul(h1 ^ byte, 2654435761), Math.imul(h2 ^ byte, 1597334677)];
}

function hashText([h1, h2]: Hash): string {
  const a = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  const b = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & b) + (a >>> 0)).toString(36);
}
