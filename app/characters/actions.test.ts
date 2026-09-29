import { describe, expect, it } from "vitest";
import {
  actionBatchSchema,
  applyAction,
  applyActions,
  characterActionSchema,
  MAX_ACTIONS_PER_REQUEST,
  type CharacterAction,
} from "./actions";
import { aCharacter, aCompanion, anItem, aSheet } from "./test-builders";
import type { PlayerCharacter } from "./types";

const sheetOf = (character: ReturnType<typeof applyAction>["character"]) =>
  (character as PlayerCharacter).sheet;

describe("applyAction on the sheet", () => {
  it.each<[string, CharacterAction, (sheet: PlayerCharacter["sheet"]) => unknown, unknown]>([
    [
      "a text field",
      { type: "text", field: "species", value: "Halfling" },
      (s) => s.species,
      "Halfling",
    ],
    ["a number", { type: "number", field: "armourClass", value: 15 }, (s) => s.armourClass, 15],
    [
      "an ability score",
      { type: "ability", ability: "dex", value: 16 },
      (s) => s.abilities.dex,
      16,
    ],
    [
      "a save",
      { type: "save", ability: "wis", value: "proficient" },
      (s) => s.saves.wis,
      "proficient",
    ],
    [
      "a skill",
      { type: "skill", skill: "stealth", value: "expertise" },
      (s) => s.skills.stealth,
      "expertise",
    ],
    [
      "an override",
      { type: "override", key: "initiative", value: 5 },
      (s) => s.overrides.initiative,
      5,
    ],
    ["inspiration", { type: "inspiration", value: true }, (s) => s.heroicInspiration, true],
    ["the portrait", { type: "portrait", value: "Art/Kit.png" }, (s) => s.portrait, "Art/Kit.png"],
  ])("sets %s", (_, action, read, expected) => {
    const result = applyAction(aCharacter(), action);
    expect(result.outcome).toBe("changed");
    expect(read(sheetOf(result.character))).toEqual(expected);
  });

  it("clears an override and the portrait when given no value", () => {
    const character = aCharacter({
      sheet: aSheet({ overrides: { initiative: 5 }, portrait: "Art/Kit.png" }),
    });
    const { character: after } = applyActions(character, [
      { type: "override", key: "initiative" },
      { type: "portrait" },
    ]);
    expect(sheetOf(after).overrides).toEqual({});
    expect(sheetOf(after)).not.toHaveProperty("portrait");
  });

  it("reports a change to something already so as unchanged, returning the same character", () => {
    const character = aCharacter();
    const result = applyAction(character, { type: "number", field: "level", value: 1 });
    expect(result).toEqual({ character, outcome: "unchanged" });
  });

  it("says what it replaced when someone else changed the field since the sender saw it", () => {
    const character = aCharacter({ sheet: aSheet({ armourClass: 16 }) });
    const result = applyAction(character, {
      type: "number",
      field: "armourClass",
      value: 15,
      from: 14,
    });
    expect(sheetOf(result.character).armourClass).toBe(15);
    expect(result.replaced).toBe(16);
  });

  it("doesn't report a replacement when the field was as the sender saw it", () => {
    const result = applyAction(aCharacter(), {
      type: "number",
      field: "armourClass",
      value: 15,
      from: 10,
    });
    expect(result.replaced).toBeUndefined();
  });

  it("drops sheet changes aimed at a companion, which has no sheet", () => {
    const companion = aCompanion();
    expect(applyAction(companion, { type: "ability", ability: "dex", value: 16 }).outcome).toBe(
      "dropped",
    );
  });
});

