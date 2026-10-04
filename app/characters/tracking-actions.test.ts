/**
 * Spells, slots, features' uses, hit dice, attacks and rests as actions: applied to what's stored,
 * undone by inverse actions, and checked when they arrive from the browser.
 */
import { describe, expect, it } from "vitest";
import { applyAction, applyActions, characterActionSchema, type CharacterAction } from "./actions";
import {
  aCharacter,
  aCompanion,
  aFeature,
  anAttack,
  aSheet,
  aSpell,
  withSlots,
} from "./test-builders";
import type { Character, PlayerCharacter, Sheet } from "./types";
import { inverseOf } from "./undo";

const sheetOf = (character: Character) => (character as PlayerCharacter).sheet;
const withSheet = (fields: Partial<Sheet>) => aCharacter({ sheet: aSheet(fields) });

const caster = withSheet({
  abilities: { ...aSheet().abilities, con: 14, wis: 16 },
  spellAbility: "wis",
  hp: { current: 5, max: 20, temp: 0 },
  spellSlots: withSlots({ 1: { max: 2, used: 0 }, 2: { max: 1, used: 0 } }),
  hitDice: { ...aSheet().hitDice, d8: { max: 3, used: 0 } },
  features: [
    aFeature({ id: "focus", uses: { max: 2, used: 0, reset: "short" } }),
    aFeature({ id: "free", uses: { max: 1, used: 0, reset: "long" } }),
  ],
  spells: [aSpell({ id: "ward", name: "Fixture Ward", concentration: true, freeUse: "free" })],
  attacks: [anAttack({ id: "blade" })],
});

/** Applies an action, then its inverse, and checks nothing is left changed. */
function undoes(before: Character, action: CharacterAction) {
  const after = applyAction(before, action).character;
  const inverse = inverseOf(before, action);
  expect(inverse.length).toBeGreaterThan(0);
  expect(applyActions(after, inverse).character).toEqual(before);
}

describe("ticking things off", () => {
  it("spends a slot of a level, and gives one back", () => {
    const cast = applyAction(caster, { type: "count", counter: { slot: 1 }, by: 1 });
    expect(cast.outcome).toBe("changed");
    expect(sheetOf(cast.character).spellSlots[0]).toEqual({ max: 2, used: 1 });
    const back = applyAction(cast.character, { type: "count", counter: { slot: 1 }, by: -1 });
    expect(sheetOf(back.character).spellSlots[0].used).toBe(0);
  });

  it("casts a concentration spell as one step: a slot and concentrating on it", () => {
    const { character } = applyActions(caster, [
      { type: "count", counter: { slot: 2 }, by: 1 },
      { type: "text", field: "concentrating", value: "Fixture Ward", from: "" },
    ]);
    expect(sheetOf(character).spellSlots[1].used).toBe(1);
    expect(sheetOf(character).concentrating).toBe("Fixture Ward");
  });

  it("ticks off a feature's use, such as a spell cast for free", () => {
    const { character } = applyAction(caster, {
      type: "count",
      counter: { feature: "free" },
      by: 1,
    });
    expect(sheetOf(character).features[1].uses?.used).toBe(1);
  });

  it("changes nothing past the end, rather than going over", () => {
    const full = applyAction(caster, { type: "count", counter: { slot: 2 }, by: 1 }).character;
    expect(applyAction(full, { type: "count", counter: { slot: 2 }, by: 1 }).outcome).toBe(
      "unchanged",
    );
  });

  it("drops a tick for a feature that's gone or has no uses", () => {
    expect(
      applyAction(caster, { type: "count", counter: { feature: "gone" }, by: 1 }).outcome,
    ).toBe("dropped");
  });

  it("drops anything about spells or uses on a companion, which has no sheet", () => {
    expect(applyAction(aCompanion(), { type: "count", counter: { slot: 1 }, by: 1 }).outcome).toBe(
      "dropped",
    );
    expect(applyAction(aCompanion(), { type: "rest", rest: "long" }).outcome).toBe("dropped");
  });

  it("sets how many slots a level has, saying whose number it replaced", () => {
    const result = applyAction(caster, {
      type: "limit",
      counter: { slot: 3 },
      value: 2,
      from: 1,
    });
    expect(sheetOf(result.character).spellSlots[2]).toEqual({ max: 2, used: 0 });
    expect(result.replaced).toBe(0);
  });
});

