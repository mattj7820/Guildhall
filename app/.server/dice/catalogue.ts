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
  // Fancier dice: patterns, glitter, cores, things inside and symbols, for the rarer ones.
  {
    id: "marble",
    label: "Marble",
    description: "White marble with grey and brown veins, and gold numbers.",
    rarity: "rare",
    look: {
      body: "#f2efe9",
      ink: "#9c7424",
      metalness: 0.1,
      roughness: 0.25,
      opacity: 1,
      pattern: { kind: "marble", colours: ["#f4f1ec", "#cfc8bd", "#7d6b4f"] },
    },
    voice: { pitch: 0.9, ring: 0.1, ringPitch: 1.1, ringFor: 0.04, knockFor: 0.05 },
  },
  {
    id: "swirl",
    label: "Swirl",
    description: "Purple, teal and pink swirled together, with a little glitter.",
    rarity: "rare",
    look: {
      body: "#3b1a5a",
      ink: "#ffffff",
      metalness: 0.05,
      roughness: 0.2,
      opacity: 1,
      pattern: { kind: "swirl", colours: ["#3b1a5a", "#14a3a3", "#f472b6"] },
      glitter: { colour: "#ffffff", amount: 0.2 },
    },
    voice: RESIN_VOICE,
  },
  {
    id: "nebula",
    label: "Nebula",
    description: "Night blue with purple and teal clouds, and glitter like stars.",
    rarity: "veryRare",
    look: {
      body: "#070b1f",
      ink: "#e0f2ff",
      metalness: 0.1,
      roughness: 0.3,
      opacity: 1,
      pattern: { kind: "nebula", colours: ["#060a1c", "#5b2a86", "#2bb3c0"], scale: 1.2 },
      glitter: { colour: "#ffffff", amount: 0.4 },
    },
    voice: { ...RESIN_VOICE, ring: 0.2, ringPitch: 1.2, ringFor: 0.08 },
  },
  {
    id: "liquid-core",
    label: "Liquid core",
    description: "A smoky clear shell around a swirling teal core full of glitter.",
    rarity: "veryRare",
    look: {
      body: "#2a2f36",
      ink: "#ffffff",
      metalness: 0.1,
      roughness: 0.05,
      opacity: 0.35,
      core: { colours: ["#0e7490", "#22d3ee"], glitter: "#e0ffff" },
    },
    voice: { pitch: 1.3, ring: 0.25, ringPitch: 1.4, ringFor: 0.14, knockFor: 0.04 },
  },
  {
    id: "gold-leaf",
    label: "Gold leaf",
    description: "Smoky clear resin with scraps of gold leaf inside, and gold numbers.",
    rarity: "veryRare",
    look: {
      body: "#1b1b1b",
      ink: "#e8c25a",
      metalness: 0.1,
      roughness: 0.05,
      opacity: 0.35,
      inclusions: { kind: "flake", colours: ["#e8c25a", "#c9a227"], count: 16 },
    },
    voice: { pitch: 1.3, ring: 0.25, ringPitch: 1.4, ringFor: 0.14, knockFor: 0.04 },
  },
  {
    id: "meadow",
    label: "Meadow",
    description: "Clear resin with little flowers inside, and green numbers.",
    rarity: "legendary",
    look: {
      body: "#f5fff7",
      ink: "#14532d",
      metalness: 0,
      roughness: 0.05,
      opacity: 0.3,
      inclusions: { kind: "flower", colours: ["#f9a8d4", "#c4b5fd", "#ffffff"], count: 9 },
    },
    voice: { pitch: 1.4, ring: 0.25, ringPitch: 1.5, ringFor: 0.14, knockFor: 0.04 },
  },
  {
    id: "dragon",
    label: "Dragon",
    description:
      "Dark red marble with gold veins and glitter, glowing gold numbers, a dragon on the 20 and a skull on the 1.",
    rarity: "legendary",
    look: {
      body: "#3a0508",
      ink: "#f3d27a",
      metalness: 0.3,
      roughness: 0.3,
      opacity: 1,
      glow: "#ff9d2e",
      pattern: { kind: "marble", colours: ["#3a0508", "#6e0d12", "#d4a017"], scale: 1.3 },
      glitter: { colour: "#ffd36b", amount: 0.3 },
      symbols: { high: "dragon", low: "skull" },
    },
    voice: { pitch: 0.8, ring: 0.3, ringPitch: 1.8, ringFor: 0.25, knockFor: 0.06 },
  },
];

const BY_ID = new Map(DICE_STYLES.map((style) => [style.id, style]));

/** A style by its ID; undefined for one no longer in the app. */
export function diceStyle(id: string | undefined): DieStyle | undefined {
  return id === undefined ? undefined : BY_ID.get(id);
}
