import { describe, expect, it } from "vitest";
import type { SrdVersion } from "./convert.ts";
import sample from "./sample.json";
import { convertSpell, type SourceSpell } from "./spells.ts";

const records = {
  "5.1": sample.spells["2014"] as unknown as SourceSpell[],
  "5.2": sample.spells["2024"] as unknown as SourceSpell[],
};

function record(version: SrdVersion, id: string): SourceSpell {
  const found = records[version].find((each) => each.index === id);
  if (!found) throw new Error(`${id} isn't in the sample`);
  return found;
}

const converted = (version: SrdVersion, id: string) => convertSpell(record(version, id), version);

/** Every word, in order, ignoring only how the text is laid out. */
const words = (text: string) => text.match(/[\w'’+-]+/g) ?? [];

describe("convertSpell: SRD 5.2.1 (2024)", () => {
  it("keeps the SRD's fields and fills in a save, a roll and an area from the text", () => {
    const { text, higherLevel, ...fireball } = converted("5.2", "fireball");
    expect(fireball).toEqual({
      id: "fireball",
      name: "Fireball",
      level: 3,
      school: "Evocation",
      classes: ["Sorcerer", "Wizard"],
      castingTime: "Action",
      range: "150 feet",
      components: "V, S, M",
      material: "a ball of bat guano and sulfur",
      duration: "Instantaneous",
      concentration: false,
      ritual: false,
      attack: false,
      save: "dex",
      roll: "8d6",
      effect: "fire",
      area: { shape: "sphere", feet: 20 },
    });
    expect(text).toMatch(/^A bright streak flashes from you/);
    expect(higherLevel).toBe("The damage increases by 1d6 for each spell slot level above 3.");
  });

  it("lays a cantrip's text out in paragraphs, words unchanged", () => {
    const spell = converted("5.2", "fire-bolt");
    expect(spell).toMatchObject({ level: 0, attack: true, roll: "1d10", effect: "fire" });
    expect(spell.save).toBeUndefined();
    expect(spell.text.split("\n\n")).toHaveLength(2);
    expect(spell.text.split("\n\n")[1]).toMatch(/^Cantrip Upgrade\./);
    expect(words(spell.text)).toEqual(words(record("5.2", "fire-bolt").description!));
  });

  it("keeps rituals and concentration", () => {
    expect(converted("5.2", "detect-magic")).toMatchObject({ ritual: true, concentration: true });
  });

  it("reads each area shape, and an Emanation as a sphere around the caster", () => {
    expect(converted("5.2", "burning-hands").area).toEqual({ shape: "cone", feet: 15 });
    expect(converted("5.2", "lightning-bolt").area).toEqual({ shape: "line", feet: 100 });
    expect(converted("5.2", "spirit-guardians").area).toEqual({ shape: "sphere", feet: 15 });
  });

  it("takes a save only when the spell asks for one", () => {
    expect(converted("5.2", "hold-person").save).toBe("wis");
    // "Advantage on Dexterity saving throws" isn't a save to make.
    expect(converted("5.2", "haste").save).toBeUndefined();
  });

  it("reads healing from the text, as the 2024 data has no healing dice", () => {
    expect(converted("5.2", "cure-wounds")).toMatchObject({ roll: "2d8", effect: "healing" });
  });

  it("keeps the first damage of two (Flame Strike's fire, not its radiant)", () => {
    expect(converted("5.2", "flame-strike")).toMatchObject({ roll: "5d6", effect: "fire" });
  });

  it("leaves out a mishap's damage", () => {
    const wish = converted("5.2", "wish");
    expect(record("5.2", "wish").damage).toBeDefined();
    expect(wish.roll).toBeUndefined();
    expect(wish.effect).toBeUndefined();
  });

  it("keeps a reaction's casting time whole (a sheet cuts it when the spell is picked)", () => {
    expect(converted("5.2", "shield").castingTime).toBe(
      "Reaction, which you take when you are hit by an attack roll or targeted by the Magic Missile spell",
    );
  });
});

describe("convertSpell: SRD 5.1 (2014)", () => {
  it("takes the save and area from the data's own fields", () => {
    const { text, higherLevel, ...fireball } = converted("5.1", "fireball");
    expect(fireball).toEqual({
      id: "fireball",
      name: "Fireball",
      level: 3,
      school: "Evocation",
      classes: ["Sorcerer", "Wizard"],
      castingTime: "1 action",
      range: "150 feet",
      components: "V, S, M",
      material: "A tiny ball of bat guano and sulfur.",
      duration: "Instantaneous",
      concentration: false,
      ritual: false,
      attack: false,
      save: "dex",
      roll: "8d6",
      effect: "fire",
      area: { shape: "sphere", feet: 20 },
    });
    expect(text.split("\n\n")).toEqual(record("5.1", "fireball").desc);
    expect(higherLevel).toMatch(/^When you cast this spell using a spell slot of 4th level/);
  });

  it("rolls a cantrip at its first level", () => {
    expect(converted("5.1", "fire-bolt")).toMatchObject({ attack: true, roll: "1d10" });
  });

  it("drops the modifier from healing, which the player adds", () => {
    expect(record("5.1", "cure-wounds").heal_at_slot_level?.["1"]).toBe("1d8 + MOD");
    expect(converted("5.1", "cure-wounds")).toMatchObject({ roll: "1d8", effect: "healing" });
  });

  it("keeps a table's rows together, so it renders as a table", () => {
    const { text } = converted("5.1", "animate-objects");
    expect(text).toContain(
      "| Size | HP | AC | Attack | Str | Dex |\n|---|---|---|---|---|---|\n| Tiny |",
    );
    expect(words(text)).toEqual(words(record("5.1", "animate-objects").desc!.join(" ")));
  });

  it("gives a line and a cone their lengths", () => {
    expect(converted("5.1", "lightning-bolt").area).toEqual({ shape: "line", feet: 100 });
    expect(converted("5.1", "burning-hands").area).toEqual({ shape: "cone", feet: 15 });
  });
});
