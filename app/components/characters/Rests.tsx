import { useEffect, useRef, useState } from "react";
import { signed } from "~/characters/abilities";
import {
  hitDieHealing,
  longRest,
  restSummary,
  shortRest,
  type SpentHitDie,
} from "~/characters/tracking";
import { HIT_DICE, type HitDie } from "~/characters/types";
import { parseDice } from "~/dice/parse";
import { roll } from "~/dice/roll";
import { defaultRng } from "~/dice/rng";
import { UndoToast } from "../inventory/UndoToast";
import { buttonClass, inputClass, primaryButtonClass } from "../styles";
import type { Parts } from "./SheetSections";

/**
 * Short rest and Long rest. Resting is the player's own button, never something the app decides
 * (decision 55). A rest is one action, so one Undo puts back everything it did.
 */
export function RestButtons({ parts, undo }: { parts: Parts; undo: () => void }) {
  const [resting, setResting] = useState(false);
  const [toast, setToast] = useState<{ message?: string; serial: number }>({ serial: 0 });
  const say = (message: string) =>
    setToast((previous) => ({ message, serial: previous.serial + 1 }));

  return (
    <>
      <button type="button" className={buttonClass} onClick={() => setResting(true)}>
        Short rest
      </button>
      <button
        type="button"
        className={buttonClass}
        onClick={() => {
          say(restSummary("long", parts.sheet, longRest(parts.sheet).sheet));
          parts.dispatch({ type: "rest", rest: "long" });
        }}
      >
        Long rest
      </button>
      {resting && (
        <ShortRestDialog
          parts={parts}
          onClose={(summary) => {
            setResting(false);
            if (summary) say(summary);
          }}
        />
      )}
      <UndoToast message={toast.message} serial={toast.serial} onUndo={undo} />
    </>
  );
}

/**
 * A short rest: spend hit dice to heal, rolled here or rolled at the table and typed in, then
 * finish to save them all as one rest with what it gives back.
 */
function ShortRestDialog({
  parts,
  onClose,
}: {
  parts: Parts;
  /** With what the rest did, if it was taken. */
  onClose: (summary?: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const finished = useRef<string>(undefined);
  const [spent, setSpent] = useState<SpentHitDie[]>([]);
  const { sheet, derived } = parts;
  const con = derived.modifiers.con;
  const pools = HIT_DICE.filter((die) => sheet.hitDice[die].max > 0);
  const preview = shortRest(sheet, spent);
  const resets = sheet.features.filter(
    (feature) => feature.uses?.reset === "short" && feature.uses.used > 0,
  );

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const left = (die: HitDie) =>
    sheet.hitDice[die].max - sheet.hitDice[die].used - spent.filter((s) => s.die === die).length;

  function finish() {
    finished.current = restSummary("short", sheet, preview.sheet);
    parts.dispatch({ type: "rest", rest: "short", hitDice: spent });
    dialog.current?.close();
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="short-rest-heading"
      onClose={() => onClose(finished.current)}
      className="m-auto w-full max-w-md rounded-xl border border-line bg-surface p-5 text-ink shadow-2xl backdrop:bg-black/50"
    >
      <h2 id="short-rest-heading" className="font-serif text-2xl font-bold">
        Short rest
      </h2>
      {pools.length === 0 ? (
        <p className="mt-2 text-sm text-muted">
          No hit dice to spend: set them while editing the sheet.
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted">
          Spend hit dice to heal: each heals its roll {signed(con)} (CON), and at least 1.
        </p>
      )}
      {pools.map((die) => (
        <HitDieRow
          key={die}
          die={die}
          left={left(die)}
          max={sheet.hitDice[die].max}
          onSpend={(face) => setSpent([...spent, { die, face }])}
        />
      ))}
      {spent.length > 0 && (
        <ul aria-label="Hit dice spent" className="mt-3 space-y-1 text-sm">
          {spent.map(({ die, face }, index) => (
            <li key={index} className="flex items-center gap-2 tabular-nums">
              {die}: {face} {signed(con)} = <strong>{hitDieHealing(face, con)}</strong>
              <button
                type="button"
                aria-label={`Take back the ${die} that rolled ${face}`}
                className="text-faint hover:text-ink"
                onClick={() => setSpent(spent.filter((_, at) => at !== index))}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-sm">
        Healing <strong>+{preview.healed}</strong> → HP {preview.sheet.hp.current} / {sheet.hp.max}
      </p>
      <p className="mt-1 text-sm text-muted">
        Also gives back: {resets.length > 0 ? resets.map((f) => f.name).join(", ") : "nothing else"}
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className={buttonClass} onClick={() => dialog.current?.close()}>
          Cancel
        </button>
        <button type="button" className={primaryButtonClass} onClick={finish}>
          Finish short rest
        </button>
      </div>
    </dialog>
  );
}

function HitDieRow({
  die,
  left,
  max,
  onSpend,
}: {
  die: HitDie;
  left: number;
  max: number;
  onSpend: (face: number) => void;
}) {
  const [typed, setTyped] = useState("");
  const sides = Number(die.slice(1));
  const face = Number(typed);
  const typedOk = Number.isInteger(face) && face >= 1 && face <= sides;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="font-semibold">{die}</span>
      <span className="mr-2 text-sm text-muted">
        {left} of {max} left
      </span>
      <button
        type="button"
        className={primaryButtonClass}
        disabled={left <= 0}
        onClick={() => {
          const dice = parseDice(`1${die}`);
          if (dice.ok) onSpend(roll(dice.expression, defaultRng).total);
        }}
      >
        Roll a {die}
      </button>
      <label className="flex items-center gap-1 text-sm text-muted">
        or rolled at the table
        <input
          inputMode="numeric"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          className={`${inputClass} w-14`}
        />
      </label>
      <button
        type="button"
        className={buttonClass}
        disabled={left <= 0 || !typedOk}
        onClick={() => {
          onSpend(face);
          setTyped("");
        }}
      >
        Add
      </button>
    </div>
  );
}
