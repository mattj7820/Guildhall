/**
 * Character shapes sent to the browser, already cut down to what the viewer may see.
 * Isomorphic: no server imports.
 */
import type { EntityId } from "~/campaign/types";
import type { Character, CharacterId, HitPoints, IconRef } from "./types";

/** An equipped item, as shown to anyone who sees the character's summary. */
export interface EquippedSummary {
  name: string;
  icon: IconRef;
}

/**
 * A party member on the Characters page. Someone who can't open the character gets only the
 * summary: name, portrait, species, class, level and what's equipped.
 */
export interface CharacterCard {
  kind: Character["kind"];
  /** The PC or companion note. */
  note: EntityId;
  name: string;
  /** No sheet yet: none. */
  id?: CharacterId;
  /** The full sheet and bag, and changing them. */
  canOpen: boolean;
  /** No sheet yet, and this viewer may start one. */
  canStart: boolean;
  portraitUrl?: string;
  species?: string;
  className?: string;
  level?: number;
  equipped: EquippedSummary[];
  /** Only for those who can open it. */
  hp?: HitPoints;
  /** A companion's numbers, from its statblock. */
  armourClass?: number;
  speed?: string;
}

/** A sheet whose vault note has gone, which only the DM can see and link again. */
export interface OrphanCard {
  id: CharacterId;
  name: string;
  note: EntityId;
}

/** What the sheet page needs, for someone allowed to open it. */
export interface CharacterPage {
  character: Character;
  /** The sheet's own name, or the note's title. */
  name: string;
  portraitUrl?: string;
  /** The note, if this viewer may read it in the wiki. */
  story?: { title: string; url: string; html: string };
  /** A companion's statblock, as this viewer may see it. */
  statblockHtml?: string;
  /** A companion's speed, from its statblock. */
  speed?: string;
  /** A companion's armour class, from its statblock. */
  armourClass?: number;
}
