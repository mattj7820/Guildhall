import type { Player } from "~/campaign/types";
import type { Rng } from "~/dice/rng";
import { createEncounter, perform, rollMonsterInitiatives } from "./encounter";
import { newId } from "~/shared/ids";
import type { Combatant, Encounter, PartyMember, PreparedEncounter } from "./types";

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
  let state: Encounter = {
    ...createEncounter(createId()),
    combatants: prepared.encounter.combatants.map((c) => ({ ...unrolled(c), id: createId() })),
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
  return perform(state, rollMonsterInitiatives(state, rng), rng);
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- dropping joinedRound
  const { joinedRound, ...rest } = combatant;
  return { ...rest, initiative: null, tiebreaks: [] };
}
