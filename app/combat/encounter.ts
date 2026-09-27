import type { Player } from "~/campaign/types";
import type { Rng } from "~/dice/rng";
import { rollText } from "~/dice/roll";
import { applyDamage, applyHealing, fullHp, gainTempHp, setMaxHp } from "./hp";
import { newId } from "~/shared/ids";
import { awaitingReroll, placeCombatant, sortByInitiative } from "./initiative";
import { firstTurn, nextTurn, previousTurn } from "./turns";
import type {
  Combatant,
  CombatantId,
  Condition,
  CreatureOption,
  Encounter,
  MonsterCombatant,
  PlayerCombatant,
  StatblockRef,
} from "./types";

/**
 * Everything that can happen to an encounter. Actions are plain data and carry any dice results,
 * so the reducer is pure: the same actions always give the same encounter. That keeps it easy to
 * test, and lets a server run the same reducer when encounters are shared with players.
 */
export type EncounterAction =
  | { type: "addMonsters"; creature: MonsterSource; monsters: NewMonster[] }
  | {
      type: "addPlayerCombatant";
      id: CombatantId;
      name: string;
      controller: Player;
      entityId?: string;
      statblock?: StatblockRef;
      initiative?: number | null;
    }
  | { type: "remove"; id: CombatantId }
  | { type: "setInitiative"; id: CombatantId; initiative: number | null }
  /** Monsters' d20 faces; each monster's bonus is added. */
  | { type: "rollInitiatives"; rolls: { id: CombatantId; roll: number }[] }
  | { type: "recordTiebreaks"; rolls: { id: CombatantId; roll: number }[] }
  | { type: "move"; id: CombatantId; offset: -1 | 1 }
  | { type: "start" }
  | { type: "nextTurn" }
  | { type: "previousTurn" }
  | { type: "damage" | "heal" | "gainTempHp" | "setMaxHp"; id: CombatantId; amount: number }
  /** Back to full health with a new maximum, e.g. after rerolling a prepared monster's HP. */
  | { type: "resetHp"; id: CombatantId; maxHp: number }
  | { type: "toggleCondition"; id: CombatantId; condition: Condition }
  | { type: "setNote"; id: CombatantId; note: string };

type MonsterSource = Pick<CreatureOption, "ref" | "name" | "armorClass" | "initiativeBonus">;

interface NewMonster {
  id: CombatantId;
  maxHp: number;
  /** The d20 face; the statblock's bonus is added when the monster joins. Null when preparing. */
  initiativeRoll: number | null;
}

export function createEncounter(id: string = newId()): Encounter {
  return { schemaVersion: 1, id, phase: "setup", round: 0, activeId: null, combatants: [] };
}

