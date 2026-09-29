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

/** A vault item note someone may add to a bag: its entity ID, title and suggested icon. */
export interface CatalogueItem {
  id: EntityId;
  title: string;
  icon?: string;
  /** For the DM: players can't read this note (yet), so they'll see only the item's own name. */
  hiddenFromPlayers?: boolean;
}

/** A linked vault note as the viewer may see it, rendered on the server. */
export interface LinkedNote {
  title: string;
  html: string;
  url: string;
  /** For the DM: players can't read this note (yet). */
  hiddenFromPlayers?: boolean;
}

/** Someone an item can be handed to: another character, or a companion the party shares. */
export interface GiftRecipient {
  id: CharacterId;
  name: string;
  companion?: boolean;
}

/** What the sheet page needs, for someone allowed to open it. */
export interface CharacterPage {
  character: Character;
  /** The sheet's own name, or the note's title. */
  name: string;
  portraitUrl?: string;
  /** The image the note shows this viewer first: the portrait when none is chosen. */
  notePortrait?: string;
  /** Images this viewer may choose as a PC's portrait. */
  portraitChoices?: string[];
  /** The note, if this viewer may read it in the wiki. */
  story?: { title: string; url: string; html: string };
  /** A companion's statblock, as this viewer may see it. */
  statblockHtml?: string;
  /** A companion's speed, from its statblock. */
  speed?: string;
  /** A companion's armour class, from its statblock. */
  armourClass?: number;
  /** Vault item notes this viewer may add to the bag. */
  catalogue: CatalogueItem[];
  /** Those notes as this viewer may read them, by entity ID, for items' details. */
  itemNotes: Record<EntityId, LinkedNote>;
  /** Who this viewer gives items as ("the DM"); none when it's their own bag. */
  givingAs?: string;
  /** Other party members with a bag, whom items can be given to. */
  recipients: GiftRecipient[];
}
