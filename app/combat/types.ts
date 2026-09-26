/**
 * The combat tracker's model. Isomorphic: shared by the server (which builds the catalogue from
 * the vault) and the browser (which runs encounters).
 */
import type { EntityId, Player } from "~/campaign/types";

/** Points at one statblock in the vault: the note's stable ID plus the statblock's name. */
export interface StatblockRef {
  entityId: EntityId;
  name: string;
}

/** One string per statblock, for lookups and form values. */
export function statblockKey(ref: StatblockRef): string {
  return `${ref.entityId}#${ref.name}`;
}

/** A statblock the DM can add to an encounter, with the numbers the tracker needs. */
export interface CreatureOption {
  key: string;
  ref: StatblockRef;
  name: string;
  noteTitle: string;
  noteUrl: string;
  armorClass?: number;
  hitPoints?: number;
  /** Rollable, e.g. "2d6 + 2". */
  hitDice?: string;
  initiativeBonus: number;
  /** The book-style statblock, rendered and sanitised on the server. */
  html: string;
}

/** A player character from a `type: pc` note. */
export interface PartyMember {
  entityId: EntityId;
  name: string;
  noteUrl: string;
  /** From the note's `player` frontmatter; undefined until the DM writes it. */
  player?: Player;
}

/** What the vault offers the combat tracker. */
export interface CombatCatalogue {
  creatures: CreatureOption[];
  party: PartyMember[];
}
