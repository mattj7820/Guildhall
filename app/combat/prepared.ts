import type { Player } from "~/campaign/types";
import type { Rng } from "~/dice/rng";
import { createEncounter, perform, rollMonsterInitiatives } from "./encounter";
import { newId } from "~/shared/ids";
import type { MapId, Point } from "~/maps/types";
import { mapUrl } from "~/maps/urls";
import type { Combatant, CombatantId, Encounter, PartyMember, PreparedEncounter } from "./types";

/** A party member who can join a fight: one whose note says who plays them. */
export type PartyChoice = PartyMember & { player: Player };

/**
 * The live fight for a prepared encounter: its monsters and companions with fresh IDs, the chosen
 * party, and monster initiative rolled (in turn order, then any tie rerolls). Players' initiative
 * is left for the DM to type in. The prepared encounter itself isn't changed.
 */
export function startPrepared(
  prepared: PreparedEncounter,
  party: PartyChoice[],
  rng: Rng,
  createId: () => string = newId,
): Encounter {
  return start(prepared, party, rng, createId).encounter;
}

/**
 * Starting a prepared fight set up on a map: the fight as `startPrepared`, and where its monsters
 * stand, by their new IDs. A monster added since it was placed has no place yet.
 */
export function startPreparedOnMap(
  prepared: PreparedEncounter,
  party: PartyChoice[],
  rng: Rng,
  createId: () => string = newId,
): { encounter: Encounter; placed: { combatant: CombatantId; at: Point }[] } {
  const { encounter, ids } = start(prepared, party, rng, createId);
  const placed = Object.entries(prepared.placement?.at ?? {}).flatMap(([was, at]) => {
    const combatant = ids.get(was);
    return combatant ? [{ combatant, at }] : [];
  });
  return { encounter, placed };
}

function start(
  prepared: PreparedEncounter,
  party: PartyChoice[],
  rng: Rng,
  createId: () => string,
): { encounter: Encounter; ids: Map<CombatantId, CombatantId> } {
  const ids = new Map<CombatantId, CombatantId>();
  let state: Encounter = {
    ...createEncounter(createId()),
    combatants: prepared.encounter.combatants.map((c) => {
      const id = createId();
      ids.set(c.id, id);
      return { ...unrolled(c), id };
    }),
  };
  for (const member of party) {
    state = perform(
      state,
      {
        type: "addPlayerCombatant",
        id: createId(),
        name: member.name,
        controller: member.player,
        entityId: member.entityId,
        statblock: member.statblock,
      },
      rng,
    );
  }
  return { encounter: perform(state, rollMonsterInitiatives(state, rng), rng), ids };
}

/**
 * A fight being set up in the tracker, made reusable: the monsters and companions stay, and the
 * party (picked each time it starts) and all initiative rolls go.
 */
export function toPrepared(encounter: Encounter): Encounter {
  return {
    ...createEncounter(encounter.id),
    combatants: encounter.combatants
      .filter((c) => c.kind === "monster" || !c.entityId)
      .map(unrolled),
  };
}

/**
 * Where starting a prepared encounter happens: on its map, if it was set up on one that's still
 * there, else in the tracker.
 */
export function preparedStartUrl(
  prepared: Pick<PreparedEncounter, "id" | "placement">,
  maps: ReadonlySet<MapId>,
): string {
  const start = `?start=${encodeURIComponent(prepared.id)}`;
  const map = prepared.placement?.map;
  return map && maps.has(map) ? `${mapUrl(map)}${start}` : `/combat${start}`;
}

/** "3× Goblin, 1× Bugbear" and "Blink Dog (Sam)", for the list of prepared encounters. */
export function summarise(encounter: Encounter): { monsters: string; companions: string } {
  const counts = new Map<string, number>();
  const companions: string[] = [];
  for (const c of encounter.combatants) {
    if (c.kind === "monster") counts.set(c.statblock.name, (counts.get(c.statblock.name) ?? 0) + 1);
    else companions.push(`${c.name} (${c.controller.name})`);
  }
  return {
    monsters: [...counts].map(([name, count]) => `${count}× ${name}`).join(", "),
    companions: companions.join(", "),
  };
}

function unrolled(combatant: Combatant): Combatant {
  const { joinedRound, ...rest } = combatant;
  return { ...rest, initiative: null, tiebreaks: [] };
}
