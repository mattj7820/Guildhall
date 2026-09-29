/**
 * Every change to an inventory as a plain, serialisable object, applied by one pure function. New
 * IDs are chosen by whoever makes the change and carried in it, so applying it is repeatable.
 */
import {
  addItem,
  QUANTITY_MAX,
  moveItem,
  removeItem,
  setEquipped,
  setQuantity,
  sortItems,
  splitItem,
  stackItem,
  updateItem,
  type SortOrder,
} from "./inventory";
import type { Coin, Inventory, InventoryItem, ItemId, Purse } from "./types";

/** What inventory changes work on: a character's bag and coins. */
export type InventoryState = Inventory;

export type InventoryChange =
  | { type: "add"; item: InventoryItem; index?: number }
  | { type: "move"; id: ItemId; index: number }
  | { type: "stack"; id: ItemId; onto: ItemId }
  /** Takes `amount` into a new stack, placed at `index` or stacked `onto` another. */
  | { type: "split"; id: ItemId; amount: number; newId: ItemId; index?: number; onto?: ItemId }
  | { type: "remove"; id: ItemId }
  | { type: "quantity"; id: ItemId; quantity: number }
  | { type: "equip"; id: ItemId; equipped: boolean }
  | { type: "attune"; id: ItemId; attuned: boolean }
  | { type: "edit"; id: ItemId; changes: ItemEdits }
  | { type: "seen"; id: ItemId }
  | { type: "sort"; order: SortOrder }
  /** Puts an item back exactly as it was (for undo): replaced where it is, or inserted at `index`. */
  | { type: "restore"; item: InventoryItem; index: number }
  | { type: "purse"; coin: Coin; amount: number };

/** What the item details let someone edit directly. */
export type ItemEdits = Partial<Pick<InventoryItem, "name" | "icon" | "description" | "source">>;

export const PURSE_MAX = 999_999;

export const emptyPurse: Purse = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };

export function applyInventoryChange(
  state: InventoryState,
  change: InventoryChange,
): InventoryState {
  if (change.type === "purse") {
    const amount = Number.isFinite(change.amount)
      ? Math.max(0, Math.min(PURSE_MAX, Math.round(change.amount)))
      : state.purse[change.coin];
    if (amount === state.purse[change.coin]) return state;
    return { ...state, purse: { ...state.purse, [change.coin]: amount } };
  }
  const items = changeItems(state.items, change);
  return items === state.items ? state : { ...state, items };
}

function changeItems(items: InventoryItem[], change: InventoryChange): InventoryItem[] {
  switch (change.type) {
    case "add":
      return addItem(items, change.item, change.index);
    case "move":
      return moveItem(items, change.id, change.index);
    case "stack":
      return stackItem(items, change.id, change.onto);
    case "split": {
      const split = splitItem(items, change.id, change.amount, change.newId, change.index);
      return change.onto && split !== items ? stackItem(split, change.newId, change.onto) : split;
    }
    case "remove":
      return removeItem(items, change.id);
    case "quantity":
      return setQuantity(items, change.id, change.quantity);
    case "equip":
      return setEquipped(items, change.id, change.equipped);
    case "attune": {
      const item = items.find((candidate) => candidate.id === change.id);
      // Attuning to something means wearing or holding it, so it's equipped too.
      return item
        ? updateItem(items, change.id, {
            attuned: change.attuned,
            equipped: item.equipped || change.attuned,
          })
        : items;
    }
    case "edit":
      return updateItem(items, change.id, cleanEdits(change.changes));
    case "seen":
      return items.some((item) => item.id === change.id && item.unseen)
        ? updateItem(items, change.id, { unseen: false })
        : items;
    case "sort":
      return sortItems(items, change.order);
    case "restore": {
      const at = items.findIndex((item) => item.id === change.item.id);
      if (at >= 0) {
        return sameItem(items[at], change.item)
          ? items
          : items.map((item, index) => (index === at ? change.item : item));
      }
      const next = [...items];
      next.splice(Math.max(0, Math.min(change.index, items.length)), 0, change.item);
      return next;
    }
    case "purse":
      return items;
  }
}

export const NAME_MAX = 80;
export const DESCRIPTION_MAX = 300;
export const SOURCE_MAX = 120;

