import { emptyPurse } from "./inventory-changes";
import { blankSheet } from "./schema";
import type {
  Attack,
  Companion,
  Counter,
  Feature,
  InventoryItem,
  PlayerCharacter,
  Sheet,
  Spell,
} from "./types";

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

/** A feature with no uses unless given some; tests state only the fields they depend on. */
export function aFeature(fields: Partial<Feature> = {}): Feature {
  count += 1;
  return {
    id: `feature-${count}`,
    name: "Fixture feature",
    source: "class",
    activation: "bonus",
    ...fields,
  };
}

/** A 1st-level spell with nothing to roll, unless told otherwise. */
export function aSpell(fields: Partial<Spell> = {}): Spell {
  count += 1;
  return {
    id: `spell-${count}`,
    name: "Fixture Spark",
    level: 1,
    castingTime: "1 action",
    range: "60 ft.",
    components: "V, S",
    duration: "Instant",
    concentration: false,
    ritual: false,
    attack: false,
    ...fields,
  };
}

export function anAttack(fields: Partial<Attack> = {}): Attack {
  count += 1;
  return { id: `attack-${count}`, name: "Fixture blade", bonus: 5, damage: "1d8+3", ...fields };
}

/** Nine levels of empty spell slots, with the given levels filled in. */
export function withSlots(levels: Partial<Record<number, Counter>>): Counter[] {
  return Array.from({ length: 9 }, (_, index) => levels[index + 1] ?? { max: 0, used: 0 });
}
