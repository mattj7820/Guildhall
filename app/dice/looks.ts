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
  /** A colour the die glows with, faintly in its body and brightly around its numbers. */
  glow?: string;
  /** Colours running through the body, in place of `body` alone. */
  pattern?: DicePattern;
  /** Flecks that catch the light as the die turns. */
  glitter?: { colour: string; /** 0 to 1: how many. */ amount: number };
  /** A smaller die inside a see-through one, slowly swirling, like a liquid core. */
  core?: { colours: [string, string]; glitter?: string };
  /** Little things set inside a see-through die. */
  inclusions?: { kind: InclusionKind; colours: string[]; count: number };
  /** Icons (token icon IDs, from game-icons.net) in place of a d20's 20 and 1. */
  symbols?: { high?: string; low?: string };
}

export interface DicePattern {
  kind: "marble" | "swirl" | "nebula" | "speckle";
  /** Two or three: the base first, then the colours running through it. */
  colours: string[];
  /** Bigger is finer. About 1. */
  scale?: number;
}

export type InclusionKind = "leaf" | "flower" | "star" | "flake" | "bubble";

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

/** One die's look and sound, as thrown. */
export interface DieLookAndVoice {
  look: DiceLook;
  voice: DiceVoice;
}

/** The theme's dice, and resin: a short knock with a low, soft ring. */
export const RESIN_VOICE: DiceVoice = {
  pitch: 1,
  ring: 0.15,
  ringPitch: 0.75,
  ringFor: 0.05,
  knockFor: 0.07,
};
