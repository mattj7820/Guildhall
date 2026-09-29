/** The fog's grid and mask, and a compact text form for storing and sending it. */
import type { Size } from "../types";
import type { CellRanges, FogGrid, FogMask } from "./types";

/**
 * Cells along the image's longer side. On the campaign's maps a cell is 2 to 15 image pixels;
 * a Dungeondraft grid square is about 25 cells across. The soft edge hides the steps.
 */
export const LONG_SIDE_CELLS = 512;

export function fogGrid({ width, height }: Size): FogGrid {
  const cell = Math.max(width, height) / LONG_SIDE_CELLS;
  return {
    cols: Math.max(1, Math.round(width / cell)),
    rows: Math.max(1, Math.round(height / cell)),
  };
}

/** A new map starts fully fogged. */
export function hiddenMask(grid: FogGrid): FogMask {
  return { cols: grid.cols, rows: grid.rows, cells: new Uint8Array(grid.cols * grid.rows) };
}

export function revealedCount(mask: FogMask): number {
  let count = 0;
  for (const cell of mask.cells) count += cell;
  return count;
}

/**
 * Run lengths in base 36, alternating hidden and revealed and starting with hidden (so it may
 * start with 0): "0.2s0" is 3600 revealed cells. Typically a few hundred bytes.
 */
export function encodeCells(cells: Uint8Array): string {
  const runs: number[] = [];
  let value = 0;
  let length = 0;
  for (const cell of cells) {
    if (cell === value) {
      length++;
    } else {
      runs.push(length);
      value = cell;
      length = 1;
    }
  }
  runs.push(length);
  return runs.map((run) => run.toString(36)).join(".");
}

/** Undefined unless the text is well formed and describes exactly `length` cells. */
export function decodeCells(text: string, length: number): Uint8Array | undefined {
  if (!/^[0-9a-z]+(\.[0-9a-z]+)*$/.test(text)) return undefined;
  const cells = new Uint8Array(length);
  let index = 0;
  let value = 0;
  for (const part of text.split(".")) {
    const run = parseInt(part, 36);
    if (index + run > length) return undefined;
    cells.fill(value, index, index + run);
    index += run;
    value = 1 - value;
  }
  return index === length ? cells : undefined;
}

/** Sorted, distinct cell indexes as ranges. */
export function toRanges(indexes: readonly number[]): CellRanges {
  const ranges: CellRanges = [];
  for (const index of indexes) {
    const last = ranges.length - 2;
    if (last >= 0 && ranges[last] + ranges[last + 1] === index) ranges[last + 1]++;
    else ranges.push(index, 1);
  }
  return ranges;
}

export function fromRanges(ranges: CellRanges): number[] {
  const indexes: number[] = [];
  for (let i = 0; i + 1 < ranges.length; i += 2) {
    for (let offset = 0; offset < ranges[i + 1]; offset++) indexes.push(ranges[i] + offset);
  }
  return indexes;
}
