/**
 * The fight the table is in: one at a time, kept on the server and seen by everyone. The DM's
 * tracker writes it whole (it's the only one changing it, apart from players ending their turn),
 * and each person gets their own view of it. Isomorphic and pure.
 */
import type { Viewer } from "~/campaign/types";
import type { MapId } from "~/maps/types";
import type { CombatantId, Encounter, HitPoints } from "./types";
import { encounterForViewer, type EncounterView } from "./visibility";
import { isWholeParty } from "./types";

export interface Fight {
  encounter: Encounter;
  /** Goes up with every change, so a stale tab can't write over a newer fight. */
  revision: number;
  /** The map it's fought on, if any. */
  map?: MapId;
}

/** The fight as one person may see it. */
export type FightView = (
  | { forDm: true; encounter: Encounter; revision: number; map?: MapId }
  | {
      forDm: false;
      view: EncounterView;
      map?: MapId;
      /** Whether it's the turn of someone this player controls, so they may end it. */
      theirTurn: boolean;
    }
) & {
  /** Party members' hit points from their sheets: all for the DM, a player's own for them. */
  hp?: Record<CombatantId, HitPoints>;
};

/** The DM's view: the whole fight. */
export type DmFightView = Extract<FightView, { forDm: true }>;

/** A player's view of the fight. */
export type PlayerFightView = Extract<FightView, { forDm: false }>;

export function fightForViewer(fight: Fight, viewer: Viewer): FightView {
  if (viewer.role === "dm") {
    return {
      forDm: true,
      encounter: fight.encounter,
      revision: fight.revision,
      ...(fight.map && { map: fight.map }),
    };
  }
  return {
    forDm: false,
    view: encounterForViewer(fight.encounter, viewer),
    ...(fight.map && { map: fight.map }),
    theirTurn: isTheirTurn(fight.encounter, viewer),
  };
}

/**
 * Whether it's the turn of a combatant this player controls: their PC, or a companion the whole
 * party shares. Only then may they end the turn themselves.
 */
export function isTheirTurn(encounter: Encounter, viewer: Viewer): boolean {
  if (encounter.phase !== "active") return false;
  const active = encounter.combatants.find((c) => c.id === encounter.activeId);
  if (active?.kind !== "player") return false;
  if (isWholeParty(active.controller)) return true;
  return viewer.playerId !== undefined && active.controller.id === viewer.playerId;
}
