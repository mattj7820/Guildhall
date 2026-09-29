import { describe, expect, it } from "vitest";
import type { Point } from "../types";
import { applyFogChange, inverseOf } from "./changes";
import { maskFrom, picture } from "./test-builders";
import type { FogChange, FogMask } from "./types";

const LEFT_HALF: Point[] = [
  [0, 0],
  [0.5, 0],
  [0.5, 1],
  [0, 1],
];
const RIGHT_HALF: Point[] = [
  [0.5, 0],
  [1, 0],
  [1, 1],
  [0.5, 1],
];

const revealLeft: FogChange = {
  type: "paint",
  mode: "reveal",
  shape: { kind: "polygon", points: LEFT_HALF },
};
const revealRight: FogChange = { ...revealLeft, shape: { kind: "polygon", points: RIGHT_HALF } };

/** Applies changes in order, returning the final mask. */
function apply(mask: FogMask, ...changes: FogChange[]): FogMask {
  return changes.reduce((current, change) => applyFogChange(current, change).mask, mask);
}

/** Applies the change, then its inverse. */
function undone(mask: FogMask, change: FogChange, meanwhile: FogChange[] = []): string[] {
  const { mask: after, changed } = applyFogChange(mask, change);
  const inverse = inverseOf(change, changed);
  if (!inverse) throw new Error("Nothing to undo");
  return picture(apply(after, ...meanwhile, inverse));
}

describe("applyFogChange", () => {
  it("reveals a shape and reports the cells it changed", () => {
    const { mask, changed } = applyFogChange(maskFrom(["....", "...."]), revealLeft);
    expect(picture(mask)).toEqual(["##..", "##.."]);
    expect(changed).toEqual([0, 1, 4, 5]);
  });

  it("hides a shape", () => {
    const hideLeft: FogChange = { ...revealLeft, mode: "hide" };
    expect(picture(apply(maskFrom(["####", "####"]), hideLeft))).toEqual(["..##", "..##"]);
  });

  it("reveals and hides everything", () => {
    const all = { kind: "all" } as const;
    const start = maskFrom(["#..#", ".##."]);
    expect(picture(apply(start, { type: "paint", mode: "reveal", shape: all }))).toEqual([
      "####",
      "####",
    ]);
    expect(picture(apply(start, { type: "paint", mode: "hide", shape: all }))).toEqual([
      "....",
      "....",
    ]);
  });

  it("changes nothing, and keeps the same mask, when the cells are already so", () => {
    const start = maskFrom(["##..", "##.."]);
    const result = applyFogChange(start, revealLeft);
    expect(result.changed).toEqual([]);
    expect(result.mask).toBe(start);
  });

  it("leaves the mask it was given as it was", () => {
    const start = maskFrom(["....", "...."]);
    applyFogChange(start, revealLeft);
    expect(picture(start)).toEqual(["....", "...."]);
  });

  it("sets listed cells, ignoring any beyond the grid", () => {
    const change: FogChange = { type: "cells", mode: "reveal", ranges: [1, 2, 7, 5] };
    expect(picture(apply(maskFrom(["....", "...."]), change))).toEqual([".##.", "...#"]);
  });
});

describe("inverseOf", () => {
  it("undoes a reveal", () => {
    expect(undone(maskFrom(["....", "...."]), revealLeft)).toEqual(["....", "...."]);
  });

  it("undoes a hide", () => {
    expect(undone(maskFrom(["####", "####"]), { ...revealLeft, mode: "hide" })).toEqual([
      "####",
      "####",
    ]);
  });

  it("doesn't hide cells that were already revealed before the change", () => {
    expect(undone(maskFrom(["#...", "...."]), revealLeft)).toEqual(["#...", "...."]);
  });

  it("doesn't touch what was revealed elsewhere in the meantime, perhaps in another tab", () => {
    expect(undone(maskFrom(["....", "...."]), revealLeft, [revealRight])).toEqual(["..##", "..##"]);
  });

  it("undoes hiding everything, back to exactly what was revealed", () => {
    const hideAll: FogChange = { type: "paint", mode: "hide", shape: { kind: "all" } };
    expect(undone(maskFrom(["#.#.", ".#.#"]), hideAll)).toEqual(["#.#.", ".#.#"]);
  });

  it("is nothing when the change changed nothing", () => {
    expect(inverseOf(revealLeft, [])).toBeUndefined();
  });
});
