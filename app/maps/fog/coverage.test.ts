import { describe, expect, it } from "vitest";
import type { Point } from "../types";
import { areaRevealed, revealedShare } from "./coverage";
import { maskFrom } from "./test-builders";

/** An area over the middle four columns of an 8×2 grid: eight cells. */
const MIDDLE: Point[] = [
  [0.25, 0],
  [0.75, 0],
  [0.75, 1],
  [0.25, 1],
];

describe("revealedShare and areaRevealed", () => {
  it.each([
    ["fogged", ["........", "........"], 0, false],
    ["grazed at the edge", ["..#.....", "........"], 1 / 8, false],
    ["under half revealed", ["..###...", "........"], 3 / 8, false],
    ["exactly half revealed", ["..####..", "........"], 1 / 2, true],
    ["mostly revealed", ["..####..", "..##...."], 6 / 8, true],
    ["fully revealed", ["..####..", "..####.."], 1, true],
  ])("an area that's %s", (_, rows, share, seen) => {
    const mask = maskFrom(rows);
    expect(revealedShare(mask, MIDDLE)).toBe(share);
    expect(areaRevealed(mask, MIDDLE)).toBe(seen);
  });

  it("ignores what's revealed outside the area", () => {
    expect(areaRevealed(maskFrom(["##....##", "##....##"]), MIDDLE)).toBe(false);
  });

  it("judges an area smaller than a cell by the cell under it", () => {
    const tiny: Point[] = [
      [0.26, 0.26],
      [0.3, 0.26],
      [0.28, 0.3],
    ];
    expect(areaRevealed(maskFrom(["..#.....", "........"]), tiny)).toBe(true);
    expect(areaRevealed(maskFrom(["...#####", "########"]), tiny)).toBe(false);
  });
});
