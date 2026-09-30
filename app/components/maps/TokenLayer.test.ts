import { describe, expect, it } from "vitest";
import { initials } from "./TokenLayer";

describe("initials", () => {
  it.each([
    ["Buddy", "B"],
    ["Fixture Minion 3", "F3"],
    ["goblin 12", "G12"],
    ["Room 101 guard", "R"],
  ])("shows %s as %s", (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});
