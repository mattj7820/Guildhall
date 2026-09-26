import { describe, expect, it } from "vitest";
import { sequenceRng } from "~/dice/rng";
import {
  addMonsters,
  createEncounter,
  encounterReducer,
  MAX_AUTOMATIC_REROLL_ROUNDS,
  perform,
  startBlockers,
  type EncounterAction,
} from "./encounter";
import { encounter, idSequence, inCombat, monster, names, player } from "./test-builders";
import type { Encounter, MonsterCombatant } from "./types";

const minion = {
  ref: { entityId: "Bestiary/Fixture Minion", name: "Fixture Minion" },
  name: "Fixture Minion",
  armorClass: 13,
  hitPoints: 7,
  hitDice: "2d6",
  initiativeBonus: 2,
};

/** Applies actions with no randomness needed; a stray roll fails the test. */
const apply = (state: Encounter, ...actions: EncounterAction[]) =>
  actions.reduce((s, action) => perform(s, action, sequenceRng([])), state);

const byName = (state: Encounter, name: string) => state.combatants.find((c) => c.name === name)!;
const hpOf = (state: Encounter, name: string) => (byName(state, name) as MonsterCombatant).hp;

describe("adding monsters", () => {
  it("numbers them, rolls initiative with the DEX bonus, and rolls HP from hit dice", () => {
    // Per monster: initiative d20, then 2d6 hit dice.
    const rng = sequenceRng([10, 3, 4, 5, 6, 6]);
    const state = perform(createEncounter(), addMonsters(minion, 2, rng), rng);
    expect(state.combatants).toMatchObject([
      { name: "Fixture Minion 1", initiative: 12, hp: { current: 7, max: 7, temp: 0 } },
      { name: "Fixture Minion 2", initiative: 7, hp: { current: 12, max: 12, temp: 0 } },
    ]);
    expect(state.combatants[0]).toMatchObject({ armorClass: 13, statblock: minion.ref });
  });

  it("continues the numbering when more of the same monster join", () => {
    let state = apply(createEncounter(), addMonsters(minion, 2, sequenceRng([10, 1, 1, 9, 1, 1])));
    state = apply(state, addMonsters(minion, 1, sequenceRng([5, 1, 1])));
    expect(names(state).sort()).toEqual([
      "Fixture Minion 1",
      "Fixture Minion 2",
      "Fixture Minion 3",
    ]);
  });

  it("uses the DM's HP instead of rolling when given", () => {
    const action = addMonsters(minion, 1, sequenceRng([10]), { maxHp: 30 });
    expect(hpOf(apply(createEncounter(), action), "Fixture Minion 1").max).toBe(30);
  });

  it("falls back to the statblock's average HP without hit dice", () => {
    const action = addMonsters({ ...minion, hitDice: undefined }, 1, sequenceRng([10]));
    expect(hpOf(apply(createEncounter(), action), "Fixture Minion 1").max).toBe(7);
  });

  it("never rolls less than 1 HP", () => {
    const action = addMonsters({ ...minion, hitDice: "1d4 − 5" }, 1, sequenceRng([10, 2]));
    expect(hpOf(apply(createEncounter(), action), "Fixture Minion 1").max).toBe(1);
  });

  it("gives each monster a fresh ID", () => {
    const action = addMonsters(minion, 2, sequenceRng([1, 1, 1, 2, 1, 1]), {
      createId: idSequence("goblin"),
    });
    expect(
      apply(createEncounter(), action)
        .combatants.map((c) => c.id)
        .sort(),
    ).toEqual(["goblin-1", "goblin-2"]);
  });
});

