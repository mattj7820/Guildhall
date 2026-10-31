import type { DieRoll } from "../roll";

/**
 * Which dice are thrown in 3D. Kept apart from the 3D code itself, which only loads when something
 * is first thrown. Others (d2, d3, d100…) show as text only.
 */
export const TRAY_SIDES: ReadonlySet<number> = new Set([4, 6, 8, 10, 12, 20]);

/** Whether any of these dice would be thrown, rather than only shown as text. */
export function throwsAny(rolls: readonly DieRoll[]): boolean {
  return rolls.some((die) => TRAY_SIDES.has(die.sides));
}
