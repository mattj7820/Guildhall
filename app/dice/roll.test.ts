import { describe, expect, it } from "vitest";
import { defaultRng, sequenceRng } from "./rng";
import { rollText } from "./roll";

function total(source: string, faces: number[], mode?: "advantage" | "disadvantage") {
  const result = rollText(source, sequenceRng(faces), mode);
  if (!result.ok) throw new Error(result.error);
  return result.result;
}

describe("rollText", () => {
  it("adds dice and modifiers", () => {
    expect(total("2d6+3", [4, 5]).total).toBe(12);
  });

  it("subtracts negative terms", () => {
    expect(total("10 - 2d4", [1, 3]).total).toBe(6);
  });

  it("reports each die and each term's contribution", () => {
    const result = total("1d8 + 1d6 - 1", [7, 2]);
    expect(result.expression).toBe("1d8 + 1d6 − 1");
    expect(result.terms.map((term) => term.subtotal)).toEqual([7, 2, -1]);
    expect(result.terms[0].rolls).toEqual([{ sides: 8, value: 7, kept: true }]);
  });

  it("keeps the higher d20 with advantage", () => {
    const result = total("d20+2", [6, 17], "advantage");
    expect(result.total).toBe(19);
    expect(result.terms[0].rolls).toEqual([
      { sides: 20, value: 6, kept: false },
      { sides: 20, value: 17, kept: true },
    ]);
  });

  it("keeps the lower d20 with disadvantage", () => {
    expect(total("d20+2", [6, 17], "disadvantage").total).toBe(8);
  });

  it("only rolls d20s twice for advantage", () => {
    // One roll for the d6, two for the d20: a third scripted face would be unused.
    const result = total("1d6 + 1d20", [3, 10, 12], "advantage");
    expect(result.total).toBe(15);
  });

  it("passes parse errors through", () => {
    expect(rollText("2d", sequenceRng([]))).toMatchObject({ ok: false });
  });
});

describe("sequenceRng", () => {
  it("refuses a face that isn't on the die", () => {
    expect(() => rollText("1d6", sequenceRng([7]))).toThrow(/d6/);
  });

  it("refuses to roll more than scripted", () => {
    expect(() => rollText("2d6", sequenceRng([1]))).toThrow(/ran out/);
  });
});

describe("defaultRng", () => {
  it("always lands on a face of the die", () => {
    for (let i = 0; i < 1000; i++) {
      const face = defaultRng(20);
      expect(face).toBeGreaterThanOrEqual(1);
      expect(face).toBeLessThanOrEqual(20);
      expect(Number.isInteger(face)).toBe(true);
    }
  });
});
