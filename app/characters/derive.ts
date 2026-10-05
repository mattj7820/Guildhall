/**
 * The numbers a sheet works out from what's typed in: ability modifiers, saving throws, skills,
 * initiative and passive scores, as on the paper sheet. Any of them can be typed over, for the
 * features and items that change them; the override always wins. This is where rules (species,
 * class, equipment) would add their contributions later, and could flag a typed value they
 * disagree with.
 */
import {
  ABILITIES,
  abilityModifier,
  PASSIVE_SKILLS,
  proficiencyBonusFor,
  SKILL_ABILITIES,
  SKILLS,
  type Ability,
  type PassiveSkill,
  type Skill,
} from "./abilities";
import type { DerivedKey, Sheet } from "./types";

export interface DerivedValue {
  /** What the sheet shows and rolls with. */
  value: number;
  /** What the sheet's maths gives. */
  computed: number;
  /** A number has been typed over the computed one. */
  overridden: boolean;
}

export interface DerivedSheet {
  modifiers: Record<Ability, number>;
  saves: Record<Ability, DerivedValue>;
  skills: Record<Skill, DerivedValue>;
  initiative: DerivedValue;
  passives: Record<PassiveSkill, DerivedValue>;
  /** Only for a character with a spellcasting ability. */
  spellcasting?: SpellNumbers;
}

/** The spell save DC and spell attack bonus for one ability. */
export interface SpellNumbers {
  ability: Ability;
  dc: DerivedValue;
  attack: DerivedValue;
}

export function deriveSheet(sheet: Sheet): DerivedSheet {
  const modifiers = mapKeys(ABILITIES, (ability) => abilityModifier(sheet.abilities[ability]));
  const withOverride = (key: DerivedKey, computed: number): DerivedValue => {
    const typed = sheet.overrides[key];
    return typed === undefined
      ? { value: computed, computed, overridden: false }
      : { value: typed, computed, overridden: true };
  };

  const saves = mapKeys(ABILITIES, (ability) =>
    withOverride(
      `save.${ability}`,
      modifiers[ability] + proficiencyBonusFor(sheet.saves[ability], sheet.proficiencyBonus),
    ),
  );
  const skills = mapKeys(SKILLS, (skill) =>
    withOverride(
      `skill.${skill}`,
      modifiers[SKILL_ABILITIES[skill]] +
        proficiencyBonusFor(sheet.skills[skill], sheet.proficiencyBonus),
    ),
  );
  // A passive score is 10 plus the skill as the sheet shows it, overrides included.
  const passives = mapKeys(PASSIVE_SKILLS, (skill) =>
    withOverride(`passive.${skill}`, 10 + skills[skill].value),
  );

  const spellcasting = sheet.spellAbility && spellNumbers(sheet, sheet.spellAbility);
  return {
    modifiers,
    saves,
    skills,
    initiative: withOverride("initiative", modifiers.dex),
    passives,
    ...(spellcasting && { spellcasting }),
  };
}

/**
 * Spell save DC (8 + proficiency + modifier) and spell attack bonus (proficiency + modifier) for
 * an ability. Typed-over numbers are for the sheet's own spellcasting ability; a spell cast with
 * another (a feat's) gets the plain maths.
 */
export function spellNumbers(sheet: Sheet, ability: Ability): SpellNumbers {
  const modifier = abilityModifier(sheet.abilities[ability]);
  const own = ability === sheet.spellAbility;
  const value = (key: "spell.dc" | "spell.attack", computed: number): DerivedValue => {
    const typed = own ? sheet.overrides[key] : undefined;
    return typed === undefined
      ? { value: computed, computed, overridden: false }
      : { value: typed, computed, overridden: true };
  };
  return {
    ability,
    dc: value("spell.dc", 8 + sheet.proficiencyBonus + modifier),
    attack: value("spell.attack", sheet.proficiencyBonus + modifier),
  };
}

function mapKeys<K extends string, V>(keys: readonly K[], value: (key: K) => V): Record<K, V> {
  return Object.fromEntries(keys.map((key) => [key, value(key)])) as Record<K, V>;
}
