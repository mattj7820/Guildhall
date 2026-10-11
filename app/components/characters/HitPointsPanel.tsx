import { useState } from "react";
import type { CharacterAction } from "~/characters/actions";
import { HP_MAX } from "~/characters/schema";
import type { HitPoints } from "~/characters/types";
import { buttonClass, inputClass } from "../styles";
import { NumberField } from "./Fields";
import { HitPointsView, SheetPanel } from "./SheetParts";

/**
 * Hit points, with Heal and Damage always to hand (temporary hit points soak up damage first).
 * Heal and Damage are changes by an amount, so the DM's damage and a player's healing add up.
 * In edit mode the three numbers can be typed.
 */
export function HitPointsPanel({
  hp,
  editing,
  dispatch,
  className = "",
}: {
  hp: HitPoints;
  editing: boolean;
  dispatch: (...actions: CharacterAction[]) => void;
  className?: string;
}) {
  const [amount, setAmount] = useState("");
  const value = Number(amount);
  const valid = amount.trim() !== "" && Number.isInteger(value) && value > 0 && value <= HP_MAX;
  const change = (type: "heal" | "damage") => {
    if (!valid) return;
    dispatch({ type, amount: value });
    setAmount("");
  };

  return (
    <SheetPanel title="Hit points" className={className}>
      {editing ? (
        <div className="flex flex-wrap items-end justify-center gap-3">
          {(["current", "max", "temp"] as const).map((field) => (
            <NumberField
              key={field}
              label={{ current: "Current", max: "Max", temp: "Temp" }[field]}
              showLabel
              value={hp[field]}
              min={0}
              max={HP_MAX}
              onCommit={(next) => dispatch({ type: "hp", field, value: next, from: hp[field] })}
            />
          ))}
        </div>
      ) : (
        <HitPointsView hp={hp} />
      )}
      {/* Enter mustn't pick Heal or Damage by itself, so neither is a submit button. */}
      <form
        className="mt-2 flex items-center justify-center gap-1.5"
        onSubmit={(event) => event.preventDefault()}
      >
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={HP_MAX}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          aria-label="Amount of healing or damage"
          placeholder="0"
          className={`${inputClass} w-16 text-center tabular-nums`}
        />
        <button
          type="button"
          className={`${buttonClass} text-good`}
          disabled={!valid}
          onClick={() => change("heal")}
        >
          Heal
        </button>
        <button
          type="button"
          className={`${buttonClass} text-danger`}
          disabled={!valid}
          onClick={() => change("damage")}
        >
          Damage
        </button>
      </form>
    </SheetPanel>
  );
}
