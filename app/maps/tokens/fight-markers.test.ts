import { describe, expect, it } from "vitest";
import { monster } from "~/combat/test-builders";
import { monsterMarker } from "./fight-markers";

describe("monsterMarker", () => {
  const place = { id: "t1", map: "arena", at: [0.5, 0.5] as [number, number], size: 1 as const };

  it("is a red marker linked to its monster, named after it, with its statblock", () => {
    const goblin = monster("Fixture Minion 2", {
      statblock: { entityId: "Bestiary/Fixture Minion", name: "Fixture Minion" },
    });
    expect(monsterMarker(goblin, place)).toEqual({
      kind: "marker",
      id: "t1",
      map: "arena",
      at: [0.5, 0.5],
      name: "Fixture Minion 2",
      colour: "red",
      visibility: "players",
      statblock: goblin.statblock,
      combatant: "Fixture Minion 2",
    });
  });

  it("is DM-only for a hidden monster, keeps its size, and guesses an icon", () => {
    const wolf = monster("Wolf 1", { hidden: true, statblock: { entityId: "wolf", name: "Wolf" } });
    expect(monsterMarker(wolf, { ...place, size: 2 })).toMatchObject({
      visibility: "dm",
      size: 2,
      picture: "icon",
      icon: expect.any(String),
    });
  });
});
