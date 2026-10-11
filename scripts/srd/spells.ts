/**
 * Converts the SRD's spells, as 5e-bits' 5e-database has them, into the shape Guildhall bundles:
 * the SRD's own fields and text, plus what a sheet's spell can be filled in with (a save, a roll
 * and an area), read from the data where it has them and from the text where it doesn't. Pure, so
 * it can be tested on a few real records; the import script fetches the data and writes the result.
 *
 * Every word of text is the SRD's as the dataset has it: paragraphs are only laid out.
 */
import type { SrdVersion } from "./convert.ts";

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
type Ability = (typeof ABILITIES)[number];

/** The battle map's spell shapes (app/maps/grid/shapes.ts), and the sheet's largest area. */
const SHAPES = ["sphere", "cube", "cone", "line"] as const;
type Shape = (typeof SHAPES)[number];
const AREA_FEET_MAX = 1000;

/** One converted spell, as the committed data holds it. */
export interface SrdSpell {
  /** 5e-bits' index, e.g. "fire-bolt": stable, and unique within a version. */
  id: string;
  name: string;
  /** 0 for a cantrip. */
  level: number;
  school: string;
  /** The classes whose lists have it, by name ("Wizard"). */
  classes: string[];
  castingTime: string;
  range: string;
  /** "V, S, M"; the material is its own field. */
  components: string;
  material?: string;
  duration: string;
  concentration: boolean;
  ritual: boolean;
  attack: boolean;
  save?: Ability;
  /** The spell's damage or healing dice; never a mishap's (see `MISHAPS`). */
  roll?: string;
  /** What the roll is: a damage type ("fire"), or "healing". */
  effect?: string;
  area?: { shape: Shape; feet: number };
  /** Markdown: the SRD's paragraphs (and 2014's tables). */
  text: string;
  /** "At higher levels" or "Using a Higher-Level Spell Slot", where it's apart from the text. */
  higherLevel?: string;
}

// The parts of 5e-bits' records the conversion reads.
interface Named {
  name: string;
  index: string;
}
interface Damage {
  damage_type?: Named;
  damage_at_slot_level?: Record<string, string>;
  damage_at_character_level?: Record<string, string>;
}
export interface SourceSpell {
  index: string;
  name: string;
  level: number;
  school: Named;
  classes: Named[];
  casting_time: string;
  range: string;
  components: string[];
  material?: string;
  duration: string;
  concentration: boolean;
  ritual: boolean;
  attack_type?: string;
  /** An array in 2014's data, one object in 2024's. */
  damage?: Damage | Damage[];
  /** 2014 only. */
  heal_at_slot_level?: Record<string, string>;
  dc?: { dc_type: Named };
  area_of_effect?: { type: string; size: number };
  /** 2014: paragraphs (a table is one row per entry). 2024: `description`, one string. */
  desc?: string[];
  description?: string;
  higher_level?: string[] | string;
}

const DICE = /^\d+d\d+(?:\s*[+-]\s*\d+)?$/;
const ABILITY_NAMES = "Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma";
/** The saving throw a spell asks for; "advantage on Dexterity saving throws" doesn't count. */
const SAVE = new RegExp(
  `(?:makes?|must make|succeeds? on|must succeed on) an? (${ABILITY_NAMES}) saving throw`,
  "gi",
);
/**
 * Spells whose only damage in the data is a mishap or a cost, not what the spell does: Wish's
 * stress, Teleport's mishap, a door into an occupied space. Named, as no rule tells them apart
 * from Hex's or a smite's extra damage.
 */
const MISHAPS = new Set([
  "contact-other-plane",
  "dimension-door",
  "meld-into-stone",
  "teleport",
  "wish",
]);
const HEALING = /regains? (?:a number of )?Hit Points equal to (\d+d\d+)/i;
const LINE = /(\d+)-foot-long(?:, [\d-]+foot-wide)? Line\b/i;
const AREA = /(\d+)-foot(?:-radius)?,? (Sphere|Cube|Cone|Emanation)\b/i;

