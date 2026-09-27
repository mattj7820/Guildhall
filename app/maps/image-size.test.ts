import { describe, expect, it } from "vitest";
import { sameShape } from "./image-size";

const WORLD = { width: 3840, height: 2160 };

describe("sameShape", () => {
  it.each([
    ["the same image", WORLD, true],
    ["a re-export at twice the resolution", { width: 7680, height: 4320 }, true],
    ["a re-export at half the resolution", { width: 1920, height: 1080 }, true],
    ["a pixel of rounding", { width: 1921, height: 1080 }, true],
    ["a wider crop", { width: 4000, height: 2000 }, false],
    ["a square image", { width: 2160, height: 2160 }, false],
  ])("%s: %s", (_name, actual, expected) => {
    expect(sameShape(WORLD, actual)).toBe(expected);
  });
});
