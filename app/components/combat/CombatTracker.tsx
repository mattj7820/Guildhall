import { useMemo, useState } from "react";
import { Link, useFetcher, useNavigate } from "react-router";
import { startPrepared, type PartyChoice } from "~/combat/prepared";
import { createEncounter } from "~/combat/encounter";
import { browserStorage, saveEncounter, type LoadResult } from "~/combat/storage";
import {
  statblockKey,
  type CombatantId,
  type CombatCatalogue,
  type Encounter,
  type PreparedEncounter,
} from "~/combat/types";
import { useEncounter } from "~/combat/useEncounter";
import { AddCombatants } from "./AddCombatants";
import { CombatantRow } from "./CombatantRow";
import { CombatNav } from "./CombatNav";
import { SaveAsPrepared } from "./SaveAsPrepared";
import { StartPrepared } from "./StartPrepared";
import { DiceRoller } from "./DiceRoller";
import { StatblockPanel } from "./StatblockPanel";
import { panelClass } from "./styles";
import { TiePrompts } from "./TiePrompts";
import { TurnBar } from "./TurnBar";

export function CombatTracker({
  catalogue,
  saved,
  starting,
}: {
  catalogue: CombatCatalogue;
  saved: LoadResult;
  /** A prepared encounter to start (`?start=`); null if it no longer exists. */
  starting?: PreparedEncounter | null;
}) {
  const [initial] = useState(() =>
    saved.status === "restored" ? saved.encounter : createEncounter(),
  );
  const [save] = useState(() => {
    const storage = browserStorage();
    return (encounter: Encounter) => (storage ? saveEncounter(storage, encounter) : false);
  });
  const tracker = useEncounter(initial, save);
  const { encounter, dispatch } = tracker;

  const creatures = useMemo(
    () => new Map(catalogue.creatures.map((creature) => [creature.key, creature])),
    [catalogue.creatures],
  );

  // The statblock panel follows whoever's turn it is, until the DM picks someone else.
  const [picked, setPicked] = useState<{ id: CombatantId; during: CombatantId | null }>();
  const shownId = picked && picked.during === encounter.activeId ? picked.id : encounter.activeId;
  const shown = encounter.combatants.find((c) => c.id === shownId);

  const navigate = useNavigate();
  const markRun = useFetcher();
  function start(prepared: PreparedEncounter, party: PartyChoice[]) {
    tracker.replace(startPrepared(prepared, party, tracker.rng));
    void markRun.submit(
      { intent: "markRun" },
      { method: "post", action: `/combat/prepared/${prepared.id}`, encType: "application/json" },
    );
    void navigate("/combat", { replace: true });
  }

  const settingUp = encounter.phase === "setup";
  const addCombatants = (
    <AddCombatants
      catalogue={catalogue}
      encounter={encounter}
      dispatch={dispatch}
      rng={tracker.rng}
    />
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <CombatNav />
      <h1 className="sr-only">Combat tracker</h1>
      {starting && (
        <StartPrepared
          key={starting.id}
          prepared={starting}
          party={catalogue.party}
          replacesFight={encounter.combatants.length > 0}
          onStart={(party) => start(starting, party)}
        />
      )}
      {starting === null && (
        <p role="alert" className="mb-4 rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-900">
          That prepared encounter doesn't exist any more.{" "}
          <Link to="/combat/prepared" className="underline">
            See the prepared encounters
          </Link>
        </p>
      )}
      {saved.status === "unreadable" && (
        <p role="alert" className="mb-4 rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-900">
          Couldn't restore the saved encounter (it may be from an older version), so this is a new
          one. The old one is replaced as soon as you change anything.
        </p>
      )}
      {tracker.saveFailed && (
        <p role="alert" className="mb-4 rounded-md bg-rose-100 px-3 py-2 text-sm text-rose-900">
          This browser isn't saving the encounter, so reloading the page would lose it.
        </p>
      )}

      <TurnBar
        encounter={encounter}
        dispatch={dispatch}
        canUndo={tracker.canUndo}
        onUndo={tracker.undo}
        onNew={tracker.startNew}
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* Adding is the main job while setting up, so it comes first until combat starts. */}
          {settingUp && addCombatants}
          <TiePrompts combatants={encounter.combatants} dispatch={dispatch} />

          <section aria-labelledby="turn-order-heading" className={panelClass}>
            <h2 id="turn-order-heading" className="mb-2 font-serif text-xl font-bold">
              Turn order
            </h2>
            {encounter.combatants.length === 0 ? (
              <p className="text-sm text-stone-500">
                No one yet. Add monsters from the vault and the party.
              </p>
            ) : (
              <ol
                aria-label="Turn order"
                className="divide-y divide-stone-200 dark:divide-stone-800"
              >
                {encounter.combatants.map((combatant, index) => (
                  <CombatantRow
                    key={combatant.id}
                    combatant={combatant}
                    isActive={combatant.id === encounter.activeId}
                    isShown={combatant.id === shownId}
                    isFirst={index === 0}
                    isLast={index === encounter.combatants.length - 1}
                    dispatch={dispatch}
                    onShowStatblock={() =>
                      setPicked({ id: combatant.id, during: encounter.activeId })
                    }
                  />
                ))}
              </ol>
            )}
          </section>

          {!settingUp && addCombatants}
          {settingUp && encounter.combatants.length > 0 && <SaveAsPrepared encounter={encounter} />}
        </div>

        <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
          <StatblockPanel
            combatantName={shown?.name}
            creature={shown?.statblock ? creatures.get(statblockKey(shown.statblock)) : undefined}
            hasStatblock={Boolean(shown?.statblock)}
          />
          <DiceRoller rng={tracker.rng} />
        </div>
      </div>
    </main>
  );
}
