import type { UniqueIdentifier } from "@dnd-kit/core";

/**
 * What the bag's drag and drop targets are called: tiles by their item's ID, and these. Shared by
 * the board, which decides what a drop does, and the zones that take drops.
 */
export const EQUIP_ZONE = "zone:equip";
export const REMOVE_ZONE = "zone:remove";
const ZONES = new Set<UniqueIdentifier>([EQUIP_ZONE, REMOVE_ZONE]);
/** Drop targets for giving an item to someone: `give:<their ID>`. */
export const GIVE_PREFIX = "give:";
/** An equipped slot's copy of an item, which can be dragged back into the bag to unequip it. */
export const SLOT_PREFIX = "equipped:";

export const isZone = (id: UniqueIdentifier) => ZONES.has(id) || String(id).startsWith(GIVE_PREFIX);
export const itemIdOf = (id: UniqueIdentifier) => String(id).replace(SLOT_PREFIX, "");
