import { describe, expect, it } from "vitest";
import {
  fromPixels,
  gridPath,
  snapToGrid,
  squareAt,
  squareCentre,
  squaresAcross,
  startingGrid,
  suggestSquare,
  toPixels,
  type PixelGrid,
} from "./grid";

describe("suggestSquare", () => {
  it.each([
    ["a Dungeondraft export", { width: 5120, height: 5120 }, 256],
    ["a tall Dungeondraft export", { width: 3840, height: 7680 }, 256],
    ["an export at 200 pixels a square", { width: 4000, height: 3000 }, 200],
    ["a Roll20-sized map", { width: 1400, height: 1400 }, 140],
  ])("fits %s", (_name, size, expected) => {
    expect(suggestSquare(size)).toBe(expected);
  });

  it("suggests nothing that would make fewer than 10 squares, or doesn't fit", () => {
    expect(suggestSquare({ width: 1024, height: 512 })).toBeUndefined();
    expect(suggestSquare({ width: 1206, height: 1204 })).toBeUndefined();
  });
});

describe("startingGrid", () => {
  it("starts with the suggestion, at the image's corner", () => {
    expect(startingGrid({ width: 5120, height: 2560 })).toEqual({
      square: 0.05,
      origin: [0, 0],
      lines: 0.35,
    });
  });

  it("starts at about 20 squares across when nothing fits", () => {
    const grid = startingGrid({ width: 1206, height: 1204 });
    expect(Math.round(1206 / (grid.square * 1206))).toBe(20);
  });
});

describe("toPixels and fromPixels", () => {
  const size = { width: 1000, height: 500 };

  it("turns fractions into pixels and back", () => {
    const grid = { square: 0.05, origin: [0.02, 0.04] as [number, number], lines: 0.5 };
    expect(toPixels(grid, size)).toEqual({ square: 50, x: 20, y: 20 });
    expect(fromPixels({ square: 50, x: 20, y: 20 }, size, 0.5)).toEqual(grid);
  });

  it("starts the lines at the image's edge wherever the origin is", () => {
    const grid = { square: 0.05, origin: [0.99, -0.02] as [number, number], lines: 0.5 };
    const pixels = toPixels(grid, size);
    expect(pixels.x).toBeCloseTo(40);
    expect(pixels.y).toBeCloseTo(40);
  });

  it("keeps squares square on an image that isn't", () => {
    expect(toPixels({ square: 0.1, origin: [0, 0], lines: 1 }, size).square).toBe(100);
  });
});

describe("squares", () => {
  const grid: PixelGrid = { square: 10, x: 5, y: 5 };

  it("finds the square a point is in, and its centre", () => {
    expect(squareAt(grid, [5, 5])).toEqual([0, 0]);
    expect(squareAt(grid, [14.9, 25])).toEqual([0, 2]);
    expect(squareAt(grid, [4, 4])).toEqual([-1, -1]);
    expect(squareCentre(grid, [0, 2])).toEqual([10, 30]);
  });

  it("counts squares across and down", () => {
    expect(squaresAcross({ square: 256, x: 0, y: 0 }, { width: 3840, height: 7680 })).toEqual([
      15, 30,
    ]);
  });
});

describe("snapToGrid", () => {
  const grid: PixelGrid = { square: 10, x: 0, y: 0 };

  it.each([1, 3])("puts a token %i square(s) across in the middle of a square", (size) => {
    expect(snapToGrid(grid, [13, 27], size)).toEqual([15, 25]);
  });

  it.each([2, 4])("puts a token %i squares across on the nearest corner", (size) => {
    expect(snapToGrid(grid, [13, 27], size)).toEqual([10, 30]);
    expect(snapToGrid(grid, [16, 24], size)).toEqual([20, 20]);
  });

  it("follows the grid's offset", () => {
    expect(snapToGrid({ square: 10, x: 3, y: 7 }, [4, 8])).toEqual([8, 12]);
  });
});

describe("gridPath", () => {
  it("draws every line across the image, and no more", () => {
    const path = gridPath({ square: 10, x: 5, y: 0 }, { width: 30, height: 20 });
    expect(path).toBe("M5,0V20M15,0V20M25,0V20M0,0H30M0,10H30M0,20H30");
  });
});
