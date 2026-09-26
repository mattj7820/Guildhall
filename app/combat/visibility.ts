import type { Viewer } from "~/campaign/types";
import type { Combatant, CombatantId, Condition, Encounter } from "./types";

/**
 * Whether a viewer may see a combatant's details (conditions, notes). The DM sees everything; a
 * player sees details only for the combatants they control this battle.
 */
export function canSeeCombatantDetails(viewer: Viewer, combatant: Combatant): boolean {
  if (viewer.role === "dm") return true;
  return (
    combatant.kind === "player" &&
    viewer.playerId !== undefined &&
    combatant.controller.id === viewer.playerId
  );
}

/** What a player may know about an encounter. Not used by a page yet: the tracker is DM-only. */
export interface EncounterView {
  started: boolean;
  round: number;
  /** Everyone's name and whose turn it is, and nothing else about them. */
  turnOrder: { id: CombatantId; name: string; isActive: boolean }[];
  /** Details only for combatants the viewer controls. */
  details: Record<CombatantId, { conditions: Condition[]; note: string }>;
}

/**
 * Filters an encounter down to what a viewer may see: no HP, initiative numbers, statblocks or
 * monster notes. Before combat starts nothing is shown, so the DM can build an encounter
 * without revealing who's in it.
 */
export function encounterForViewer(encounter: Encounter, viewer: Viewer): EncounterView {
  if (encounter.phase === "setup") return { started: false, round: 0, turnOrder: [], details: {} };
  return {
    started: true,
    round: encounter.round,
    turnOrder: encounter.combatants.map((c) => ({
      id: c.id,
      name: c.name,
      isActive: c.id === encounter.activeId,
    })),
    details: Object.fromEntries(
      encounter.combatants
        .filter((c) => canSeeCombatantDetails(viewer, c))
        .map((c) => [c.id, { conditions: c.conditions, note: c.note }]),
    ),
  };
}
