import type { DieRoll } from "../roll";

/**
 * Which dice are thrown in 3D. Kept apart from the 3D code itself, which only loads when something
 * is first thrown. Others (d2, d3, d100…) show as text only.
 */
export const TRAY_SIDES: ReadonlySet<number> = new Set([4, 6, 8, 10, 12, 20]);

/** More than this many dice in one roll: the first ones are thrown, all are in the text. */
export const MOST_DICE_THROWN = 10;

/** The dice of a roll that are thrown, in order. */
export function thrownDice<T extends Pick<DieRoll, "sides">>(rolls: readonly T[]): T[] {
  return rolls.filter((die) => TRAY_SIDES.has(die.sides)).slice(0, MOST_DICE_THROWN);
}

/** Whether any of these dice would be thrown, rather than only shown as text. */
export function throwsAny(rolls: readonly DieRoll[]): boolean {
  return thrownDice(rolls).length > 0;
}
