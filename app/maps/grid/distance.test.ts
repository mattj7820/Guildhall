import { describe, expect, it } from "vitest";
import { feetAlong, feetBetween, formatFeet } from "./distance";

/** 20-pixel squares, 5 ft each. */
const grid = { square: 20, x: 0, y: 0 };

describe("feetBetween", () => {
  it("measures a square's side as 5 ft, and half of one as 2.5 ft", () => {
    expect(feetBetween(grid, [0, 0], [20, 0])).toBe(5);
    expect(feetBetween(grid, [0, 0], [0, 10])).toBe(2.5);
  });

  it("measures diagonals at their true length, longer than counting squares", () => {
    expect(feetBetween(grid, [0, 0], [60, 80])).toBe(25);
    expect(feetBetween(grid, [0, 0], [20, 20])).toBeCloseTo(7.07);
  });

  it("doesn't mind which way round", () => {
    expect(feetBetween(grid, [60, 80], [0, 0])).toBe(25);
  });
});

describe("feetAlong", () => {
  it("adds up each turn of a path", () => {
    expect(
      feetAlong(grid, [
        [0, 0],
        [40, 0],
        [40, 60],
      ]),
    ).toBe(25);
  });

  it("is nothing for a single point", () => {
    expect(feetAlong(grid, [[5, 5]])).toBe(0);
  });
});

describe("formatFeet", () => {
  it.each([
    [0, "0 ft"],
    [2.5, "2.5 ft"],
    [7.07, "7 ft"],
    [7.3, "7.5 ft"],
    [30, "30 ft"],
  ])("writes %f feet as %s", (feet, expected) => {
    expect(formatFeet(feet)).toBe(expected);
  });
});
