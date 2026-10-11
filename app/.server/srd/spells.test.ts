import { isDeepStrictEqual } from "node:util";
import { describe, expect, it } from "vitest";
import { ABILITIES } from "~/characters/abilities";
import { AREA_FEET_MAX, spellSchema } from "~/characters/schema";
import { pickedSpell } from "~/characters/spell-options";
import { aSheet } from "~/characters/test-builders";
import { parseDice } from "~/dice/parse";
import { SPELL_SHAPES } from "~/maps/grid/shapes";
import srd51 from "./spells-5.1.json";
import srd52 from "./spells-5.2.json";
import { srdSpells, srdSpellText } from "./spells";

const CLASSES = ["Bard", "Cleric", "Druid", "Paladin", "Ranger", "Sorcerer", "Warlock", "Wizard"];

/**
 * Checks over every spell in the committed SRD data, so a converter change or a new release of the
 * source data can't quietly break one. (`npm run srd:check` proves the files match the script.)
 */
describe.each([
  ["SRD 5.1", srd51, 319],
  ["SRD 5.2.1", srd52, 339],
])("%s spells", (document, data, count) => {
  const spells = data.spells as {
    id: string;
    level: number;
    classes: string[];
    save?: string;
    roll?: string;
    effect?: string;
    area?: { shape: string; feet: number };
    text: string;
  }[];

  it("are all there, from the pinned release", () => {
    expect(data.document).toBe(document);
    expect(spells).toHaveLength(count);
  });

  it("have unique IDs", () => {
    expect(new Set(spells.map(({ id }) => id)).size).toBe(count);
  });

  it("all have a level, a class and text", () => {
    const wrong = spells.filter(
      ({ level, classes, text }) =>
        !Number.isInteger(level) ||
        level < 0 ||
        level > 9 ||
        classes.length === 0 ||
        classes.some((name) => !CLASSES.includes(name)) ||
        text.trim() === "",
    );
    expect(wrong.map(({ id }) => id)).toEqual([]);
  });

  it("only fill in what a sheet's spell can hold", () => {
    const wrong = spells.filter(
      ({ save, roll, effect, area }) =>
        (save !== undefined && !(ABILITIES as readonly string[]).includes(save)) ||
        (roll !== undefined && !parseDice(roll).ok) ||
        (roll === undefined) !== (effect === undefined) ||
        (area !== undefined &&
          (!(SPELL_SHAPES as readonly string[]).includes(area.shape) ||
            area.feet < 1 ||
            area.feet > AREA_FEET_MAX)),
    );
    expect(wrong.map(({ id }) => id)).toEqual([]);
  });

  it("fill in saves, rolls and areas for the spells that have them", () => {
    // Floors, not exact counts: they catch a pattern that stops matching, not one more match.
    expect(spells.filter(({ save }) => save).length).toBeGreaterThan(80);
    expect(spells.filter(({ roll }) => roll).length).toBeGreaterThan(60);
    expect(spells.filter(({ area }) => area).length).toBeGreaterThan(60);
  });
});

describe("every SRD spell", () => {
  const all = [...srdSpells().values()];

  it("picks into a spell the sheet stores as it is", () => {
    const changed = all.filter(({ option }) => {
      const spell = pickedSpell(option, "new-id", aSheet());
      return !isDeepStrictEqual(spellSchema.parse(spell), spell);
    });
    expect(changed.map(({ option }) => option.key)).toEqual([]);
  });

  it("keeps every word of its text when rendered", () => {
    const words = (text: string) => text.match(/[A-Za-z0-9]+/g) ?? [];
    const lost = all.filter(({ option, stored }) => {
      const html = srdSpellText(option.key)!.html.replace(/<[^>]+>/g, " ");
      // Entities (&#x27;) split words just as the apostrophes they stand for do.
      const rendered = words(html.replace(/&#?w+;/g, " ")).join(" ");
      return !rendered.includes(words(stored.text).join(" "));
    });
    expect(lost.map(({ option }) => option.key)).toEqual([]);
  });
});
