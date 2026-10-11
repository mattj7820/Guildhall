import type { FormEvent } from "react";
import type { RollMode } from "~/dice/roll";
import type { LoggedRoll } from "~/dice/roll-log";
import type { RollLogControls } from "~/dice/useRollLog";
import { inputClass, labelClass, panelClass, primaryButtonClass } from "~/components/styles";

const MODES: { value: RollMode; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "advantage", label: "Advantage" },
  { value: "disadvantage", label: "Disadvantage" },
];

/**
 * Typed rolls (e.g. `2d6+3`) and the results of statblock clicks. Advantage and disadvantage
 * last for one d20 roll; Critical doubles the next damage roll's dice.
 */
export function DiceRoller({
  rolls,
  hint = "Or click a roll in the statblock. Advantage lasts one d20 roll; Critical doubles the next damage dice, and turns on after a natural 20.",
}: {
  rolls: RollLogControls;
  hint?: string;
}) {
  const { log } = rolls;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    rolls.roll({
      expression: String(new FormData(event.currentTarget).get("dice")),
      kind: "custom",
    });
  }

  const [latest, ...earlier] = log.rolls;

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
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <fieldset className="flex gap-3">
            <legend className="sr-only">Next d20 roll</legend>
            {MODES.map(({ value, label }) => (
              <label key={value} className="flex items-center gap-1">
                <input
                  type="radio"
                  name="mode"
                  value={value}
                  checked={log.mode === value}
                  onChange={() => rolls.setMode(value)}
                />
                {label}
              </label>
            ))}
          </fieldset>
          <label
            className={`flex items-center gap-1 ${log.critical ? "font-semibold text-danger" : ""}`}
          >
            <input
              type="checkbox"
              checked={log.critical}
              onChange={(event) => rolls.setCritical(event.target.checked)}
            />
            Critical
          </label>
        </div>
        <p className="text-xs text-muted">{hint}</p>
      </form>
      {rolls.error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {rolls.error}
        </p>
      )}
      <output aria-live="polite" aria-label="Latest roll" className="mt-3 block">
        {latest && <RollLine roll={latest} large />}
      </output>
      {earlier.length > 0 && (
        <>
          <h3 className={`${labelClass} mt-3`}>Earlier</h3>
          <ul className="mt-1 flex flex-col gap-1">
            {earlier.map((roll) => (
              <li key={roll.id}>
                <RollLine roll={roll} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function RollLine({ roll, large = false }: { roll: LoggedRoll; large?: boolean }) {
  const { result } = roll;
  return (
    <span className="block">
      {roll.label && (
        <span className={`block ${large ? "text-sm font-semibold" : "text-xs"}`}>{roll.label}</span>
      )}
      <span className="flex flex-wrap items-baseline gap-x-2 font-mono text-sm">
        <strong className={large ? "text-3xl" : "text-base"}>{result.total}</strong>
        {result.natural === 20 && <Badge tone="good">Natural 20!</Badge>}
        {result.natural === 1 && <Badge tone="bad">Natural 1</Badge>}
        {roll.critical && <Badge tone="good">Critical</Badge>}
        {roll.recharged !== undefined && (
          <Badge tone={roll.recharged ? "good" : "bad"}>
            {roll.recharged ? "Recharged" : "Not recharged"}
          </Badge>
        )}
        <span className="text-muted">
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
    </span>
  );
}

function Badge({ tone, children }: { tone: "good" | "bad"; children: string }) {
  const colours = tone === "good" ? "bg-good-surface text-good" : "bg-line text-ink";
  return (
    <span className={`rounded px-1.5 py-0.5 font-sans text-xs font-semibold ${colours}`}>
      {children}
    </span>
  );
}
