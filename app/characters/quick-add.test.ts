import { describe, expect, it } from "vitest";
import { ITEM_ICONS } from "./item-icons";
import { FALLBACK_ICON, guessIcon, iconById, parseQuickAdd } from "./quick-add";

describe("parseQuickAdd", () => {
  it.each([
    ["rope", "rope", 1],
    ["  healing   potion ", "healing potion", 1],
    ["3 rope", "rope", 3],
    ["3x torch", "torch", 3],
    ["3 x torch", "torch", 3],
    ["torch x5", "torch", 5],
    ["torch ×5", "torch", 5],
    ["50 ft of rope", "50 ft of rope", 1],
    ["10 days of rations", "10 days of rations", 1],
    ["Wax5", "Wax5", 1],
    ["0 arrows", "arrows", 1],
    ["99999 arrows", "arrows", 9999],
  ])("reads %j as %j ×%s", (text, name, quantity) => {
    expect(parseQuickAdd(text)).toEqual({ name, quantity });
  });

  it("ignores blank text", () => {
    expect(parseQuickAdd("   ")).toBeUndefined();
  });
});

describe("guessIcon", () => {
  it.each([
    ["Rope", "rope"],
    ["50 ft of rope", "rope"],
    ["Potion of healing", "potion"],
    ["Healing potion", "potion"],
    ["Bag of holding", "bag"],
    ["Flask of oil", "flask"],
    ["Longsword", "sword"],
    ["Torches", "torch"],
    ["Cloak of many pockets", "cloak"],
    ["Something odd", "curio"],
    ["Thingamajig", FALLBACK_ICON],
  ])("guesses %j → %s", (name, icon) => {
    expect(guessIcon(name)).toBe(icon);
  });
});

describe("the icon set", () => {
  it("has unique IDs, an author and a path for every icon", () => {
    expect(new Set(ITEM_ICONS.map((icon) => icon.id)).size).toBe(ITEM_ICONS.length);
    for (const icon of ITEM_ICONS) {
      expect(icon.author).not.toBe("");
      expect(icon.path).toMatch(/^M/);
    }
  });

  it("falls back to the bag for an unknown icon", () => {
    expect(iconById("gone").id).toBe(FALLBACK_ICON);
  });
});
