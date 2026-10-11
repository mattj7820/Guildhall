import { useId, type FormEvent } from "react";
import { playerFromName, type Player } from "~/campaign/types";
import type { EncounterAction } from "~/combat/encounter";
import { newId } from "~/shared/ids";
import {
  isWholeParty,
  type CombatCatalogue,
  type CreatureOption,
  type Encounter,
} from "~/combat/types";
import type { Rng } from "~/dice/rng";
import { tagOf } from "~/combat/find-creatures";
import { MonsterPicker } from "./MonsterPicker";
import { buttonClass, inputClass, labelClass, panelClass } from "~/components/styles";

type Dispatch = (action: EncounterAction) => void;

/**
 * Adding monsters (the vault's statblocks and the SRD's), the party, and companions. When preparing an encounter the
 * party is left out (it's chosen when the fight starts) and monsters don't roll initiative yet.
 * Collapsed once combat starts.
 */
export function AddCombatants({
  catalogue,
  encounter,
  dispatch,
  rng,
  mode = "live",
}: {
  catalogue: CombatCatalogue;
  encounter: Encounter;
  dispatch: Dispatch;
  rng: Rng;
  mode?: "live" | "prep";
}) {
  const players = knownPlayers(catalogue);
  const body = (
    <div className="flex flex-col gap-6">
      {/* The picker takes the panel's whole width: there's a lot to find. */}
      <MonsterPicker catalogue={catalogue} dispatch={dispatch} rng={rng} mode={mode} />
      <div className="grid gap-6 md:grid-cols-2">
        {mode === "live" && (
          <AddParty catalogue={catalogue} encounter={encounter} dispatch={dispatch} />
        )}
        <AddPlayerCombatant creatures={catalogue.creatures} players={players} dispatch={dispatch} />
      </div>
    </div>
  );

  return encounter.phase === "setup" ? (
    <section aria-labelledby="add-heading" className={panelClass}>
      <h2 id="add-heading" className="mb-3 font-serif text-xl font-bold">
        Add combatants
      </h2>
      {body}
    </section>
  ) : (
    <details className={panelClass}>
      <summary className="cursor-pointer font-serif text-xl font-bold">Add combatants</summary>
      <div className="mt-3">{body}</div>
    </details>
  );
}

function AddParty({
  catalogue,
  encounter,
  dispatch,
}: {
  catalogue: CombatCatalogue;
  encounter: Encounter;
  dispatch: Dispatch;
}) {
  const inEncounter = new Set(
    encounter.combatants.flatMap((c) => (c.kind === "player" && c.entityId ? [c.entityId] : [])),
  );
  const available = catalogue.party.filter((member) => !inEncounter.has(member.entityId));

  return (
    <div className="flex flex-col gap-2">
      <h3 className={labelClass}>Party</h3>
      {catalogue.party.length === 0 ? (
        <p className="text-sm text-muted">
          No player characters found. Give PC notes <code>type: pc</code> and{" "}
          <code>player: Name</code> in their frontmatter.
        </p>
      ) : available.length === 0 ? (
        <p className="text-sm text-muted">The whole party is in the encounter.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {available.map((member) => (
            <li key={member.entityId} className="flex items-center gap-2 text-sm">
              <button
                type="button"
                className={buttonClass}
                disabled={!member.player}
                onClick={() =>
                  member.player &&
                  dispatch({
                    type: "addPlayerCombatant",
                    id: newId(),
                    name: member.name,
                    controller: member.player,
                    entityId: member.entityId,
                    statblock: member.statblock,
                  })
                }
              >
                Add {member.name}
              </button>
              <span className="text-muted">
                {isWholeParty(member.player)
                  ? "the whole party's"
                  : member.player
                    ? member.player.name
                    : "needs player: in its frontmatter to say who controls it"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A companion (e.g. assigned to a player for this battle) or anyone else a player controls. */
function AddPlayerCombatant({
  creatures,
  players,
  dispatch,
}: {
  creatures: CreatureOption[];
  players: Player[];
  dispatch: Dispatch;
}) {
  const ids = useId();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const controller = playerFromName(String(form.get("controller") ?? ""));
    const creature = creatures.find((c) => c.key === form.get("statblock"));
    const name = String(form.get("name") ?? "").trim() || creature?.name;
    if (!controller || !name) return;
    dispatch({
      type: "addPlayerCombatant",
      id: newId(),
      name,
      controller,
      statblock: creature?.ref,
    });
    event.currentTarget.reset();
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-2"
      aria-label="Add a companion or other player combatant"
    >
      <h3 className={labelClass}>Companion or other</h3>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col text-sm font-medium">
          Name
          <input name="name" placeholder="From statblock" className={inputClass} />
        </label>
        <label className="flex flex-col text-sm font-medium">
          Controlled by
          <input
            name="controller"
            required
            list={`${ids}-players`}
            defaultValue={players.length === 1 ? players[0].name : undefined}
            className={inputClass}
          />
          <datalist id={`${ids}-players`}>
            {players.map((player) => (
              <option key={player.id} value={player.name} />
            ))}
          </datalist>
        </label>
      </div>
      <label className="flex flex-col text-sm font-medium">
        Linked statblock (optional)
        <select name="statblock" defaultValue="" className={inputClass}>
          <option value="">None</option>
          {creatures.map((creature) => (
            <option key={creature.key} value={creature.key}>
              {creature.name}
              {creature.ref.source ? ` (${tagOf(creature)})` : ""}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className={`${buttonClass} self-start`}>
        Add player combatant
      </button>
    </form>
  );
}

function knownPlayers(catalogue: CombatCatalogue): Player[] {
  const players = new Map<string, Player>();
  for (const member of catalogue.party) {
    if (member.player && !isWholeParty(member.player) && !players.has(member.player.id)) {
      players.set(member.player.id, member.player);
    }
  }
  return [...players.values()];
}