describe("rests as actions", () => {
  it("takes a short rest with the hit dice rolled, and resets short rest uses", () => {
    const tired = applyActions(caster, [
      { type: "count", counter: { feature: "focus" }, by: 2 },
      { type: "count", counter: { feature: "free" }, by: 1 },
    ]).character;
    const { character } = applyAction(tired, {
      type: "rest",
      rest: "short",
      hitDice: [{ die: "d8", face: 6 }],
    });
    const sheet = sheetOf(character);
    expect(sheet.hp.current).toBe(5 + 6 + 2);
    expect(sheet.hitDice.d8.used).toBe(1);
    expect(sheet.features.map((feature) => feature.uses?.used)).toEqual([0, 1]);
  });

  it("is unchanged when there was nothing to rest from", () => {
    const fresh = withSheet({ hp: { current: 10, max: 10, temp: 0 } });
    expect(applyAction(fresh, { type: "rest", rest: "long" }).outcome).toBe("unchanged");
  });
});

describe("lists as actions", () => {
  it("adds, edits and removes spells, attacks and features", () => {
    const { character } = applyActions(caster, [
      { type: "spells", change: { type: "add", item: aSpell({ id: "new", level: 0 }) } },
      { type: "attacks", change: { type: "edit", id: "blade", changes: { bonus: 6 } } },
      { type: "features", change: { type: "remove", id: "focus" } },
    ]);
    const sheet = sheetOf(character);
    expect(sheet.spells.map((spell) => spell.id)).toEqual(["ward", "new"]);
    expect(sheet.attacks[0].bonus).toBe(6);
    expect(sheet.features.map((feature) => feature.id)).toEqual(["free"]);
  });

  it("drops an edit of something removed elsewhere", () => {
    expect(
      applyAction(caster, {
        type: "spells",
        change: { type: "edit", id: "gone", changes: { name: "x" } },
      }).outcome,
    ).toBe("dropped");
  });

  it("edits a feature's uses by their maximum and reset, keeping how many are used", () => {
    const used = applyAction(caster, {
      type: "count",
      counter: { feature: "focus" },
      by: 2,
    }).character;
    const raised = applyAction(used, {
      type: "features",
      change: { type: "edit", id: "focus", changes: { uses: { max: 3, reset: "long" } } },
    }).character;
    expect(sheetOf(raised).features[0].uses).toEqual({ max: 3, used: 2, reset: "long" });
    const lowered = applyAction(raised, {
      type: "features",
      change: { type: "edit", id: "focus", changes: { uses: { max: 1, reset: "long" } } },
    }).character;
    expect(sheetOf(lowered).features[0].uses?.used).toBe(1);
  });

  it("takes a feature's uses away with null", () => {
    const { character } = applyAction(caster, {
      type: "features",
      change: { type: "edit", id: "focus", changes: { uses: null } },
    });
    expect(sheetOf(character).features[0].uses).toBeUndefined();
  });
});

