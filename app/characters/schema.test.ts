import { describe, expect, it } from "vitest";
import {
  blankSheet,
  characterSchema,
  inventorySchema,
  ITEMS_MAX,
  PREPARE_MAX,
  sheetSchema,
} from "./schema";
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

describe("sheets saved before spells, uses and rests", () => {
  /** A whole sheet as the first sheet slice stored it, before any of the tracking fields. */
  const savedBefore = {
    name: "Kit",
    species: "Halfling",
    className: "Rogue",
    level: 3,
    background: "Sailor",
    abilities: { str: 8, dex: 17, con: 12, int: 13, wis: 10, cha: 14 },
    proficiencyBonus: 2,
    saves: {
      str: "none",
      dex: "proficient",
      con: "none",
      int: "proficient",
      wis: "none",
      cha: "none",
    },
    skills: { stealth: "expertise" },
    overrides: { initiative: 5 },
    armourClass: 14,
    speed: "25 ft.",
    hp: { current: 17, max: 21, temp: 3 },
    heroicInspiration: true,
    senses: "",
    languages: "Common",
    proficiencies: "",
    defences: "",
    conditions: "",
    notes: "Fixture: notes from before the tracking fields",
  };

  it("loads unchanged, with nothing to track yet", () => {
    const sheet = sheetSchema.parse(savedBefore);
    expect(sheet).toMatchObject(savedBefore);
    expect(sheet).toMatchObject({ spells: [], features: [], attacks: [], concentrating: "" });
    expect(sheet.spellAbility).toBeUndefined();
    expect(sheet.spellSlots).toHaveLength(9);
    expect(sheet.spellSlots.every((slot) => slot.max === 0 && slot.used === 0)).toBe(true);
    expect(sheet.hitDice).toEqual({
      d6: { max: 0, used: 0 },
      d8: { max: 0, used: 0 },
      d10: { max: 0, used: 0 },
      d12: { max: 0, used: 0 },
    });
  });

  it("reads back exactly what it writes, so saving never changes a sheet", () => {
    const sheet = sheetSchema.parse(savedBefore);
    expect(sheetSchema.parse(JSON.parse(JSON.stringify(sheet)))).toEqual(sheet);
  });
});

describe("sheets saved before preparing spells", () => {
  /** Spells as the tracking slice stored them, before they could be prepared. */
  const savedBefore = {
    className: "Fixture class",
    spellAbility: "wis",
    spells: [
      { id: "s0", name: "Fixture Spark", level: 0, castingTime: "1 action" },
      { id: "s1", name: "Fixture Ward", level: 1, concentration: true },
      { id: "s2", name: "Fixture Gift", level: 1, freeUse: "f1" },
    ],
  };

  it("loads every spell as prepared, with no number to prepare, so nothing is hidden", () => {
    const sheet = sheetSchema.parse(savedBefore);
    expect(sheet.spells.map((spell) => spell.prepared)).toEqual([true, true, true]);
    expect(sheet.spellsToPrepare).toBeUndefined();
    expect(sheet.spells[1]).toMatchObject(savedBefore.spells[1]);
  });

  it("reads back exactly what it writes", () => {
    const sheet = sheetSchema.parse(savedBefore);
    expect(sheetSchema.parse(JSON.parse(JSON.stringify(sheet)))).toEqual(sheet);
  });

  it("keeps an unprepared spell unprepared", () => {
    const [spell] = sheetSchema.parse({
      spells: [{ id: "s1", name: "Fixture Ward", level: 1, prepared: false }],
    }).spells;
    expect(spell.prepared).toBe(false);
  });

  it.each([
    ["a number past the limit", 150, PREPARE_MAX],
    ["a negative number", -1, undefined],
    ["a fraction", 2.5, undefined],
    ["text", "three", undefined],
  ])("reads %s to prepare without refusing the sheet", (_, stored, read) => {
    expect(sheetSchema.parse({ spellsToPrepare: stored }).spellsToPrepare).toBe(read);
  });

  it("reads a prepared flag that isn't true or false as prepared", () => {
    const [spell] = sheetSchema.parse({
      spells: [{ id: "s1", name: "Fixture Ward", level: 1, prepared: "yes" }],
    }).spells;
    expect(spell.prepared).toBe(true);
  });
});

