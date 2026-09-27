import { startBlockers, type EncounterAction } from "~/combat/encounter";
import { awaitingReroll } from "~/combat/initiative";
import type { Encounter } from "~/combat/types";
import { buttonClass, panelClass, primaryButtonClass } from "~/components/styles";

/** Round and turn, stepping through turns, starting combat, undo and starting over. */
export function TurnBar({
  encounter,
  dispatch,
  canUndo,
  onUndo,
  onNew,
}: {
  encounter: Encounter;
  dispatch: (action: EncounterAction) => void;
  canUndo: boolean;
  onUndo: () => void;
  onNew: () => void;
}) {
  const active = encounter.combatants.find((c) => c.id === encounter.activeId);
  const blockers = startBlockers(encounter);
  const rerolling = new Set(awaitingReroll(encounter.combatants).map((c) => c.id));
  const missing = blockers.filter((c) => c.initiative === null);
  const waitingOnRerolls = blockers.filter((c) => rerolling.has(c.id));

  return (
    <section aria-label="Turn" className={`${panelClass} flex flex-wrap items-center gap-3`}>
      <div className="mr-auto" aria-live="polite">
        {encounter.phase === "active" ? (
          <p className="font-serif text-2xl font-bold">
            Round {encounter.round}
            {active && (
              <span className="text-amber-800 dark:text-amber-400"> · {active.name}'s turn</span>
            )}
          </p>
        ) : (
          <>
            <p className="font-serif text-2xl font-bold">Setting up</p>
            <p className="text-sm text-stone-500">
              {encounter.combatants.length === 0
                ? "Add combatants, then roll initiative."
                : missing.length > 0
                  ? `Waiting for initiative: ${missing.map((c) => c.name).join(", ")}`
                  : waitingOnRerolls.length > 0
                    ? `Waiting for tie rerolls: ${waitingOnRerolls.map((c) => c.name).join(", ")}`
                    : "Ready to start."}
            </p>
          </>
        )}
      </div>

      {encounter.phase === "active" ? (
        <>
          <button
            type="button"
            className={buttonClass}
            onClick={() => dispatch({ type: "previousTurn" })}
          >
            Previous turn
          </button>
          <button
            type="button"
            className={primaryButtonClass}
            onClick={() => dispatch({ type: "nextTurn" })}
          >
            Next turn
          </button>
        </>
      ) : (
        <button
          type="button"
          className={primaryButtonClass}
          disabled={encounter.combatants.length === 0 || blockers.length > 0}
          onClick={() => dispatch({ type: "start" })}
        >
          Start combat
        </button>
      )}
      <button type="button" className={buttonClass} disabled={!canUndo} onClick={onUndo}>
        Undo
      </button>
      <button
        type="button"
        className={buttonClass}
        disabled={encounter.combatants.length === 0 && encounter.phase === "setup"}
        onClick={onNew}
        title="Clears the tracker. Undo brings this encounter back."
      >
        New encounter
      </button>
    </section>
  );
}
