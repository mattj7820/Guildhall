import { describe, expect, it } from "vitest";
import { DM_VIEWER, type Viewer } from "~/campaign/types";
import { aCharacter, aCompanion, aSheet } from "~/characters/test-builders";
import { inCombat, monster, player } from "~/combat/test-builders";
import { WHOLE_PARTY } from "~/combat/types";
import { fightView } from "./fight-view";

const one = { id: "player one", name: "Player One" };
const two = { id: "player two", name: "Player Two" };
const playerOne: Viewer = { role: "player", playerId: "player one" };

const fight = {
  encounter: inCombat(
    [
      player("Aria", { controller: one, entityId: "Party/Aria" }),
      player("Brim", { controller: two, entityId: "Party/Brim" }),
      player("Blink Dog", { controller: WHOLE_PARTY, entityId: "Bestiary/Blink Dog" }),
      monster("Goblin 1"),
    ],
    "Aria",
  ),
  revision: 1,
};
const characters = {
  list: async () => [
    aCharacter({
      id: "a",
      note: "Party/Aria",
      sheet: aSheet({ hp: { current: 9, max: 12, temp: 0 } }),
    }),
    aCharacter({
      id: "b",
      note: "Party/Brim",
      sheet: aSheet({ hp: { current: 4, max: 10, temp: 2 } }),
    }),
    aCompanion({ id: "d", note: "Bestiary/Blink Dog", hp: { current: 20, max: 22, temp: 0 } }),
  ],
};
const services = { characters } as Parameters<typeof fightView>[0];
const hpByName = async (viewer: Viewer) => {
  const view = await fightView(services, fight, viewer);
  return Object.fromEntries(
    fight.encounter.combatants.flatMap((c) =>
      view.hp?.[c.id] ? [[c.name, view.hp[c.id].current]] : [],
    ),
  );
};

describe("fightView", () => {
  it("gives the DM every party member's hit points from their sheets", async () => {
    expect(await hpByName(DM_VIEWER)).toEqual({ Aria: 9, Brim: 4, "Blink Dog": 20 });
  });

  it("gives a player only their own, and the companion the party shares", async () => {
    expect(await hpByName(playerOne)).toEqual({ Aria: 9, "Blink Dog": 20 });
  });
});
