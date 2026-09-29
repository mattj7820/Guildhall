import { emptyPurse } from "./inventory-changes";
import { blankSheet } from "./schema";
import type { Companion, InventoryItem, PlayerCharacter, Sheet } from "./types";

let count = 0;

/** An inventory item with sensible defaults; tests state only the fields they depend on. */
export function anItem(fields: Partial<InventoryItem> = {}): InventoryItem {
  count += 1;
  return {
    id: `item-${count}`,
    name: "Rope",
    icon: { builtin: "rope" },
    quantity: 1,
    equipped: false,
    attuned: false,
    ...fields,
  };
}

/** A blank sheet with the given changes. */
export function aSheet(fields: Partial<Sheet> = {}): Sheet {
  return { ...blankSheet(), ...fields };
}

/** A player character with a blank sheet and an empty bag, unless told otherwise. */
export function aCharacter(
  fields: Partial<Omit<PlayerCharacter, "kind">> & { items?: InventoryItem[] } = {},
): PlayerCharacter {
  const { items, ...rest } = fields;
  return {
    kind: "pc",
    id: "character-1",
    note: "Party/Fixture PC One",
    revision: 0,
    createdAt: "2026-09-29T10:00:00.000Z",
    updatedAt: "2026-09-29T10:00:00.000Z",
    sheet: aSheet(),
    inventory: { items: items ?? [], purse: { ...emptyPurse } },
    ...rest,
  };
}

/** A shared companion with 22 hit points and an empty bag, unless told otherwise. */
export function aCompanion(fields: Partial<Omit<Companion, "kind">> = {}): Companion {
  return {
    kind: "companion",
    id: "companion-1",
    note: "Bestiary/Fixture Companion",
    revision: 0,
    createdAt: "2026-09-29T10:00:00.000Z",
    updatedAt: "2026-09-29T10:00:00.000Z",
    hp: { current: 22, max: 22, temp: 0 },
    inventory: { items: [], purse: { ...emptyPurse } },
    ...fields,
  };
}
