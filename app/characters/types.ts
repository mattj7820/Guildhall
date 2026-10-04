/**
 * Character sheets and their inventories. Isomorphic: stored by the server, edited in the browser.
 */
import type { EntityId } from "~/campaign/types";
import type { SpellShape } from "~/maps/grid/shapes";
import type { Ability, PassiveSkill, Proficiency, Skill } from "./abilities";

export type ItemId = string;

/** A built-in icon from `item-icons.ts`, by ID. Vault images may join later. */
export interface IconRef {
  builtin: string;
}

/** Where an item came from: free text ("Session 1"), a vault note (a place, a person), or both. */
export interface ItemSource {
  text?: string;
  note?: EntityId;
}

/**
 * Something a character carries. Its name and icon are copied when it's added, so the tile still
 * says what the player was told if the linked note is renamed, removed or kept secret.
 */
export interface InventoryItem {
  id: ItemId;
  name: string;
  icon: IconRef;
  /** A whole number, at least 1. */
  quantity: number;
  equipped: boolean;
  attuned: boolean;
  /** The vault item note this is, if any. */
  note?: EntityId;
  /** A line or two, written by the player or the DM. */
  description?: string;
  source?: ItemSource;
  /** Who handed it over: "the DM", or another character by name. */
  givenBy?: string;
  /** Given by someone else and not yet looked at by its owner. */
  unseen?: boolean;
}

export const COINS = ["cp", "sp", "ep", "gp", "pp"] as const;
export type Coin = (typeof COINS)[number];
export type Purse = Record<Coin, number>;

export interface Inventory {
  /** In the order they sit in the grid. */
  items: InventoryItem[];
  purse: Purse;
}

export type CharacterId = string;

export interface HitPoints {
  current: number;
  max: number;
  /** Absorbs damage first; doesn't stack. */
  temp: number;
}

/**
 * A number the sheet works out, which can be typed over: a save or skill bonus, initiative, a
 * passive score, or the spell save DC and attack bonus. Keys look like `save.dex`,
 * `skill.stealth`, `initiative`, `passive.perception`, `spell.dc`.
 */
export type DerivedKey =
  | `save.${Ability}`
  | `skill.${Skill}`
  | "initiative"
  | `passive.${PassiveSkill}`
  | "spell.dc"
  | "spell.attack";

/** Something that gets used up: spell slots at a level, hit dice of a size, a feature's uses. */
export interface Counter {
  max: number;
  /** Between 0 and `max`. */
  used: number;
}

/** What gives a feature's uses back. Anything "at dawn" is a long rest at the table. */
export const RESETS = ["short", "long", "manual"] as const;
export type Reset = (typeof RESETS)[number];

export interface Uses extends Counter {
  reset: Reset;
}

/** How a feature is used in play, which decides where it's listed with the actions. */
export const ACTIVATIONS = ["action", "bonus", "reaction", "other", "passive"] as const;
export type Activation = (typeof ACTIVATIONS)[number];

export const FEATURE_SOURCES = ["class", "species", "feat", "item", "other"] as const;
export type FeatureSource = (typeof FEATURE_SOURCES)[number];

export type FeatureId = string;

/**
 * Something the character can do or has: a class feature, a species trait, a feat or an item's
 * power, as a reminder in the player's own words. Uses, if it has them, are ticked off here, and
 * a spell cast for free (a feat's once a day) spends them.
 */
export interface Feature {
  id: FeatureId;
  name: string;
  source: FeatureSource;
  /** The item or class it comes from, if worth saying ("Wand of Sparks"). */
  sourceName?: string;
  activation: Activation;
  note?: string;
  /** Dice to roll, such as healing or damage. */
  roll?: string;
  uses?: Uses;
}

export type AttackId = string;

/** An attack as written on the paper sheet: the bonus is typed, not worked out. */
export interface Attack {
  id: AttackId;
  name: string;
  bonus: number;
  /** Dice, such as `1d8+3`; empty for none. */
  damage: string;
  damageType?: string;
  /** Range, properties, anything else. */
  notes?: string;
}

