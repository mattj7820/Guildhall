import { describe, expect, it } from "vitest";
import { DICE_STYLES, diceStyle } from "./catalogue";

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
