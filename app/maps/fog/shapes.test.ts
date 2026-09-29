import { describe, expect, it } from "vitest";
import type { Point } from "../types";
import { applyFogChange } from "./changes";
import { cellsInPolygon, cellsInStroke } from "./shapes";
import { hiddenMask } from "./mask";
import { picture } from "./test-builders";
import type { FogGrid, FogShape } from "./types";

/** An 8×4 grid, like a 2:1 image. */
const GRID: FogGrid = { cols: 8, rows: 4 };

function revealed(shape: FogShape, grid = GRID): string[] {
  return picture(applyFogChange(hiddenMask(grid), { type: "paint", mode: "reveal", shape }).mask);
}

const LEFT_HALF: Point[] = [
  [0, 0],
  [0.5, 0],
  [0.5, 1],
  [0, 1],
];

describe("polygons", () => {
  it("cover the cells whose centre is inside", () => {
    expect(revealed({ kind: "polygon", points: LEFT_HALF })).toEqual([
      "####....",
      "####....",
      "####....",
      "####....",
    ]);
  });

  it("follow a slanted edge", () => {
    const triangle: Point[] = [
      [0, 0],
      [1, 0],
      [0, 1],
    ];
    expect(revealed({ kind: "polygon", points: triangle })).toEqual([
      "#######.",
      "#####...",
      "###.....",
      "#.......",
    ]);
  });

  it("still cover the cell under a polygon too small to hold a cell's centre", () => {
    const tiny: Point[] = [
      [0.26, 0.26],
      [0.3, 0.26],
      [0.28, 0.3],
    ];
    expect(revealed({ kind: "polygon", points: tiny })).toEqual([
      "........",
      "..#.....",
      "........",
      "........",
    ]);
  });
});

describe("brush strokes", () => {
  it("are round on the image, whatever the grid's shape", () => {
    expect(revealed({ kind: "stroke", points: [[0.5, 0.5]], radius: 0.25 })).toEqual([
      "...##...",
      "..####..",
      "..####..",
      "...##...",
    ]);
  });

  it("cover a band along the path", () => {
    const across: Point[] = [
      [0, 0.5],
      [1, 0.5],
    ];
    expect(revealed({ kind: "stroke", points: across, radius: 0.1 })).toEqual([
      "........",
      "########",
      "########",
      "........",
    ]);
  });

  it("follow every segment of a bent path", () => {
    const bend: Point[] = [
      [0.0625, 0.125],
      [0.5625, 0.125],
      [0.5625, 0.875],
    ];
    expect(revealed({ kind: "stroke", points: bend, radius: 0.01 })).toEqual([
      "#####...",
      "....#...",
      "....#...",
      "....#...",
    ]);
  });

  it("always paint the cell under the pointer, however small the brush", () => {
    expect(revealed({ kind: "stroke", points: [[0.0625, 0.125]], radius: 0.001 })).toEqual([
      "#.......",
      "........",
      "........",
      "........",
    ]);
  });

  it("stop at the edge of the map", () => {
    expect(revealed({ kind: "stroke", points: [[0, 0]], radius: 0.2 })).toEqual([
      "##......",
      "#.......",
      "........",
      "........",
    ]);
  });
});

describe("everything", () => {
  it("covers every cell", () => {
    expect(revealed({ kind: "all" }, { cols: 3, rows: 2 })).toEqual(["###", "###"]);
  });
});

describe("the row-by-row fill", () => {
  /** The plain definition: every cell whose centre is inside, by the even-odd rule. */
  function naive(grid: FogGrid, outline: Point[]): number[] {
    const polygon = outline.map(([x, y]) => [x * grid.cols, y * grid.rows]);
    const cells: number[] = [];
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        const [x, y] = [col + 0.5, row + 0.5];
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
          const [xi, yi] = polygon[i];
          const [xj, yj] = polygon[j];
          if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) cells.push(row * grid.cols + col);
      }
    }
    return cells;
  }

  /** A fixed pseudo-random sequence, so a failure can be reproduced. */
  function sequence(seed: number) {
    return () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  }

  it("agrees with testing every cell's centre, for random outlines", () => {
    const random = sequence(7);
    const grid = { cols: 40, rows: 25 };
    for (let trial = 0; trial < 200; trial++) {
      const outline = Array.from({ length: 3 + Math.floor(random() * 10) }, (): Point => [
        random(),
        random(),
      ]);
      const expected = naive(grid, outline);
      if (expected.length === 0) continue; // Tiny polygons fall back to the cell under them.
      expect(cellsInPolygon(grid, outline)).toEqual(expected);
    }
  });
});

describe("speed", () => {
  const WORLD = { cols: 512, rows: 512 };

  it("paints a long stroke across the whole map quickly", () => {
    const zigzag = Array.from({ length: 4000 }, (_, i): Point => [i / 3999, (i % 40) / 39]);
    const started = performance.now();
    cellsInStroke(WORLD, zigzag, 0.05);
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it("fills a detailed outline the size of the map quickly", () => {
    const circle = Array.from({ length: 500 }, (_, i): Point => {
      const angle = (i / 500) * 2 * Math.PI;
      return [0.5 + 0.5 * Math.cos(angle), 0.5 + 0.5 * Math.sin(angle)];
    });
    const started = performance.now();
    cellsInPolygon(WORLD, circle);
    expect(performance.now() - started).toBeLessThan(200);
  });
});
