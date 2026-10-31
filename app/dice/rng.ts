/**
 * The only source of randomness in the app: rolls one die and returns a face from 1 to `sides`.
 * Passed in wherever dice are rolled, so tests can script the results.
 */
export type Rng = (sides: number) => number;

/** Real dice. Reads `Math.random` at call time, so end-to-end tests can seed it in the page. */
export const defaultRng: Rng = (sides) => Math.floor(Math.random() * sides) + 1;

/**
 * A scripted Rng for tests: returns `faces` in order, whatever the die. Throws when a face can't
 * be on the die being rolled or the script runs out, so a test can't silently roll more than it
 * expects.
 */
export function sequenceRng(faces: readonly number[]): Rng {
  let next = 0;
  return (sides) => {
    if (next >= faces.length) {
      throw new Error(`sequenceRng ran out after ${faces.length} rolls`);
    }
    const face = faces[next++];
    if (!Number.isInteger(face) || face < 1 || face > sides) {
      throw new Error(`sequenceRng: ${face} can't be rolled on a d${sides}`);
    }
    return face;
  };
}

/**
 * A repeatable Rng from a seed (mulberry32), for what only has to look random, such as how dice
 * tumble on screen: never a roll's result. The same seed gives the same faces.
 */
export function seededRng(seed: number): Rng {
  let state = seed >>> 0;
  return (sides) => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const unit = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return Math.floor(unit * sides) + 1;
  };
}
