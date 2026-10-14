import { describe, expect, it } from "vitest";
import { SRD_SOURCES, type SrdSource } from "~/campaign/srd";
import { parseNote } from "~/.server/vault/parse-note";
import { extractStatblocks } from "~/.server/vault/statblock/extract-statblocks";
import { statblockFromData } from "~/.server/vault/statblock/parse-statblock";
import monsters51 from "./monsters-5.1.json";
import monsters52 from "./monsters-5.2.json";
import type { StoredSpell } from "./spells";
import spells51 from "./spells-5.1.json";
import spells52 from "./spells-5.2.json";
import { lookUp, monsterNote, spellNote } from "./vault-notes";

const monsters = { "srd-5.1": monsters51.monsters, "srd-5.2": monsters52.monsters };
const spells: Record<SrdSource, StoredSpell[]> = {
  "srd-5.1": spells51.spells,
  "srd-5.2": spells52.spells,
};

/** Every word, in order, ignoring only how the text is laid out. */
const words = (text: string) => (text.match(/[\w'’+-]+/g) ?? []).join(" ");
const names = (result: ReturnType<typeof lookUp>) =>
  "choices" in result ? result.choices.map((each) => `${each.name}, ${each.edition}`) : [];

describe("lookUp", () => {
  it("finds a name in the one SRD that has it, in any case", () => {
    expect(lookUp("monster", "goblin boss")).toMatchObject({
      found: { source: "srd-5.2", name: "Goblin Boss", edition: "2024 (SRD 5.2.1)" },
    });
  });

  it("asks which SRD when both have the name", () => {
    expect(names(lookUp("spell", "Fireball")).slice(0, 2)).toEqual([
      "Fireball, 2014 (SRD 5.1)",
      "Fireball, 2024 (SRD 5.2.1)",
    ]);
    expect(lookUp("spell", "Fireball", ["srd-5.2"])).toMatchObject({
      found: { source: "srd-5.2", name: "Fireball" },
    });
  });

  it("offers the closest names when none is exact, and nothing when nothing is close", () => {
    expect(names(lookUp("monster", "goblin", ["srd-5.2"]))).toEqual([
      "Goblin Boss, 2024 (SRD 5.2.1)",
      "Goblin Minion, 2024 (SRD 5.2.1)",
      "Goblin Warrior, 2024 (SRD 5.2.1)",
      "Hobgoblin Captain, 2024 (SRD 5.2.1)",
      "Hobgoblin Warrior, 2024 (SRD 5.2.1)",
    ]);
    expect(lookUp("monster", "Fixture Beholder Prince")).toEqual({ choices: [] });
  });
});

describe("the SRD as vault notes", () => {
  it.each(SRD_SOURCES)("writes every %s monster as a statblock read the same", (source) => {
    for (const monster of monsters[source]) {
      const expected = statblockFromData(monster.statblock);
      expect(extractStatblocks(monsterNote(monster)), monster.id).toEqual([
        expected.ok && expected.statblock,
      ]);
    }
  });

  it("keeps a 2014 monster's description", () => {
    const acolyte = monsters["srd-5.1"].find((monster) => monster.id === "acolyte")!;
    expect(monsterNote(acolyte)).toMatch(/^Acolytes are junior members of a clergy/);
  });

  it.each(SRD_SOURCES)("writes every %s spell as a note the picker fills in", (source) => {
    for (const spell of spells[source]) {
      const note = parseNote(`${spell.name}.md`, spellNote(spell, source));
      expect(note.type).toBe("spell");
      expect(note.spell, spell.id).toEqual({
        level: spell.level,
        school: spell.school,
        classes: spell.classes,
        castingTime: spell.castingTime,
        range: spell.range,
        ...(spell.components && { components: spell.components }),
        duration: spell.duration,
        concentration: spell.concentration,
        ritual: spell.ritual,
        ...(spell.attack && { attack: true }),
        ...(spell.save && { save: spell.save }),
        ...(spell.roll && { roll: spell.roll }),
        ...(spell.effect && { effect: spell.effect }),
        ...(spell.area && { area: spell.area }),
      });
      for (const part of [spell.text, spell.material, spell.higherLevel]) {
        if (part) expect(words(note.body), spell.id).toContain(words(part));
      }
    }
  });

  it("labels a spell's higher levels as each edition's book does", () => {
    const fireball = (source: SrdSource) =>
      spellNote(
        spells[source].find((spell) => spell.id === "fireball")!,
        source,
      );
    expect(fireball("srd-5.1")).toContain("**At Higher Levels.** When you cast this spell");
    expect(fireball("srd-5.2")).toContain("**Using a Higher-Level Spell Slot.** The damage");
  });
});
