import { describe, expect, it } from "vitest";
import { clampToBoard, freeSpot, pinOf, stringMiddle, stringPath, tiltOf } from "./layout";

describe("clampToBoard", () => {
  it("keeps a card's whole width on the board", () => {
    expect(clampToBoard({ x: 0.95, y: -0.2 }, 0.17)).toEqual({ x: 0.83, y: 0 });
  });
});

describe("stringPath", () => {
  it("sags below the straight line between two pins", () => {
    // Pins 0.5 apart across the board, at the same height: the curve's control point hangs below.
    expect(stringPath({ x: 0.25, y: 0.5 }, { x: 0.75, y: 0.5 })).toBe(
      "M250,312.5 Q500,372.5 750,312.5",
    );
  });
});

describe("stringMiddle", () => {
  it("is where the sagging curve passes halfway", () => {
    const middle = stringMiddle({ x: 0.25, y: 0.5 }, { x: 0.75, y: 0.5 });
    expect(middle.x).toBeCloseTo(0.5);
    // Halfway down the sag of 60 (in a 625-high view): 30 / 625.
    expect(middle.y).toBeCloseTo(0.5 + 30 / 625);
  });
});

describe("pinOf", () => {
  it("is the middle of a card's top edge", () => {
    expect(pinOf({ kind: "sessions", x: 0.1, y: 0.2 }).x).toBeCloseTo(0.185);
  });
});

describe("tiltOf", () => {
  it("is the same for the same card, and small", () => {
    expect(tiltOf("abc")).toBe(tiltOf("abc"));
    expect(Math.abs(tiltOf("abc"))).toBeLessThanOrEqual(2.5);
  });
});

describe("freeSpot", () => {
  it("finds a spot no card is near", () => {
    const first = freeSpot([], "a");
    const second = freeSpot([first], "b");
    expect(Math.abs(second.x - first.x)).toBeGreaterThan(0.1);
  });
});
