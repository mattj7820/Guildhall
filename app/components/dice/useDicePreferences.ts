import { useRouteLoaderData } from "react-router";
import { EMPTY_BAG, stylesForThrow, type DiceBag } from "~/dice/bag";
import { RESIN_VOICE, type DieLookAndVoice } from "~/dice/looks";
import type { loader as rootLoader } from "~/root";
import { styleLook, themeLook } from "./looks";

export interface DicePreferences {
  /** Whether rolls are thrown as 3D dice. */
  enabled: boolean;
  /** Whether the dice make a sound (the map's Effects menu can still mute it, and sets the volume). */
  sound: boolean;
  /** The dice they roll with, from their collection. */
  bag: DiceBag;
}

/**
 * This person's dice, as they chose in Settings: on unless they turned them off, picked up from
 * their collection.
 */
export function useDicePreferences(): DicePreferences {
  const dice = useRouteLoaderData<typeof rootLoader>("root")?.dice;
  return {
    enabled: dice?.on ?? true,
    sound: dice?.sound ?? true,
    bag: dice?.bag ?? EMPTY_BAG,
  };
}

/**
 * How each thrown die looks and sounds, resolved where they're drawn: a die from their bag in its
 * style, and once they've run out of a type, the theme's dice, which sound like resin.
 */
export function throwStyles(
  rolls: readonly { sides: number }[],
  bag: DiceBag,
  within: HTMLElement,
): DieLookAndVoice[] {
  return stylesForThrow(rolls, bag).map((style) =>
    style
      ? { look: styleLook(style)(within), voice: style.voice }
      : { look: themeLook(within), voice: RESIN_VOICE },
  );
}
