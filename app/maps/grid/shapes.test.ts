import { describe, expect, it } from "vitest";
import type { PixelGrid } from "./grid";
import {
  areaPath,
  caughtIn,
  coveredSquares,
  insideArea,
  SPELL_SHAPES,
  type SpellArea,
  type SpellShape,
} from "./shapes";

/** 10-pixel squares (5 ft each), lines through the origin. */
const grid: PixelGrid = { square: 10, x: 0, y: 0 };
const RIGHT: [number, number] = [100, 0];
const area = (shape: SpellShape, feet: number, aim = RIGHT): SpellArea => ({
  shape,
  feet,
  origin: [0, 0],
  aim,
});
const set = (squares: [number, number][]) => new Set(squares.map(([c, r]) => `${c},${r}`));

describe("coveredSquares", () => {
  it("covers the 4 squares round a grid corner with a 5 ft sphere, and 12 with 10 ft", () => {
    expect(set(coveredSquares(grid, area("sphere", 5)))).toEqual(
      set([
        [-1, -1],
        [0, -1],
        [-1, 0],
        [0, 0],
      ]),
    );
    expect(coveredSquares(grid, area("sphere", 10))).toHaveLength(12);
  });

  it("covers a cube's squares, extending the way it's aimed", () => {
    const right = set(coveredSquares(grid, area("cube", 10)));
    expect(right).toEqual(
      set([
        [0, -1],
        [1, -1],
        [0, 0],
        [1, 0],
      ]),
    );
    const up = set(coveredSquares(grid, area("cube", 10, [0, -100])));
    expect(up).toEqual(
      set([
        [-1, -2],
        [0, -2],
        [-1, -1],
        [0, -1],
      ]),
    );
  });

  it("covers a line's row of squares, 5 ft wide", () => {
    const line = {
      ...area("line", 30),
      origin: [0, 5] as [number, number],
      aim: [100, 5] as [number, number],
    };
    expect(coveredSquares(grid, line)).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [4, 0],
      [5, 0],
    ]);
  });

  it("covers a cone that widens as it goes, as wide as it is far", () => {
    const cone = {
      ...area("cone", 15),
      origin: [0, 5] as [number, number],
      aim: [100, 5] as [number, number],
    };
    const byColumn = [0, 1, 2].map(
      (col) => coveredSquares(grid, cone).filter(([c]) => c === col).length,
    );
    expect(byColumn).toEqual([1, 1, 3]);
  });

  it.each(
    SPELL_SHAPES.flatMap((shape) => [10, 15, 20, 30, 60].map((feet) => [shape, feet] as const)),
  )(
    "finds every square a %s of %i ft covers, checked square by square over a wide field",
    (shape, feet) => {
      for (const aim of [RIGHT, [-40, 70], [30, -90], [-100, -100]] as [number, number][]) {
        const spell = { shape, feet, origin: [3, -7] as [number, number], aim };
        const expected: [number, number][] = [];
        for (let row = -40; row <= 40; row++) {
          for (let col = -40; col <= 40; col++) {
            if (insideArea(grid, spell, [col * 10 + 5, row * 10 + 5])) expected.push([col, row]);
          }
        }
        expect(set(coveredSquares(grid, spell))).toEqual(set(expected));
      }
    },
  );
});

describe("caughtIn", () => {
  const squares: [number, number][] = [
    [0, 0],
    [1, 0],
  ];

  it("catches tokens with any of their squares in the area", () => {
    const tokens = [
      { id: "in", at: [15, 5] as const, size: 1 },
      { id: "out", at: [35, 5] as const, size: 1 },
      // Large, on the corner at (30, 10): squares 2..3 × 0..1.
      { id: "large-out", at: [30, 10] as const, size: 2 },
      // Large, on the corner at (20, 10): squares 1..2 × 0..1, one of them in.
      { id: "large-in", at: [20, 10] as const, size: 2 },
    ];
    expect(caughtIn(grid, squares, tokens)).toEqual(["in", "large-in"]);
  });
});

describe("areaPath", () => {
  it("draws each shape", () => {
    for (const shape of SPELL_SHAPES) {
      expect(areaPath(grid, area(shape, 20))).toMatch(/^M.*Z$/);
    }
  });
});
