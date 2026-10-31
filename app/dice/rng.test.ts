import { describe, expect, it } from "vitest";
import { seededRng } from "./rng";

describe("seededRng", () => {
  it("gives the same faces for the same seed", () => {
    const one = seededRng(42);
    const two = seededRng(42);
    const faces = Array.from({ length: 20 }, () => one(20));
    expect(Array.from({ length: 20 }, () => two(20))).toEqual(faces);
  });

  it("gives different faces for different seeds", () => {
    const one = seededRng(1);
    const two = seededRng(2);
    const faces = (rng: typeof one) => Array.from({ length: 10 }, () => rng(1000));
    expect(faces(one)).not.toEqual(faces(two));
  });

  it("stays on the die and reaches every face", () => {
    const rng = seededRng(7);
    const seen = new Set(Array.from({ length: 600 }, () => rng(6)));
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
