import { useCallback, useRef, useState } from "react";
import { defaultRng, type Rng } from "~/dice/rng";
import { createEncounter, perform, type EncounterAction } from "./encounter";
import { record, startHistory, undo, type History } from "~/shared/history";
import type { Encounter } from "./types";

/**
 * An encounter being edited: every change goes through the reducer and can be undone. `save`
 * runs after each change (returning false if it couldn't save). Nothing is saved until something
 * changes, so an unreadable saved encounter isn't overwritten just by opening the page.
 */
export function useEncounter(
  initial: Encounter,
  save?: (encounter: Encounter) => boolean,
  rng: Rng = defaultRng,
) {
  const [history, setHistory] = useState(() => startHistory(initial));
  const [saveFailed, setSaveFailed] = useState(false);
  // Read the latest history here, not in a state updater: updaters may run twice, rolling twice.
  const latest = useRef(history);

  const commit = useCallback(
    (next: History<Encounter>) => {
      if (next === latest.current) return;
      latest.current = next;
      setHistory(next);
      if (save) setSaveFailed(!save(next.present));
    },
    [save],
  );

  const dispatch = useCallback(
    (action: EncounterAction) =>
      commit(record(latest.current, perform(latest.current.present, action, rng))),
    [commit, rng],
  );

  /** Swaps in a whole encounter (a new one, or a prepared one starting). Undo brings the old back. */
  const replace = useCallback(
    (encounter: Encounter) => commit(record(latest.current, encounter)),
    [commit],
  );

  return {
    encounter: history.present,
    dispatch,
    rng,
    canUndo: history.past.length > 0,
    undo: useCallback(() => commit(undo(latest.current)), [commit]),
    replace,
    startNew: useCallback(() => replace(createEncounter()), [replace]),
    saveFailed,
  };
}
