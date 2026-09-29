/** Plain-words names for what an action changes, for notices on the sheet. */
import { ABILITY_NAMES, SKILL_NAMES } from "./abilities";
import type { CharacterAction } from "./actions";
import type { DerivedKey } from "./types";

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
