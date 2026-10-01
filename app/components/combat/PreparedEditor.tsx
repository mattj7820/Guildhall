import { useCallback, useEffect, useMemo, useState } from "react";
import { Form, Link, useFetcher } from "react-router";
import { rerollHp } from "~/combat/encounter";
import { PREPARED_NAME_MAX, PREPARED_NOTES_MAX } from "~/combat/schema";
import {
  statblockKey,
  type CombatantId,
  type CombatCatalogue,
  type PreparedEncounter,
} from "~/combat/types";
import { useEncounter } from "~/combat/useEncounter";
import type { action } from "~/routes/combat-prepared-edit";
import { AddCombatants } from "./AddCombatants";
import { CombatantRow } from "./CombatantRow";
import { CombatNav } from "./CombatNav";
import { StatblockPanel } from "./StatblockPanel";
import { buttonClass, inputClass, panelClass, primaryButtonClass } from "~/components/styles";

/** Wait this long after the last change before saving, so typing doesn't save every key. */
const AUTOSAVE_DELAY_MS = 500;

/**
 * Edits a prepared encounter. Every change is saved to the server automatically; the status
 * shows whether it has been. Leaving by the page's own links saves anything still pending first.
 */
export function PreparedEditor({
  prepared,
  catalogue,
  startUrl,
}: {
  prepared: PreparedEncounter;
  catalogue: CombatCatalogue;
  /** On its map, if it was set up on one. */
  startUrl: string;
}) {
  const [name, setName] = useState(prepared.name);
  const [notes, setNotes] = useState(prepared.notes);
  const editor = useEncounter(prepared.encounter);
  const { encounter, dispatch } = editor;

  const fetcher = useFetcher<typeof action>();
  const snapshot = JSON.stringify({ intent: "save", name, notes, encounter });
  const [submitted, setSubmitted] = useState(snapshot);
  const dirty = snapshot !== submitted;

  const { submit } = fetcher;
  const save = useCallback(() => {
    void submit(JSON.parse(snapshot), { method: "post", encType: "application/json" });
    setSubmitted(snapshot);
  }, [submit, snapshot]);
  const saveNow = () => {
    if (dirty) save();
  };

  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(save, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [dirty, save]);

  // Closing the tab mid-save is the one way to lose a change, so the browser asks first.
  useEffect(() => {
    if (!dirty && fetcher.state === "idle") return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, fetcher.state]);

  const error = fetcher.data && "error" in fetcher.data ? fetcher.data.error : undefined;
  const status = error
    ? undefined
    : dirty || fetcher.state !== "idle"
      ? "Saving…"
      : "All changes saved";

  const creatures = useMemo(
    () => new Map(catalogue.creatures.map((creature) => [creature.key, creature])),
    [catalogue.creatures],
  );
  const [pickedId, setPickedId] = useState<CombatantId>();
  const shown =
    encounter.combatants.find((c) => c.id === pickedId) ??
    encounter.combatants.find((c) => c.kind === "monster");

  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <CombatNav />
      <p className="mb-3 text-sm">
        <Link
          to="/combat/prepared"
          onClick={saveNow}
          className="text-amber-800 hover:underline dark:text-amber-400"
        >
          ← All prepared encounters
        </Link>
      </p>

      <section aria-label="Encounter details" className={`${panelClass} flex flex-wrap gap-4`}>
        <div className="flex min-w-72 flex-1 flex-col gap-2">
          <h1 className="sr-only">Edit prepared encounter</h1>
          <label className="flex flex-col text-sm font-medium">
            Encounter name
            <input
              value={name}
              maxLength={PREPARED_NAME_MAX}
              onChange={(event) => setName(event.target.value)}
              onBlur={saveNow}
              className={`${inputClass} font-serif text-2xl font-bold`}
            />
          </label>
          <label className="flex flex-col text-sm font-medium">
            Encounter notes
            <textarea
              value={notes}
              rows={2}
              maxLength={PREPARED_NOTES_MAX}
              placeholder="Where it happens, how the monsters fight, what they carry…"
              onChange={(event) => setNotes(event.target.value)}
              onBlur={saveNow}
              className={inputClass}
            />
          </label>
        </div>
        <div className="flex flex-col items-end justify-between gap-3">
          <p aria-live="polite" className="text-sm text-stone-500">
            {status && (status === "All changes saved" ? `✓ ${status}` : status)}
          </p>
          {error && (
            <p
              role="alert"
              className="max-w-xs text-right text-sm text-rose-700 dark:text-rose-400"
            >
              Couldn't save: {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className={buttonClass}
              disabled={!editor.canUndo}
              onClick={editor.undo}
            >
              Undo
            </button>
            <Link to={startUrl} onClick={saveNow} className={primaryButtonClass}>
              Start
            </Link>
          </div>
          {confirmingDelete ? (
            <Form method="post" className="flex items-center gap-2">
              <span className="text-sm font-medium">Delete for good?</span>
              <button
                type="submit"
                name="intent"
                value="delete"
                className="rounded-md bg-rose-700 px-2.5 py-1 text-sm font-semibold text-white hover:bg-rose-800"
              >
                Delete encounter
              </button>
              <button
                type="button"
                className={buttonClass}
                onClick={() => setConfirmingDelete(false)}
              >
                Keep it
              </button>
            </Form>
          ) : (
            <button
              type="button"
              className="text-sm text-rose-700 hover:underline dark:text-rose-400"
              onClick={() => setConfirmingDelete(true)}
            >
              Delete…
            </button>
          )}
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <section aria-labelledby="prepared-combatants-heading" className={panelClass}>
            <h2 id="prepared-combatants-heading" className="mb-1 font-serif text-xl font-bold">
              Monsters and companions
            </h2>
            <p className="mb-2 text-sm text-stone-500">
              Initiative is rolled when the fight starts, and you'll pick who's playing then.
            </p>
            {encounter.combatants.length === 0 ? (
              <p className="text-sm text-stone-500">
                No one yet. Add monsters from the vault below.
              </p>
            ) : (
              <ul
                aria-label="Monsters and companions"
                className="divide-y divide-stone-200 dark:divide-stone-800"
              >
                {encounter.combatants.map((combatant) => {
                  const creature = combatant.statblock
                    ? creatures.get(statblockKey(combatant.statblock))
                    : undefined;
                  return (
                    <CombatantRow
                      key={combatant.id}
                      mode="prep"
                      combatant={combatant}
                      isShown={combatant.id === shown?.id}
                      dispatch={dispatch}
                      onShowStatblock={() => setPickedId(combatant.id)}
                      onRerollHp={
                        creature
                          ? () => dispatch(rerollHp(creature, combatant.id, editor.rng))
                          : undefined
                      }
                    />
                  );
                })}
              </ul>
            )}
          </section>
          <AddCombatants
            mode="prep"
            catalogue={catalogue}
            encounter={encounter}
            dispatch={dispatch}
            rng={editor.rng}
          />
        </div>
        <div className="lg:sticky lg:top-4 lg:self-start">
          <StatblockPanel
            combatantName={shown?.name}
            creature={shown?.statblock ? creatures.get(statblockKey(shown.statblock)) : undefined}
            hasStatblock={Boolean(shown?.statblock)}
          />
        </div>
      </div>
    </main>
  );
}
