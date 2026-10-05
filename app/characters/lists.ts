/**
 * Changes to a sheet's lists (spells, attacks, features) as plain objects, applied by one pure
 * function, like the bag's changes but without stacking. New IDs are chosen by whoever makes the
 * change and carried in it.
 *
 * An edit changes only the fields it names, so two people editing different fields of one spell
 * both keep their change. `null` clears an optional field.
 */

export interface Listed {
  id: string;
}

/** The fields an edit can set: any but the ID, with `null` clearing an optional one. */
export type Edits<T extends Listed> = {
  [K in Exclude<keyof T, "id">]?: undefined extends T[K] ? T[K] | null : T[K];
};

export type ListChange<T extends Listed, E = Edits<T>> =
  | { type: "add"; item: T; index?: number }
  | { type: "edit"; id: string; changes: E }
  | { type: "remove"; id: string }
  | { type: "move"; id: string; index: number }
  /** Puts an item back exactly as it was (for undo): replaced where it is, or inserted at `index`. */
  | { type: "restore"; item: T; index: number };

/** How an edit's changes go onto an item; plain fields are simply set. */
export type ApplyEdits<T extends Listed, E> = (item: T, changes: E) => T;

export function setFields<T extends Listed>(item: T, changes: Edits<T>): T {
  const next: Record<string, unknown> = { ...(item as object) };
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) continue;
    if (value === null) delete next[key];
    else next[key] = value;
  }
  return next as T;
}

/** The list with the change made; the same list if it changed nothing or doesn't apply. */
export function applyListChange<T extends Listed, E>(
  list: T[],
  change: ListChange<T, E>,
  applyEdits: ApplyEdits<T, E>,
): T[] {
  const at = (id: string) => list.findIndex((item) => item.id === id);
  switch (change.type) {
    case "add":
      // An ID already there means the add was already made.
      if (at(change.item.id) !== -1) return list;
      return insert(list, change.item, change.index ?? list.length);
    case "edit": {
      const index = at(change.id);
      if (index === -1) return list;
      const edited = applyEdits(list[index], change.changes);
      return same(edited, list[index]) ? list : replace(list, index, edited);
    }
    case "remove": {
      const index = at(change.id);
      return index === -1 ? list : without(list, index);
    }
    case "move": {
      const index = at(change.id);
      const to = clampIndex(change.index, list.length - 1);
      if (index === -1 || index === to) return list;
      return insert(without(list, index), list[index], to);
    }
    case "restore": {
      const index = at(change.item.id);
      if (index === -1) return insert(list, change.item, change.index);
      return same(list[index], change.item) ? list : replace(list, index, change.item);
    }
  }
}

/** Whether the change finds what it's about (an edit, move or removal of something gone doesn't). */
export function applies<T extends Listed, E>(list: T[], change: ListChange<T, E>) {
  if (change.type === "add" || change.type === "restore") return true;
  return list.some((item) => item.id === change.id);
}

/**
 * Changes that undo `change`, from the list just before it: an edit is undone by putting back only
 * the fields it changed, so others' edits to the rest stay.
 */
export function inverseListChange<T extends Listed>(
  before: T[],
  change: ListChange<T, Edits<T>>,
): ListChange<T, Edits<T>>[] {
  const index = (id: string) => before.findIndex((item) => item.id === id);
  switch (change.type) {
    case "add":
      return index(change.item.id) === -1 ? [{ type: "remove", id: change.item.id }] : [];
    case "remove": {
      const at = index(change.id);
      return at === -1 ? [] : [{ type: "restore", item: before[at], index: at }];
    }
    case "move": {
      const at = index(change.id);
      return at === -1 ? [] : [{ type: "move", id: change.id, index: at }];
    }
    case "restore": {
      const at = index(change.item.id);
      return at === -1
        ? [{ type: "remove", id: change.item.id }]
        : [{ type: "restore", item: before[at], index: at }];
    }
    case "edit": {
      const at = index(change.id);
      if (at === -1) return [];
      const item = before[at] as Record<string, unknown>;
      const changes: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(change.changes)) {
        if (value === undefined || same(item[key], value)) continue;
        changes[key] = item[key] === undefined ? null : item[key];
      }
      return Object.keys(changes).length === 0
        ? []
        : [{ type: "edit", id: change.id, changes: changes as Edits<T> }];
    }
  }
}

function insert<T>(list: T[], item: T, index: number): T[] {
  const at = clampIndex(index, list.length);
  return [...list.slice(0, at), item, ...list.slice(at)];
}

function without<T>(list: T[], index: number): T[] {
  return [...list.slice(0, index), ...list.slice(index + 1)];
}

function replace<T>(list: T[], index: number, item: T): T[] {
  return list.map((each, at) => (at === index ? item : each));
}

function clampIndex(index: number, max: number): number {
  return Math.max(0, Math.min(max, Math.trunc(index)));
}

/** Items are small plain data, so comparing their JSON is enough. */
function same(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}
