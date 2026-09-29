/**
 * How the fog turns into pixels, and which tiles of the image players may have. The rule that
 * keeps hidden parts hidden: a pixel in a hidden cell is always fully transparent. Inside revealed
 * cells the edge fades in with the distance from the nearest hidden cell, from nothing at its edge
 * to fully shown `FEATHER_CELLS` in, so the soft edge only ever eats into what's revealed, and the
 * grid's steps don't show.
 */
import type { Size } from "../types";
import type { FogMask } from "./types";

/** Players' images are cut into tiles this many image pixels square. */
export const TILE_SIZE = 512;
/**
 * Each tile carries one more pixel on its right and bottom edges, drawn under its neighbours, so
 * no hairline shows between tiles.
 */
export const TILE_OVERLAP = 1;
/** How far, in cells, the edge of a reveal fades in. */
export const FEATHER_CELLS = 2.5;
/** How far from a hidden cell's centre the fade starts: just beyond its corners (√½). */
const EDGE_OFFSET = 0.75;
/** A pixel this many cells or more from every hidden cell can't be in the fade. */
const REACH = Math.ceil(FEATHER_CELLS + EDGE_OFFSET) + 1;

const OPAQUE = 255;

/**
 * Each cell's opacity at its centre, 0 to 255, for drawing the fog at the grid's resolution (the
 * DM's view, which the browser smooths as it scales it up). The image's own edges don't fade.
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

/**
 * The fog, ready for working out pixels: the mask, and which cells are clear of the fade (no
 * hidden cell within reach), so pixels there need no search. Worked out once per state of the fog.
 */
export interface FogField {
  mask: FogMask;
  clear: Uint8Array;
}

export function fogField(mask: FogMask): FogField {
  const { cols, rows, cells } = mask;
  // Hidden cells within reach along each row, then along each column: a square around each cell.
  const nearRow = new Uint8Array(cols * rows);
  for (let row = 0; row < rows; row++) {
    let lastHidden = -Infinity;
    for (let col = 0; col < cols; col++) {
      if (!cells[row * cols + col]) lastHidden = col;
      if (col - lastHidden <= REACH) nearRow[row * cols + col] = 1;
    }
    lastHidden = Infinity;
    for (let col = cols - 1; col >= 0; col--) {
      if (!cells[row * cols + col]) lastHidden = col;
      if (lastHidden - col <= REACH) nearRow[row * cols + col] = 1;
    }
  }
  const clear = new Uint8Array(cols * rows).fill(1);
  for (let col = 0; col < cols; col++) {
    let last = -Infinity;
    for (let row = 0; row < rows; row++) {
      if (nearRow[row * cols + col]) last = row;
      if (row - last <= REACH) clear[row * cols + col] = 0;
    }
    last = Infinity;
    for (let row = rows - 1; row >= 0; row--) {
      if (nearRow[row * cols + col]) last = row;
      if (last - row <= REACH) clear[row * cols + col] = 0;
    }
  }
  return { mask, clear };
}

/** A rectangle of image pixels: `[x, y, width, height]`. */
export type PixelRect = [x: number, y: number, width: number, height: number];

/**
 * The opacity of each pixel in the rectangle, row by row, for an image of the given size: 0 in a
 * hidden cell, otherwise rising smoothly with the distance to the nearest hidden cell.
 */
export function pixelAlpha(
  { mask, clear }: FogField,
  image: Size,
  [x0, y0, width, height]: PixelRect,
): Uint8Array {
  const { cols, rows, cells } = mask;
  const cellWidth = image.width / cols;
  const cellHeight = image.height / rows;
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const py = y0 + y + 0.5;
    const row = Math.min(rows - 1, Math.floor(py / cellHeight));
    for (let x = 0; x < width; x++) {
      const px = x0 + x + 0.5;
      const col = Math.min(cols - 1, Math.floor(px / cellWidth));
      const index = row * cols + col;
      if (!cells[index]) continue; // A hidden cell: always transparent.
      if (clear[index]) {
        out[y * width + x] = OPAQUE;
        continue;
      }
      // Distance, in cells, to the nearest hidden cell's centre: its contours are smooth, where
      // distances to the cells' squares would keep the grid's staircase.
      let nearest = Infinity;
      for (let r = Math.max(0, row - REACH); r <= Math.min(rows - 1, row + REACH); r++) {
        for (let c = Math.max(0, col - REACH); c <= Math.min(cols - 1, col + REACH); c++) {
          if (cells[r * cols + c]) continue;
          const dx = px / cellWidth - (c + 0.5);
          const dy = py / cellHeight - (r + 0.5);
          nearest = Math.min(nearest, Math.hypot(dx, dy));
        }
      }
      // Nothing yet at a hidden cell's edge (at most √½ cells from its centre), then fading in.
      const t = Math.min(1, Math.max(0, nearest - EDGE_OFFSET) / FEATHER_CELLS);
      out[y * width + x] = Math.round(t * t * (3 - 2 * t) * OPAQUE);
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
 * One tile's state, or undefined if the fog hides all of it. A partial tile's key is a hash of
 * the fog within reach of it, so it changes exactly when the tile's pixels might, and players
 * fetch again only the tiles a reveal touched.
 */
export function tileState(
  { mask }: FogField,
  image: Size,
  x: number,
  y: number,
  size = TILE_SIZE,
): TileState | undefined {
  const { cols, rows, cells } = mask;
  const [left, top, width, height] = tileRect(image, x, y, size);
  const col = (px: number) => Math.min(cols - 1, Math.floor((px / image.width) * cols));
  const row = (px: number) => Math.min(rows - 1, Math.floor((px / image.height) * rows));
  // The cells the tile's own pixels are in.
  const own = [col(left + 0.5), row(top + 0.5), col(left + width - 0.5), row(top + height - 0.5)];
  let shown = false;
  for (let r = own[1]; r <= own[3] && !shown; r++) {
    for (let c = own[0]; c <= own[2] && !shown; c++) shown = cells[r * cols + c] === 1;
  }
  if (!shown) return undefined;

  // Every cell that can shape a pixel of the tile.
  const [firstCol, firstRow] = [Math.max(0, own[0] - REACH), Math.max(0, own[1] - REACH)];
  const [lastCol, lastRow] = [
    Math.min(cols - 1, own[2] + REACH),
    Math.min(rows - 1, own[3] + REACH),
  ];
  let allRevealed = true;
  let hash = hashStart(`${firstCol},${firstRow},${lastCol},${lastRow}`);
  for (let r = firstRow; r <= lastRow; r++) {
    for (let c = firstCol; c <= lastCol; c++) {
      const cell = cells[r * cols + c];
      if (!cell) allRevealed = false;
      hash = hashByte(hash, cell);
    }
  }
  return { x, y, key: allRevealed ? FULL_TILE : hashText(hash) };
}

/** Every tile players may have, row by row. */
export function tileStates(field: FogField, image: Size, size = TILE_SIZE): TileState[] {
  const { columns, rows } = tileCount(image, size);
  const tiles: TileState[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const state = tileState(field, image, x, y, size);
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
