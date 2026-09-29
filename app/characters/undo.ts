/**
 * Undo, as actions. Undoing sends actions that put back what one action changed, rather than
 * restoring an old copy of the whole character, which would also wipe out whatever the DM or
 * another tab changed in the meantime.
 */
import { applyAction, type CharacterAction } from "./actions";
import { applyInventoryChange, type InventoryChange } from "./inventory-changes";
import { COINS, type Character, type HitPoints, type Inventory } from "./types";

/**
 * Actions that undo `action`, worked out from the character just before it was applied. Empty if
 * it changed nothing.
 */
export function inverseOf(before: Character, action: CharacterAction): CharacterAction[] {
  const { character: after, outcome } = applyAction(before, action);
  if (outcome !== "changed") return [];

  if (action.type === "inventory") {
    return revertInventory(before.inventory, after.inventory).map((change) => ({
      type: "inventory",
      change,
    }));
  }
  if (action.type === "hp" || action.type === "damage" || action.type === "heal") {
    return revertHp(hpOf(before), hpOf(after));
  }
  if (before.kind !== "pc") return [];

  const sheet = before.sheet;
  switch (action.type) {
    case "text":
      return [{ ...action, value: sheet[action.field], from: action.value }];
    case "number":
      return [{ ...action, value: sheet[action.field], from: action.value }];
    case "ability":
      return [{ ...action, value: sheet.abilities[action.ability], from: action.value }];
    case "save":
      return [{ ...action, value: sheet.saves[action.ability], from: action.value }];
    case "skill":
      return [{ ...action, value: sheet.skills[action.skill], from: action.value }];
    case "override":
      return [{ ...action, value: sheet.overrides[action.key], from: action.value }];
    case "inspiration":
      return [{ ...action, value: sheet.heroicInspiration, from: action.value }];
    case "portrait":
      return [{ ...action, value: sheet.portrait, from: action.value }];
  }
}

/** The maximum first, so putting back a higher current value isn't capped by a lower one. */
function revertHp(before: HitPoints, after: HitPoints): CharacterAction[] {
  return (["max", "current", "temp"] as const)
    .filter((field) => before[field] !== after[field])
    .map((field) => ({ type: "hp", field, value: before[field], from: after[field] }));
}

function hpOf(character: Character): HitPoints {
  return character.kind === "pc" ? character.sheet.hp : character.hp;
}

/**
 * Changes that turn the `after` bag back into the `before` one: take out what was added, put back
 * what was removed or changed (exactly, without stacking), restore coins, then the order.
 */
export function revertInventory(before: Inventory, after: Inventory): InventoryChange[] {
  const changes: InventoryChange[] = [];
  const beforeIds = new Set(before.items.map((item) => item.id));
  const afterById = new Map(after.items.map((item) => [item.id, item]));

  for (const item of after.items) {
    if (!beforeIds.has(item.id)) changes.push({ type: "remove", id: item.id });
  }
  before.items.forEach((item, index) => {
    const now = afterById.get(item.id);
    if (!now || JSON.stringify(now) !== JSON.stringify(item)) {
      changes.push({ type: "restore", item, index });
    }
  });
  for (const coin of COINS) {
    if (before.purse[coin] !== after.purse[coin]) {
      changes.push({ type: "purse", coin, amount: before.purse[coin] });
    }
  }

  let current = changes.reduce(applyInventoryChange, after);
  before.items.forEach((item, index) => {
    if (current.items[index]?.id !== item.id) {
      const move: InventoryChange = { type: "move", id: item.id, index };
      changes.push(move);
      current = applyInventoryChange(current, move);
    }
  });
  return changes;
}

/** What Undo and Redo will send: the inverses of recent changes, newest last. */
export interface UndoStack {
  undo: CharacterAction[][];
  redo: CharacterAction[][];
}

export const UNDO_LIMIT = 50;

export const emptyUndo: UndoStack = { undo: [], redo: [] };

/** Remembers how to undo an action just made; a new change forgets anything undone. */
export function remember(stack: UndoStack, inverse: CharacterAction[]): UndoStack {
  if (inverse.length === 0) return stack;
  return { undo: [...stack.undo, inverse].slice(-UNDO_LIMIT), redo: [] };
}

/**
 * Takes the latest undo (or redo) step, and records how to reverse it, worked out from the
 * character as it is now.
 */
export function takeStep(
  stack: UndoStack,
  direction: "undo" | "redo",
  now: Character,
): { stack: UndoStack; actions: CharacterAction[] } | undefined {
  const from = direction === "undo" ? stack.undo : stack.redo;
  const actions = from.at(-1);
  if (!actions) return undefined;

  const reverse: CharacterAction[] = [];
  let current = now;
  for (const action of actions) {
    reverse.unshift(...inverseOf(current, action));
    current = applyAction(current, action).character;
  }
  const rest = from.slice(0, -1);
  const other = direction === "undo" ? stack.redo : stack.undo;
  const moved = reverse.length > 0 ? [...other, reverse] : other;
  return {
    stack: direction === "undo" ? { undo: rest, redo: moved } : { undo: moved, redo: rest },
    actions,
  };
}