export function encounterReducer(state: Encounter, action: EncounterAction): Encounter {
  switch (action.type) {
    case "addMonsters": {
      const { creature } = action;
      let number = highestNumber(state.combatants, creature.name);
      const added = action.monsters.map((monster): MonsterCombatant => ({
        kind: "monster",
        id: monster.id,
        name: `${creature.name} ${++number}`,
        initiative:
          monster.initiativeRoll === null
            ? null
            : monster.initiativeRoll + creature.initiativeBonus,
        tiebreaks: [],
        conditions: [],
        note: "",
        ...joined(state),
        statblock: creature.ref,
        initiativeBonus: creature.initiativeBonus,
        armorClass: creature.armorClass,
        hp: fullHp(monster.maxHp),
      }));
      return arrange(
        state,
        [...state.combatants, ...added],
        added.map((c) => c.id),
      );
    }

    case "addPlayerCombatant": {
      const added: PlayerCombatant = {
        kind: "player",
        id: action.id,
        name: action.name.trim() || "Unnamed",
        initiative: action.initiative ?? null,
        tiebreaks: [],
        conditions: [],
        note: "",
        ...joined(state),
        controller: action.controller,
        entityId: action.entityId,
        statblock: action.statblock,
      };
      return arrange(state, [...state.combatants, added], [added.id]);
    }

    case "remove": {
      let { activeId, round } = state;
      if (state.phase === "active" && action.id === activeId) {
        // Their turn ends: play passes to whoever is next, starting a new round if it wraps.
        ({ activeId, round } = nextTurn(state.combatants, state));
        if (activeId === action.id) activeId = null;
      }
      const combatants = state.combatants.filter((c) => c.id !== action.id);
      return { ...state, activeId, round, combatants };
    }

    case "setInitiative": {
      const combatants = update(state.combatants, action.id, (c) => ({
        ...c,
        initiative: action.initiative,
        tiebreaks: [],
      }));
      return arrange(state, combatants, [action.id]);
    }

    case "rollInitiatives": {
      const rolls = new Map(action.rolls.map(({ id, roll }) => [id, roll]));
      const combatants = state.combatants.map((c) => {
        const roll = rolls.get(c.id);
        return c.kind === "monster" && roll !== undefined
          ? { ...c, initiative: roll + c.initiativeBonus, tiebreaks: [] }
          : c;
      });
      return arrange(state, combatants, [...rolls.keys()]);
    }

    case "recordTiebreaks": {
      let combatants = state.combatants;
      for (const { id, roll } of action.rolls) {
        combatants = update(combatants, id, (c) => ({ ...c, tiebreaks: [...c.tiebreaks, roll] }));
      }
      // Mid-fight, only newcomers move: the settled order isn't reshuffled by their tie-break.
      const moved = action.rolls
        .map((r) => r.id)
        .filter((id) => combatants.find((c) => c.id === id)?.joinedRound !== undefined);
      return arrange(state, combatants, moved);
    }

    case "move": {
      const from = state.combatants.findIndex((c) => c.id === action.id);
      const to = from + action.offset;
      if (from === -1 || to < 0 || to >= state.combatants.length) return state;
      const combatants = [...state.combatants];
      [combatants[from], combatants[to]] = [combatants[to], combatants[from]];
      return { ...state, combatants };
    }

    case "start":
      if (state.phase !== "setup" || startBlockers(state).length > 0) return state;
      return { ...state, phase: "active", ...firstTurn(state.combatants) };

    case "nextTurn":
      return state.phase === "active" ? { ...state, ...nextTurn(state.combatants, state) } : state;

    case "previousTurn":
      return state.phase === "active"
        ? { ...state, ...previousTurn(state.combatants, state) }
        : state;

    case "damage":
    case "heal":
    case "gainTempHp":
    case "setMaxHp": {
      const change = { damage: applyDamage, heal: applyHealing, gainTempHp, setMaxHp }[action.type];
      return {
        ...state,
        combatants: update(state.combatants, action.id, (c) =>
          c.kind === "monster" ? { ...c, hp: change(c.hp, action.amount) } : c,
        ),
      };
    }

    case "resetHp":
      return {
        ...state,
        combatants: update(state.combatants, action.id, (c) =>
          c.kind === "monster" ? { ...c, hp: fullHp(action.maxHp) } : c,
        ),
      };

    case "toggleCondition":
      return {
        ...state,
        combatants: update(state.combatants, action.id, (c) => ({
          ...c,
          conditions: c.conditions.includes(action.condition)
            ? c.conditions.filter((condition) => condition !== action.condition)
            : [...c.conditions, action.condition],
        })),
      };

    case "setNote":
      return {
        ...state,
        combatants: update(state.combatants, action.id, (c) => ({ ...c, note: action.note })),
      };
  }
}

/** A guard against a broken Rng that ties forever. Real dice tie 10 times in a row ~never. */
export const MAX_AUTOMATIC_REROLL_ROUNDS = 10;

/**
 * Applies an action, then rerolls any monsters stuck in a tie until only player rerolls (which the
 * DM types in) are left. One user action, so one undo step.
 */
