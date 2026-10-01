import { describe, expect, it } from "vitest";
import { DM_VIEWER, PLAYER_VIEWER, type Viewer } from "~/campaign/types";
import { fightAllowsMove, fightForViewer, isTheirTurn, type Fight } from "./fight";
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

describe("fightAllowsMove", () => {
  const party = [
    player("Aria", { controller: one, entityId: "Party/Aria", initiative: 18 }),
    player("Brim", { controller: two, entityId: "Party/Brim", initiative: 14 }),
    monster("Goblin 1", { initiative: 9 }),
  ];
  const fight = (active: string, more: Partial<Fight> = {}): Fight => ({
    encounter: inCombat(party, active),
    revision: 1,
    map: "cave",
    ...more,
  });

  it("lets players move someone in the fight only on their turn", () => {
    expect(fightAllowsMove(fight("Aria"), "cave", "Party/Aria", playerOne)).toBe(true);
    expect(fightAllowsMove(fight("Brim"), "cave", "Party/Aria", playerOne)).toBe(false);
    expect(fightAllowsMove(fight("Goblin 1"), "cave", "Party/Aria", playerOne)).toBe(false);
  });

  it("lets the DM move anyone, any time", () => {
    expect(fightAllowsMove(fight("Goblin 1"), "cave", "Party/Aria", DM_VIEWER)).toBe(true);
  });

  it("doesn't hold back free movement, other maps, those not fighting, or a fight not started", () => {
    const off = fight("Brim");
    expect(fightAllowsMove({ ...off, freeMovement: true }, "cave", "Party/Aria", playerOne)).toBe(
      true,
    );
    expect(fightAllowsMove(off, "town", "Party/Aria", playerOne)).toBe(true);
    expect(fightAllowsMove(off, "cave", "Party/Cleo", playerOne)).toBe(true);
    const setup = { ...off, encounter: { ...off.encounter, phase: "setup" as const } };
    expect(fightAllowsMove(setup, "cave", "Party/Aria", playerOne)).toBe(true);
    expect(fightAllowsMove(undefined, "cave", "Party/Aria", playerOne)).toBe(true);
  });
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
