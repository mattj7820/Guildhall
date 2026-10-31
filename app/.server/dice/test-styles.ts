import type { DieStyle, Rarity } from "~/dice/styles";

/** A style for tests, so they don't change as the catalogue grows. */
export const testStyle = (id: string, rarity: Rarity): DieStyle => ({
  id,
  label: id,
  description: "Fixture: a style for tests",
  rarity,
  look: { body: "#000000", ink: "#ffffff", metalness: 0, roughness: 1, opacity: 1 },
  voice: { pitch: 1, ring: 0, ringPitch: 1, ringFor: 0, knockFor: 0.05 },
});
