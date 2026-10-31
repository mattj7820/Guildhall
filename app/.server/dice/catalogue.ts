import { RESIN_VOICE } from "~/dice/looks";
import type { DieStyle } from "~/dice/styles";

/**
 * Every dice style in the app: the app's looks, not the campaign's, so they're here rather than
 * in the vault. Server-only, so dice nobody has found yet never reach a browser. New styles go at
 * the end; an ID, once used, is never reused or renamed (it's in people's collections).
 */
export const DICE_STYLES: readonly DieStyle[] = [
  {
    id: "gilded",
    label: "Gilded",
    description: "Black, with gold numbers. They clink like metal.",
    rarity: "veryRare",
    look: { body: "#17161a", ink: "#e8c25a", metalness: 0.6, roughness: 0.3, opacity: 1 },
    // Metal: a clink that rings on, slightly out of tune with itself.
    voice: { pitch: 1.3, ring: 0.4, ringPitch: 2.1, ringFor: 0.35, knockFor: 0.05 },
  },
  {
    id: "glass",
    label: "Glass",
    description: "See-through blue, with white numbers. They chime like glass.",
    rarity: "rare",
    look: { body: "#8fd3ff", ink: "#ffffff", metalness: 0, roughness: 0.05, opacity: 0.55 },
    // Glass: bright, with a short clear ring.
    voice: { pitch: 1.6, ring: 0.3, ringPitch: 1.5, ringFor: 0.18, knockFor: 0.04 },
  },
  {
    id: "bone",
    label: "Bone",
    description: "Ivory, with dark brown numbers. They clack dully, like bone.",
    rarity: "uncommon",
    look: {
      body: "#e9dfc8",
      ink: "#3b2a1a",
      metalness: 0,
      roughness: 0.9,
      opacity: 1,
      font: "Georgia, serif",
    },
    // Bone: low and dull, no ring at all.
    voice: { pitch: 0.7, ring: 0, ringPitch: 1, ringFor: 0.01, knockFor: 0.05 },
  },
  {
    id: "blood",
    label: "Blood",
    description: "Dark red resin, with cream numbers.",
    rarity: "uncommon",
    look: { body: "#6e0b14", ink: "#f4efe6", metalness: 0.2, roughness: 0.25, opacity: 0.85 },
    voice: { ...RESIN_VOICE, pitch: 0.95, ring: 0.2, ringPitch: 0.8, ringFor: 0.06 },
  },
];

const BY_ID = new Map(DICE_STYLES.map((style) => [style.id, style]));

/** A style by its ID; undefined for one no longer in the app. */
export function diceStyle(id: string | undefined): DieStyle | undefined {
  return id === undefined ? undefined : BY_ID.get(id);
}

/** Someone's dice as stored: what the DM gave them and what they chose. */
export interface DiceChoices {
  given?: readonly string[];
  set?: string;
}

/**
 * The styles someone may use, in the usual order: the DM has them all, everyone else those given
 * to them. Styles no longer in the app are left out.
 */
export function setsFor(dice: DiceChoices | undefined, isDm: boolean): DieStyle[] {
  return DICE_STYLES.filter((style) => isDm || (dice?.given ?? []).includes(style.id));
}

/** The style someone's dice are in, or undefined for the theme's dice (also once it's taken back). */
export function chosenSet(dice: DiceChoices | undefined, isDm: boolean): DieStyle | undefined {
  return setsFor(dice, isDm).find((style) => style.id === dice?.set);
}
