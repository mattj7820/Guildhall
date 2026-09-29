/**
 * Character sheets and their inventories. Isomorphic: stored by the server, edited in the browser.
 */
import type { EntityId } from "~/campaign/types";
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
 * A number the sheet works out, which can be typed over: a save or skill bonus, initiative, or a
 * passive score. Keys look like `save.dex`, `skill.stealth`, `initiative`, `passive.perception`.
 */
export type DerivedKey =
  `save.${Ability}` | `skill.${Skill}` | "initiative" | `passive.${PassiveSkill}`;

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
  /** Features, traits and anything else, as free text. */
  notes: string;
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
 * Guildhall keeps only its current hit points and its bag.
 */
export interface Companion extends CharacterBase {
  kind: "companion";
  hp: Pick<HitPoints, "current" | "temp">;
}

export type Character = PlayerCharacter | Companion;
