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
      className={`rounded-md border px-2 py-0.5 text-sm tabular-nums hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-amber-600 dark:hover:bg-amber-900/30 ${
        strong
          ? "border-amber-400 font-semibold text-amber-900 dark:border-amber-700 dark:text-amber-200"
          : "border-stone-300 dark:border-stone-700"
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
        className={`${iconButtonClass} hover:text-rose-700 dark:hover:text-rose-400`}
      >
        ✕
      </button>
    </span>
  );
}
