import { describe, expect, it } from "vitest";
import { formatDice, parseDice, type Term } from "./parse";

function terms(source: string): Term[] {
  const result = parseDice(source);
  if (!result.ok) throw new Error(result.error);
  return result.expression.terms;
}

describe("parseDice", () => {
  it.each<[string, Term[]]>([
    ["d20", [{ kind: "dice", sign: 1, count: 1, sides: 20 }]],
    [
      "2d6+3",
      [
        { kind: "dice", sign: 1, count: 2, sides: 6 },
        { kind: "constant", value: 3 },
      ],
    ],
    [
      "1d8 + 1d6 - 1",
      [
        { kind: "dice", sign: 1, count: 1, sides: 8 },
        { kind: "dice", sign: 1, count: 1, sides: 6 },
        { kind: "constant", value: -1 },
      ],
    ],
    [
      "-1 + D4",
      [
        { kind: "constant", value: -1 },
        { kind: "dice", sign: 1, count: 1, sides: 4 },
      ],
    ],
    [
      "10 - 2d4",
      [
        { kind: "constant", value: 10 },
        { kind: "dice", sign: -1, count: 2, sides: 4 },
      ],
    ],
  ])("reads %s", (source, expected) => {
    expect(terms(source)).toEqual(expected);
  });

  it.each([
    ["the Fantasy Statblocks plugin's hit dice", "5d6 + -1"],
    ["a typographic minus", "5d6 − 1"],
  ])("normalises %s", (_label, source) => {
    expect(terms(source).at(-1)).toEqual({ kind: "constant", value: -1 });
  });

  it("reads subtracting a negative as adding", () => {
    expect(terms("5d6 - -2").at(-1)).toEqual({ kind: "constant", value: 2 });
  });

  it.each([
    ["an empty string", "", /Enter dice/],
    ["words", "fireball", /Couldn't read/],
    ["a stray gap between terms", "2d6 3", /Couldn't read/],
    ["a trailing operator", "2d6+", /Couldn't read/],
    ["zero dice", "0d6", /between 1 and 100 dice/],
    ["too many dice", "101d6", /between 1 and 100 dice/],
    ["a zero-sided die", "1d0", /between 1 and 1000 sides/],
    ["an absurd die", "1d1001", /between 1 and 1000 sides/],
  ])("rejects %s with a readable error", (_label, source, error) => {
    const result = parseDice(source);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(error);
  });
});

describe("formatDice", () => {
  it.each([
    ["2d6+3", "2d6 + 3"],
    ["d20 - 1", "1d20 − 1"],
    ["-1+d4", "−1 + 1d4"],
    ["10-2d4", "10 − 2d4"],
    ["5d6 + -1", "5d6 − 1"],
  ])("writes %s as %s", (source, expected) => {
    const result = parseDice(source);
    expect(result.ok && formatDice(result.expression)).toBe(expected);
  });
});
