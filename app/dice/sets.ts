import type { DiceLook } from "./looks";

/**
 * Dice sets the DM can give: looks beyond the theme's own dice, defined here rather than in the
 * vault (they're the app's looks, not the campaign's). Isomorphic.
 */
export const DICE_SETS = ["gilded", "glass", "bone", "blood"] as const;
export type DiceSetId = (typeof DICE_SETS)[number];

export interface DiceSetInfo {
  label: string;
  description: string;
  /** Without a font, the numbers use the theme's display font. */
  look: Omit<DiceLook, "font"> & { font?: string };
}

export const DICE_SET_INFO: Record<DiceSetId, DiceSetInfo> = {
  gilded: {
    label: "Gilded",
    description: "Black, with gold numbers.",
    look: { body: "#17161a", ink: "#e8c25a", metalness: 0.6, roughness: 0.3, opacity: 1 },
  },
  glass: {
    label: "Glass",
    description: "See-through blue, with white numbers.",
    look: { body: "#8fd3ff", ink: "#ffffff", metalness: 0, roughness: 0.05, opacity: 0.55 },
  },
  bone: {
    label: "Bone",
    description: "Ivory, with dark brown numbers.",
    look: {
      body: "#e9dfc8",
      ink: "#3b2a1a",
      metalness: 0,
      roughness: 0.9,
      opacity: 1,
      font: "Georgia, serif",
    },
  },
  blood: {
    label: "Blood",
    description: "Dark red resin, with cream numbers.",
    look: { body: "#6e0b14", ink: "#f4efe6", metalness: 0.2, roughness: 0.25, opacity: 0.85 },
  },
};

export function isDiceSet(value: unknown): value is DiceSetId {
  return DICE_SETS.includes(value as DiceSetId);
}

/** Someone's dice as stored: what the DM gave them and what they chose. */
export interface DiceChoices {
  given?: readonly string[];
  set?: string;
}

/**
 * The sets someone may use, in the usual order: the DM has them all, everyone else those given
 * to them. Sets no longer in the app are left out.
 */
export function setsFor(dice: DiceChoices | undefined, isDm: boolean): DiceSetId[] {
  return DICE_SETS.filter((set) => isDm || (dice?.given ?? []).includes(set));
}

/** The set someone's dice are in, or undefined for the theme's dice (also once a set is taken back). */
export function chosenSet(dice: DiceChoices | undefined, isDm: boolean): DiceSetId | undefined {
  return setsFor(dice, isDm).find((set) => set === dice?.set);
}
