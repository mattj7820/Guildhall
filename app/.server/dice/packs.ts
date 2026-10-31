import { countOf, MOST_OF_A_DIE, type OwnedDie } from "~/dice/collection";
import type { Rng } from "~/dice/rng";
import { DIE_TYPES, RARITIES, RARITY_INFO, type DieStyle, type DieType } from "~/dice/styles";

export interface DrawnDie {
  style: DieStyle;
  sides: DieType;
}

/**
 * The die in a pack: its rarity drawn by the odds, then a style of that rarity and a type, evenly.
 * Dice they already have the most worth having of are never drawn, so no pack is wasted; a
 * rarity with none left to give has its odds shared out among the rest. Undefined only once
 * they have everything.
 */
export function drawDie(
  rng: Rng,
  styles: readonly DieStyle[],
  owned: readonly OwnedDie[],
): DrawnDie | undefined {
  const left = (style: DieStyle) =>
    DIE_TYPES.filter((sides) => countOf(owned, style.id, sides) < MOST_OF_A_DIE[sides]).map(
      (sides) => ({ style, sides }),
    );
  const byRarity = RARITIES.map((rarity) => ({
    odds: RARITY_INFO[rarity].odds,
    dice: styles.filter((style) => style.rarity === rarity).flatMap(left),
  })).filter((rarity) => rarity.dice.length > 0);
  if (byRarity.length === 0) return undefined;

  let ticket = rng(byRarity.reduce((total, rarity) => total + rarity.odds, 0));
  const { dice } = byRarity.find((rarity) => (ticket -= rarity.odds) <= 0) ?? byRarity[0];
  return dice[rng(dice.length) - 1];
}
