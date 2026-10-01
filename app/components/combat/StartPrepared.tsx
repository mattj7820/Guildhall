import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { summarise, type PartyChoice } from "~/combat/prepared";
import type { PartyMember, PreparedEncounter } from "~/combat/types";
import { buttonClass, primaryButtonClass } from "~/components/styles";

/**
 * Starting a prepared encounter: pick who's playing (everyone, unless someone's absent), then its
 * monsters roll initiative and the fight lands in the tracker for the players' rolls.
 */
export function StartPrepared({
  prepared,
  party,
  replacesFight,
  onStart,
  cancelTo = "/combat",
}: {
  prepared: PreparedEncounter;
  party: PartyMember[];
  /** Whether a fight is already in the tracker; starting replaces it (undo brings it back). */
  replacesFight: boolean;
  onStart: (chosen: PartyChoice[]) => void;
  /** Where Cancel goes: the page it's on, without starting anything. */
  cancelTo?: string;
}) {
  const playable = party.filter((member): member is PartyChoice => Boolean(member.player));
  // A companion already in the prepared fight (added with its statblock) isn't added twice.
  const alreadyIn = new Set(
    prepared.encounter.combatants.flatMap((c) =>
      c.kind === "player" && c.statblock ? [c.statblock.entityId] : [],
    ),
  );
  const [chosen, setChosen] = useState(
    () =>
      new Set(
        playable
          .filter((member) => member.kind === "pc" || !alreadyIn.has(member.entityId))
          .map((member) => member.entityId),
      ),
  );
  const { monsters, companions } = summarise(prepared.encounter);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onStart(playable.filter((member) => chosen.has(member.entityId)));
  }

  function toggle(entityId: string) {
    setChosen((previous) => {
      const next = new Set(previous);
      if (!next.delete(entityId)) next.add(entityId);
      return next;
    });
  }

  return (
    <section
      aria-labelledby="start-heading"
      className="mb-4 rounded-lg border-2 border-amber-500 bg-amber-50 p-4 dark:bg-amber-950/40"
    >
      <h2 id="start-heading" className="font-serif text-2xl font-bold">
        Start “{prepared.name}”
      </h2>
      <p className="mt-1 text-sm">
        {monsters || "No monsters"}
        {companions && ` · ${companions}`}
      </p>
      <form onSubmit={submit} className="mt-3 flex flex-col gap-3">
        <fieldset>
          <legend className="text-sm font-semibold">Who's playing?</legend>
          {party.length === 0 && (
            <p className="text-sm text-stone-500">
              No player characters in the vault yet; add them to the tracker by hand.
            </p>
          )}
          <ul className="mt-1 flex flex-wrap gap-x-5 gap-y-1">
            {party.map((member) => (
              <li key={member.entityId}>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={chosen.has(member.entityId)}
                    disabled={!member.player}
                    onChange={() => toggle(member.entityId)}
                  />
                  {member.name}
                  <span className="text-stone-500">
                    {member.player ? `(${member.player.name})` : "(needs player: in its note)"}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
        <p className="text-sm text-stone-600 dark:text-stone-400">
          Monsters roll initiative now; you'll type in the players' rolls.
          {replacesFight && " This replaces the fight in the tracker; Undo brings it back."}
        </p>
        <div className="flex gap-2">
          <button type="submit" className={primaryButtonClass}>
            Add to tracker
          </button>
          <Link to={cancelTo} replace className={buttonClass}>
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}
