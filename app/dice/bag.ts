import type { DieStyle, DieType } from "./styles";
import { thrownDice } from "./tray/thrown";

/**
 * The dice someone rolls with, as sent to their browser: for each type, the style of each die in
 * the order they're picked up (their favourite's first), and those styles. Only their own dice
 * are in it. Isomorphic.
 */
export interface DiceBag {
  styles: DieStyle[];
  byType: Partial<Record<DieType, string[]>>;
}

export const EMPTY_BAG: DiceBag = { styles: [], byType: {} };

/**
 * Each thrown die's style: the first d20 in a roll is the first d20 in the bag, the second the
 * second, and so on. Once they've run out of a type, the rest are the theme's dice (undefined).
 */
export function stylesForThrow(
  rolls: readonly { sides: number }[],
  bag: DiceBag,
): (DieStyle | undefined)[] {
  const taken = new Map<number, number>();
  return thrownDice(rolls).map(({ sides }) => {
    const nth = taken.get(sides) ?? 0;
    taken.set(sides, nth + 1);
    const id = bag.byType[sides as DieType]?.[nth];
    return bag.styles.find((style) => style.id === id);
  });
}
