/** Undo for the combat tracker: the states before recent changes. Kept in memory only. */
export interface History<T> {
  past: T[];
  present: T;
}

export const HISTORY_LIMIT = 50;

export function startHistory<T>(present: T): History<T> {
  return { past: [], present };
}

/** Moves to `next`, remembering the current state. A change that changes nothing isn't recorded. */
export function record<T>(history: History<T>, next: T): History<T> {
  if (next === history.present) return history;
  return { past: [...history.past, history.present].slice(-HISTORY_LIMIT), present: next };
}

export function undo<T>(history: History<T>): History<T> {
  const previous = history.past.at(-1);
  return previous === undefined ? history : { past: history.past.slice(0, -1), present: previous };
}
