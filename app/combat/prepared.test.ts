import { describe, expect, it } from "vitest";
import { sequenceRng } from "~/dice/rng";
import { addMonsters, createEncounter, perform, rerollHp } from "./encounter";
import {
  startPrepared,
  startPreparedOnMap,
  summarise,
  toPrepared,
  type PartyChoice,
} from "./prepared";
import { encounter, idSequence, inCombat, monster, names, player } from "./test-builders";
import type { MonsterCombatant, PreparedEncounter } from "./types";

const minion = {
  ref: { entityId: "Bestiary/Fixture Minion", name: "Fixture Minion" },
  name: "Fixture Minion",
  armorClass: 13,
  hitPoints: 7,
  hitDice: "2d6",
  initiativeBonus: 2,
};

const sam = { id: "sam", name: "Sam" };
const jo = { id: "jo", name: "Jo" };

const party: PartyChoice[] = [
  { kind: "pc", entityId: "Party/Aria", name: "Aria", noteUrl: "/wiki/Party/Aria", player: sam },
  { kind: "pc", entityId: "Party/Brim", name: "Brim", noteUrl: "/wiki/Party/Brim", player: jo },
];

function prepared(combatants: PreparedEncounter["encounter"]["combatants"]): PreparedEncounter {
  return {
    id: "prep-1",
    name: "Mill ambush",
    notes: "",
    createdAt: "2026-09-26T18:00:00.000Z",
    updatedAt: "2026-09-26T18:00:00.000Z",
    encounter: encounter(combatants),
  };
}

describe("preparing monsters", () => {
  it("rolls HP but leaves initiative until the fight starts", () => {
    // Only the 2d6 hit dice are rolled.
    const rng = sequenceRng([3, 4]);
    const state = perform(
      createEncounter(),
      addMonsters(minion, 1, rng, { rollInitiative: false }),
      rng,
    );
    expect(state.combatants[0]).toMatchObject({
      name: "Fixture Minion 1",
      initiative: null,
      hp: { current: 7, max: 7, temp: 0 },
    });
  });

  it("rerolls one monster's HP, back to full health", () => {
    const state = encounter([monster("Goblin 1", { hp: { current: 2, max: 7, temp: 3 } })]);
    const rng = sequenceRng([6, 5]);
    const after = perform(state, rerollHp(minion, "Goblin 1", rng), rng);
    expect((after.combatants[0] as MonsterCombatant).hp).toEqual({ current: 11, max: 11, temp: 0 });
  });
});

describe("startPreparedOnMap", () => {
  it("puts the monsters where they were placed, by their new IDs", () => {
    const template: PreparedEncounter = {
      ...prepared([monster("Goblin 1"), monster("Goblin 2"), monster("Goblin 3")]),
      placement: {
        map: "mill",
        // Goblin 3 joined after the others were placed, and Goblin 9 has since been removed.
        at: { "Goblin 1": [0.1, 0.2], "Goblin 2": [0.3, 0.4], "Goblin 9": [0.5, 0.5] },
      },
    };
    const { encounter: started, placed } = startPreparedOnMap(
      template,
      [],
      sequenceRng([10, 15, 5]),
      idSequence("live"),
    );
    const idOf = (name: string) => started.combatants.find((c) => c.name === name)?.id;
    expect(placed).toEqual([
      { combatant: idOf("Goblin 1"), at: [0.1, 0.2] },
      { combatant: idOf("Goblin 2"), at: [0.3, 0.4] },
    ]);
    expect(placed.map((each) => each.combatant)).not.toContain("Goblin 1");
  });
});

