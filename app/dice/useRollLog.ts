import { useCallback, useRef, useState } from "react";
import type { Rng } from "./rng";
import type { RollMode } from "./roll";
import { emptyRollLog, rollInto, type RollLog, type RollRequest } from "./roll-log";

/**
 * The dice roller's state, shared by everything that rolls on the page (typed rolls, statblock
 * clicks), so they all land in one history and respect the same advantage and Critical choices.
 */
export function useRollLog(rng: Rng) {
  const [log, setLog] = useState<RollLog>(emptyRollLog);
  const [error, setError] = useState<string>();
  // Read the latest log here, not in a state updater: updaters may run twice, rolling twice.
  const latest = useRef(log);

  const update = useCallback((next: RollLog) => {
    latest.current = next;
    setLog(next);
  }, []);

  return {
    log,
    error,
    /** Whether the latest roll's dice are still tumbling, its result not shown yet. */
    rolling: false,
    roll: useCallback(
      (request: RollRequest) => {
        const outcome = rollInto(latest.current, request, rng);
        setError(outcome.ok ? undefined : outcome.error);
        if (outcome.ok) update(outcome.log);
      },
      [rng, update],
    ),
    setMode: useCallback((mode: RollMode) => update({ ...latest.current, mode }), [update]),
    setCritical: useCallback(
      (critical: boolean) => update({ ...latest.current, critical }),
      [update],
    ),
  };
}

export type RollLogControls = ReturnType<typeof useRollLog>;