describe("initiative during setup", () => {
  it("keeps everyone sorted as initiatives come in", () => {
    let state = encounter([monster("Goblin", { initiative: 12 }), player("Aria")]);
    state = apply(state, { type: "setInitiative", id: "Aria", initiative: 17 });
    expect(names(state)).toEqual(["Aria", "Goblin"]);
  });

  it("rerolls monster-only ties automatically, as often as they keep tying", () => {
    const state = perform(
      encounter([monster("A", { initiative: 9 }), monster("B", { initiative: 12 })]),
      { type: "setInitiative", id: "A", initiative: 12 },
      // First rerolls tie (7, 7), the second pair differs (3, 18).
      sequenceRng([7, 7, 3, 18]),
    );
    expect(names(state)).toEqual(["B", "A"]);
    expect(startBlockers(state)).toEqual([]);
  });

  it("rerolls the monster and waits for the player's reroll in a monster-player tie", () => {
    const state = perform(
      encounter([monster("Goblin", { initiative: 14 }), player("Aria")]),
      { type: "setInitiative", id: "Aria", initiative: 14 },
      sequenceRng([11]),
    );
    expect(byName(state, "Goblin").tiebreaks).toEqual([11]);
    expect(names(startBlockers(state))).toEqual(["Aria"]);
  });

  it("goes round again when the player's reroll ties the monster's", () => {
    let state = encounter([
      monster("Goblin", { initiative: 14, tiebreaks: [11] }),
      player("Aria", { initiative: 14 }),
    ]);
    state = perform(
      state,
      { type: "recordTiebreaks", rolls: [{ id: "Aria", roll: 11 }] },
      sequenceRng([4]),
    );
    expect(byName(state, "Goblin").tiebreaks).toEqual([11, 4]);
    expect(names(startBlockers(state))).toEqual(["Aria"]);

    state = apply(state, { type: "recordTiebreaks", rolls: [{ id: "Aria", roll: 9 }] });
    expect(names(state)).toEqual(["Aria", "Goblin"]);
    expect(startBlockers(state)).toEqual([]);
  });

  it("resolves a three-way tie, rerolling only those still level", () => {
    let state = perform(
      encounter([
        monster("A", { initiative: 15 }),
        monster("B", { initiative: 15 }),
        player("C", { initiative: 3 }),
      ]),
      { type: "setInitiative", id: "C", initiative: 15 },
      sequenceRng([15, 10]),
    );
    // A and B rerolled; C still has to.
    expect(names(startBlockers(state))).toEqual(["C"]);

    // C ties A on 15, so A rerolls automatically and C must roll again. B is settled last.
    state = perform(
      state,
      { type: "recordTiebreaks", rolls: [{ id: "C", roll: 15 }] },
      sequenceRng([6]),
    );
    expect(names(startBlockers(state))).toEqual(["C"]);
    expect(byName(state, "B").tiebreaks).toEqual([10]);

    state = apply(state, { type: "recordTiebreaks", rolls: [{ id: "C", roll: 20 }] });
    expect(names(state)).toEqual(["C", "A", "B"]);
  });

  it("stops rerolling after a fixed number of rounds if the dice always tie", () => {
    const alwaysTies = sequenceRng(Array(2 * MAX_AUTOMATIC_REROLL_ROUNDS).fill(5));
    const state = perform(
      encounter([monster("A", { initiative: 1 }), monster("B", { initiative: 7 })]),
      { type: "setInitiative", id: "A", initiative: 7 },
      alwaysTies,
    );
    expect(byName(state, "A").tiebreaks).toHaveLength(MAX_AUTOMATIC_REROLL_ROUNDS);
    // The DM can still start and order them by hand.
    expect(startBlockers(state)).toEqual([]);
  });

  it("clears a combatant's old tie-breaks when their initiative changes", () => {
    const state = apply(encounter([monster("A", { initiative: 15, tiebreaks: [3] })]), {
      type: "setInitiative",
      id: "A",
      initiative: 16,
    });
    expect(byName(state, "A").tiebreaks).toEqual([]);
  });

  it("can't start until everyone has an initiative", () => {
    const state = encounter([monster("Goblin", { initiative: 10 }), player("Aria")]);
    expect(names(startBlockers(state))).toEqual(["Aria"]);
    expect(apply(state, { type: "start" })).toEqual(state);
  });

  it("starts in round 1 with the first combatant", () => {
    const state = apply(
      encounter([player("Aria", { initiative: 17 }), monster("Goblin", { initiative: 10 })]),
      { type: "start" },
    );
    expect(state).toMatchObject({ phase: "active", round: 1, activeId: "Aria" });
  });
});

describe("changing the order by hand", () => {
  const three = () =>
    encounter([
      monster("A", { initiative: 15 }),
      monster("B", { initiative: 10 }),
      monster("C", { initiative: 5 }),
    ]);

  it("moves a combatant up or down one place", () => {
    expect(names(apply(three(), { type: "move", id: "C", offset: -1 }))).toEqual(["A", "C", "B"]);
    expect(names(apply(three(), { type: "move", id: "A", offset: 1 }))).toEqual(["B", "A", "C"]);
  });

  it("does nothing past either end", () => {
    expect(names(apply(three(), { type: "move", id: "A", offset: -1 }))).toEqual(["A", "B", "C"]);
    expect(names(apply(three(), { type: "move", id: "C", offset: 1 }))).toEqual(["A", "B", "C"]);
  });
});

