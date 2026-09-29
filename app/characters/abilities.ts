/**
 * The six abilities and eighteen skills, and the modifier maths from the paper sheet. Game terms
 * only; no rules text.
 */

export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
export type Ability = (typeof ABILITIES)[number];

export const ABILITY_NAMES: Record<Ability, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

/** Each skill and the ability it's rolled with. */
export const SKILL_ABILITIES = {
  acrobatics: "dex",
  "animal-handling": "wis",
  arcana: "int",
  athletics: "str",
  deception: "cha",
  history: "int",
  insight: "wis",
  intimidation: "cha",
  investigation: "int",
  medicine: "wis",
  nature: "int",
  perception: "wis",
  performance: "cha",
  persuasion: "cha",
  religion: "int",
  "sleight-of-hand": "dex",
  stealth: "dex",
  survival: "wis",
} as const satisfies Record<string, Ability>;

export type Skill = keyof typeof SKILL_ABILITIES;
export const SKILLS = Object.keys(SKILL_ABILITIES) as Skill[];

export const SKILL_NAMES: Record<Skill, string> = {
  acrobatics: "Acrobatics",
  "animal-handling": "Animal Handling",
  arcana: "Arcana",
  athletics: "Athletics",
  deception: "Deception",
  history: "History",
  insight: "Insight",
  intimidation: "Intimidation",
  investigation: "Investigation",
  medicine: "Medicine",
  nature: "Nature",
  perception: "Perception",
  performance: "Performance",
  persuasion: "Persuasion",
  religion: "Religion",
  "sleight-of-hand": "Sleight of Hand",
  stealth: "Stealth",
  survival: "Survival",
};

/** The skills the sheet shows a passive score for. */
export const PASSIVE_SKILLS = ["perception", "insight", "investigation"] as const satisfies Skill[];
export type PassiveSkill = (typeof PASSIVE_SKILLS)[number];

/** How much of the proficiency bonus applies: none, all of it, or twice (expertise). */
export const PROFICIENCIES = ["none", "proficient", "expertise"] as const;
export type Proficiency = (typeof PROFICIENCIES)[number];

const PROFICIENCY_MULTIPLIER: Record<Proficiency, number> = {
  none: 0,
  proficient: 1,
  expertise: 2,
};

/** The modifier for an ability score: 10–11 is +0, each 2 points more or less is ±1. */
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function proficiencyBonusFor(proficiency: Proficiency, bonus: number): number {
  return PROFICIENCY_MULTIPLIER[proficiency] * bonus;
}

/** "+3", "+0", "-1". */
export function signed(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}
