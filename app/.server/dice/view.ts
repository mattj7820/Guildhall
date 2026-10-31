import type { OwnedDie, OwnedDieView } from "~/dice/collection";
import { DIE_TYPES, RARITIES } from "~/dice/styles";
import { DICE_STYLES, diceStyle } from "./catalogue";

/**
 * Dice someone owns, with their styles, by type (d4 to d20), rarest first, then in the
 * catalogue's order. Only these styles are sent: never one they haven't found.
 */
export function ownedView(owned: readonly OwnedDie[]): OwnedDieView[] {
  const order = (id: string) => DICE_STYLES.findIndex((style) => style.id === id);
  return owned
    .flatMap((die) => {
      const style = diceStyle(die.style);
      return style ? [{ style, sides: die.sides, count: die.count }] : [];
    })
    .sort(
      (a, b) =>
        DIE_TYPES.indexOf(a.sides) - DIE_TYPES.indexOf(b.sides) ||
        RARITIES.indexOf(b.style.rarity) - RARITIES.indexOf(a.style.rarity) ||
        order(a.style.id) - order(b.style.id),
    );
}
