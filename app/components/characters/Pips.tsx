import type { Counter, Reset } from "~/characters/types";

/** Past this many, a counter is a number with − and + rather than a row of pips. */
const MAX_PIPS = 10;

/**
 * Something that gets used up, at a glance: a lit pip for each one left, as games show charges.
 * One click on a lit pip uses one; a click on a spent one gives one back.
 */
export function Pips({
  label,
  counter,
  onCount,
  size = "md",
}: {
  /** What's counted, e.g. "1st-level slot", "Focus points". */
  label: string;
  counter: Counter;
  /** Uses `by` more (or gives back, when negative). */
  onCount: (by: number) => void;
  size?: "sm" | "md";
}) {
  if (counter.max === 0) return null;
  const left = counter.max - counter.used;
  const summary = `${label}: ${left} of ${counter.max} left`;

  if (counter.max > MAX_PIPS) {
    const step = "rounded border border-line-strong px-1.5 text-sm leading-5 disabled:opacity-40";
    return (
      <span role="group" aria-label={summary} className="inline-flex items-center gap-1">
        <button
          type="button"
          aria-label={`Use one ${label}`}
          disabled={left === 0}
          onClick={() => onCount(1)}
          className={step}
        >
          −
        </button>
        <span className="min-w-[3.5ch] text-center text-sm font-semibold tabular-nums">
          {left}/{counter.max}
        </span>
        <button
          type="button"
          aria-label={`Give back one ${label}`}
          disabled={counter.used === 0}
          onClick={() => onCount(-1)}
          className={step}
        >
          +
        </button>
      </span>
    );
  }

  const box = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <span role="group" aria-label={summary} className="inline-flex items-center gap-1.5">
      {Array.from({ length: counter.max }, (_, index) => {
        const spent = index >= left;
        return (
          <button
            key={index}
            type="button"
            aria-label={spent ? `Give back one ${label}` : `Use one ${label}`}
            title={spent ? "Spent: click to give it back" : "Click to use"}
            onClick={() => onCount(spent ? -1 : 1)}
            className={`${box} rotate-45 rounded-[3px] border-2 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              spent
                ? "border-line-strong bg-transparent"
                : "border-accent bg-accent shadow-[0_0_6px] shadow-trim/60"
            }`}
          />
        );
      })}
    </span>
  );
}

const RESET_ABBREVIATIONS: Record<Reset, [string, string] | undefined> = {
  short: ["SR", "Comes back on a short or long rest"],
  long: ["LR", "Comes back on a long rest"],
  manual: undefined,
};

/** SR or LR beside a counter, saying what gives it back; nothing for one kept by hand. */
export function ResetBadge({ reset }: { reset: Reset }) {
  const badge = RESET_ABBREVIATIONS[reset];
  if (!badge) return null;
  return (
    <abbr
      title={badge[1]}
      className="rounded bg-raised px-1 text-[10px] font-semibold text-muted no-underline"
    >
      {badge[0]}
    </abbr>
  );
}
