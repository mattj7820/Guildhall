import { useRouteLoaderData } from "react-router";
import type { DiceLook } from "~/dice/looks";
import type { loader as rootLoader } from "~/root";
import { setLook, themeLook } from "./looks";

export interface DicePreferences {
  /** Whether rolls are thrown as 3D dice. */
  enabled: boolean;
  /** The look of this person's dice, resolved where they're drawn. */
  look: (within: HTMLElement) => DiceLook;
}

/**
 * This person's dice, as they chose in Settings: on unless they turned them off, in the set they
 * picked or the theme's colours.
 */
export function useDicePreferences(): DicePreferences {
  const dice = useRouteLoaderData<typeof rootLoader>("root")?.dice;
  return { enabled: dice?.on ?? true, look: dice?.set ? setLook(dice.set) : themeLook };
}