describe("startPrepared", () => {
  const template = prepared([
    monster("Goblin 1", { initiativeBonus: 2, note: "Fixture note", conditions: ["invisible"] }),
    monster("Goblin 2", { initiativeBonus: 2 }),
    player("Blink Dog", { controller: sam, statblock: { entityId: "Bestiary/Dog", name: "Dog" } }),
  ]);

  it("rolls monster initiative and adds the chosen party, ready for player rolls", () => {
    const fight = startPrepared(template, party, sequenceRng([10, 15]), idSequence("live"));
    expect(fight).toMatchObject({ phase: "setup", round: 0, activeId: null });
    expect(names(fight)).toEqual(["Goblin 2", "Goblin 1", "Blink Dog", "Aria", "Brim"]);
    expect(fight.combatants.map((c) => c.initiative)).toEqual([17, 12, null, null, null]);
    expect(fight.combatants.find((c) => c.name === "Aria")).toMatchObject({
      kind: "player",
      entityId: "Party/Aria",
      controller: sam,
    });
  });

  it("keeps what was prepared: notes, conditions, HP and companions", () => {
    const fight = startPrepared(template, [], sequenceRng([10, 15]));
    expect(fight.combatants.find((c) => c.name === "Goblin 1")).toMatchObject({
      note: "Fixture note",
      conditions: ["invisible"],
      hp: { current: 10, max: 10, temp: 0 },
    });
    expect(fight.combatants.find((c) => c.name === "Blink Dog")).toMatchObject({
      controller: sam,
      statblock: { entityId: "Bestiary/Dog", name: "Dog" },
    });
  });

  it("leaves out party members who weren't chosen", () => {
    const fight = startPrepared(template, [party[1]], sequenceRng([10, 15]));
    expect(names(fight)).not.toContain("Aria");
    expect(names(fight)).toContain("Brim");
  });

  it("gives every combatant a fresh ID, and leaves the template untouched", () => {
    const before = structuredClone(template);
    const fight = startPrepared(template, party, sequenceRng([10, 15]), idSequence("live"));
    expect(fight.combatants.map((c) => c.id).every((id) => id.startsWith("live-"))).toBe(true);
    expect(fight.id).not.toBe(template.encounter.id);
    expect(template).toEqual(before);
  });

  it("breaks monster ties with automatic rerolls", () => {
    // Both goblins roll 10 (12 with DEX), then reroll 4 and 18.
    const fight = startPrepared(template, [], sequenceRng([10, 10, 4, 18]));
    expect(names(fight).slice(0, 2)).toEqual(["Goblin 2", "Goblin 1"]);
  });

  it("can start an encounter with no monsters", () => {
    const fight = startPrepared(prepared([]), party, sequenceRng([]));
    expect(names(fight)).toEqual(["Aria", "Brim"]);
  });
});

describe("toPrepared", () => {
  it("keeps monsters and companions, drops the party and every roll", () => {
    const setup = encounter([
      monster("Goblin 1", { initiative: 14, tiebreaks: [3], joinedRound: 2 }),
      player("Aria", { initiative: 12, entityId: "Party/Aria" }),
      player("Blink Dog", { initiative: 9, controller: sam }),
    ]);
    const template = toPrepared(setup);
    expect(names(template)).toEqual(["Goblin 1", "Blink Dog"]);
    expect(
      template.combatants.every((c) => c.initiative === null && c.tiebreaks.length === 0),
    ).toBe(true);
    expect(template.combatants[0]).not.toHaveProperty("joinedRound");
  });

  it("is always an unstarted fight", () => {
    const template = toPrepared(inCombat([monster("Goblin 1")], "Goblin 1", 3));
    expect(template).toMatchObject({ phase: "setup", round: 0, activeId: null });
  });
});

describe("summarise", () => {
  it("counts monsters by statblock and lists companions with their player", () => {
    const summary = summarise(
      encounter([
        monster("Goblin 1", { statblock: { entityId: "Bestiary/Goblin", name: "Goblin" } }),
        monster("Bugbear 1", { statblock: { entityId: "Bestiary/Bugbear", name: "Bugbear" } }),
        monster("Goblin 2", { statblock: { entityId: "Bestiary/Goblin", name: "Goblin" } }),
        player("Blink Dog", { controller: sam }),
      ]),
    );
    expect(summary).toEqual({ monsters: "2× Goblin, 1× Bugbear", companions: "Blink Dog (Sam)" });
  });

  it("is empty for an empty encounter", () => {
    expect(summarise(encounter([]))).toEqual({ monsters: "", companions: "" });
  });
});
