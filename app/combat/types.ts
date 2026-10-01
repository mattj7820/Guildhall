/**
 * The combat tracker's model. Isomorphic: shared by the server (which builds the catalogue from
 * the vault) and the browser (which runs encounters).
 */
import type { EntityId, Player } from "~/campaign/types";
import type { MapId, Point } from "~/maps/types";

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
  /** Squares across on a battle map, from its size. */
  squares?: 1 | 2 | 3 | 4;
  /** Rollable, e.g. "2d6 + 2". */
  hitDice?: string;
  initiativeBonus: number;
  /** The book-style statblock, rendered and sanitised on the server. */
  html: string;
}

/** A party member from the vault: a `type: pc` note, or the party's `type: companion`. */
export interface PartyMember {
  kind: "pc" | "companion";
  entityId: EntityId;
  name: string;
  noteUrl: string;
  /**
   * Who controls them, from the note's `player` frontmatter: undefined for a PC until the DM writes
   * it; the whole party for a companion that names no one.
   */
  player?: Player;
  /** A companion's statblock, shown when it's their turn. */
  statblock?: StatblockRef;
}

/**
 * The controller of a companion the whole party shares: every player may see its details. Its ID
 * is empty, which no player's can be (a blank name isn't a player).
 */
export const WHOLE_PARTY: Player = { id: "", name: "the party" };

/** Whether a controller is the whole party (compared by ID, since it may have come as JSON). */
export const isWholeParty = (player: Player | undefined) => player?.id === WHOLE_PARTY.id;

/** What the vault offers the combat tracker. */
export interface CombatCatalogue {
  creatures: CreatureOption[];
  party: PartyMember[];
}

/** The 5e conditions, as simple tags. */
export const CONDITIONS = [
  "blinded",
  "charmed",
  "deafened",
  "exhaustion",
  "frightened",
  "grappled",
  "incapacitated",
  "invisible",
  "paralyzed",
  "petrified",
  "poisoned",
  "prone",
  "restrained",
  "stunned",
  "unconscious",
] as const;

export type Condition = (typeof CONDITIONS)[number];

/** Stable for the life of an encounter; keys the UI and any future real-time updates. */
export type CombatantId = string;

interface CombatantBase {
  id: CombatantId;
  /** "Goblin 2", "Aria" */
  name: string;
  /** The initiative total; null until rolled or entered. */
  initiative: number | null;
  /** d20 rerolls that broke ties, in order. Compared after `initiative`. */
  tiebreaks: number[];
  conditions: Condition[];
  /** A short note. On a player combatant, its player will be able to see it. */
  note: string;
  /** Set when added after combat started, so tie-breaks place it without reshuffling others. */
  joinedRound?: number;
}

/** A monster or NPC the DM runs: fully tracked. */
export interface MonsterCombatant extends CombatantBase {
  kind: "monster";
  statblock: StatblockRef;
  /** Snapshotted from the statblock when added, so editing the note can't change a live fight. */
  initiativeBonus: number;
  armorClass?: number;
  hp: HitPoints;
  /** Hidden from players (an ambusher): not in their turn order, nor on their map. */
  hidden?: boolean;
}

/** A PC or companion a player runs: the players track their own stats. */
export interface PlayerCombatant extends CombatantBase {
  kind: "player";
  controller: Player;
  /** The PC's vault note, if it came from one. */
  entityId?: EntityId;
  /** Optional reference, e.g. a companion's statblock. */
  statblock?: StatblockRef;
}

export type Combatant = MonsterCombatant | PlayerCombatant;

export interface HitPoints {
  current: number;
  max: number;
  temp: number;
}

export interface Encounter {
  schemaVersion: 1;
  id: string;
  phase: "setup" | "active";
  /** 0 during setup. */
  round: number;
  /** An ID rather than an index, so adding or removing combatants can't shift the turn. */
  activeId: CombatantId | null;
  /** In turn order. The DM can reorder by hand. */
  combatants: Combatant[];
}

/**
 * A fight set up ahead of a session. Its encounter holds the monsters (HP already rolled) and any
 * companions; initiative is rolled and the party chosen when it starts. Starting copies it, so
 * the prepared encounter stays as a reusable template.
 */
export interface PreparedEncounter {
  id: string;
  name: string;
  /** The DM's notes on the fight, e.g. where it happens or how the monsters behave. */
  notes: string;
  /** ISO 8601 timestamps. */
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  encounter: Encounter;
  /** Set up on a map: it starts there, with its monsters where the DM put them. */
  placement?: PreparedPlacement;
}

/** A prepared fight's map, and where its monsters stand on it (by combatant, in fractions). */
export interface PreparedPlacement {
  map: MapId;
  at: Record<CombatantId, Point>;
}
