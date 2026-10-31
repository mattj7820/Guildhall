import { describe, expect, it } from "vitest";
import { TOKEN_ICONS } from "~/maps/tokens/token-icons";
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

  it("gives every effect what it needs to draw", () => {
    const icons = new Set(TOKEN_ICONS.map((icon) => icon.id));
    const colour = /^#[0-9a-f]{6}$/;
    for (const { id, look } of DICE_STYLES) {
      const colours = [
        look.body,
        look.ink,
        ...(look.pattern?.colours ?? []),
        ...(look.core?.colours ?? []),
        ...(look.inclusions?.colours ?? []),
      ];
      for (const each of colours) expect(each, id).toMatch(colour);
      if (look.pattern) expect(look.pattern.colours.length, id).toBeGreaterThanOrEqual(2);
      if (look.pattern) expect(look.pattern.colours.length, id).toBeLessThanOrEqual(3);
      if (look.inclusions) expect(look.inclusions.count, id).toBeLessThanOrEqual(20);
      for (const symbol of [look.symbols?.high, look.symbols?.low]) {
        if (symbol) expect(icons.has(symbol), `${id}: ${symbol}`).toBe(true);
      }
    }
  });
});
