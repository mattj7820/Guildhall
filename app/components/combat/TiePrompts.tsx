import type { FormEvent } from "react";
import type { EncounterAction } from "~/combat/encounter";
import { pendingTies } from "~/combat/initiative";
import type { Combatant } from "~/combat/types";
import { buttonClass, inputClass } from "./styles";

/**
 * Ties still to be broken. Monsters reroll by themselves; for a player combatant the DM types in
 * the d20 the player rolled.
 */
export function TiePrompts({
  combatants,
  dispatch,
}: {
  combatants: Combatant[];
  dispatch: (action: EncounterAction) => void;
}) {
  const ties = pendingTies(combatants);
  if (ties.length === 0) return null;

  return (
    <section
      aria-label="Ties to break"
      className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40"
    >
      <h2 className="font-semibold">Initiative ties: each tied combatant rerolls a d20</h2>
      <ul className="mt-2 flex flex-col gap-3">
        {ties.map((tie) => (
          <li key={tie.members.map((m) => m.id).join()}>
            <p className="text-sm">
              Tied on {tie.initiative}:{" "}
              {tie.members
                .map((m) =>
                  m.tiebreaks.length ? `${m.name} (rerolled ${m.tiebreaks.join(", ")})` : m.name,
                )
                .join(", ")}
            </p>
            <div className="mt-1 flex flex-wrap gap-3">
              {tie.waitingFor.map((combatant) =>
                combatant.kind === "player" ? (
                  <RerollForm key={combatant.id} combatant={combatant} dispatch={dispatch} />
                ) : (
                  <p key={combatant.id} className="text-sm text-stone-600">
                    {combatant.name} kept tying. Order them by hand with the arrows.
                  </p>
                ),
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RerollForm({
  combatant,
  dispatch,
}: {
  combatant: Combatant;
  dispatch: (action: EncounterAction) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const roll = Number(new FormData(event.currentTarget).get("roll"));
    if (!Number.isInteger(roll) || roll < 1 || roll > 20) return;
    dispatch({ type: "recordTiebreaks", rolls: [{ id: combatant.id, roll }] });
    event.currentTarget.reset();
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <label className="text-sm font-medium" htmlFor={`reroll-${combatant.id}`}>
        Reroll for {combatant.name}
      </label>
      <input
        id={`reroll-${combatant.id}`}
        name="roll"
        type="number"
        min={1}
        max={20}
        required
        className={`${inputClass} w-16`}
      />
      <button type="submit" className={buttonClass}>
        Save reroll
      </button>
    </form>
  );
}
