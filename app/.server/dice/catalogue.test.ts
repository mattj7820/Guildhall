import { describe, expect, it } from "vitest";
import { DICE_STYLES, chosenSet, diceStyle, setsFor } from "./catalogue";

const ids = (styles: readonly { id: string }[]) => styles.map((style) => style.id);

describe("the catalogue", () => {
  it("never repeats an ID", () => {
    expect(new Set(ids(DICE_STYLES)).size).toBe(DICE_STYLES.length);
  });

  it("finds a style by its ID, and nothing for one no longer in the app", () => {
    expect(diceStyle("bone")?.label).toBe("Bone");
    expect(diceStyle("a style from the future")).toBeUndefined();
    expect(diceStyle(undefined)).toBeUndefined();
  });
});

describe("setsFor", () => {
  it("gives the DM every style", () => {
    expect(setsFor(undefined, true)).toEqual(DICE_STYLES);
  });

  it("gives everyone else only what the DM gave them, in the usual order", () => {
    expect(setsFor(undefined, false)).toEqual([]);
    expect(ids(setsFor({ given: ["blood", "gilded"] }, false))).toEqual(["gilded", "blood"]);
  });

  it("leaves out styles that are no longer in the app", () => {
    expect(ids(setsFor({ given: ["glass", "a set from the future"] }, false))).toEqual(["glass"]);
  });
});

describe("chosenSet", () => {
  it("is the chosen style while they have it", () => {
    expect(chosenSet({ given: ["bone"], set: "bone" }, false)?.id).toBe("bone");
    expect(chosenSet({ set: "glass" }, true)?.id).toBe("glass");
  });

  it("falls back to the theme's dice once the style is taken back, or was never theirs", () => {
    expect(chosenSet({ given: [], set: "bone" }, false)).toBeUndefined();
    expect(chosenSet({ given: ["bone"], set: "glass" }, false)).toBeUndefined();
    expect(chosenSet({ given: ["bone"] }, false)).toBeUndefined();
  });
});
