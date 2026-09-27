/** Undo history: the states before recent changes, and those undone. Kept in memory only. */
export interface History<T> {
  past: T[];
  present: T;
  /** States undone, most recently undone last, for redo. */
  future: T[];
  /** What the latest change was, so a run of changes to the same thing can merge into one step. */
  lastKey?: string;
}

export const HISTORY_LIMIT = 50;

export function startHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

/**
 * Moves to `next`, remembering the current state and forgetting anything undone. A change that
 * changes nothing isn't recorded. Consecutive changes with the same `mergeKey` (such as typing
 * into one field, or nudging one point with the arrow keys) count as a single step to undo.
 */
export function record<T>(history: History<T>, next: T, mergeKey?: string): History<T> {
  if (next === history.present) return history;
  if (mergeKey !== undefined && mergeKey === history.lastKey) {
    return { ...history, present: next, future: [] };
  }
  return {
    past: [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: next,
    future: [],
    lastKey: mergeKey,
  };
}

export function undo<T>(history: History<T>): History<T> {
  const previous = history.past.at(-1);
  if (previous === undefined) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [...history.future, history.present],
  };
}

export function redo<T>(history: History<T>): History<T> {
  const next = history.future.at(-1);
  if (next === undefined) return history;
  return {
    past: [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: next,
    future: history.future.slice(0, -1),
  };
}
