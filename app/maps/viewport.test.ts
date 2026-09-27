import { describe, expect, it } from "vitest";
import {
  clamp,
  fit,
  pan,
  scaleLimits,
  toImage,
  toScreen,
  viewBox,
  zoomAt,
  zoomPercent,
} from "./viewport";

const WORLD = { width: 3840, height: 2160 };
const SCREEN = { width: 1200, height: 900 };

describe("fit", () => {
  it("fits a wide image to the width and centres it vertically", () => {
    const view = fit(WORLD, SCREEN);
    expect(view.scale).toBeCloseTo(1200 / 3840);
    expect(view.x).toBeCloseTo(0);
    expect(toScreen(view, 0, 0)[1]).toBeCloseTo((900 - 2160 * view.scale) / 2);
  });

  it("fits a tall image to the height and centres it horizontally", () => {
    const view = fit({ width: 1000, height: 2000 }, SCREEN);
    expect(view.scale).toBeCloseTo(900 / 2000);
    expect(toScreen(view, 0, 0)[0]).toBeCloseTo((1200 - 1000 * view.scale) / 2);
    expect(view.y).toBeCloseTo(0);
  });

  it("makes a viewBox that shows exactly the canvas's shape", () => {
    const view = fit({ width: 400, height: 200 }, { width: 800, height: 800 });
    expect(viewBox(view, { width: 800, height: 800 })).toBe("0 -100 400 400");
  });
});

describe("converting between screen and image", () => {
  it("round-trips a point", () => {
    const view = { scale: 2.5, x: 100, y: 40 };
    const [x, y] = toImage(view, 250, 50);
    expect([x, y]).toEqual([200, 60]);
    expect(toScreen(view, x, y)).toEqual([250, 50]);
  });
});

describe("zoomAt", () => {
  it("keeps the point under the cursor still", () => {
    const start = fit(WORLD, SCREEN);
    const cursor = { x: 300, y: 400 };
    const before = toImage(start, cursor.x, cursor.y);
    const zoomed = zoomAt(start, 2, cursor, WORLD, SCREEN);
    expect(zoomed.scale).toBeCloseTo(start.scale * 2);
    const after = toImage(zoomed, cursor.x, cursor.y);
    expect(after[0]).toBeCloseTo(before[0]);
    expect(after[1]).toBeCloseTo(before[1]);
  });

  it("can't zoom out beyond fitting the whole image", () => {
    const start = fit(WORLD, SCREEN);
    expect(zoomAt(start, 0.1, { x: 0, y: 0 }, WORLD, SCREEN)).toEqual(start);
  });

  it("stops zooming in at the limit", () => {
    const zoomed = zoomAt(fit(WORLD, SCREEN), 1000, { x: 600, y: 450 }, WORLD, SCREEN);
    expect(zoomed.scale).toBe(scaleLimits(WORLD, SCREEN).max);
  });

  it("lets a small image zoom in well past its own pixels", () => {
    const tiny = { width: 100, height: 100 };
    expect(scaleLimits(tiny, SCREEN).max).toBeCloseTo(36);
  });
});

describe("pan and clamp", () => {
  it("moves the image with the pointer", () => {
    const start = { scale: 1, x: 1000, y: 500 };
    expect(pan(start, 100, -50, WORLD, SCREEN)).toEqual({ scale: 1, x: 900, y: 550 });
  });

  it("stops at the image's edges", () => {
    const view = pan({ scale: 1, x: 100, y: 100 }, 5000, -5000, WORLD, SCREEN);
    expect(view).toEqual({ scale: 1, x: 0, y: 2160 - 900 });
  });

  it("keeps an axis centred while the whole image fits along it", () => {
    const fitted = fit(WORLD, SCREEN);
    expect(pan(fitted, 0, 300, WORLD, SCREEN)).toEqual(fitted);
  });

  it("brings an out-of-range scale back within limits", () => {
    expect(clamp({ scale: 0.01, x: 0, y: 0 }, WORLD, SCREEN)).toEqual(fit(WORLD, SCREEN));
  });
});

describe("zoomPercent", () => {
  it("is 100% when the image fits, and grows as it zooms in", () => {
    const start = fit(WORLD, SCREEN);
    expect(zoomPercent(start, WORLD, SCREEN)).toBe(100);
    expect(zoomPercent({ ...start, scale: start.scale * 1.5 }, WORLD, SCREEN)).toBe(150);
  });
});
