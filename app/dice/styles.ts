import type { DiceLook, DiceVoice } from "./looks";

/**
 * Dice styles: how a die can look and sound. The styles themselves are kept on the server
 * (`app/.server/dice/catalogue.ts`), so a browser only ever learns of the ones its viewer owns;
 * these are the shapes they're sent in. Isomorphic.
 */

/** The dice that are drawn, by their sides. */
export const DIE_TYPES = [4, 6, 8, 10, 12, 20] as const;
export type DieType = (typeof DIE_TYPES)[number];

export function isDieType(value: unknown): value is DieType {
  return DIE_TYPES.includes(value as DieType);
}

/** From most to least common, like magic items. */
export const RARITIES = ["common", "uncommon", "rare", "veryRare", "legendary"] as const;
export type Rarity = (typeof RARITIES)[number];

export interface RarityInfo {
  label: string;
  /** The chance a pack's die is this rare, out of 100. */
  odds: number;
  /** Its colour on badges and in a pack's glow, the same in every theme, as on magic items. */
  colour: string;
}

export const RARITY_INFO: Record<Rarity, RarityInfo> = {
  common: { label: "Common", odds: 50, colour: "#9ca3af" },
  uncommon: { label: "Uncommon", odds: 30, colour: "#22c55e" },
  rare: { label: "Rare", odds: 13, colour: "#3b82f6" },
  veryRare: { label: "Very rare", odds: 5, colour: "#a855f7" },
  legendary: { label: "Legendary", odds: 2, colour: "#f59e0b" },
};

/** A style as sent to its owner's browser. Without a font, the numbers use the theme's. */
export interface DieStyle {
  id: string;
  label: string;
  description: string;
  rarity: Rarity;
  look: Omit<DiceLook, "font"> & { font?: string };
  voice: DiceVoice;
}
