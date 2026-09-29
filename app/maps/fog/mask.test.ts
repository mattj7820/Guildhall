import { describe, expect, it } from "vitest";
import {
  decodeCells,
  encodeCells,
  fogGrid,
  fromRanges,
  hiddenMask,
  LONG_SIDE_CELLS,
  revealedCount,
  toRanges,
} from "./mask";
import { maskFrom } from "./test-builders";

describe("fogGrid", () => {
  it.each([
    ["a 4K world map", { width: 3840, height: 2160 }, { cols: 512, rows: 288 }],
    ["a tall map", { width: 3840, height: 7680 }, { cols: 256, rows: 512 }],
    ["a square dungeon", { width: 5120, height: 5120 }, { cols: 512, rows: 512 }],
    ["a small image", { width: 400, height: 200 }, { cols: 512, rows: 256 }],
    ["a sliver", { width: 5000, height: 2 }, { cols: 512, rows: 1 }],
  ])("gives %s square cells, %s", (_, size, grid) => {
    expect(fogGrid(size)).toEqual(grid);
  });

  it("gives a re-export at another resolution the same grid", () => {
    expect(fogGrid({ width: 7680, height: 4320 })).toEqual(fogGrid({ width: 3840, height: 2160 }));
  });

  it("never has more cells along a side than the long side's count", () => {
    const { cols, rows } = fogGrid({ width: 1234, height: 5678 });
    expect(Math.max(cols, rows)).toBe(LONG_SIDE_CELLS);
  });
});

describe("hiddenMask", () => {
  it("starts with everything fogged", () => {
    const mask = hiddenMask({ cols: 3, rows: 2 });
    expect(mask.cells).toHaveLength(6);
    expect(revealedCount(mask)).toBe(0);
  });
});

describe("encodeCells and decodeCells", () => {
  it.each([
    ["all hidden", ["....", "...."], "8"],
    ["all revealed", ["####", "####"], "0.8"],
    ["runs across rows", ["..##", "#..."], "2.3.3"],
    ["alternating", ["#.#."], "0.1.1.1.1"],
  ])("writes %s as run lengths", (_, rows, text) => {
    const { cells } = maskFrom(rows);
    expect(encodeCells(cells)).toBe(text);
    expect(decodeCells(text, cells.length)).toEqual(cells);
  });

  it("writes long runs in base 36", () => {
    const cells = new Uint8Array(LONG_SIDE_CELLS * LONG_SIDE_CELLS).fill(1);
    expect(encodeCells(cells)).toBe("0.5m9s");
  });

  it("round-trips a large mask exactly", () => {
    const cells = Uint8Array.from({ length: 512 * 288 }, (_, i) =>
      i % 7 < 3 || i % 1000 > 900 ? 1 : 0,
    );
    expect(decodeCells(encodeCells(cells), cells.length)).toEqual(cells);
  });

  it.each([
    ["too few cells", "3", 4],
    ["too many cells", "2.3", 4],
    ["an empty string", "", 4],
    ["a stray character", "2.Z", 4],
    ["an empty run", "2..2", 4],
    ["a negative run", "-1.5", 4],
  ])("refuses %s", (_, text, length) => {
    expect(decodeCells(text, length)).toBeUndefined();
  });
});

describe("toRanges and fromRanges", () => {
  it("joins neighbouring cells into ranges", () => {
    expect(toRanges([2, 3, 4, 9, 11, 12])).toEqual([2, 3, 9, 1, 11, 2]);
    expect(fromRanges([2, 3, 9, 1, 11, 2])).toEqual([2, 3, 4, 9, 11, 12]);
  });

  it("has nothing for no cells", () => {
    expect(toRanges([])).toEqual([]);
    expect(fromRanges([])).toEqual([]);
  });
});
