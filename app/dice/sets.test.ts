import { describe, expect, it } from "vitest";
import { DICE_SETS, chosenSet, isDiceSet, setsFor } from "./sets";

describe("setsFor", () => {
  it("gives the DM every set", () => {
    expect(setsFor(undefined, true)).toEqual([...DICE_SETS]);
  });

  it("gives everyone else only what the DM gave them, in the usual order", () => {
    expect(setsFor(undefined, false)).toEqual([]);
    expect(setsFor({ given: ["blood", "gilded"] }, false)).toEqual(["gilded", "blood"]);
  });

  it("leaves out sets that are no longer in the app", () => {
    expect(setsFor({ given: ["glass", "a set from the future"] }, false)).toEqual(["glass"]);
  });
});

describe("chosenSet", () => {
  it("is the chosen set while they have it", () => {
    expect(chosenSet({ given: ["bone"], set: "bone" }, false)).toBe("bone");
    expect(chosenSet({ set: "glass" }, true)).toBe("glass");
  });

  it("falls back to the theme's dice once the set is taken back, or was never theirs", () => {
    expect(chosenSet({ given: [], set: "bone" }, false)).toBeUndefined();
    expect(chosenSet({ given: ["bone"], set: "glass" }, false)).toBeUndefined();
    expect(chosenSet({ given: ["bone"] }, false)).toBeUndefined();
  });
});

describe("isDiceSet", () => {
  it("knows the sets", () => {
    expect(isDiceSet("gilded")).toBe(true);
    expect(isDiceSet("theme")).toBe(false);
  });
});
