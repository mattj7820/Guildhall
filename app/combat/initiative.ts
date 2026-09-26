import type { Combatant, CombatantId } from "./types";

/**
 * Initiative order: highest first; ties broken by d20 rerolls, compared in order. Combatants
 * without an initiative yet go last. Returns 0 while a tie is unresolved.
 */
export function compareInitiative(a: Combatant, b: Combatant): number {
  if (a.initiative === null || b.initiative === null) {
    return (a.initiative === null ? 1 : 0) - (b.initiative === null ? 1 : 0);
  }
  if (a.initiative !== b.initiative) return b.initiative - a.initiative;
  const depth = Math.min(a.tiebreaks.length, b.tiebreaks.length);
  for (let i = 0; i < depth; i++) {
    if (a.tiebreaks[i] !== b.tiebreaks[i]) return b.tiebreaks[i] - a.tiebreaks[i];
  }
  return 0;
}

/** Stable sort into initiative order; unresolved ties keep their current order. */
export function sortByInitiative(combatants: readonly Combatant[]): Combatant[] {
  return [...combatants].sort(compareInitiative);
}

/** An unresolved tie: everyone in `members` is still level, and `waitingFor` must reroll. */
export interface PendingTie {
  initiative: number;
  members: Combatant[];
  /** Tied combatants who haven't rolled this round of rerolls yet. */
  waitingFor: Combatant[];
}

/**
 * Every tie still to be broken. Tied combatants each reroll a d20; any still level reroll again,
 * as many times as it takes. A combatant who joins a tie that was already broken just rolls
 * against the rerolls on record, as if everyone had rolled at the same time.
 */
export function pendingTies(combatants: readonly Combatant[]): PendingTie[] {
  const byInitiative = groupBy(
    combatants.filter((c) => c.initiative !== null),
    (c) => c.initiative,
  );
  return [...byInitiative.values()].flatMap((group) => tiesIn(group, 0));
}

function tiesIn(group: Combatant[], depth: number): PendingTie[] {
  if (group.length < 2) return [];
  const waitingFor = group.filter((c) => c.tiebreaks.length <= depth);
  if (waitingFor.length > 0) {
    return [{ initiative: group[0].initiative!, members: group, waitingFor }];
  }
  const byReroll = groupBy(group, (c) => c.tiebreaks[depth]);
  return [...byReroll.values()].flatMap((tied) => tiesIn(tied, depth + 1));
}

/** Combatants who must reroll before their place in the order is settled. */
export function awaitingReroll(combatants: readonly Combatant[]): Combatant[] {
  return pendingTies(combatants).flatMap((tie) => tie.waitingFor);
}

/**
 * Moves one combatant to its initiative position without disturbing anyone else, so a DM's
 * manual reordering survives someone joining mid-fight.
 */
export function placeCombatant(combatants: readonly Combatant[], id: CombatantId): Combatant[] {
  const placing = combatants.find((c) => c.id === id);
  if (!placing) return [...combatants];
  const others = combatants.filter((c) => c.id !== id);
  const index = others.findIndex((other) => compareInitiative(placing, other) < 0);
  others.splice(index === -1 ? others.length : index, 0, placing);
  return others;
}

function groupBy<T, K>(items: readonly T[], key: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    groups.set(k, [...(groups.get(k) ?? []), item]);
  }
  return groups;
}
