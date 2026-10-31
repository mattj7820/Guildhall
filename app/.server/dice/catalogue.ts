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
  // Packs' first dice. Plain resin for common ones; metals, glass and glows the rarer they are.
  {
    id: "slate",
    label: "Slate",
    description: "Grey resin, with white numbers.",
    rarity: "common",
    look: { body: "#4b5563", ink: "#f9fafb", metalness: 0.05, roughness: 0.6, opacity: 1 },
    voice: RESIN_VOICE,
  },
  {
    id: "forest",
    label: "Forest",
    description: "Dark green resin, with cream numbers.",
    rarity: "common",
    look: { body: "#1f4d2b", ink: "#f4efe6", metalness: 0.05, roughness: 0.5, opacity: 1 },
    voice: RESIN_VOICE,
  },
  {
    id: "ocean",
    label: "Ocean",
    description: "Deep blue resin, with white numbers.",
    rarity: "common",
    look: { body: "#123a6b", ink: "#ffffff", metalness: 0.05, roughness: 0.45, opacity: 1 },
    voice: RESIN_VOICE,
  },
  {
    id: "ochre",
    label: "Ochre",
    description: "Mustard yellow resin, with dark brown numbers.",
    rarity: "common",
    look: { body: "#c99a2e", ink: "#2b1d0e", metalness: 0.05, roughness: 0.55, opacity: 1 },
    voice: RESIN_VOICE,
  },
  {
    id: "plum",
    label: "Plum",
    description: "Purple resin, with cream numbers.",
    rarity: "common",
    look: { body: "#4a1f5c", ink: "#f4efe6", metalness: 0.05, roughness: 0.5, opacity: 1 },
    voice: RESIN_VOICE,
  },
  {
    id: "pearl",
    label: "Pearl",
    description: "Pearly white, with gold numbers.",
    rarity: "uncommon",
    look: { body: "#f1ece4", ink: "#a8812a", metalness: 0.35, roughness: 0.2, opacity: 1 },
    voice: { ...RESIN_VOICE, pitch: 1.15, ring: 0.18, ringPitch: 1.3, ringFor: 0.08 },
  },
  {
    id: "copper",
    label: "Copper",
    description: "Copper, with dark numbers. They clink like metal.",
    rarity: "uncommon",
    look: { body: "#b0643a", ink: "#1d120c", metalness: 0.8, roughness: 0.35, opacity: 1 },
    voice: { pitch: 1.1, ring: 0.35, ringPitch: 1.9, ringFor: 0.25, knockFor: 0.05 },
  },
  {
    id: "emerald",
    label: "Emerald",
    description: "See-through green, with white numbers. They chime like glass.",
    rarity: "rare",
    look: { body: "#2fbf71", ink: "#ffffff", metalness: 0, roughness: 0.05, opacity: 0.55 },
    voice: { pitch: 1.55, ring: 0.3, ringPitch: 1.5, ringFor: 0.18, knockFor: 0.04 },
  },
  {
    id: "smoke",
    label: "Smoke",
    description: "See-through grey, with white numbers. They chime like glass.",
    rarity: "rare",
    look: { body: "#3a3f47", ink: "#ffffff", metalness: 0.1, roughness: 0.1, opacity: 0.6 },
    voice: { pitch: 1.45, ring: 0.28, ringPitch: 1.45, ringFor: 0.16, knockFor: 0.04 },
  },
  {
    id: "silver",
    label: "Silver",
    description: "Silver, with black numbers. They ring like metal.",
    rarity: "veryRare",
    look: { body: "#c9ced6", ink: "#111827", metalness: 0.9, roughness: 0.2, opacity: 1 },
    voice: { pitch: 1.5, ring: 0.45, ringPitch: 2.3, ringFor: 0.45, knockFor: 0.04 },
  },
  {
    id: "molten",
    label: "Molten",
    description: "Black, with glowing orange numbers.",
    rarity: "legendary",
    look: {
      body: "#140d0a",
      ink: "#ffb347",
      metalness: 0.3,
      roughness: 0.4,
      opacity: 1,
      glow: "#ff6a00",
    },
    voice: { pitch: 0.85, ring: 0.3, ringPitch: 1.7, ringFor: 0.3, knockFor: 0.06 },
  },
  {
    id: "frost",
    label: "Frost",
    description: "See-through ice blue, with glowing white numbers. They chime like glass.",
    rarity: "legendary",
    look: {
      body: "#bfe6ff",
      ink: "#ffffff",
      metalness: 0.1,
      roughness: 0.05,
      opacity: 0.6,
      glow: "#7cc8ff",
    },
    voice: { pitch: 1.8, ring: 0.4, ringPitch: 1.6, ringFor: 0.4, knockFor: 0.03 },
  },
];

const BY_ID = new Map(DICE_STYLES.map((style) => [style.id, style]));

/** A style by its ID; undefined for one no longer in the app. */
export function diceStyle(id: string | undefined): DieStyle | undefined {
  return id === undefined ? undefined : BY_ID.get(id);
}
