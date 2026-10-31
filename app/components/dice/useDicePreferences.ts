import { useRouteLoaderData } from "react-router";
import { RESIN_VOICE, type DiceLook, type DiceVoice } from "~/dice/looks";
import type { loader as rootLoader } from "~/root";
import { styleLook, themeLook } from "./looks";

export interface DicePreferences {
  /** Whether rolls are thrown as 3D dice. */
  enabled: boolean;
  /** Whether the dice make a sound (the map's Effects menu can still mute it, and sets the volume). */
  sound: boolean;
  /** The look of this person's dice, resolved where they're drawn. */
  look: (within: HTMLElement) => DiceLook;
  /** How they sound: the set's own voice, or resin for the theme's dice. */
  voice: DiceVoice;
}

/**
 * This person's dice, as they chose in Settings: on unless they turned them off, in the set they
 * picked or the theme's colours.
 */
export function useDicePreferences(): DicePreferences {
  const dice = useRouteLoaderData<typeof rootLoader>("root")?.dice;
  return {
    enabled: dice?.on ?? true,
    sound: dice?.sound ?? true,
    look: dice?.style ? styleLook(dice.style) : themeLook,
    voice: dice?.style?.voice ?? RESIN_VOICE,
  };
}
