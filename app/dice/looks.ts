/** How a set of dice looks: what three.js needs to draw them. */
export interface DiceLook {
  body: string;
  ink: string;
  /** A CSS font family for the numbers. */
  font: string;
  metalness: number;
  roughness: number;
  /** Below 1, see-through, like glass or resin. */
  opacity: number;
}

/** How a set of dice sounds as it knocks on the table and on other dice. */
export interface DiceVoice {
  /** Times the usual pitch: higher for glass, lower for bone. */
  pitch: number;
  /** How loud the ring after each knock is, from 0 (none: a dull thud) to about 0.5. */
  ring: number;
  /** The ring's pitch, times the knock's (not whole numbers for metal's clang). */
  ringPitch: number;
  /** How long the ring lasts, in seconds. */
  ringFor: number;
  /** How long the knock itself lasts, in seconds. */
  knockFor: number;
}

/** The theme's dice, and resin: a short knock with a low, soft ring. */
export const RESIN_VOICE: DiceVoice = {
  pitch: 1,
  ring: 0.15,
  ringPitch: 0.75,
  ringFor: 0.05,
  knockFor: 0.07,
};