/** Trims text and drops what's left empty; a name can't be emptied. */
function cleanEdits(changes: ItemEdits): ItemEdits {
  const clean: ItemEdits = { ...changes };
  if (changes.name !== undefined) {
    const name = tidy(changes.name, NAME_MAX);
    if (name) clean.name = name;
    else delete clean.name;
  }
  if ("description" in changes) clean.description = tidy(changes.description, DESCRIPTION_MAX);
  if ("source" in changes) {
    const text = tidy(changes.source?.text, SOURCE_MAX);
    const note = changes.source?.note;
    clean.source =
      text || note ? { ...(text ? { text } : {}), ...(note ? { note } : {}) } : undefined;
  }
  return clean;
}

function sameItem(a: InventoryItem, b: InventoryItem): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function tidy(text: string | undefined, max: number): string | undefined {
  const trimmed = (text ?? "").trim().slice(0, max);
  return trimmed || undefined;
}

export interface Transfer {
  from: InventoryState;
  to: InventoryState;
}

/**
 * Hands some or all of a stack to someone else. It arrives as its own tile at the end of their
 * bag (never stacked, so they can see what's new), unequipped, marked new and with who gave it.
 * Undefined if the item has gone or the amount is wrong.
 */
export function giveItem(
  from: InventoryState,
  to: InventoryState,
  { id, amount, newId, givenBy }: { id: ItemId; amount: number; newId: ItemId; givenBy: string },
): Transfer | undefined {
  const item = from.items.find((candidate) => candidate.id === id);
  if (!item || !Number.isInteger(amount) || amount < 1 || amount > item.quantity) return undefined;
  const kept =
    amount === item.quantity
      ? removeItem(from.items, id)
      : setQuantity(from.items, id, item.quantity - amount);
  const received: InventoryItem = {
    ...item,
    id: newId,
    quantity: Math.min(amount, QUANTITY_MAX),
    equipped: false,
    attuned: false,
    unseen: true,
    givenBy,
  };
  return {
    from: { ...from, items: kept },
    to: { ...to, items: [...to.items, received] },
  };
}

const COIN_VALUE_IN_GOLD: Record<Coin, number> = { cp: 0.01, sp: 0.1, ep: 0.5, gp: 1, pp: 10 };

/** What the coins are worth altogether, in gold pieces, to the copper. */
export function purseInGold(purse: Purse): number {
  const copper = (Object.keys(COIN_VALUE_IN_GOLD) as Coin[]).reduce(
    (sum, coin) => sum + Math.round(purse[coin] * COIN_VALUE_IN_GOLD[coin] * 100),
    0,
  );
  return copper / 100;
}

/** A short past-tense line for the undo toast and screen readers, e.g. "Removed Rope ×3". */
export function describeChange(before: InventoryState, change: InventoryChange): string {
  if (change.type === "purse") return `Changed ${change.coin} to ${change.amount}`;
  if (change.type === "sort")
    return change.order === "name" ? "Sorted by name" : "Sorted equipped first";
  if (change.type === "add") return `Added ${label(change.item)}`;
  if (change.type === "restore") return `Put back ${change.item.name}`;
  const item = before.items.find((candidate) => candidate.id === change.id);
  const name = item?.name ?? "item";
  switch (change.type) {
    case "move":
      return `Moved ${name}`;
    case "stack": {
      const onto = before.items.find((candidate) => candidate.id === change.onto);
      return `Stacked ${name}${onto ? ` ×${onto.quantity + (item?.quantity ?? 0)}` : ""}`;
    }
    case "split":
      return `Split ${change.amount} ${name} off`;
    case "remove":
      return `Removed ${item ? label(item) : name}`;
    case "quantity":
      return `${name} ×${change.quantity}`;
    case "equip":
      return `${change.equipped ? "Equipped" : "Unequipped"} ${name}`;
    case "attune":
      return `${change.attuned ? "Attuned to" : "Ended attunement to"} ${name}`;
    case "edit":
      return `Changed ${name}`;
    case "seen":
      return `Looked at ${name}`;
  }
}

function label(item: InventoryItem): string {
  return item.quantity > 1 ? `${item.name} ×${item.quantity}` : item.name;
}
