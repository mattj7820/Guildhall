import type { Page } from "@playwright/test";

/** The value Math.random must return for a die with `sides` to land on `face`. */
export const face = (sides: number, value: number) => (value - 0.5) / sides;
export const d20 = (value: number) => face(20, value);
export const d6 = (value: number) => face(6, value);

/**
 * Scripts the next dice the page rolls. Replaces Math.random in the loaded page (not in an init
 * script, because React and React Router also call it while starting up and navigating), so call
 * it just before the action that rolls. Real randomness resumes once the script runs out.
 */
export async function scriptDice(page: Page, values: number[]) {
  await page.evaluate((scripted) => {
    const real = Math.random;
    let next = 0;
    Math.random = () => (next < scripted.length ? scripted[next++] : real());
  }, values);
}
