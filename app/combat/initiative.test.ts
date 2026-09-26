import { describe, expect, it } from "vitest";
import { awaitingReroll, pendingTies, placeCombatant, sortByInitiative } from "./initiative";
import { monster, names, player } from "./test-builders";

const waiting = (combatants: Parameters<typeof awaitingReroll>[0]) =>
  names(awaitingReroll(combatants));

describe("sortByInitiative", () => {
  it("puts the highest initiative first", () => {
    const sorted = sortByInitiative([
      monster("Low", { initiative: 3 }),
      player("High", { initiative: 19 }),
      monster("Mid", { initiative: 11 }),
    ]);
    expect(names(sorted)).toEqual(["High", "Mid", "Low"]);
  });

  it("puts combatants without an initiative last", () => {
    const sorted = sortByInitiative([player("Unrolled"), monster("Rolled", { initiative: 1 })]);
    expect(names(sorted)).toEqual(["Rolled", "Unrolled"]);
  });

  it("orders a broken tie by the rerolls, then by later rerolls", () => {
    const sorted = sortByInitiative([
      monster("A", { initiative: 15, tiebreaks: [8] }),
      monster("B", { initiative: 15, tiebreaks: [12, 3] }),
      monster("C", { initiative: 15, tiebreaks: [12, 17] }),
    ]);
    expect(names(sorted)).toEqual(["C", "B", "A"]);
  });

  it("keeps an unresolved tie in its current order", () => {
    const sorted = sortByInitiative([
      monster("First", { initiative: 12 }),
      player("Second", { initiative: 12 }),
    ]);
    expect(names(sorted)).toEqual(["First", "Second"]);
  });
});

describe("pendingTies", () => {
  it("finds nothing when every initiative differs", () => {
    expect(
      pendingTies([monster("A", { initiative: 10 }), monster("B", { initiative: 9 })]),
    ).toEqual([]);
  });

  it("ignores combatants who haven't rolled initiative", () => {
    expect(pendingTies([player("A"), player("B")])).toEqual([]);
  });

  it("asks everyone in a tie to reroll", () => {
    const ties = pendingTies([
      monster("Goblin", { initiative: 14 }),
      player("Aria", { initiative: 14 }),
      monster("Other", { initiative: 9 }),
    ]);
    expect(ties).toHaveLength(1);
    expect(ties[0].initiative).toBe(14);
    expect(names(ties[0].waitingFor)).toEqual(["Goblin", "Aria"]);
  });

  it("waits only for those who haven't rerolled yet", () => {
    expect(
      waiting([
        monster("Goblin", { initiative: 14, tiebreaks: [11] }),
        player("Aria", { initiative: 14 }),
      ]),
    ).toEqual(["Aria"]);
  });

  it("is resolved once the rerolls differ", () => {
    expect(
      waiting([
        monster("Goblin", { initiative: 14, tiebreaks: [11] }),
        player("Aria", { initiative: 14, tiebreaks: [6] }),
      ]),
    ).toEqual([]);
  });

  it("asks for another reroll when the rerolls tie again", () => {
    expect(
      waiting([
        monster("Goblin", { initiative: 14, tiebreaks: [11] }),
        player("Aria", { initiative: 14, tiebreaks: [11] }),
      ]),
    ).toEqual(["Goblin", "Aria"]);
  });

  it("in a three-way tie, rerolls again only for those still level", () => {
    const combatants = [
      monster("A", { initiative: 15, tiebreaks: [15] }),
      monster("B", { initiative: 15, tiebreaks: [10] }),
      player("C", { initiative: 15, tiebreaks: [15] }),
    ];
    expect(waiting(combatants)).toEqual(["A", "C"]);
  });

  it("settles separate ties independently", () => {
    expect(
      waiting([
        monster("A", { initiative: 15 }),
        monster("B", { initiative: 15 }),
        monster("C", { initiative: 8, tiebreaks: [2] }),
        player("D", { initiative: 8 }),
      ]),
    ).toEqual(["A", "B", "D"]);
  });

  it("has a newcomer to a settled tie roll against the rerolls on record", () => {
    expect(
      waiting([
        monster("A", { initiative: 15, tiebreaks: [12] }),
        monster("B", { initiative: 15, tiebreaks: [8] }),
        player("Newcomer", { initiative: 15 }),
      ]),
    ).toEqual(["Newcomer"]);
  });
});

describe("placeCombatant", () => {
  it("moves one combatant into initiative position without reordering the rest", () => {
    // The DM moved Slow ahead of Mid by hand; placing the newcomer mustn't undo that.
    const combatants = [
      monster("Fast", { initiative: 18 }),
      monster("Slow", { initiative: 5 }),
      monster("Mid", { initiative: 9 }),
      monster("Newcomer", { initiative: 12 }),
    ];
    expect(names(placeCombatant(combatants, "Newcomer"))).toEqual([
      "Fast",
      "Newcomer",
      "Slow",
      "Mid",
    ]);
  });

  it("goes after everyone it doesn't beat, including unresolved ties", () => {
    const combatants = [
      monster("A", { initiative: 12 }),
      monster("Newcomer", { initiative: 12 }),
      monster("B", { initiative: 12 }),
    ];
    expect(names(placeCombatant(combatants, "Newcomer"))).toEqual(["A", "B", "Newcomer"]);
  });

  it("goes to the end without an initiative", () => {
    const combatants = [player("Newcomer"), monster("A", { initiative: 3 })];
    expect(names(placeCombatant(combatants, "Newcomer"))).toEqual(["A", "Newcomer"]);
  });
});
