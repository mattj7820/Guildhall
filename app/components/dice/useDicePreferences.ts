import type { DiceLook } from "~/dice/looks";
import { themeLook } from "./themeLook";

export interface DicePreferences {
  /** Whether rolls are thrown as 3D dice. */
  enabled: boolean;
  /** The look of this person's dice, resolved where they're drawn. */
  look: (within: HTMLElement) => DiceLook;
}

/** This person's dice: for now, everyone's are on and in the theme's colours. */
export function useDicePreferences(): DicePreferences {
  return { enabled: true, look: themeLook };
}
