/**
 * What a `type: spell` note's frontmatter says about the spell, so the spell picker can fill a
 * sheet's spell in from it as from the SRD (the format is in the README). Every field is optional,
 * and a value that can't be read is left out rather than refusing the note.
 */
import { ABILITIES, type Ability } from "~/characters/abilities";
import { AREA_FEET_MAX } from "~/characters/schema";
import { SPELL_LEVELS, type SpellArea, type SpellLevel } from "~/characters/types";
import { parseDice } from "~/dice/parse";
import { SPELL_SHAPES } from "~/maps/grid/shapes";
import { nonEmptyString, stringList } from "./frontmatter";

export interface SpellFields {
  level?: SpellLevel;
  school?: string;
  /** As the SRD names them ("Artificer"), whatever their case in the note. */
  classes: string[];
  castingTime?: string;
  range?: string;
  components?: string;
  duration?: string;
  concentration?: boolean;
  ritual?: boolean;
  attack?: boolean;
  save?: Ability;
  roll?: string;
  effect?: string;
  area?: SpellArea;
}

export function spellFields(data: Record<string, unknown>): SpellFields {
  const text = (key: string) => {
    const value = nonEmptyString(data[key]);
    return value === undefined ? {} : { [key === "casting_time" ? "castingTime" : key]: value };
  };
  const flag = (key: "concentration" | "ritual" | "attack") => {
    const value = yesOrNo(data[key]);
    return value === undefined ? {} : { [key]: value };
  };
  const level = levelOf(data.level);
  const save = saveOf(data.save);
  const roll = nonEmptyString(data.roll);
  const area = areaOf(data.area);
  return {
    ...(level !== undefined && { level }),
    ...text("school"),
    classes: stringList(data.classes).map(capitalised),
    ...text("casting_time"),
    ...text("range"),
    ...text("components"),
    ...text("duration"),
    ...flag("concentration"),
    ...flag("ritual"),
    ...flag("attack"),
    ...(save && { save }),
    ...(roll && parseDice(roll).ok && { roll }),
    ...text("effect"),
    ...(area && { area }),
  };
}

/** 0 to 9, or "cantrip". */
function levelOf(value: unknown): SpellLevel | undefined {
  const text = nonEmptyString(value)?.toLowerCase();
  const level = text === "cantrip" ? 0 : Number(text);
  return SPELL_LEVELS.find((each) => each === level);
}

/** "dex", "DEX" or "Dexterity". */
function saveOf(value: unknown): Ability | undefined {
  const start = nonEmptyString(value)?.slice(0, 3).toLowerCase();
  return ABILITIES.find((ability) => ability === start);
}

function yesOrNo(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  const text = nonEmptyString(value)?.toLowerCase();
  return text === "yes" || text === "true"
    ? true
    : text === "no" || text === "false"
      ? false
      : undefined;
}

/** "20 ft cube", "20-foot cone", "15 ft. radius" (a sphere), "100 feet line". */
function areaOf(value: unknown): SpellArea | undefined {
  const match = /^(\d+)[\s-]*(?:ft\.?|feet|foot)?[\s-]*(\w+)$/i.exec(nonEmptyString(value) ?? "");
  if (!match) return undefined;
  const named = match[2].toLowerCase();
  const shape = SPELL_SHAPES.find((each) => each === (named === "radius" ? "sphere" : named));
  const feet = Number(match[1]);
  return shape && feet >= 1 && feet <= AREA_FEET_MAX ? { shape, feet } : undefined;
}

const capitalised = (name: string) => name.replace(/\b\w/g, (letter) => letter.toUpperCase());
