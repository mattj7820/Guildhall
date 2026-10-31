import type { DiceBag } from "~/dice/bag";
import { EMPTY_COLLECTION, type DiceCollection, type OwnedDie } from "~/dice/collection";
import { DIE_TYPES, RARITIES, type DieStyle, type DieType } from "~/dice/styles";
import { MOST_DICE_THROWN } from "~/dice/tray/thrown";
import type { Member } from "~/members/types";
import { DataFileError } from "../data/json-store";
import { DICE_STYLES } from "./catalogue";
import { usableDice, type DiceCollections } from "./collections";

/**
 * The dice someone picks up to roll, by type: their favourite style's first, then their other
 * dice of that type, rarest first, as many as a roll ever throws. Without a favourite for a type,
 * the set they picked before packs (`dice.set`) is it, if they have it. Only styles in `usable`
 * are sent.
 */
export function diceBag(
  usable: readonly OwnedDie[],
  favourites: DiceCollection["favourites"],
  oldSet?: string,
): DiceBag {
  const order = (style: string) => DICE_STYLES.findIndex((each) => each.id === style);
  const rarity = (style: string) => RARITIES.indexOf(DICE_STYLES[order(style)].rarity);
  const byType: DiceBag["byType"] = {};
  for (const sides of DIE_TYPES) {
    const ofType = usable.filter((die) => die.sides === sides && order(die.style) >= 0);
    if (ofType.length === 0) continue;
    const favourite = favouriteFor(sides, ofType, favourites, oldSet);
    const sorted = [...ofType].sort(
      (a, b) =>
        Number(b.style === favourite) - Number(a.style === favourite) ||
        rarity(b.style) - rarity(a.style) ||
        order(a.style) - order(b.style),
    );
    byType[sides] = sorted
      .flatMap((die) => Array.from({ length: die.count }, () => die.style))
      .slice(0, MOST_DICE_THROWN);
  }
  const used = new Set(Object.values(byType).flat());
  const styles: DieStyle[] = DICE_STYLES.filter((style) => used.has(style.id));
  return { styles, byType };
}

/** The style a type is rolled in first, if they have any of it. */
export function favouriteFor(
  sides: DieType,
  ofType: readonly OwnedDie[],
  favourites: DiceCollection["favourites"],
  oldSet?: string,
): string | undefined {
  const has = (style: string | undefined) =>
    ofType.some((die) => die.sides === sides && die.style === style);
  const chosen = favourites.find((each) => each.sides === sides)?.style;
  if (has(chosen)) return chosen;
  return has(oldSet) ? oldSet : undefined;
}

/**
 * Someone's dice to roll with. If `dice.json` can't be read, they roll what they had before packs
 * (or the theme's dice) rather than the page failing.
 */
export async function bagFor(
  collections: DiceCollections,
  member: Member,
  isDm: boolean,
): Promise<DiceBag> {
  let collection = EMPTY_COLLECTION;
  try {
    collection = await collections.get(member.discordId);
  } catch (error) {
    if (!(error instanceof DataFileError)) throw error;
  }
  const usable = usableDice(collection, member.dice?.given, isDm);
  return diceBag(usable, collection.favourites, member.dice?.set);
}