export function perform(state: Encounter, action: EncounterAction, rng: Rng): Encounter {
  let next = encounterReducer(state, action);
  for (let round = 0; round < MAX_AUTOMATIC_REROLL_ROUNDS; round++) {
    const rolls = awaitingReroll(next.combatants)
      .filter((c) => c.kind === "monster")
      .map((c) => ({ id: c.id, roll: rng(20) }));
    if (rolls.length === 0) break;
    next = encounterReducer(next, { type: "recordTiebreaks", rolls });
  }
  return next;
}

type HpSource = Pick<CreatureOption, "hitDice" | "hitPoints">;

/**
 * Rolls for new monsters: for each in turn, its initiative d20 (unless preparing, when
 * initiative waits until the fight starts), then its hit dice. Max HP is the DM's `maxHp` if
 * given, else rolled from the statblock's hit dice (at least 1), else the statblock's average HP,
 * else 1.
 */
export function addMonsters(
  creature: MonsterSource & HpSource,
  quantity: number,
  rng: Rng,
  options: { maxHp?: number; rollInitiative?: boolean; createId?: () => string } = {},
): EncounterAction {
  const createId = options.createId ?? newId;
  const monsters = Array.from({ length: Math.max(1, Math.floor(quantity)) }, () => {
    const initiativeRoll = options.rollInitiative === false ? null : rng(20);
    return { id: createId(), initiativeRoll, maxHp: options.maxHp ?? rollMaxHp(creature, rng) };
  });
  const { ref, name, armorClass, initiativeBonus } = creature;
  return {
    type: "addMonsters",
    creature: { ref, name, armorClass, initiativeBonus },
    monsters,
  };
}

/** Fresh HP for one monster, rolled the same way as when it was added. */
export function rerollHp(creature: HpSource, id: CombatantId, rng: Rng): EncounterAction {
  return { type: "resetHp", id, maxHp: rollMaxHp(creature, rng) };
}

/** A d20 for every monster that has no initiative yet, in turn order. */
export function rollMonsterInitiatives(state: Encounter, rng: Rng): EncounterAction {
  return {
    type: "rollInitiatives",
    rolls: state.combatants
      .filter((c) => c.kind === "monster" && c.initiative === null)
      .map((c) => ({ id: c.id, roll: rng(20) })),
  };
}

function rollMaxHp(creature: HpSource, rng: Rng): number {
  const rolled = creature.hitDice ? rollText(creature.hitDice, rng) : undefined;
  if (rolled?.ok) return Math.max(1, rolled.result.total);
  return creature.hitPoints ?? 1;
}

/** What stops combat from starting: missing initiative, or a player who must reroll a tie. */
export function startBlockers(state: Encounter): Combatant[] {
  const waiting = new Set(awaitingReroll(state.combatants).map((c) => c.id));
  return state.combatants.filter(
    (c) => c.initiative === null || (c.kind === "player" && waiting.has(c.id)),
  );
}

/** Setup keeps everyone sorted; mid-fight only the changed combatants are (re)placed. */
function arrange(state: Encounter, combatants: Combatant[], changed: CombatantId[]): Encounter {
  if (state.phase === "setup") return { ...state, combatants: sortByInitiative(combatants) };
  return { ...state, combatants: changed.reduce(placeCombatant, combatants) };
}

function joined(state: Encounter): { joinedRound?: number } {
  return state.phase === "active" ? { joinedRound: state.round } : {};
}

function update(
  combatants: Combatant[],
  id: CombatantId,
  change: (combatant: Combatant) => Combatant,
): Combatant[] {
  return combatants.map((c) => (c.id === id ? change(c) : c));
}

/** The highest N among combatants called "`base` N", so new monsters continue the numbering. */
function highestNumber(combatants: readonly Combatant[], base: string): number {
  return combatants.reduce((highest, c) => {
    const match = /^(.*) (\d+)$/.exec(c.name);
    return match && match[1] === base ? Math.max(highest, Number(match[2])) : highest;
  }, 0);
}
