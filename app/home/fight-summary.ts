/** PROTOTYPE: the fight as the front page says it. */
import type { FightView } from "~/combat/fight";

/** The fight, as the banner says it: the round and whose turn. */
export function fightSummaryOf(view: FightView | null) {
  if (!view) return null;
  if (view.forDm) {
    const { encounter } = view;
    if (encounter.phase !== "active") return null;
    const active = encounter.combatants.find((each) => each.id === encounter.activeId);
    return { round: encounter.round, turn: active?.name, map: view.map };
  }
  if (!view.view.started) return null;
  const active = view.view.turnOrder.find((each) => each.isActive);
  return { round: view.view.round, turn: active?.name, map: view.map };
}
