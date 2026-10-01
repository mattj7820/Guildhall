import { describe, expect, it } from "vitest";
import { DM_VIEWER, PLAYER_VIEWER, type Viewer } from "~/campaign/types";
import { fightForViewer, isTheirTurn, type Fight } from "./fight";
import { encounter, inCombat, monster, player } from "./test-builders";
import { WHOLE_PARTY } from "./types";

const one = { id: "player one", name: "Player One" };
const two = { id: "player two", name: "Player Two" };
const playerOne: Viewer = { role: "player", playerId: "player one" };

const combatants = [
  player("Aria", { controller: one, initiative: 18 }),
  player("Brim", { controller: two, initiative: 14 }),
  player("Blink Dog", { controller: WHOLE_PARTY, initiative: 12 }),
  monster("Goblin 1", { initiative: 9, note: "DM secret" }),
];
const fightOn = (activeName: string): Fight => ({
  encounter: inCombat(combatants, activeName),
  revision: 3,
  map: "cave",
});

describe("fightForViewer", () => {
  it("gives the DM the whole encounter and its revision", () => {
    const fight = fightOn("Aria");
    expect(fightForViewer(fight, DM_VIEWER)).toEqual({
      forDm: true,
      encounter: fight.encounter,
      revision: 3,
      map: "cave",
    });
  });

  it("gives players only their view: no HP, initiative or DM notes", () => {
    const view = fightForViewer(fightOn("Goblin 1"), playerOne);
    expect(view.forDm).toBe(false);
    const text = JSON.stringify(view);
    expect(text).not.toContain("DM secret");
    expect(text).not.toContain('"hp"');
    expect(text).not.toContain('"initiative"');
    expect(text).not.toContain('"revision"');
  });
});

describe("isTheirTurn", () => {
  it.each([
    ["their own PC's turn", "Aria", playerOne, true],
    ["another player's turn", "Brim", playerOne, false],
    ["a monster's turn", "Goblin 1", playerOne, false],
    ["the shared companion's turn, for any player", "Blink Dog", playerOne, true],
    [
      "the shared companion's turn, even for a player assigned no one",
      "Blink Dog",
      PLAYER_VIEWER,
      true,
    ],
    ["a PC's turn, for a player assigned no one", "Aria", PLAYER_VIEWER, false],
  ])("is %s", (_name, active, viewer, expected) => {
    expect(isTheirTurn(fightOn(active).encounter, viewer)).toBe(expected);
  });

  it("is never so while the fight is being set up", () => {
    expect(isTheirTurn(encounter(combatants), playerOne)).toBe(false);
  });
});
