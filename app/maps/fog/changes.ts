/**
 * Applying fog changes and undoing them. The same pure functions run in the DM's browser (so a
 * reveal shows at once) and on the server (applied to whatever is stored now).
 */
import { fromRanges, toRanges } from "./mask";
import { cellsIn } from "./shapes";
import type { FogChange, FogMask, FogMode } from "./types";

export interface Applied {
  mask: FogMask;
  /** The cells this change actually flipped, ascending. */
  changed: number[];
}

/** A new mask with the change applied; the one passed in is left as it was. */
export function applyFogChange(mask: FogMask, change: FogChange): Applied {
  const value = change.mode === "reveal" ? 1 : 0;
  const size = mask.cols * mask.rows;
  const targets =
    change.type === "paint"
      ? cellsIn(mask, change.shape)
      : fromRanges(change.ranges).filter((index) => index >= 0 && index < size);

  const cells = mask.cells.slice();
  const changed: number[] = [];
  for (const index of targets) {
    if (cells[index] === value) continue;
    cells[index] = value;
    changed.push(index);
  }
  return { mask: changed.length > 0 ? { ...mask, cells } : mask, changed };
}

/**
 * What undoes an applied change: the cells it flipped, set back. Cells it didn't change are left
 * alone, so undoing a reveal doesn't hide what someone else revealed meanwhile.
 */
export function inverseOf(change: FogChange, changed: readonly number[]): FogChange | undefined {
  if (changed.length === 0) return undefined;
  const mode: FogMode = change.mode === "reveal" ? "hide" : "reveal";
  return { type: "cells", mode, ranges: toRanges(changed) };
}
