import type { InventoryItem } from "./types";

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
