import { describe, expect, it } from "vitest";
import { SRD_SOURCES } from "~/campaign/srd";
import { applyAction } from "./actions";
import { spellSchema } from "./schema";
import {
  noteSpellKey,
  parseSpellKey,
  pickedSpell,
  spellTag,
  srdSpellKey,
  type SpellOption,
} from "./spell-options";
import { aCharacter, aSheet, aSpell } from "./test-builders";
import type { PlayerCharacter, Sheet } from "./types";

/** The 2024 Fireball as the picker lists it. */
const fireball: SpellOption = {
  key: "srd-5.2/fireball",
  name: "Fireball",
  level: 3,
  school: "Evocation",
  classes: ["Sorcerer", "Wizard"],
  castingTime: "Action",
  range: "150 feet",
  components: "V, S, M",
  duration: "Instantaneous",
  concentration: false,
  ritual: false,
  attack: false,
  save: "dex",
  roll: "8d6",
  effect: "fire",
  area: { shape: "sphere", feet: 20 },
  srd: { source: "srd-5.2", id: "fireball" },
};

const sheet = (fields: Partial<Sheet> = {}): Sheet => ({ ...aSheet(), ...fields });

describe("pickedSpell", () => {
  it("fills in an ordinary spell, linked to its SRD entry", () => {
    expect(pickedSpell(fireball, "new-id", sheet())).toEqual({
      id: "new-id",
      name: "Fireball",
      level: 3,
      castingTime: "Action",
      range: "150 feet",
      components: "V, S, M",
      duration: "Instantaneous",
      concentration: false,
      ritual: false,
      attack: false,
      save: "dex",
      roll: "8d6",
      effect: "fire",
      area: { shape: "sphere", feet: 20 },
      srd: { source: "srd-5.2", id: "fireball" },
      prepared: true,
    });
  });

  it("starts prepared only while there's room under the number to prepare", () => {
    const full = sheet({ spellsToPrepare: 1, spells: [aSpell({ level: 1, prepared: true })] });
    expect(pickedSpell(fireball, "new-id", full).prepared).toBe(false);
    expect(pickedSpell(fireball, "new-id", sheet({ spellsToPrepare: 1 })).prepared).toBe(true);
  });

  it("keeps a reaction's trigger in the text, not the casting time", () => {
    const shield = {
      ...fireball,
      castingTime:
        "Reaction, which you take when you are hit by an attack roll or targeted by the Magic Missile spell",
    };
    expect(pickedSpell(shield, "new-id", sheet()).castingTime).toBe("Reaction");
  });

  it("fits a vault note that gives only its name, as a level 0 spell linked to the note", () => {
    const note: SpellOption = {
      key: "note/fixture-spark",
      name: "Fixture Spark",
      classes: [],
      castingTime: "",
      range: "",
      components: "",
      duration: "",
      concentration: false,
      ritual: false,
      attack: false,
      note: "fixture-spark",
    };
    const spell = pickedSpell(note, "new-id", sheet());
    expect(spell).toMatchObject({ name: "Fixture Spark", level: 0, note: "fixture-spark" });
    expect(spell.srd).toBeUndefined();
  });

  it("makes a spell the sheet stores as it is", () => {
    const spell = pickedSpell(fireball, "new-id", sheet());
    expect(spellSchema.parse(spell)).toEqual(spell);
  });

  it("adds through the usual action, then edits and unlinks like any spell", () => {
    const character = aCharacter();
    const spell = pickedSpell(fireball, "new-id", (character as PlayerCharacter).sheet);
    const added = applyAction(character, { type: "spells", change: { type: "add", item: spell } });
    const renamed = applyAction(added.character, {
      type: "spells",
      change: { type: "edit", id: "new-id", changes: { name: "Fixture Blast", srd: null } },
    });
    const [stored] = (renamed.character as PlayerCharacter).sheet.spells;
    expect(stored).toMatchObject({ name: "Fixture Blast", roll: "8d6", save: "dex" });
    expect(stored.srd).toBeUndefined();
  });
});

describe("spell keys and tags", () => {
  it("names SRD spells and notes apart, and reads them back", () => {
    expect(srdSpellKey(fireball.srd!)).toBe("srd-5.2/fireball");
    expect(parseSpellKey("srd-5.2/fireball", SRD_SOURCES)).toEqual({ srd: fireball.srd });
    expect(noteSpellKey("Spells/Fixture Spark")).toBe("note/Spells/Fixture Spark");
    expect(parseSpellKey("note/Spells/Fixture Spark", SRD_SOURCES)).toEqual({
      note: "Spells/Fixture Spark",
    });
  });

  it.each(["", "note/", "srd-9.9/fireball", "srd-5.2/", "fireball"])(
    "reads %j as no spell",
    (key) => {
      expect(parseSpellKey(key, SRD_SOURCES)).toBeUndefined();
    },
  );

  it("tags the SRD by its rules, and notes as the DM's own", () => {
    expect(spellTag(fireball)).toBe("2024");
    expect(spellTag({ srd: { source: "srd-5.1", id: "fireball" } })).toBe("2014");
    expect(spellTag({})).toBe("Mine");
  });
});