describe("undoing", () => {
  it.each<[string, CharacterAction]>([
    ["a slot spent", { type: "count", counter: { slot: 1 }, by: 1 }],
    ["a use ticked off", { type: "count", counter: { feature: "focus" }, by: 1 }],
    ["slots for a level", { type: "limit", counter: { slot: 4 }, value: 2 }],
    ["fewer hit dice", { type: "limit", counter: { hitDie: "d8" }, value: 1 }],
    ["choosing a spellcasting ability", { type: "spellAbility", value: "int", from: "wis" }],
    ["a short rest", { type: "rest", rest: "short", hitDice: [{ die: "d8", face: 3 }] }],
    ["a spell added", { type: "spells", change: { type: "add", item: aSpell() } }],
    [
      "a spell edited",
      { type: "spells", change: { type: "edit", id: "ward", changes: { save: "con" } } },
    ],
    ["an attack removed", { type: "attacks", change: { type: "remove", id: "blade" } }],
    ["a feature moved", { type: "features", change: { type: "move", id: "free", index: 0 } }],
    [
      "a feature's uses taken away",
      { type: "features", change: { type: "edit", id: "focus", changes: { uses: null } } },
    ],
  ])("undoes %s", (_, action) => {
    const used = applyActions(caster, [
      { type: "count", counter: { slot: 1 }, by: 1 },
      { type: "count", counter: { feature: "focus" }, by: 1 },
      { type: "count", counter: { hitDie: "d8" }, by: 2 },
    ]).character;
    undoes(used, action);
  });

  it("undoes a long rest, putting back everything it gave back", () => {
    const tired = applyActions(caster, [
      { type: "count", counter: { slot: 1 }, by: 2 },
      { type: "count", counter: { feature: "free" }, by: 1 },
      { type: "count", counter: { hitDie: "d8" }, by: 3 },
      { type: "text", field: "concentrating", value: "Fixture Ward" },
      { type: "hp", field: "temp", value: 4 },
    ]).character;
    undoes(tired, { type: "rest", rest: "long" });
  });

  it("undoes a rest without undoing a slot spent in another tab since", () => {
    const tired = applyAction(caster, { type: "count", counter: { slot: 1 }, by: 2 }).character;
    const rest: CharacterAction = { type: "rest", rest: "long" };
    const inverse = inverseOf(tired, rest);
    const rested = applyAction(tired, rest).character;
    // Another tab casts with a 2nd-level slot after the rest.
    const elsewhere = applyAction(rested, { type: "count", counter: { slot: 2 }, by: 1 }).character;
    const undone = sheetOf(applyActions(elsewhere, inverse).character);
    expect(undone.spellSlots[0].used).toBe(2);
    expect(undone.spellSlots[1].used).toBe(1);
  });

  it("gives back how many were used when a feature's maximum comes down and is undone", () => {
    const used = applyAction(caster, {
      type: "count",
      counter: { feature: "focus" },
      by: 2,
    }).character;
    undoes(used, {
      type: "features",
      change: { type: "edit", id: "focus", changes: { uses: { max: 1, reset: "short" } } },
    });
  });
});

describe("checking actions from the browser", () => {
  const valid = (action: unknown) => characterActionSchema.safeParse(action).success;

  it.each<[string, unknown]>([
    ["a slot spent", { type: "count", counter: { slot: 3 }, by: 1 }],
    ["a use given back", { type: "count", counter: { feature: "f1" }, by: -1 }],
    ["a short rest", { type: "rest", rest: "short", hitDice: [{ die: "d10", face: 10 }] }],
    ["a long rest", { type: "rest", rest: "long" }],
    ["a spell", { type: "spells", change: { type: "add", item: aSpell({ roll: "2d6+3" }) } }],
    [
      "clearing a spell's save",
      { type: "spells", change: { type: "edit", id: "s1", changes: { save: null } } },
    ],
  ])("accepts %s", (_, action) => {
    expect(valid(action)).toBe(true);
  });

  it.each<[string, unknown]>([
    ["a cantrip slot", { type: "count", counter: { slot: 0 }, by: 1 }],
    ["a d20 hit die", { type: "count", counter: { hitDie: "d20" }, by: 1 }],
    [
      "a face that isn't on the die",
      { type: "rest", rest: "short", hitDice: [{ die: "d8", face: 9 }] },
    ],
    [
      "dice that can't be rolled",
      { type: "spells", change: { type: "add", item: aSpell({ roll: "lots" }) } },
    ],
    [
      "an attack's damage that can't be rolled",
      { type: "attacks", change: { type: "edit", id: "a1", changes: { damage: "a lot" } } },
    ],
    ["too many slots", { type: "limit", counter: { slot: 1 }, value: 21 }],
    [
      "setting a feature's uses with no maximum",
      {
        type: "features",
        change: { type: "edit", id: "f1", changes: { uses: { reset: "long" } } },
      },
    ],
    ["a rest of another kind", { type: "rest", rest: "nap" }],
  ])("refuses %s", (_, action) => {
    expect(valid(action)).toBe(false);
  });

  it("never lets an edit set how many uses are used", () => {
    const parsed = characterActionSchema.parse({
      type: "features",
      change: { type: "edit", id: "f1", changes: { uses: { max: 2, reset: "long", used: 0 } } },
    });
    expect(parsed).toEqual({
      type: "features",
      change: { type: "edit", id: "f1", changes: { uses: { max: 2, reset: "long" } } },
    });
  });
});
