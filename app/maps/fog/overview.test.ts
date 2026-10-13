import { describe, expect, it } from "vitest";
import { borrowedFrom, cellOverview, maskOverview } from "./overview";
import type { RawImage } from "./overview";
import { maskFrom } from "./test-builders";
import type { FogMask } from "./types";

type Colour = [number, number, number, number?];

/** An RGBA image from a colour for each pixel. */
function imageOf(width: number, height: number, colour: (x: number, y: number) => Colour) {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a = 255] = colour(x, y);
      data.set([r, g, b, a], (y * width + x) * 4);
    }
  }
  return { width, height, channels: 4, data } satisfies RawImage;
}

function pixels(image: RawImage): number[][] {
  return Array.from({ length: image.width * image.height }, (_, i) =>
    Array.from(image.data.subarray(i * image.channels, (i + 1) * image.channels)),
  );
}

describe("cellOverview", () => {
  it("averages the pixels in each cell", () => {
    const image = imageOf(4, 2, (x) => (x < 2 ? [0, 0, 0] : [200, 100, 0]));
    image.data.set([100, 100, 100, 255], 0);
    expect(pixels(cellOverview(image, { cols: 2, rows: 1 }))).toEqual([
      [25, 25, 25, 255],
      [200, 100, 0, 255],
    ]);
  });

  it("puts each pixel in the cell its centre is in", () => {
    // 2.5 pixels a cell: pixels 0 and 1 are in the first, 2 to 4 in the second.
    const image = imageOf(5, 1, (x) => (x === 2 ? [255, 0, 0] : [0, 0, 0]));
    expect(pixels(cellOverview(image, { cols: 2, rows: 1 }))).toEqual([
      [0, 0, 0, 255],
      [85, 0, 0, 255],
    ]);
  });

  it("averages colours by their opacity, so transparency doesn't darken a cell", () => {
    const image = imageOf(2, 1, (x) => (x === 0 ? [200, 0, 0, 255] : [0, 0, 0, 0]));
    expect(pixels(cellOverview(image, { cols: 1, rows: 1 }))).toEqual([[200, 0, 0, 128]]);
  });

  it("reads images without an alpha channel as opaque", () => {
    const image: RawImage = {
      width: 2,
      height: 1,
      channels: 3,
      data: Uint8Array.of(10, 20, 30, 30, 40, 50),
    };
    expect(pixels(cellOverview(image, { cols: 1, rows: 1 }))).toEqual([[20, 30, 40, 255]]);
  });

  it("colours the cells of an image smaller than its grid from the pixel at their centre", () => {
    const image = imageOf(2, 1, (x) => (x === 0 ? [255, 0, 0] : [0, 0, 255]));
    expect(pixels(cellOverview(image, { cols: 4, rows: 1 }))).toEqual([
      [255, 0, 0, 255],
      [255, 0, 0, 255],
      [0, 0, 255, 255],
      [0, 0, 255, 255],
    ]);
  });
});

describe("borrowedFrom", () => {
  it("is undefined when every cell has pixels of its own", () => {
    expect(borrowedFrom({ width: 1000, height: 600 }, { cols: 512, rows: 307 })).toBeUndefined();
  });

  it("names the cell whose pixels colour an empty one", () => {
    // Pixel 0's centre is in cell 1 of 4, pixel 1's in cell 3.
    expect(Array.from(borrowedFrom({ width: 2, height: 1 }, { cols: 4, rows: 1 })!)).toEqual([
      1, 1, 3, 3,
    ]);
  });
});

describe("maskOverview", () => {
  const grey = (cols: number, rows: number) => imageOf(cols, rows, () => [90, 90, 90]);

  it("takes out hidden cells, keeps revealed ones and fades the edge", () => {
    const mask = maskFrom(["..########"]);
    const masked = pixels(maskOverview(grey(10, 1), mask, { width: 100, height: 10 }));
    expect(masked.slice(0, 2)).toEqual([
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    expect(masked[2].slice(0, 3)).toEqual([90, 90, 90]);
    expect(masked[2][3]).toBeGreaterThan(0);
    expect(masked[2][3]).toBeLessThan(255);
    expect(masked[9]).toEqual([90, 90, 90, 255]);
  });

  it("hides a borrowed cell when the cell it borrowed from is hidden", () => {
    // A 2-pixel image on 4 cells: cell 2 is coloured by cell 3's pixel, which is hidden.
    const overview = cellOverview(
      imageOf(2, 1, () => [255, 0, 255]),
      { cols: 4, rows: 1 },
    );
    const mask = maskFrom(["###."]);
    expect(pixels(maskOverview(overview, mask, { width: 2, height: 1 }))[2]).toEqual([0, 0, 0, 0]);
  });

  it("refuses a fog that doesn't fit the overview", () => {
    expect(() => maskOverview(grey(4, 2), maskFrom(["###"]), { width: 40, height: 20 })).toThrow();
  });

  it("never shows anything of a pixel under a hidden cell", () => {
    // Odd sizes, so cells don't line up with pixels: pixels under hidden cells are magenta.
    const random = sequence(7);
    for (const [width, height, cols, rows] of [
      [37, 23, 7, 5],
      [101, 64, 16, 10],
      [5, 3, 8, 5],
    ]) {
      const mask = randomMask(random, cols, rows);
      const under = (x: number, y: number) =>
        mask.cells[
          Math.min(rows - 1, Math.floor((y + 0.5) / (height / rows))) * cols +
            Math.min(cols - 1, Math.floor((x + 0.5) / (width / cols)))
        ];
      const image = imageOf(width, height, (x, y) => (under(x, y) ? [0, 160, 0] : [255, 0, 255]));
      const masked = maskOverview(cellOverview(image, mask), mask, { width, height });
      // Hidden cells are all zeros, and the rest have no magenta in them.
      for (const [r, , b] of pixels(masked)) expect([r, b]).toEqual([0, 0]);
    }
  });
});

/** A fixed pseudo-random sequence, so a failure can be reproduced. */
function sequence(seed: number) {
  return () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
}

function randomMask(random: () => number, cols: number, rows: number): FogMask {
  const cells = Uint8Array.from({ length: cols * rows }, () => (random() < 0.5 ? 1 : 0));
  return { cols, rows, cells };
}
