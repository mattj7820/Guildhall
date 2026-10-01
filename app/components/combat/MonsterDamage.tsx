import { useState, type FormEvent } from "react";
import type { EncounterAction } from "~/combat/encounter";
import type { MonsterCombatant } from "~/combat/types";
import { buttonClass, inputClass, panelClass, primaryButtonClass } from "~/components/styles";

/**
 * Damage or healing for the monsters picked on the map, as the table says it: the DM types the
 * number a player rolled, and Half for those who saved. One undo step per monster.
 */
export function MonsterDamage({
  monsters,
  dispatch,
  onClear,
}: {
  monsters: readonly MonsterCombatant[];
  dispatch: (action: EncounterAction) => void;
  onClear: () => void;
}) {
  const [amount, setAmount] = useState("");
  const value = Number.parseInt(amount, 10);
  const valid = Number.isFinite(value) && value > 0;

  function apply(type: "damage" | "heal", half = false) {
    if (!valid) return;
    const each = half ? Math.floor(value / 2) : value;
    for (const monster of monsters) dispatch({ type, id: monster.id, amount: each });
    setAmount("");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    apply("damage");
  }

  const names = monsters.map((monster) => monster.name).join(", ");
  return (
    <form
      aria-label="Damage the picked monsters"
      onSubmit={submit}
      className={`${panelClass} flex flex-col gap-2 border-2 border-sky-500 text-sm`}
    >
      <div className="flex items-baseline gap-2">
        <span className="mr-auto font-semibold">{names}</span>
        <button type="button" className="text-xs text-stone-500 hover:underline" onClick={onClear}>
          Clear
        </button>
      </div>
      {monsters.length === 1 && (
        <span className="text-xs text-stone-500 tabular-nums">
          HP {monsters[0].hp.current}/{monsters[0].hp.max}
        </span>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label="Amount"
          inputMode="numeric"
          value={amount}
          onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))}
          className={`${inputClass} w-16`}
          autoFocus
        />
        <button type="submit" className={primaryButtonClass} disabled={!valid}>
          Damage
        </button>
        <button
          type="button"
          className={buttonClass}
          disabled={!valid}
          title="Half damage, rounded down: for a successful save or resistance"
          onClick={() => apply("damage", true)}
        >
          Half
        </button>
        <button
          type="button"
          className={buttonClass}
          disabled={!valid}
          onClick={() => apply("heal")}
        >
          Heal
        </button>
      </div>
      <p className="text-xs text-stone-500">Shift-click tokens to pick more.</p>
    </form>
  );
}
