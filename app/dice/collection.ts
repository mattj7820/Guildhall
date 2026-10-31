import type { DieType } from "./styles";

/**
 * Someone's dice collection: the dice they own (one style in one type, counted, since owning two
 * of a d20 lets them roll two at once), the packs they haven't opened yet, and which style each
 * type rolls with first. Isomorphic: shapes only, the styles themselves stay on the server.
 */

/** How many of one style in one type they own. */
export interface OwnedDie {
  style: string;
  sides: DieType;
  count: number;
}

/** A pack the DM gave, not opened yet. What's in it is drawn only when it's opened. */
export interface DicePack {
  id: string;
  givenAt: string;
  /** Why, in the DM's words ("For the session 12 recap"). */
  reason?: string;
}

/** A die someone got: from a pack they opened, or given by the DM. */
export interface DiceGot {
  at: string;
  style: string;
  sides: DieType;
  /** The pack it came out of; without one, the DM gave it. */
  pack?: string;
  reason?: string;
}

export interface DiceCollection {
  owned: OwnedDie[];
  packs: DicePack[];
  /** The style each type is rolled in first; the rest of their dice of that type fill in after. */
  favourites: { sides: DieType; style: string }[];
  /** What they got, newest last (kept to the latest few hundred). */
  history: DiceGot[];
}

export const EMPTY_COLLECTION: DiceCollection = {
  owned: [],
  packs: [],
  favourites: [],
  history: [],
};

/**
 * The most of one style in one type worth having: about the most a roll ever throws (three d20s
 * for Elven Accuracy, ten d6s, the most the tray throws). A pack never gives a die past this.
 */
export const MOST_OF_A_DIE: Record<DieType, number> = { 4: 4, 6: 10, 8: 8, 10: 4, 12: 2, 20: 3 };

/** How many of this style in this type are owned. */
export function countOf(owned: readonly OwnedDie[], style: string, sides: DieType): number {
  return owned.find((die) => die.style === style && die.sides === sides)?.count ?? 0;
}

/** One more of a die, never past the most worth having. */
export function addDie(owned: readonly OwnedDie[], style: string, sides: DieType): OwnedDie[] {
  const count = Math.min(countOf(owned, style, sides) + 1, MOST_OF_A_DIE[sides]);
  const others = owned.filter((die) => !(die.style === style && die.sides === sides));
  return [...others, { style, sides, count }];
}
