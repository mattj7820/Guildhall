/** Builders for combat unit tests: each test states only the fields it cares about. */
import { createEncounter } from "./encounter";
import type { Combatant, Encounter, MonsterCombatant, PlayerCombatant } from "./types";

export function monster(
  name: string,
  overrides: Partial<Omit<MonsterCombatant, "kind">> = {},
): MonsterCombatant {
  return {
    kind: "monster",
    id: name,
    name,
    initiative: null,
    tiebreaks: [],
    conditions: [],
    note: "",
    statblock: { entityId: `Bestiary/${name}`, name },
    initiativeBonus: 0,
    hp: { current: 10, max: 10, temp: 0 },
    ...overrides,
  };
}

export function player(
  name: string,
  overrides: Partial<Omit<PlayerCombatant, "kind">> = {},
): PlayerCombatant {
  return {
    kind: "player",
    id: name,
    name,
    initiative: null,
    tiebreaks: [],
    conditions: [],
    note: "",
    controller: { id: "player one", name: "Player One" },
    ...overrides,
  };
}

export function encounter(combatants: Combatant[], overrides: Partial<Encounter> = {}): Encounter {
  return { ...createEncounter("test-encounter"), combatants, ...overrides };
}

/** An encounter already in round `round`, with `activeId` taking their turn. */
export function inCombat(combatants: Combatant[], activeId: string, round = 1): Encounter {
  return encounter(combatants, { phase: "active", round, activeId });
}

export const names = (state: Encounter | Combatant[]) =>
  (Array.isArray(state) ? state : state.combatants).map((c) => c.name);

/** Sequential IDs, so tests can refer to added combatants. */
export function idSequence(prefix = "id") {
  let next = 0;
  return () => `${prefix}-${++next}`;
}
