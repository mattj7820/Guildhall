import { describe, expect, it } from "vitest";
import { DM_VIEWER, type Viewer } from "~/campaign/types";
import { fightForViewer, type Fight } from "~/combat/fight";
import { encounter, inCombat, monster, player } from "~/combat/test-builders";
import type { Whereabouts } from "~/maps/tokens/types";
import { bannerMap, fightSummary, latestSession, newestFirst } from "./front-page";

const at = (name: string, map?: string, theirs = false): Whereabouts => ({
  name,
  theirs,
  ...(map && { map: { id: map, name: map } }),
});

describe("bannerMap", () => {
  const party = [at("Aria", "town", true), at("Brim", "cave"), at("Blink Dog", "cave")];

  it("shows the DM where most of the party is", () => {
    expect(bannerMap(party, true)).toBe("cave");
  });

  it("shows a player where their own character is, wherever the others are", () => {
    expect(bannerMap(party, false)).toBe("town");
  });

  it("takes the first map on a tie", () => {
    expect(bannerMap([at("Aria", "town"), at("Brim", "cave")], true)).toBe("town");
  });

  it("shows nothing when nobody the viewer may place is on a map", () => {
    expect(bannerMap([at("Aria", undefined, true), at("Brim", "cave")], false)).toBeUndefined();
    expect(bannerMap([], true)).toBeUndefined();
  });
});

describe("fightSummary", () => {
  const playerOne: Viewer = { role: "player", playerId: "player one" };
  const combatants = [
    player("Aria", { controller: { id: "player one", name: "Player One" }, initiative: 18 }),
    monster("Lurker", { initiative: 12, hidden: true }),
    monster("Goblin 1", { initiative: 9 }),
  ];
  const fight = (active: string): Fight => ({
    encounter: inCombat(combatants, active),
    revision: 1,
    map: "cave",
  });

  it("says the round, whose turn and where", () => {
    expect(fightSummary(fightForViewer(fight("Goblin 1"), playerOne))).toEqual({
      round: 1,
      turn: "Goblin 1",
      map: "cave",
    });
  });

  it("names a hidden monster's turn to the DM only", () => {
    expect(fightSummary(fightForViewer(fight("Lurker"), DM_VIEWER))?.turn).toBe("Lurker");
    const forPlayer = fightSummary(fightForViewer(fight("Lurker"), playerOne));
    expect(forPlayer).toEqual({ round: 1, map: "cave" });
  });

  it("is nothing without a fight, or while the DM sets one up", () => {
    expect(fightSummary(null)).toBeNull();
    const setup: Fight = { encounter: encounter(combatants), revision: 1 };
    expect(fightSummary(fightForViewer(setup, DM_VIEWER))).toBeNull();
    expect(fightSummary(fightForViewer(setup, playerOne))).toBeNull();
  });
});

describe("latestSession", () => {
  it("orders by number in the title, not by text", () => {
    const sessions = ["Session 9", "Session 10", "Session 2"].map((title) => ({ title }));
    expect(latestSession(sessions)?.title).toBe("Session 10");
  });

  it("is nothing without session notes", () => {
    expect(latestSession([])).toBeUndefined();
  });
});

describe("newestFirst", () => {
  it("puts the highest-numbered session first", () => {
    const sessions = ["Session 2", "Session 10", "Session 9"].map((title) => ({ title }));
    expect(newestFirst(sessions).map((session) => session.title)).toEqual([
      "Session 10",
      "Session 9",
      "Session 2",
    ]);
  });
});
