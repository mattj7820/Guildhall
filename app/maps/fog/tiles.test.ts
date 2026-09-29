import { describe, expect, it } from "vitest";
import { maskFrom } from "./test-builders";
import {
  cellAlpha,
  FULL_TILE,
  pixelAlpha,
  tileCount,
  tileRect,
  tileState,
  tileStates,
  TILE_OVERLAP,
} from "./tiles";
import type { FogMask } from "./types";

/** A fixed pseudo-random sequence, so a failure can be reproduced. */
function sequence(seed: number) {
  return () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
}

function randomMask(random: () => number, cols: number, rows: number, share: number): FogMask {
  const cells = Uint8Array.from({ length: cols * rows }, () => (random() < share ? 1 : 0));
  return { cols, rows, cells };
}

describe("cellAlpha", () => {
  it("keeps hidden cells transparent and fades revealed ones in from the edge", () => {
    const mask = maskFrom(["..########"]);
    const alpha = Array.from(cellAlpha(mask));
    expect(alpha.slice(0, 2)).toEqual([0, 0]);
    // Rising with the distance from the hidden cells, then fully opaque.
    expect(alpha[2]).toBeGreaterThan(0);
    expect(alpha[2]).toBeLessThan(alpha[3]);
    expect(alpha[3]).toBeLessThan(alpha[4]);
    expect(alpha.slice(5)).toEqual([255, 255, 255, 255, 255]);
  });

  it("doesn't fade at the image's own edges", () => {
    expect(Array.from(cellAlpha(maskFrom(["###", "###"])))).toEqual([255, 255, 255, 255, 255, 255]);
  });
});

describe("pixelAlpha", () => {
  it("never shows a pixel in a hidden cell, for any fog and image size", () => {
    const random = sequence(11);
    for (let trial = 0; trial < 40; trial++) {
      const cols = 3 + Math.floor(random() * 20);
      const rows = 3 + Math.floor(random() * 20);
      const mask = randomMask(random, cols, rows, 0.6);
      const image = {
        width: 20 + Math.floor(random() * 200),
        height: 20 + Math.floor(random() * 200),
      };
      const pixels = pixelAlpha(mask, cellAlpha(mask), image, [0, 0, image.width, image.height]);
      for (let y = 0; y < image.height; y++) {
        for (let x = 0; x < image.width; x++) {
          const col = Math.floor(((x + 0.5) / image.width) * cols);
          const row = Math.floor(((y + 0.5) / image.height) * rows);
          if (!mask.cells[row * cols + col]) expect(pixels[y * image.width + x]).toBe(0);
        }
      }
    }
  });

  it("shows every pixel of a fully revealed map", () => {
    const mask = maskFrom(Array(12).fill("############"));
    const pixels = pixelAlpha(mask, cellAlpha(mask), { width: 120, height: 120 }, [0, 0, 120, 120]);
    expect(pixels.every((alpha) => alpha === 255)).toBe(true);
  });

  it("fades a reveal in from its edge, and shows its middle fully", () => {
    // Revealed in the middle eight cells of twenty, on an image 10 pixels a cell.
    const mask = maskFrom(["......########......"]);
    const row = pixelAlpha(mask, cellAlpha(mask), { width: 200, height: 10 }, [0, 5, 200, 1]);
    expect(row[55]).toBe(0);
    expect(row[65]).toBeGreaterThan(0);
    expect(row[65]).toBeLessThan(255);
    expect(row[100]).toBe(255);
    expect(row[145]).toBe(0);
  });

  it("gives the same pixels for a part of the image as for the whole", () => {
    const random = sequence(5);
    const mask = randomMask(random, 16, 8, 0.5);
    const alpha = cellAlpha(mask);
    const image = { width: 160, height: 80 };
    const whole = pixelAlpha(mask, alpha, image, [0, 0, 160, 80]);
    const part = pixelAlpha(mask, alpha, image, [40, 20, 30, 10]);
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 30; x++) expect(part[y * 30 + x]).toBe(whole[(20 + y) * 160 + 40 + x]);
    }
  });
});

describe("tiles", () => {
  /** A 64×32 image on a 16×8 grid (4 pixels a cell), in 16-pixel tiles: 4 × 2 tiles. */
  const IMAGE = { width: 64, height: 32 };
  const SIZE = 16;
  const states = (rows: string[]) => {
    const mask = maskFrom(rows);
    return tileStates(mask, cellAlpha(mask), IMAGE, SIZE);
  };
  const HIDDEN = Array(8).fill("................");
  const REVEALED = Array(8).fill("################");

  it("cuts the image into tiles, with a pixel of overlap inside the image", () => {
    expect(tileCount(IMAGE, SIZE)).toEqual({ columns: 4, rows: 2 });
    expect(tileCount({ width: 65, height: 32 }, SIZE)).toEqual({ columns: 5, rows: 2 });
    expect(tileRect(IMAGE, 0, 0, SIZE)).toEqual([0, 0, SIZE + TILE_OVERLAP, SIZE + TILE_OVERLAP]);
    expect(tileRect(IMAGE, 3, 1, SIZE)).toEqual([48, 16, 16, 16]);
  });

  it("gives players no tiles of a fully fogged map", () => {
    expect(states(HIDDEN)).toEqual([]);
  });

  it("gives every tile whole on a fully revealed map", () => {
    const all = states(REVEALED);
    expect(all).toHaveLength(8);
    expect(all.every((tile) => tile.key === FULL_TILE)).toBe(true);
  });

  it("gives only the tiles a reveal reaches, with the edge ones marked partial", () => {
    // The left quarter of the map revealed: tile column 0 is inside, column 1 holds its fade.
    const left = states(Array(8).fill("####............"));
    expect(left.map(({ x, y }) => [x, y])).toEqual([
      [0, 0],
      [0, 1],
    ]);
    expect(left.every((tile) => tile.key !== FULL_TILE)).toBe(true);
  });

  it("leaves out a tile whose own cells are all hidden, even beside a reveal", () => {
    const mask = maskFrom(Array(8).fill("####............"));
    expect(tileState(mask, cellAlpha(mask), IMAGE, 1, 0, SIZE)).toBeUndefined();
  });

  it("keeps a tile's key while the fog around it stays the same", () => {
    const rows = Array(8).fill("######..........");
    const moreFarAway = [...rows.slice(0, 7), "######.........#"];
    const key = (fog: string[]) => states(fog).find((tile) => tile.x === 0 && tile.y === 0)?.key;
    expect(key(rows)).toBe(key(moreFarAway));
  });

  it("changes a tile's key when the fog around it changes", () => {
    const key = (fog: string[]) => states(fog).find((tile) => tile.x === 0 && tile.y === 0)?.key;
    const before = Array(8).fill("######..........");
    const after = ["#######.........", ...before.slice(1)];
    expect(key(before)).not.toBe(key(after));
  });
});