export function convertSpell(spell: SourceSpell, version: SrdVersion): SrdSpell {
  const text = version === "5.1" ? paragraphs(spell.desc ?? []) : lines(spell.description ?? "");
  const higher = Array.isArray(spell.higher_level)
    ? paragraphs(spell.higher_level)
    : lines(spell.higher_level ?? "");
  const attack = Boolean(spell.attack_type);
  const save = version === "5.1" ? abilityOf(spell.dc?.dc_type.index) : saveIn(text);
  const area = version === "5.1" ? structuredArea(spell.area_of_effect) : areaIn(text);
  return {
    id: spell.index,
    name: spell.name,
    level: spell.level,
    school: spell.school.name,
    classes: spell.classes.map(({ name }) => name),
    castingTime: spell.casting_time,
    range: spell.range,
    components: spell.components.join(", "),
    ...(spell.material && { material: spell.material }),
    duration: spell.duration,
    concentration: spell.concentration,
    ritual: spell.ritual,
    attack,
    ...(save && { save }),
    ...rollOf(spell, text),
    ...(area && { area }),
    text,
    ...(higher && { higherLevel: higher }),
  };
}

/** 2014's paragraphs, a blank line apart; a table's rows stay together. */
function paragraphs(entries: string[]): string {
  return entries
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce(
      (text, entry, index, all) =>
        index === 0
          ? entry
          : `${text}${entry.startsWith("|") && all[index - 1].startsWith("|") ? "\n" : "\n\n"}${entry}`,
      "",
    );
}

/** 2024's text has one paragraph per line (indented); a blank line apart, as markdown wants. */
function lines(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n\n");
}

function abilityOf(index: string | undefined): Ability | undefined {
  return ABILITIES.find((ability) => ability === index);
}

/** The one ability the text asks a save of; none if it names several. */
function saveIn(text: string): Ability | undefined {
  const named = new Set([...text.matchAll(SAVE)].map((match) => match[1].toLowerCase()));
  return named.size === 1 ? abilityOf([...named][0].slice(0, 3)) : undefined;
}

function structuredArea(area: SourceSpell["area_of_effect"]): SrdSpell["area"] {
  const shape = SHAPES.find((each) => each === area?.type);
  return shape && area && area.size <= AREA_FEET_MAX ? { shape, feet: area.size } : undefined;
}

/** The first area the 2024 text gives; an Emanation is a sphere around the caster. */
function areaIn(text: string): SrdSpell["area"] {
  const line = LINE.exec(text);
  const other = AREA.exec(text);
  if (line && (!other || line.index < other.index)) return { shape: "line", feet: Number(line[1]) };
  if (!other) return undefined;
  const named = other[2].toLowerCase();
  return { shape: named === "emanation" ? "sphere" : (named as Shape), feet: Number(other[1]) };
}

/**
 * The dice at the spell's own level (a cantrip's at its first): its first damage with a type
 * (Flame Strike's fire, not its radiant), or else its healing. 2014 writes "1d8 + MOD"; the
 * modifier is left to the sheet's player, as the roll is only dice.
 */
function rollOf(spell: SourceSpell, text: string): Pick<SrdSpell, "roll" | "effect"> {
  const damage = Array.isArray(spell.damage) ? spell.damage[0] : spell.damage;
  if (damage?.damage_type && !MISHAPS.has(spell.index)) {
    const table = damage.damage_at_slot_level ?? damage.damage_at_character_level ?? {};
    const dice = diceOf(table[spell.level] ?? table[1] ?? table[0]);
    if (dice) return { roll: dice, effect: damage.damage_type.index };
  }
  const healing = spell.heal_at_slot_level
    ? diceOf(spell.heal_at_slot_level[spell.level])
    : diceOf(HEALING.exec(text)?.[1]);
  return healing ? { roll: healing, effect: "healing" } : {};
}

function diceOf(text: string | undefined): string | undefined {
  const trimmed = text?.trim().replace(/\s*\+\s*MOD$/, "");
  return trimmed && DICE.test(trimmed) ? trimmed.replace(/\s+/g, "") : undefined;
}
