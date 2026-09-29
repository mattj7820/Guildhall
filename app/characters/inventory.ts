/**
 * The inventory's rules: moving, stacking, splitting and equipping items. Pure functions over the
 * ordered item list; the order is each item's place in the grid. A change that can't apply (an
 * item that's gone, a stack that would lose information) returns the list unchanged, the same
 * array, so callers can tell nothing happened.
 */
import type { InventoryItem, ItemId } from "./types";

export const QUANTITY_MAX = 9999;

/**
 * Whether `item` can be stacked onto `target` without losing anything: the same note (or none),
 * name, icon, description and source, and neither equipped or attuned.
 */
export function canStack(item: InventoryItem, target: InventoryItem): boolean {
  if (item.id === target.id) return false;
  if (item.equipped || target.equipped || item.attuned || target.attuned) return false;
  return (
    item.note === target.note &&
    sameText(item.name, target.name) &&
    item.icon.builtin === target.icon.builtin &&
    sameText(item.description, target.description) &&
    sameText(item.source?.text, target.source?.text) &&
    item.source?.note === target.source?.note
  );
}

/** Moves an item to `index` in the resulting list. */
export function moveItem(items: InventoryItem[], id: ItemId, index: number): InventoryItem[] {
  const from = items.findIndex((item) => item.id === id);
  const to = clamp(index, 0, items.length - 1);
  if (from < 0 || from === to) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Puts one stack onto another: the target keeps its place and gains the quantity. */
export function stackItem(items: InventoryItem[], id: ItemId, ontoId: ItemId): InventoryItem[] {
  const item = items.find((candidate) => candidate.id === id);
  const target = items.find((candidate) => candidate.id === ontoId);
  if (!item || !target || !canStack(item, target)) return items;
  const quantity = Math.min(QUANTITY_MAX, item.quantity + target.quantity);
  return items
    .filter((candidate) => candidate.id !== id)
    .map((candidate) => (candidate.id === ontoId ? { ...candidate, quantity } : candidate));
}

/**
 * Takes `amount` off a stack into a new one, placed at `index` (default: just after it). The new
 * stack is never equipped; everything else is copied.
 */
export function splitItem(
  items: InventoryItem[],
  id: ItemId,
  amount: number,
  newId: ItemId,
  index?: number,
): InventoryItem[] {
  const at = items.findIndex((item) => item.id === id);
  const item = items[at];
  if (!item || !Number.isInteger(amount) || amount < 1 || amount >= item.quantity) return items;
  const split: InventoryItem = {
    ...item,
    id: newId,
    quantity: amount,
    equipped: false,
    attuned: false,
    unseen: false,
  };
  const next = items.map((candidate) =>
    candidate.id === id ? { ...candidate, quantity: candidate.quantity - amount } : candidate,
  );
  next.splice(clamp(index ?? at + 1, 0, next.length), 0, split);
  return next;
}

/**
 * Adds an item, stacking it onto the first identical stack as games do when you pick something
 * up. Otherwise it goes at `index`, or the end.
 */
export function addItem(
  items: InventoryItem[],
  item: InventoryItem,
  index?: number,
): InventoryItem[] {
  const stack = items.find((candidate) => canStack(item, candidate));
  if (stack) return stackItem([...items, item], item.id, stack.id);
  const next = [...items];
  next.splice(clamp(index ?? items.length, 0, items.length), 0, item);
  return next;
}

export function removeItem(items: InventoryItem[], id: ItemId): InventoryItem[] {
  const next = items.filter((item) => item.id !== id);
  return next.length === items.length ? items : next;
}

/** Changes an item's own fields; the ID can't change. */
export function updateItem(
  items: InventoryItem[],
  id: ItemId,
  changes: Partial<Omit<InventoryItem, "id">>,
): InventoryItem[] {
  if (!items.some((item) => item.id === id)) return items;
  return items.map((item) => (item.id === id ? { ...item, ...changes } : item));
}

/** A whole number between 1 and QUANTITY_MAX. */
export function setQuantity(items: InventoryItem[], id: ItemId, quantity: number): InventoryItem[] {
  if (!Number.isFinite(quantity)) return items;
  return updateItem(items, id, { quantity: clamp(Math.round(quantity), 1, QUANTITY_MAX) });
}

/** Unequipping an item also ends attunement. */
export function setEquipped(
  items: InventoryItem[],
  id: ItemId,
  equipped: boolean,
): InventoryItem[] {
  return updateItem(items, id, equipped ? { equipped } : { equipped, attuned: false });
}

export type SortOrder = "name" | "equipped";

/** Rewrites the order once; items keep that order afterwards until moved. */
export function sortItems(items: InventoryItem[], order: SortOrder): InventoryItem[] {
  const byName = (a: InventoryItem, b: InventoryItem) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  const compare =
    order === "name"
      ? byName
      : (a: InventoryItem, b: InventoryItem) =>
          Number(b.equipped) - Number(a.equipped) || byName(a, b);
  return [...items].sort(compare);
}

function sameText(a: string | undefined, b: string | undefined): boolean {
  return normalise(a) === normalise(b);
}

function normalise(text: string | undefined): string {
  return (text ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