describe("hit points", () => {
  const hurt = aCharacter({ sheet: aSheet({ hp: { current: 10, max: 20, temp: 3 } }) });

  it("takes damage from temporary hit points first", () => {
    expect(sheetOf(applyAction(hurt, { type: "damage", amount: 5 }).character).hp).toEqual({
      current: 8,
      max: 20,
      temp: 0,
    });
  });

  it("heals up to the maximum", () => {
    expect(sheetOf(applyAction(hurt, { type: "heal", amount: 50 }).character).hp.current).toBe(20);
  });

  it("adds up damage from two people instead of one overwriting the other", () => {
    const { character } = applyActions(hurt, [
      { type: "damage", amount: 4 },
      { type: "damage", amount: 2 },
    ]);
    expect(sheetOf(character).hp).toEqual({ current: 7, max: 20, temp: 0 });
  });

  it("keeps current hit points within a lowered maximum", () => {
    const { character } = applyAction(hurt, { type: "hp", field: "max", value: 8 });
    expect(sheetOf(character).hp).toEqual({ current: 8, max: 8, temp: 3 });
  });

  it("tracks a companion's hit points too", () => {
    const { character } = applyAction(aCompanion(), { type: "damage", amount: 7 });
    expect(character.kind === "companion" && character.hp.current).toBe(15);
  });
});

describe("inventory actions", () => {
  it("applies the inventory change", () => {
    const character = aCharacter({ items: [anItem({ id: "a", quantity: 2 })] });
    const { character: after, outcome } = applyAction(character, {
      type: "inventory",
      change: { type: "quantity", id: "a", quantity: 5 },
    });
    expect(outcome).toBe("changed");
    expect(after.inventory.items[0].quantity).toBe(5);
  });

  it("drops a change to an item that has gone, perhaps removed by the DM", () => {
    const result = applyAction(aCharacter(), {
      type: "inventory",
      change: { type: "equip", id: "gone", equipped: true },
    });
    expect(result.outcome).toBe("dropped");
  });

  it("works on a companion's bag", () => {
    const { character } = applyAction(aCompanion(), {
      type: "inventory",
      change: { type: "add", item: anItem({ name: "Saddlebag" }) },
    });
    expect(character.inventory.items.map((item) => item.name)).toEqual(["Saddlebag"]);
  });
});

describe("applyActions", () => {
  it("applies a batch in order and reports each one", () => {
    const { character, results } = applyActions(aCharacter(), [
      { type: "ability", ability: "str", value: 14 },
      { type: "ability", ability: "str", value: 14 },
      { type: "inventory", change: { type: "remove", id: "gone" } },
    ]);
    expect(sheetOf(character).abilities.str).toBe(14);
    expect(results.map((result) => result.outcome)).toEqual(["changed", "unchanged", "dropped"]);
  });
});

describe("characterActionSchema", () => {
  it.each<[string, unknown]>([
    ["an ability score over 30", { type: "ability", ability: "str", value: 31 }],
    ["an unknown ability", { type: "ability", ability: "luck", value: 10 }],
    ["level 0", { type: "number", field: "level", value: 0 }],
    ["an unknown number field", { type: "number", field: "revision", value: 3 }],
    ["a text field that isn't one", { type: "text", field: "id", value: "x" }],
    ["too much text in a short field", { type: "text", field: "name", value: "x".repeat(81) }],
    ["too much text in senses", { type: "text", field: "senses", value: "x".repeat(2001) }],
    ["negative damage", { type: "damage", amount: -3 }],
    ["an override of something not derived", { type: "override", key: "revision", value: 1 }],
    [
      "an item with a quantity of 0",
      { type: "inventory", change: { type: "add", item: anItem({ quantity: 0 }) } },
    ],
    ["an unknown inventory change", { type: "inventory", change: { type: "burn", id: "a" } }],
    ["an unknown action", { type: "levelUp" }],
  ])("refuses %s", (_, action) => {
    expect(characterActionSchema.safeParse(action).success).toBe(false);
  });

  it("allows long notes", () => {
    const notes = { type: "text", field: "notes", value: "x".repeat(5000) };
    expect(characterActionSchema.safeParse(notes).success).toBe(true);
  });

  it("limits how many actions one request carries", () => {
    const many = Array.from({ length: MAX_ACTIONS_PER_REQUEST + 1 }, () => ({
      type: "heal",
      amount: 1,
    }));
    expect(actionBatchSchema.safeParse(many).success).toBe(false);
    expect(actionBatchSchema.safeParse([]).success).toBe(false);
  });
});
