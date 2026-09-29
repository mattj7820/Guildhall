import { describe, expect, it } from "vitest";
import { fogChangesSchema, FOG_BATCH_MAX, STROKE_POINTS_MAX } from "./schema";

const stroke = {
  type: "paint",
  mode: "reveal",
  shape: { kind: "stroke", points: [[0.5, 0.5]], radius: 0.03 },
};
const square = [
  [0.1, 0.1],
  [0.2, 0.1],
  [0.2, 0.2],
  [0.1, 0.2],
];

describe("fogChangesSchema", () => {
  it.each([
    ["a brush stroke", stroke],
    [
      "an area or rectangle",
      { type: "paint", mode: "hide", shape: { kind: "polygon", points: square } },
    ],
    ["everything", { type: "paint", mode: "reveal", shape: { kind: "all" } }],
    ["an undo", { type: "cells", mode: "hide", ranges: [0, 4, 10, 2] }],
  ])("accepts %s", (_, change) => {
    expect(fogChangesSchema.safeParse([change]).success).toBe(true);
  });

  it.each([
    ["no changes", []],
    ["too many changes", Array(FOG_BATCH_MAX + 1).fill(stroke)],
    ["a point off the map", [{ ...stroke, shape: { ...stroke.shape, points: [[1.2, 0.5]] } }]],
    ["an empty stroke", [{ ...stroke, shape: { ...stroke.shape, points: [] } }]],
    [
      "an endless stroke",
      [
        {
          ...stroke,
          shape: { ...stroke.shape, points: Array(STROKE_POINTS_MAX + 1).fill([0.5, 0.5]) },
        },
      ],
    ],
    ["a brush of no size", [{ ...stroke, shape: { ...stroke.shape, radius: 0 } }]],
    [
      "a polygon of two points",
      [{ type: "paint", mode: "reveal", shape: { kind: "polygon", points: square.slice(0, 2) } }],
    ],
    ["an unknown mode", [{ ...stroke, mode: "peek" }]],
    ["an unknown shape", [{ ...stroke, shape: { kind: "circle" } }]],
    ["unpaired ranges", [{ type: "cells", mode: "hide", ranges: [0, 4, 10] }]],
    ["a negative cell", [{ type: "cells", mode: "hide", ranges: [-1, 4] }]],
    ["a fractional cell", [{ type: "cells", mode: "hide", ranges: [1.5, 4] }]],
  ])("refuses %s", (_, changes) => {
    expect(fogChangesSchema.safeParse(changes).success).toBe(false);
  });
});
