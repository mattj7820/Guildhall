import type { Combatant, CombatantId } from "./types";

/** A monster at 0 HP. Player-controlled combatants are never "down" here: players track that. */
export function isDown(combatant: Combatant): boolean {
  return combatant.kind === "monster" && combatant.hp.current === 0;
}

/** At or below half its maximum HP, but not down. */
export function isBloodied(combatant: Combatant): boolean {
  return (
    combatant.kind === "monster" &&
    combatant.hp.current > 0 &&
    combatant.hp.current <= combatant.hp.max / 2
  );
}

/** Down monsters stay in the order but lose their turns. Player combatants always get theirs. */
export function takesTurn(combatant: Combatant): boolean {
  return !isDown(combatant);
}

export interface TurnPosition {
  round: number;
  activeId: CombatantId | null;
}

/** Round 1, with the first combatant who takes a turn. */
export function firstTurn(combatants: readonly Combatant[]): TurnPosition {
  return { round: 1, activeId: (combatants.find(takesTurn) ?? combatants[0])?.id ?? null };
}

/** The next combatant who takes a turn; passing the end of the order starts a new round. */
export function nextTurn(combatants: readonly Combatant[], position: TurnPosition): TurnPosition {
  const count = combatants.length;
  if (count === 0) return { round: position.round, activeId: null };
  const start = combatants.findIndex((c) => c.id === position.activeId);
  const at = (raw: number) => ({
    round: position.round + Math.floor(raw / count),
    activeId: combatants[raw % count].id,
  });
  for (let step = 1; step <= count; step++) {
    if (takesTurn(combatants[(start + step) % count])) return at(start + step);
  }
  // Nobody can act (every monster is down and there are no players): just step along.
  return at(start + 1);
}

/** Steps back a turn, into the previous round if needed, but never before round 1. */
export function previousTurn(
  combatants: readonly Combatant[],
  position: TurnPosition,
): TurnPosition {
  const count = combatants.length;
  const start = combatants.findIndex((c) => c.id === position.activeId);
  if (start === -1) return position;
  for (let step = 1; step <= count; step++) {
    const raw = start - step;
    const combatant = combatants[(raw + count) % count];
    if (!takesTurn(combatant)) continue;
    const round = raw < 0 ? position.round - 1 : position.round;
    return round < 1 ? position : { round, activeId: combatant.id };
  }
  return position;
}
