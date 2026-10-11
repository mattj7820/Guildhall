import type { ReactNode } from "react";
import { iconButtonClass } from "../styles";

/** Dice to roll with a click, such as damage: a small chip, as on the paper sheet's box. */
export function DiceChip({
  label,
  onRoll,
  strong = false,
  children,
}: {
  /** What a screen reader hears, e.g. "Roll Quarterstaff damage, 1d8+3". */
  label: string;
  onRoll: () => void;
  /** The to-hit roll, which reads first. */
  strong?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onRoll}
      className={`rounded-md border px-2 py-0.5 text-sm tabular-nums hover:bg-accent-surface focus-visible:outline-2 focus-visible:outline-accent ${
        strong ? "border-trim font-semibold text-title" : "border-line-strong"
      }`}
    >
      {children}
    </button>
  );
}

/** Moving a row of a sheet's list up or down, and removing it, while editing. */
export function ListControls({
  name,
  index,
  length,
  onMove,
  onRemove,
}: {
  name: string;
  index: number;
  length: number;
  onMove: (index: number) => void;
  onRemove: () => void;
}) {
  return (
    <span className="ml-auto inline-flex items-center">
      <button
        type="button"
        aria-label={`Move ${name} up`}
        disabled={index <= 0}
        onClick={() => onMove(index - 1)}
        className={iconButtonClass}
      >
        ↑
      </button>
      <button
        type="button"
        aria-label={`Move ${name} down`}
        disabled={index >= length - 1}
        onClick={() => onMove(index + 1)}
        className={iconButtonClass}
      >
        ↓
      </button>
      <button
        type="button"
        aria-label={`Remove ${name}`}
        onClick={onRemove}
        className={`${iconButtonClass} hover:text-danger`}
      >
        ✕
      </button>
    </span>
  );
}

/** A small letter after a name: C for concentration, R for ritual. */
export function Badge({ title, children }: { title: string; children: string }) {
  return (
    <abbr
      title={title}
      className="ml-1 rounded border border-line-strong px-1 text-[10px] font-semibold text-muted no-underline"
    >
      {children}
    </abbr>
  );
}
