import { describe, expect, it } from "vitest";
import { blankSheet, characterSchema, inventorySchema, ITEMS_MAX, sheetSchema } from "./schema";
import { anItem } from "./test-builders";

describe("sheetSchema", () => {
  it("fills in a blank sheet: level 1, every score 10, nothing proficient", () => {
    const sheet = blankSheet();
    expect(sheet).toMatchObject({
      name: "",
      level: 1,
      proficiencyBonus: 2,
      armourClass: 10,
      speed: "30 ft.",
      hp: { current: 0, max: 0, temp: 0 },
      heroicInspiration: false,
      overrides: {},
    });
    expect(Object.values(sheet.abilities)).toEqual([10, 10, 10, 10, 10, 10]);
    expect(new Set(Object.values(sheet.skills))).toEqual(new Set(["none"]));
  });

  it("keeps what's there and fills in fields added since it was saved", () => {
    const sheet = sheetSchema.parse({ name: "Kit", abilities: { dex: 16 } });
    expect(sheet.name).toBe("Kit");
    expect(sheet.abilities).toMatchObject({ dex: 16, str: 10 });
    expect(sheet.notes).toBe("");
  });

  it("reads an unknown proficiency as none rather than refusing the sheet", () => {
    expect(sheetSchema.parse({ skills: { stealth: "master" } }).skills.stealth).toBe("none");
  });

  it.each([
    ["an ability score of 0", { abilities: { str: 0 } }],
    ["an ability score over 30", { abilities: { str: 31 } }],
    ["a fractional score", { abilities: { str: 10.5 } }],
    ["level 21", { level: 21 }],
    ["negative hit points", { hp: { current: -1 } }],
    ["an override of something that isn't derived", { overrides: { "skill.flying": 3 } }],
    ["an enormous override", { overrides: { initiative: 1000 } }],
    ["a very long name", { name: "x".repeat(81) }],
  ])("refuses %s", (_, sheet) => {
    expect(sheetSchema.safeParse(sheet).success).toBe(false);
  });
});

describe("inventorySchema", () => {
  it("accepts items and coins, filling in missing coins", () => {
    const inventory = inventorySchema.parse({ items: [anItem()], purse: { gp: 12 } });
    expect(inventory.purse).toEqual({ cp: 0, sp: 0, ep: 0, gp: 12, pp: 0 });
  });

  it.each([
    ["two items with one ID", { items: [anItem({ id: "a" }), anItem({ id: "a" })] }],
    ["a quantity of 0", { items: [anItem({ quantity: 0 })] }],
    ["an item with no name", { items: [anItem({ name: " " })] }],
    ["negative coins", { purse: { gp: -1 } }],
    [
      "more items than a bag holds",
      { items: Array.from({ length: ITEMS_MAX + 1 }, () => anItem()) },
    ],
  ])("refuses %s", (_, inventory) => {
    expect(inventorySchema.safeParse(inventory).success).toBe(false);
  });
});

describe("characterSchema", () => {
  const base = {
    id: "c1",
    note: "Party/Kit",
    revision: 3,
    createdAt: "2026-09-29T10:00:00.000Z",
    updatedAt: "2026-09-29T10:00:00.000Z",
  };

  it("reads a player character with a sheet", () => {
    const character = characterSchema.parse({ ...base, kind: "pc", sheet: {} });
    expect(character.kind === "pc" && character.sheet.level).toBe(1);
    expect(character.inventory).toEqual({
      items: [],
      purse: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    });
  });

  it("reads a companion, which keeps only hit points and a bag", () => {
    const character = characterSchema.parse({
      ...base,
      kind: "companion",
      hp: { current: 9, max: 22 },
    });
    expect(character).toMatchObject({ kind: "companion", hp: { current: 9, max: 22, temp: 0 } });
  });

  it("refuses an unknown kind of character", () => {
    expect(characterSchema.safeParse({ ...base, kind: "familiar" }).success).toBe(false);
  });
});
