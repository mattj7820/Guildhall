/** Plain-words names for what an action changes, for notices on the sheet. */
import { ABILITY_NAMES, SKILL_NAMES } from "./abilities";
import type { CharacterAction } from "./actions";
import type { CounterRef } from "./tracking";
import type { Activation, DerivedKey, FeatureSource, Reset } from "./types";

/** "1st" to "9th", by spell level (0 has no ordinal: it's a cantrip). */
export const ORDINALS = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];

/** "Cantrips", "1st level"… */
export function levelName(level: number): string {
  return level === 0 ? "Cantrips" : `${ORDINALS[level]} level`;
}

export const ACTIVATION_NAMES: Record<Activation, string> = {
  action: "Action",
  bonus: "Bonus action",
  reaction: "Reaction",
  other: "Other",
  passive: "Passive",
};

export const SOURCE_NAMES: Record<FeatureSource, string> = {
  class: "Class",
  species: "Species",
  feat: "Feat",
  item: "Item",
  other: "Other",
};

export const RESET_NAMES: Record<Reset, string> = {
  short: "Short rest",
  long: "Long rest",
  manual: "By hand",
};

/** "2nd-level spell slots", "d8 hit dice", "A feature's uses". */
export function counterLabel(counter: CounterRef): string {
  if ("slot" in counter) return `${ORDINALS[counter.slot]}-level spell slots`;
  if ("hitDie" in counter) return `${counter.hitDie} hit dice`;
  return "Uses";
}

const TEXT_LABELS: Record<Extract<CharacterAction, { type: "text" }>["field"], string> = {
  name: "Name",
  species: "Species",
  className: "Class",
  background: "Background",
  speed: "Speed",
  senses: "Senses",
  languages: "Languages",
  proficiencies: "Proficiencies",
  defences: "Defences",
  conditions: "Conditions",
  notes: "Notes",
  concentrating: "Concentration",
};

const NUMBER_LABELS: Record<Extract<CharacterAction, { type: "number" }>["field"], string> = {
  level: "Level",
  proficiencyBonus: "Proficiency bonus",
  armourClass: "Armour class",
};

const HP_LABELS = {
  current: "Current hit points",
  max: "Maximum hit points",
  temp: "Temporary hit points",
};

export function derivedLabel(key: DerivedKey): string {
  if (key === "initiative") return "Initiative";
  if (key === "spell.dc") return "Spell save DC";
  if (key === "spell.attack") return "Spell attack bonus";
  const [kind, name] = key.split(".") as [string, string];
  if (kind === "save") return `${ABILITY_NAMES[name as keyof typeof ABILITY_NAMES]} save`;
  if (kind === "passive") return `Passive ${SKILL_NAMES[name as keyof typeof SKILL_NAMES]}`;
  return SKILL_NAMES[name as keyof typeof SKILL_NAMES];
}

/** What an action changes, e.g. "Armour class", "Stealth proficiency". */
export function actionLabel(action: CharacterAction): string {
  switch (action.type) {
    case "text":
      return TEXT_LABELS[action.field];
    case "number":
      return NUMBER_LABELS[action.field];
    case "ability":
      return ABILITY_NAMES[action.ability];
    case "save":
      return `${ABILITY_NAMES[action.ability]} save proficiency`;
    case "skill":
      return `${SKILL_NAMES[action.skill]} proficiency`;
    case "override":
      return derivedLabel(action.key);
    case "inspiration":
      return "Heroic inspiration";
    case "portrait":
      return "Portrait";
    case "hp":
      return HP_LABELS[action.field];
    case "damage":
    case "heal":
      return "Hit points";
    case "inventory":
      return "Bag";
    case "spellAbility":
      return "Spellcasting ability";
    case "count":
    case "limit":
      return counterLabel(action.counter);
    case "spells":
      return "Spells";
    case "attacks":
      return "Attacks";
    case "features":
      return "Features";
    case "rest":
      return action.rest === "short" ? "Short rest" : "Long rest";
  }
}

/**
 * Said when a change replaced one someone else made after this sheet last heard from the server:
 * "Armour class had been changed to 16 elsewhere; yours (15) was kept."
 */
export function replacedNotice(action: CharacterAction, replaced: unknown): string {
  const yours = "value" in action ? action.value : undefined;
  return `${actionLabel(action)} had been changed to ${shown(replaced)} elsewhere; yours (${shown(yours)}) was kept.`;
}

function shown(value: unknown): string {
  if (value === undefined || value === "") return "blank";
  if (typeof value === "boolean") return value ? "on" : "off";
  const text = String(value);
  return text.length > 40 ? `${text.slice(0, 40)}…` : text;
}
