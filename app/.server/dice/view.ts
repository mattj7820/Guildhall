import type { CollectionView, DiceCollection, OwnedDie, OwnedDieView } from "~/dice/collection";
import { DIE_TYPES, RARITIES } from "~/dice/styles";
import type { Member } from "~/members/types";
import { favouriteFor } from "./bag";
import { DICE_STYLES, diceStyle } from "./catalogue";
import { usableDice } from "./collections";

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

/**
 * Someone's collection page: their dice (the DM has every one), each type's favourite as rolled
 * now, and the packs they have to open. Nothing about dice they haven't found.
 */
export function collectionView(
  collection: DiceCollection,
  member: Member,
  isDm: boolean,
): CollectionView {
  const usable = usableDice(collection, member.dice?.given, isDm);
  const favourites: CollectionView["favourites"] = {};
  for (const sides of DIE_TYPES) {
    const favourite = favouriteFor(sides, usable, collection.favourites, member.dice?.set);
    if (favourite) favourites[sides] = favourite;
  }
  return {
    isDm,
    owned: ownedView(usable),
    favourites,
    packs: isDm ? [] : collection.packs,
  };
}
