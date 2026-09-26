import { useState, type FormEvent } from "react";
import type { Rng } from "~/dice/rng";
import { rollText, type RollMode, type RollResult } from "~/dice/roll";
import { inputClass, labelClass, panelClass, primaryButtonClass } from "./styles";

const MODES: { value: RollMode; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "advantage", label: "Advantage" },
  { value: "disadvantage", label: "Disadvantage" },
];

const HISTORY_LENGTH = 8;

/** A quick roller for dice expressions, e.g. `2d6+3`, with advantage and disadvantage on d20s. */
export function DiceRoller({ rng }: { rng: Rng }) {
  const [mode, setMode] = useState<RollMode>("normal");
  const [results, setResults] = useState<{ id: number; result: RollResult }[]>([]);
  const [error, setError] = useState<string>();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const outcome = rollText(String(new FormData(event.currentTarget).get("dice")), rng, mode);
    if (!outcome.ok) {
      setError(outcome.error);
      return;
    }
    setError(undefined);
    setResults((previous) =>
      [{ id: (previous[0]?.id ?? 0) + 1, result: outcome.result }, ...previous].slice(
        0,
        HISTORY_LENGTH,
      ),
    );
  }

  const [latest, ...earlier] = results;

  return (
    <section aria-labelledby="dice-heading" className={panelClass}>
      <h2 id="dice-heading" className="mb-2 font-serif text-xl font-bold">
        Dice
      </h2>
      <form onSubmit={submit} className="flex flex-col gap-2">
        <div className="flex gap-2">
          <label htmlFor="dice-expression" className="sr-only">
            Dice to roll
          </label>
          <input
            id="dice-expression"
            name="dice"
            defaultValue="1d20"
            autoComplete="off"
            className={`${inputClass} min-w-0 flex-1 font-mono`}
          />
          <button type="submit" className={primaryButtonClass}>
            Roll
          </button>
        </div>
        <fieldset className="flex gap-3 text-sm">
          <legend className="sr-only">d20 rolls</legend>
          {MODES.map(({ value, label }) => (
            <label key={value} className="flex items-center gap-1">
              <input
                type="radio"
                name="mode"
                value={value}
                checked={mode === value}
                onChange={() => setMode(value)}
              />
              {label}
            </label>
          ))}
        </fieldset>
      </form>
      {error && (
        <p role="alert" className="mt-2 text-sm text-rose-700 dark:text-rose-400">
          {error}
        </p>
      )}
      <output aria-live="polite" aria-label="Latest roll" className="mt-3 block">
        {latest && <RollLine result={latest.result} large />}
      </output>
      {earlier.length > 0 && (
        <>
          <h3 className={`${labelClass} mt-3`}>Earlier</h3>
          <ul className="mt-1 flex flex-col gap-0.5">
            {earlier.map(({ id, result }) => (
              <li key={id}>
                <RollLine result={result} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function RollLine({ result, large = false }: { result: RollResult; large?: boolean }) {
  return (
    <span className="flex items-baseline gap-2 font-mono text-sm">
      <strong className={large ? "text-3xl" : "text-base"}>{result.total}</strong>
      <span className="text-stone-500">
        {result.expression}
        {result.mode !== "normal" && ` (${result.mode})`}:{" "}
        {result.terms.map((term, index) => (
          <span key={index}>
            {index > 0 && " "}
            {term.term.kind === "constant" ? (
              `${term.subtotal >= 0 ? "+" : "−"}${Math.abs(term.subtotal)}`
            ) : (
              <>
                {term.subtotal < 0 && "−"}[
                {term.rolls.map((die, dieIndex) => (
                  <span key={dieIndex} className={die.kept ? "" : "line-through opacity-50"}>
                    {dieIndex > 0 && ", "}
                    {die.value}
                  </span>
                ))}
                ]
              </>
            )}
          </span>
        ))}
      </span>
    </span>
  );
}
