/**
 * A map's overview: one pixel per fog cell, for thumbnails. Each pixel is the average of the image
 * pixels whose centres are in its cell, the same rule `pixelAlpha` uses, so taking out a hidden
 * cell takes out everything of the image under it.
 */
import type { Size } from "../types";
import { cellAlpha } from "./tiles";
import type { FogGrid, FogMask } from "./types";

/** Pixels row by row, as sharp's raw output gives them. */
export interface RawImage {
  width: number;
  height: number;
  channels: 3 | 4;
  data: Uint8Array;
}

/**
 * The overview of an image on the grid, RGBA. Colours are averaged by their opacity, so a
 * transparent pixel doesn't darken its cell.
 */
export function cellOverview(image: RawImage, grid: FogGrid): RawImage {
  const { width, height, channels, data } = image;
  const { cols, rows } = grid;
  const colOf = cellsAlong(width, cols);
  const rowOf = cellsAlong(height, rows);
  // Per cell: red, green and blue times opacity, opacity, and how many pixels.
  const sums = new Float64Array(cols * rows * 5);
  for (let y = 0; y < height; y++) {
    const rowStart = rowOf[y] * cols;
    for (let x = 0; x < width; x++) {
      const pixel = (y * width + x) * channels;
      const alpha = channels === 4 ? data[pixel + 3] : 255;
      const sum = (rowStart + colOf[x]) * 5;
      sums[sum] += data[pixel] * alpha;
      sums[sum + 1] += data[pixel + 1] * alpha;
      sums[sum + 2] += data[pixel + 2] * alpha;
      sums[sum + 3] += alpha;
      sums[sum + 4]++;
    }
  }

  const out = new Uint8Array(cols * rows * 4);
  const sources = borrowedFrom({ width, height }, grid);
  for (let cell = 0; cell < cols * rows; cell++) {
    const sum = (sources?.[cell] ?? cell) * 5;
    const opacity = sums[sum + 3];
    if (opacity === 0) continue;
    for (let channel = 0; channel < 3; channel++) {
      out[cell * 4 + channel] = Math.round(sums[sum + channel] / opacity);
    }
    out[cell * 4 + 3] = Math.round(opacity / sums[sum + 4]);
  }
  return { width: cols, height: rows, channels: 4, data: out };
}

/**
 * The overview as players may see it: hidden cells transparent black, with nothing of them left,
 * and the edge of what's revealed faded like the fog the DM sees.
 */
export function maskOverview(overview: RawImage, mask: FogMask, image: Size): RawImage {
  const { cols, rows, cells } = mask;
  if (overview.width !== cols || overview.height !== rows || overview.channels !== 4) {
    throw new Error("The fog doesn't match the overview it's masking");
  }
  const shown = cellAlpha(mask);
  const sources = borrowedFrom(image, mask);
  const out = new Uint8Array(overview.data.length);
  for (let cell = 0; cell < cols * rows; cell++) {
    // A cell coloured by its neighbour's pixels shows only if that neighbour is revealed too.
    if (shown[cell] === 0 || (sources && cells[sources[cell]] === 0)) continue;
    const pixel = cell * 4;
    out.set(overview.data.subarray(pixel, pixel + 3), pixel);
    out[pixel + 3] = Math.round((overview.data[pixel + 3] * shown[cell]) / 255);
  }
  return { ...overview, data: out };
}

/** For each pixel along one side, the cell its centre is in. */
function cellsAlong(pixels: number, cells: number): Uint32Array {
  const size = pixels / cells;
  return Uint32Array.from({ length: pixels }, (_, pixel) =>
    Math.min(cells - 1, Math.floor((pixel + 0.5) / size)),
  );
}

/**
 * Only for an image smaller than its grid, where some cells have no pixel centred in them: for
 * each cell, the cell whose pixels colour it (the one its own centre's pixel belongs to).
 * Undefined when every cell has pixels of its own.
 */
export function borrowedFrom(image: Size, { cols, rows }: FogGrid): Uint32Array | undefined {
  const across = sourcesAlong(image.width, cols);
  const down = sourcesAlong(image.height, rows);
  if (!across && !down) return undefined;
  return Uint32Array.from({ length: cols * rows }, (_, cell) => {
    const row = Math.floor(cell / cols);
    const col = cell % cols;
    return (down?.[row] ?? row) * cols + (across?.[col] ?? col);
  });
}

function sourcesAlong(pixels: number, cells: number): Uint32Array | undefined {
  const cellOf = cellsAlong(pixels, cells);
  const used = new Uint8Array(cells);
  for (const cell of cellOf) used[cell] = 1;
  if (used.every(Boolean)) return undefined;
  const size = pixels / cells;
  return Uint32Array.from({ length: cells }, (_, cell) =>
    used[cell] ? cell : cellOf[Math.min(pixels - 1, Math.floor((cell + 0.5) * size))],
  );
}