describe("what gets used up, as stored", () => {
  it("brings anything used above its maximum back down rather than refusing the sheet", () => {
    const sheet = sheetSchema.parse({
      spellSlots: [{ max: 2, used: 5 }],
      hitDice: { d8: { max: 3, used: 4 } },
      features: [
        {
          id: "f1",
          name: "Fixture feature",
          source: "class",
          activation: "bonus",
          uses: { max: 1, used: 3, reset: "long" },
        },
      ],
    });
    expect(sheet.spellSlots[0]).toEqual({ max: 2, used: 2 });
    expect(sheet.hitDice.d8).toEqual({ max: 3, used: 3 });
    expect(sheet.features[0].uses).toEqual({ max: 1, used: 1, reset: "long" });
  });

  it("reads a feature's unknown source or activation as other, rather than refusing the sheet", () => {
    const [feature] = sheetSchema.parse({
      features: [{ id: "f1", name: "Fixture feature", source: "boon", activation: "free" }],
    }).features;
    expect(feature).toMatchObject({ source: "other", activation: "other" });
  });

  it("fills in a spell's details when only its name and level were kept", () => {
    const [spell] = sheetSchema.parse({
      spells: [{ id: "s1", name: "Fixture Spark", level: 0 }],
    }).spells;
    expect(spell).toMatchObject({
      castingTime: "",
      range: "",
      concentration: false,
      ritual: false,
      attack: false,
    });
  });

  it.each([
    ["a spell of level 10", { spells: [{ id: "s1", name: "x", level: 10 }] }],
    ["a feature with no name", { features: [{ id: "f1", name: " " }] }],
    ["more than nine levels of slots", { spellSlots: Array.from({ length: 10 }, () => ({})) }],
    ["an attack bonus of 100", { attacks: [{ id: "a1", name: "x", bonus: 100 }] }],
  ])("refuses %s", (_, sheet) => {
    expect(sheetSchema.safeParse(sheet).success).toBe(false);
  });
});

describe("sheets saved before the SRD spell picker", () => {
  /** A sheet's spells as preparing left them: typed, one linked to a vault note. */
  const savedBefore = {
    className: "Fixture class",
    spellAbility: "int",
    spellsToPrepare: 1,
    spells: [
      { id: "s0", name: "Fixture Spark", level: 0, castingTime: "1 action", note: "fixture-spark" },
      { id: "s1", name: "Fixture Ward", level: 1, concentration: true, prepared: false },
    ],
  };

  it("loads unchanged, with no spell linked to the SRD", () => {
    const sheet = sheetSchema.parse(savedBefore);
    expect(sheet.spells.map((spell) => spell.srd)).toEqual([undefined, undefined]);
    expect(sheet.spells[0]).toMatchObject(savedBefore.spells[0]);
    expect(sheet.spells[1]).toMatchObject(savedBefore.spells[1]);
  });

  it("reads back exactly what it writes", () => {
    const sheet = sheetSchema.parse(savedBefore);
    expect(sheetSchema.parse(JSON.parse(JSON.stringify(sheet)))).toEqual(sheet);
  });

  it("keeps a spell's link to the SRD, and reads it back", () => {
    const linked = {
      id: "s2",
      name: "Fireball",
      level: 3,
      srd: { source: "srd-5.2", id: "fireball" },
    };
    const sheet = sheetSchema.parse({ spells: [linked] });
    expect(sheet.spells[0].srd).toEqual(linked.srd);
    expect(sheetSchema.parse(JSON.parse(JSON.stringify(sheet)))).toEqual(sheet);
  });

  it.each([
    ["an SRD this build doesn't know", { source: "srd-6.0", id: "fireball" }],
    ["no ID", { source: "srd-5.2", id: "" }],
    ["a link that isn't one", "fireball"],
  ])("drops a link to %s, keeping the spell and the sheet", (_, srd) => {
    const [spell] = sheetSchema.parse({
      spells: [{ id: "s2", name: "Fireball", level: 3, range: "150 feet", srd }],
    }).spells;
    expect(spell.srd).toBeUndefined();
    expect(spell).toMatchObject({ name: "Fireball", level: 3, range: "150 feet" });
  });
});