describe("joining mid-fight", () => {
  it("places a newcomer by initiative without undoing the DM's reordering", () => {
    // The DM moved C above B by hand.
    const state = inCombat(
      [
        monster("A", { initiative: 15 }),
        monster("C", { initiative: 5 }),
        monster("B", { initiative: 10 }),
      ],
      "A",
      2,
    );
    const after = apply(state, {
      type: "addPlayerCombatant",
      id: "Late",
      name: "Late",
      controller: { id: "player one", name: "Player One" },
      initiative: 12,
    });
    expect(names(after)).toEqual(["A", "Late", "C", "B"]);
    expect(byName(after, "Late").joinedRound).toBe(2);
    expect(after.activeId).toBe("A");
  });

  it("breaks a tie by rerolling, moving only the newcomer", () => {
    // The DM ordered A before B at the start without a reroll. Newcomer N ties them on 12, so all
    // three reroll: A 5, B 18, N 20. N goes first; B beats A on the reroll but doesn't move.
    const state = inCombat(
      [monster("A", { initiative: 12 }), monster("B", { initiative: 12 })],
      "A",
    );
    const after = perform(
      state,
      addMonsters({ ...minion, name: "N", initiativeBonus: 0 }, 1, sequenceRng([12, 1, 1]), {
        createId: () => "N",
      }),
      sequenceRng([5, 18, 20]),
    );
    expect(names(after)).toEqual(["N 1", "A", "B"]);
  });

  it("waits at the end of the order until a player's initiative is entered", () => {
    const state = inCombat([monster("A", { initiative: 12 })], "A");
    let after = apply(state, {
      type: "addPlayerCombatant",
      id: "Late",
      name: "Late",
      controller: { id: "player one", name: "Player One" },
    });
    expect(names(after)).toEqual(["A", "Late"]);
    after = apply(after, { type: "setInitiative", id: "Late", initiative: 20 });
    expect(names(after)).toEqual(["Late", "A"]);
  });
});

describe("removing combatants", () => {
  const fight = (activeId: string) =>
    inCombat([monster("A"), monster("B"), monster("C")], activeId, 2);

  it("keeps the current turn when someone else leaves", () => {
    expect(apply(fight("B"), { type: "remove", id: "A" })).toMatchObject({
      activeId: "B",
      round: 2,
    });
  });

  it("passes the turn on when the active combatant leaves", () => {
    expect(apply(fight("B"), { type: "remove", id: "B" })).toMatchObject({
      activeId: "C",
      round: 2,
    });
  });

  it("starts the next round when the last in the order leaves on their turn", () => {
    expect(apply(fight("C"), { type: "remove", id: "C" })).toMatchObject({
      activeId: "A",
      round: 3,
    });
  });

  it("leaves no one active when the last combatant leaves", () => {
    const state = inCombat([monster("A")], "A");
    expect(apply(state, { type: "remove", id: "A" })).toMatchObject({
      activeId: null,
      combatants: [],
    });
  });
});

describe("hit points, conditions and notes", () => {
  it("applies damage, healing and temporary HP to monsters", () => {
    let state = encounter([monster("Goblin", { hp: { current: 10, max: 10, temp: 0 } })]);
    state = apply(
      state,
      { type: "gainTempHp", id: "Goblin", amount: 3 },
      { type: "damage", id: "Goblin", amount: 5 },
    );
    expect(hpOf(state, "Goblin")).toEqual({ current: 8, max: 10, temp: 0 });
    state = apply(state, { type: "heal", id: "Goblin", amount: 1 });
    expect(hpOf(state, "Goblin").current).toBe(9);
  });

  it("ignores HP changes for player combatants", () => {
    const state = encounter([player("Aria")]);
    expect(apply(state, { type: "damage", id: "Aria", amount: 5 })).toEqual(state);
  });

  it("toggles conditions on any combatant", () => {
    let state = encounter([player("Aria")]);
    state = apply(
      state,
      { type: "toggleCondition", id: "Aria", condition: "prone" },
      { type: "toggleCondition", id: "Aria", condition: "poisoned" },
      { type: "toggleCondition", id: "Aria", condition: "prone" },
    );
    expect(byName(state, "Aria").conditions).toEqual(["poisoned"]);
  });

  it("keeps a short note", () => {
    const state = apply(encounter([player("Aria")]), {
      type: "setNote",
      id: "Aria",
      note: "Fixture note",
    });
    expect(byName(state, "Aria").note).toBe("Fixture note");
  });
});

describe("encounterReducer", () => {
  it("never mutates the previous state", () => {
    const state = encounter([monster("Goblin", { initiative: 3 }), player("Aria")]);
    const snapshot = structuredClone(state);
    encounterReducer(state, { type: "setInitiative", id: "Aria", initiative: 20 });
    encounterReducer(state, { type: "damage", id: "Goblin", amount: 4 });
    encounterReducer(state, { type: "toggleCondition", id: "Aria", condition: "prone" });
    expect(state).toEqual(snapshot);
  });
});
