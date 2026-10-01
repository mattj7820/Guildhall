import { describe, expect, it } from "vitest";
import { DM_VIEWER, PLAYER_VIEWER, type Viewer } from "~/campaign/types";
import { encounter, inCombat, monster, player } from "./test-builders";
import { WHOLE_PARTY } from "./types";
import { canSeeCombatantDetails, encounterForViewer } from "./visibility";

const playerOne: Viewer = { role: "player", playerId: "player one" };
const playerTwo: Viewer = { role: "player", playerId: "player two" };

const one = { id: "player one", name: "Player One" };
const two = { id: "player two", name: "Player Two" };

const fight = inCombat(
  [
    player("Aria", { controller: one, initiative: 18, conditions: ["prone"], note: "Aria note" }),
    player("Blink Dog", { controller: one, initiative: 14, note: "Dog note" }),
    player("Brim", { controller: two, initiative: 12, conditions: ["poisoned"] }),
    monster("Goblin 1", { initiative: 9, conditions: ["frightened"], note: "DM secret" }),
  ],
  "Blink Dog",
  2,
);

describe("canSeeCombatantDetails", () => {
  it("lets the DM see every combatant", () => {
    expect(fight.combatants.every((c) => canSeeCombatantDetails(DM_VIEWER, c))).toBe(true);
  });

  it("lets a player see only the combatants they control, companions included", () => {
    const visible = fight.combatants.filter((c) => canSeeCombatantDetails(playerOne, c));
    expect(visible.map((c) => c.name)).toEqual(["Aria", "Blink Dog"]);
  });

  it("lets every player see a companion the whole party shares, even one assigned to no one", () => {
    const shared = player("Blink Dog", { controller: WHOLE_PARTY });
    expect(canSeeCombatantDetails({ role: "player", playerId: "jo" }, shared)).toBe(true);
    expect(canSeeCombatantDetails(PLAYER_VIEWER, shared)).toBe(true);
  });

  it("never lets a player see a monster's details", () => {
    const goblin = fight.combatants.find((c) => c.kind === "monster")!;
    expect(canSeeCombatantDetails(playerOne, goblin)).toBe(false);
  });

  it("shows nothing to a player the app can't identify", () => {
    expect(fight.combatants.some((c) => canSeeCombatantDetails(PLAYER_VIEWER, c))).toBe(false);
  });
});

describe("encounterForViewer", () => {
  it("shows every player the full turn order: names and whose turn it is", () => {
    expect(encounterForViewer(fight, playerTwo)).toMatchObject({
      started: true,
      round: 2,
      turnOrder: [
        { id: "Aria", name: "Aria", isActive: false },
        { id: "Blink Dog", name: "Blink Dog", isActive: true },
        { id: "Brim", name: "Brim", isActive: false },
        { id: "Goblin 1", name: "Goblin 1", isActive: false },
      ],
    });
  });

  it("gives details only for the viewer's own combatants", () => {
    expect(encounterForViewer(fight, playerOne).details).toEqual({
      Aria: { conditions: ["prone"], note: "Aria note" },
      "Blink Dog": { conditions: [], note: "Dog note" },
    });
    expect(encounterForViewer(fight, playerTwo).details).toEqual({
      Brim: { conditions: ["poisoned"], note: "" },
    });
  });

  it("leaves out HP, initiative, statblocks and DM notes", () => {
    const json = JSON.stringify(encounterForViewer(fight, playerOne));
    for (const secret of ["hp", "initiative", "statblock", "DM secret", "frightened"]) {
      expect(json).not.toContain(secret);
    }
  });

  it("reveals nothing while the DM is still building the encounter", () => {
    const setup = encounter(fight.combatants);
    expect(encounterForViewer(setup, playerOne)).toEqual({
      started: false,
      round: 0,
      turnOrder: [],
      details: {},
    });
  });
});