export type SpellId = string;

/** 0 is a cantrip. */
export const SPELL_LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export type SpellLevel = (typeof SPELL_LEVELS)[number];

/** Spell areas use the battle map's own shapes, so a spell could one day lay one out there. */
export interface SpellArea {
  shape: SpellShape;
  feet: number;
}

/**
 * A spell the character knows or has prepared, as typed in. Its details are short text, as
 * spells write them ("1 bonus action", "60 ft."). It can point at a vault spell note.
 */
export interface Spell {
  id: SpellId;
  name: string;
  level: SpellLevel;
  castingTime: string;
  range: string;
  components: string;
  duration: string;
  concentration: boolean;
  ritual: boolean;
  /** Rolls a spell attack. */
  attack: boolean;
  /** Asks for a saving throw against the spell save DC. */
  save?: Ability;
  /** Damage or healing dice. */
  roll?: string;
  /** What the roll is ("fire", "healing"), or what the spell does. */
  effect?: string;
  area?: SpellArea;
  /** Cast with another ability than the sheet's own (a feat's spell, say). */
  ability?: Ability;
  /** A feature whose uses cast it without a slot. */
  freeUse?: FeatureId;
  description?: string;
  /** The vault spell note this is, if any. */
  note?: EntityId;
}

export const HIT_DICE = ["d6", "d8", "d10", "d12"] as const;
export type HitDie = (typeof HIT_DICE)[number];

/**
 * A player character's sheet, as typed in from paper. Only the maths the paper sheet does itself
 * (modifiers, proficiency) is worked out; anything else a feature changes is typed as an override.
 * Rules can later fill in or check these values without changing what's stored.
 */
export interface Sheet {
  /** Blank means the PC note's title. */
  name: string;
  species: string;
  className: string;
  level: number;
  background: string;
  /** A vault image; none means the first image in the PC note. */
  portrait?: string;
  abilities: Record<Ability, number>;
  proficiencyBonus: number;
  saves: Record<Ability, Proficiency>;
  skills: Record<Skill, Proficiency>;
  overrides: Partial<Record<DerivedKey, number>>;
  armourClass: number;
  /** Text, as it's often more than a number ("30 ft., climb 20 ft."). */
  speed: string;
  hp: HitPoints;
  heroicInspiration: boolean;
  senses: string;
  languages: string;
  proficiencies: string;
  defences: string;
  conditions: string;
  /** Anything else, as free text. */
  notes: string;
  /** The ability the character casts spells with; none for a character without spells. */
  spellAbility?: Ability;
  /** In the order the player put them; shown by level. */
  spells: Spell[];
  /** Index 0 is 1st level, up to 9th. */
  spellSlots: Counter[];
  /** By die size, so multiclassing works later; a size with no maximum isn't shown. */
  hitDice: Record<HitDie, Counter>;
  features: Feature[];
  attacks: Attack[];
  /** The spell being concentrated on, by name; empty for none. */
  concentrating: string;
}

interface CharacterBase {
  id: CharacterId;
  /** The vault note this is about: its story, name and (for a PC) who plays it. */
  note: EntityId;
  /** Goes up by one with every saved change; lets an editor tell others have changed it. */
  revision: number;
  createdAt: string;
  updatedAt: string;
  inventory: Inventory;
}

/** A player character: a full sheet and a bag. */
export interface PlayerCharacter extends CharacterBase {
  kind: "pc";
  sheet: Sheet;
}

/**
 * A companion the party shares, such as an animal: its numbers stay in its vault statblock, so
 * Guildhall keeps only its hit points (the maximum starts as the statblock's) and its bag.
 */
export interface Companion extends CharacterBase {
  kind: "companion";
  hp: HitPoints;
}

export type Character = PlayerCharacter | Companion;
