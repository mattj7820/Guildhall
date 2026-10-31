/** The DM picking tokens on a map, for a fight or for damage: pure and isomorphic. */
import type { Point } from "../types";
import type { TokenId, TokenView } from "./types";

/** The tokens whose centre is inside a box drawn between two corners (either way round). */
export function tokensInBox(tokens: readonly TokenView[], from: Point, to: Point): TokenId[] {
  const [left, right] = [Math.min(from[0], to[0]), Math.max(from[0], to[0])];
  const [top, bottom] = [Math.min(from[1], to[1]), Math.max(from[1], to[1])];
  return tokens
    .filter(({ at: [x, y] }) => x >= left && x <= right && y >= top && y <= bottom)
    .map((token) => token.id);
}

/** A token in or out of the pick. */
export function togglePick(picked: readonly TokenId[], id: TokenId): TokenId[] {
  return picked.includes(id) ? picked.filter((each) => each !== id) : [...picked, id];
}

/** More tokens in the pick, each once, in the order they came. */
export function addToPick(picked: readonly TokenId[], ids: readonly TokenId[]): TokenId[] {
  return [
    ...picked,
    ...ids.filter((id, index) => !picked.includes(id) && ids.indexOf(id) === index),
  ];
}

/**
 * Whether a token is in the fight now: a party member or monster with a combatant. The others
 * (markers with a statblock, party members not in it) are what a fight can be started with.
 */
export const inTheFight = (token: TokenView) => !!token.combatant;
