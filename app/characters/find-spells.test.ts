import { describe, expect, it } from "vitest";
import type { SrdSource } from "~/campaign/srd";
import { findSpells, spellClasses, type SpellFilters } from "./find-spells";
import { SPELL_TAGS, type SpellOption } from "./spell-options";
import type { SpellLevel } from "./types";

function spell(
  name: string,
  level: SpellLevel | undefined,
  from: SrdSource | "note",
  fields: Partial<SpellOption> = {},
): SpellOption {
  const id = name.toLowerCase().replace(/\W+/g, "-");
  return {
    key: from === "note" ? `note/${id}` : `${from}/${id}`,
    name,
    ...(level !== undefined && { level }),
    classes: ["Wizard"],
    castingTime: "Action",
    range: "60 feet",
    components: "V, S",
    duration: "Instantaneous",
    concentration: false,
    ritual: false,
    attack: false,
    ...(from === "note" ? { note: id } : { srd: { source: from, id } }),
    ...fields,
  };
}

const fireBolt24 = spell("Fire Bolt", 0, "srd-5.2");
const fireball24 = spell("Fireball", 3, "srd-5.2", { classes: ["Sorcerer", "Wizard"] });
const fireball14 = spell("Fireball", 3, "srd-5.1", { classes: ["Sorcerer", "Wizard"] });
const myFireball = spell("Fireball", 3, "note");
const faerieFire = spell("Faerie Fire", 1, "srd-5.2", { concentration: true, classes: ["Bard"] });
const huntersMark = spell("Hunter's Mark", 1, "srd-5.2", { concentration: true });
const detectMagic = spell("Detect Magic", 1, "srd-5.2", { ritual: true, concentration: true });
const unlevelled = spell("Fixture Spell", undefined, "note", { classes: ["artificer"] });
const all = [
  unlevelled,
  detectMagic,
  fireball14,
  huntersMark,
  faerieFire,
  myFireball,
  fireball24,
  fireBolt24,
];

const names = (spells: SpellOption[]) =>
  spells.map((each) => `${each.name} (${each.note ? "Mine" : each.srd?.source})`);
const find = (filters: Partial<SpellFilters>) =>
  names(findSpells(all, { query: "", tags: new Set(SPELL_TAGS), ...filters }));

describe("findSpells", () => {
  it("browses by level, cantrips first, then by name, the DM's own first, without a level last", () => {
    expect(find({})).toEqual([
      "Fire Bolt (srd-5.2)",
      "Detect Magic (srd-5.2)",
      "Faerie Fire (srd-5.2)",
      "Hunter's Mark (srd-5.2)",
      "Fireball (Mine)",
      "Fireball (srd-5.2)",
      "Fireball (srd-5.1)",
      "Fixture Spell (Mine)",
    ]);
  });

  it("searches best match first: exact, a prefix, a word's start, anywhere", () => {
    expect(find({ query: " FIREBALL " })).toEqual([
      "Fireball (Mine)",
      "Fireball (srd-5.2)",
      "Fireball (srd-5.1)",
    ]);
    // Both start with it, so the DM's own comes first, then 2024 by name.
    expect(find({ query: "fire" })).toEqual([
      "Fireball (Mine)",
      "Fire Bolt (srd-5.2)",
      "Fireball (srd-5.2)",
      "Fireball (srd-5.1)",
      "Faerie Fire (srd-5.2)",
    ]);
    expect(find({ query: "mark" })).toEqual(["Hunter's Mark (srd-5.2)"]);
    expect(find({ query: "agic" })).toEqual(["Detect Magic (srd-5.2)"]);
  });

  it("shows only the tags picked", () => {
    expect(find({ query: "fireball", tags: new Set(["Mine", "2024"]) })).toEqual([
      "Fireball (Mine)",
      "Fireball (srd-5.2)",
    ]);
  });

  it("filters by level, class (whatever its case), concentration and ritual", () => {
    expect(find({ level: 0 })).toEqual(["Fire Bolt (srd-5.2)"]);
    expect(find({ className: "Bard" })).toEqual(["Faerie Fire (srd-5.2)"]);
    expect(find({ className: "Artificer" })).toEqual(["Fixture Spell (Mine)"]);
    expect(find({ concentration: true, ritual: true })).toEqual(["Detect Magic (srd-5.2)"]);
  });

  it("finds nothing for a search nothing matches", () => {
    expect(find({ query: "zzz" })).toEqual([]);
  });
});

describe("spellClasses", () => {
  it("lists each class once, alphabetically", () => {
    expect(spellClasses(all)).toEqual(["artificer", "Bard", "Sorcerer", "Wizard"]);
  });
});
