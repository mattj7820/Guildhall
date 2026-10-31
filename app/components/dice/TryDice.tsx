import { defaultRng } from "~/dice/rng";
import type { DieType } from "~/dice/styles";
import { useRollLog } from "~/dice/useRollLog";
import { useDicePreferences } from "./useDicePreferences";
import { useDiceTray } from "./useDiceTray";

/**
 * Throws a few of a type, as a roll would pick them up: two d20s (advantage), or up to four of
 * the others. Just to see them; the result goes nowhere.
 */
export function TryDice({ sides }: { sides: DieType }) {
  const { bag, enabled } = useDicePreferences();
  const { rolls, tray } = useDiceTray(useRollLog(defaultRng), { fixed: true });
  const count = sides === 20 ? 2 : Math.min(Math.max(bag.byType[sides]?.length ?? 1, 1), 4);
  const latest = rolls.log.rolls[0];
  if (!enabled) return null;
  return (
    <>
      <button
        type="button"
        className="text-link text-sm font-semibold"
        onClick={() => rolls.roll({ expression: `${count}d${sides}`, kind: "custom" })}
      >
        Try them
      </button>
      <span aria-live="polite" className="text-muted text-sm">
        {rolls.rolling ? "Rolling…" : latest && `${latest.result.total}`}
      </span>
      {tray}
    </>
  );
}
