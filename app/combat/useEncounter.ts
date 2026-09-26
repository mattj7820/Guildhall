import { useCallback, useRef, useState } from "react";
import { defaultRng, type Rng } from "~/dice/rng";
import { createEncounter, perform, type EncounterAction } from "./encounter";
import { record, startHistory, undo, type History } from "./history";
import { saveEncounter } from "./storage";
import type { Encounter } from "./types";

/**
 * The live encounter for the tracker page: every change goes through the reducer, can be undone,
 * and is saved straight away. Nothing is saved until the DM changes something, so an unreadable
 * saved encounter isn't overwritten just by opening the page.
 */
export function useEncounter(
  initial: Encounter,
  storage: Pick<Storage, "setItem"> | undefined,
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
      setSaveFailed(!storage || !saveEncounter(storage, next.present));
    },
    [storage],
  );

  const dispatch = useCallback(
    (action: EncounterAction) =>
      commit(record(latest.current, perform(latest.current.present, action, rng))),
    [commit, rng],
  );

  return {
    encounter: history.present,
    dispatch,
    rng,
    canUndo: history.past.length > 0,
    undo: useCallback(() => commit(undo(latest.current)), [commit]),
    /** Starts over. Undo brings the old encounter back. */
    startNew: useCallback(() => commit(record(latest.current, createEncounter())), [commit]),
    saveFailed,
  };
}
