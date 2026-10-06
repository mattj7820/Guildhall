import { describe, expect, it } from "vitest";
import { numberedNames } from "./naming";
import { MARKER_NAME_MAX } from "./schema";

describe("numberedNames", () => {
  it("leaves a single new name as it is", () => {
    expect(numberedNames("Mira Stonehand", 1, ["Innkeeper"])).toEqual(["Mira Stonehand"]);
  });

  it("numbers several from 1", () => {
    expect(numberedNames("Bandit", 3, [])).toEqual(["Bandit 1", "Bandit 2", "Bandit 3"]);
  });

  it("carries on after the highest number already on the map", () => {
    expect(numberedNames("Bandit", 2, ["Bandit 1", "Bandit 4", "Guard 9"])).toEqual([
      "Bandit 5",
      "Bandit 6",
    ]);
  });

  it("numbers a single one whose name is taken, counting the plain name as the first", () => {
    expect(numberedNames("Bandit", 1, ["Bandit"])).toEqual(["Bandit 2"]);
  });

  it("ignores case and spacing when comparing, but keeps the name as typed", () => {
    expect(numberedNames("  Cave  bear ", 1, ["cave BEAR 2"])).toEqual(["Cave bear 3"]);
  });

  it("doesn't count names that merely start the same", () => {
    expect(numberedNames("Guard", 1, ["Guard captain", "Guardsman 3", "Guard 2b"])).toEqual([
      "Guard",
    ]);
  });

  it("cuts a long name so its number still fits", () => {
    const long = "A".repeat(MARKER_NAME_MAX);
    const [first] = numberedNames(long, 2, []);
    expect(first).toHaveLength(MARKER_NAME_MAX);
    expect(first.endsWith(" 1")).toBe(true);
  });
});
