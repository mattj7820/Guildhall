import { describe, expect, it } from "vitest";
import {
  labelPoint,
  midpoints,
  normalise,
  offset,
  polygonArea,
  svgPoints,
  toPixels,
} from "./geometry";
import type { Point } from "./types";

const WORLD = { width: 3840, height: 2160 };

describe("normalise and toPixels", () => {
  it("stores a pixel position as fractions of the image's size", () => {
    expect(normalise(960, 1080, WORLD)).toEqual([0.25, 0.5]);
  });

  it("keeps points on the image", () => {
    expect(normalise(-20, 5000, WORLD)).toEqual([0, 1]);
  });

  it("rounds to five decimal places", () => {
    expect(normalise(1, 1, { width: 3, height: 7 })).toEqual([0.33333, 0.14286]);
  });

  it("lines an outline up with a re-export at a different resolution", () => {
    const point = normalise(1920, 540, WORLD);
    expect(toPixels(point, { width: 7680, height: 4320 })).toEqual([3840, 1080]);
    expect(toPixels(point, { width: 1920, height: 1080 })).toEqual([960, 270]);
  });
});

describe("offset", () => {
  it("moves a point and keeps it on the image", () => {
    expect(offset([0.5, 0.5], 0.1, -0.2)).toEqual([0.6, 0.3]);
    expect(offset([0.99, 0.01], 0.05, -0.05)).toEqual([1, 0]);
  });
});

describe("polygonArea", () => {
  it.each<[string, Point[], number]>([
    [
      "a square, clockwise",
      [
        [0, 0],
        [0.5, 0],
        [0.5, 0.5],
        [0, 0.5],
      ],
      0.25,
    ],
    [
      "a triangle, anticlockwise",
      [
        [0, 0],
        [0, 1],
        [1, 0],
      ],
      0.5,
    ],
    [
      "points on a line",
      [
        [0, 0],
        [0.5, 0.5],
        [1, 1],
      ],
      0,
    ],
  ])("measures %s", (_name, outline, expected) => {
    expect(polygonArea(outline)).toBeCloseTo(expected);
  });
});

describe("labelPoint", () => {
  it("is the centre of a rectangle, in pixels", () => {
    const outline: Point[] = [
      [0, 0],
      [0.5, 0],
      [0.5, 1],
      [0, 1],
    ];
    const [x, y] = labelPoint(outline, { width: 400, height: 200 });
    expect(x).toBeCloseTo(100);
    expect(y).toBeCloseTo(100);
  });

  it("falls back to the average when the outline has no area", () => {
    const outline: Point[] = [
      [0, 0],
      [0.5, 0.5],
      [1, 1],
    ];
    expect(labelPoint(outline, { width: 100, height: 100 })).toEqual([50, 50]);
  });
});

describe("midpoints", () => {
  it("gives the middle of each edge, including the closing one", () => {
    expect(
      midpoints([
        [0, 0],
        [1, 0],
        [1, 1],
      ]),
    ).toEqual([
      [0.5, 0],
      [1, 0.5],
      [0.5, 0.5],
    ]);
  });
});

describe("svgPoints", () => {
  it("writes the outline in pixels", () => {
    expect(
      svgPoints(
        [
          [0, 0],
          [0.5, 1],
        ],
        { width: 400, height: 200 },
      ),
    ).toBe("0,0 200,200");
  });
});
