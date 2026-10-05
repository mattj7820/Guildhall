import { describe, expect, it } from "vitest";
import { applyActions } from "./actions";
import { deriveSheet } from "./derive";
import { castActions, castNotice, castOptionLabel, castOptions, numbersFor } from "./spells";
import { aCharacter, aFeature, aSheet, aSpell, withSlots } from "./test-builders";
import type { PlayerCharacter, Sheet } from "./types";

const sheet = aSheet({
  spellSlots: withSlots({ 1: { max: 2, used: 2 }, 2: { max: 2, used: 1 }, 3: { max: 1, used: 0 } }),
  features: [
    aFeature({ id: "free", name: "Fixture feat", uses: { max: 1, used: 0, reset: "long" } }),
  ],
});

describe("castOptions", () => {
  it("offers the lowest slot left at the spell's level or above first, then higher ones", () => {
    const options = castOptions(sheet, aSpell({ level: 1 }));
    expect(options).toEqual([
      { kind: "slot", level: 2, left: 1 },
      { kind: "slot", level: 3, left: 1 },
    ]);
  });

  it("offers a feature's uses for a spell it casts for free, while any are left", () => {
    const spell = aSpell({ level: 1, freeUse: "free" });
    expect(castOptions(sheet, spell)).toContainEqual({
      kind: "free",
      feature: "free",
      name: "Fixture feat",
      left: 1,
    });
    const spent: Sheet = {
      ...sheet,
      features: [aFeature({ id: "free", uses: { max: 1, used: 1, reset: "long" } })],
    };
    expect(castOptions(spent, spell).some((option) => option.kind === "free")).toBe(false);
  });

  it("offers a ritual without any slot", () => {
    const noSlots = aSheet();
    expect(castOptions(noSlots, aSpell({ level: 1, ritual: true }))).toEqual([{ kind: "ritual" }]);
  });

  it("has nothing for a cantrip, or a spell with nothing left to cast it", () => {
    expect(castOptions(sheet, aSpell({ level: 0 }))).toEqual([]);
    expect(castOptions(aSheet(), aSpell({ level: 1 }))).toEqual([]);
  });

  it("finds nothing for a free use whose feature has gone", () => {
    expect(castOptions(aSheet(), aSpell({ level: 1, freeUse: "gone" }))).toEqual([]);
  });
});

describe("casting", () => {
  const cast = (from: Sheet, spell: ReturnType<typeof aSpell>, at: number) => {
    const option = castOptions(from, spell)[at];
    const after = applyActions(aCharacter({ sheet: from }), castActions(from, spell, option));
    return { option, sheet: (after.character as PlayerCharacter).sheet };
  };

  it("spends the slot chosen", () => {
    expect(cast(sheet, aSpell({ level: 1 }), 1).sheet.spellSlots[2].used).toBe(1);
  });

  it("spends a free use instead of a slot", () => {
    const spell = aSpell({ level: 1, freeUse: "free" });
    const { sheet: after } = cast(sheet, spell, 2);
    expect(after.features[0].uses?.used).toBe(1);
    expect(after.spellSlots.map((slot) => slot.used)).toEqual(sheet.spellSlots.map((s) => s.used));
  });

  it("starts concentrating on a concentration spell, ending any other", () => {
    const focused = { ...sheet, concentrating: "Fixture Old" };
    const spell = aSpell({ name: "Fixture Ward", level: 1, concentration: true });
    const { sheet: after, option } = cast(focused, spell, 0);
    expect(after.concentrating).toBe("Fixture Ward");
    expect(castNotice(focused, spell, option)).toBe(
      "Cast Fixture Ward with a 2nd-level slot; stopped concentrating on Fixture Old.",
    );
  });

  it("spends nothing for a ritual", () => {
    const spell = aSpell({ level: 1, ritual: true });
    expect(castActions(aSheet(), spell, { kind: "ritual" })).toEqual([]);
  });
});

describe("castOptionLabel", () => {
  it.each([
    [{ kind: "slot", level: 2, left: 1 } as const, "With a 2nd-level slot (1 left)"],
    [
      { kind: "free", feature: "f", name: "Fixture feat", left: 1 } as const,
      "Free (Fixture feat, 1 left)",
    ],
    [{ kind: "ritual" } as const, "As a ritual"],
  ])("says %j as %s", (option, label) => {
    expect(castOptionLabel(option)).toBe(label);
  });
});

describe("numbersFor", () => {
  const caster = aSheet({
    abilities: { ...aSheet().abilities, wis: 16, cha: 12 },
    spellAbility: "wis",
    overrides: { "spell.attack": 9 },
  });

  it("uses the sheet's spellcasting, typed-over numbers and all", () => {
    expect(numbersFor(caster, deriveSheet(caster), aSpell())?.attack.value).toBe(9);
  });

  it("uses a spell's own ability when it has one", () => {
    expect(numbersFor(caster, deriveSheet(caster), aSpell({ ability: "cha" }))).toMatchObject({
      ability: "cha",
      dc: { value: 11 },
      attack: { value: 3 },
    });
  });

  it("has none without a spellcasting ability", () => {
    expect(numbersFor(aSheet(), deriveSheet(aSheet()), aSpell())).toBeUndefined();
  });
});
