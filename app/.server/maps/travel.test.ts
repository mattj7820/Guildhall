import { describe, expect, it } from "vitest";
import { DM_VIEWER, PLAYER_VIEWER } from "~/campaign/types";
import type { Fight } from "~/combat/fight";
import type { Combatant } from "~/combat/types";
import { maskFrom } from "~/maps/fog/test-builders";
import type { FogMask } from "~/maps/fog/types";
import { buildArea, buildMap, SQUARE } from "~/maps/test-builders";
import type { TravelWay } from "~/maps/tokens/types";
import type { CampaignMap } from "~/maps/types";
import { fightStopsTravel, travelLanding, travelWays } from "./travel";

const CLEAR = maskFrom(["####", "####"]);
const DARK = maskFrom(["....", "...."]);

/** Town has the Inn (shared) and the Crypt (shared map, secret area); the Inn has a Cellar. */
function world(fields: { inn?: Partial<CampaignMap>; town?: Partial<CampaignMap> } = {}) {
  const town = buildMap({
    id: "town",
    visibility: "players",
    areas: [
      buildArea({ id: "inn-door", map: "inn", visibility: "players" }),
      buildArea({ id: "crypt-door", map: "crypt", visibility: "dm" }),
    ],
    ...fields.town,
  });
  const inn = buildMap({
    id: "inn",
    name: "The Inn",
    visibility: "players",
    areas: [buildArea({ id: "cellar-door", map: "cellar", visibility: "players" })],
    ...fields.inn,
  });
  const cellar = buildMap({ id: "cellar", visibility: "dm" });
  const crypt = buildMap({ id: "crypt", visibility: "players" });
  return [town, inn, cellar, crypt];
}

const fogs =
  (byMap: Record<string, FogMask> = {}) =>
  (id: string) =>
    byMap[id] ?? CLEAR;

describe("travelWays", () => {
  it("goes in through a shared map's seen area, never a secret area or an unshared map", () => {
    const maps = world();
    expect(travelWays(maps[0], maps, PLAYER_VIEWER, fogs())).toEqual([
      { direction: "in", map: { id: "inn", name: "The Inn" }, area: "inn-door" },
    ]);
    // The Cellar isn't shared, so the Inn only leads back up.
    expect(travelWays(maps[1], maps, PLAYER_VIEWER, fogs())).toEqual([
      { direction: "up", map: { id: "town", name: "town" }, area: "inn-door" },
    ]);
  });

  it("doesn't go in through an area still under the fog", () => {
    const maps = world();
    expect(travelWays(maps[0], maps, PLAYER_VIEWER, fogs({ town: DARK }))).toEqual([]);
  });

  it("goes up only through an area the player sees on the map above", () => {
    const maps = world();
    expect(travelWays(maps[1], maps, PLAYER_VIEWER, fogs({ town: DARK }))).toEqual([]);
    const secretDoor = world({
      town: { areas: [buildArea({ id: "inn-door", map: "inn", visibility: "dm" })] },
    });
    expect(travelWays(secretDoor[1], secretDoor, PLAYER_VIEWER, fogs())).toEqual([]);
  });

  it("doesn't go up to a map that isn't shared", () => {
    const maps = world({ town: { visibility: "dm" } });
    expect(travelWays(maps[1], maps, PLAYER_VIEWER, fogs())).toEqual([]);
  });

  it("gives nothing from a map the viewer can't see", () => {
    const maps = world();
    expect(travelWays(maps[2], maps, PLAYER_VIEWER, fogs())).toEqual([]);
  });

  it("gives the DM every link, fog or not", () => {
    const maps = world();
    const ways = travelWays(maps[0], maps, DM_VIEWER, fogs({ town: DARK }));
    expect(ways.map((way) => way.map.id)).toEqual(["inn", "crypt"]);
  });
});

describe("fightStopsTravel", () => {
  const pc: Combatant = {
    kind: "player",
    id: "c1",
    entityId: "pc-one",
  } as Combatant;
  const fight = (map: string, combatants: Combatant[] = []): Fight =>
    ({ encounter: { combatants }, revision: 1, map }) as unknown as Fight;

  it("lets anyone travel with no fight on either map", () => {
    expect(fightStopsTravel(undefined, "town", "inn", "pc-one")).toBeUndefined();
    expect(fightStopsTravel(fight("crypt", [pc]), "town", "inn", "pc-one")).toBeUndefined();
  });

  it("stops anyone walking into a map with a fight on it", () => {
    expect(fightStopsTravel(fight("inn"), "town", "inn", "pc-two")).toMatch(/fight/);
  });

  it("stops someone in the fight leaving its map, but not someone outside it", () => {
    expect(fightStopsTravel(fight("town", [pc]), "town", "inn", "pc-one")).toMatch(/fight/);
    expect(fightStopsTravel(fight("town", [pc]), "town", "inn", "pc-two")).toBeUndefined();
  });
});

describe("travelLanding", () => {
  const inn = buildMap({ id: "inn", areas: [buildArea({ id: "door", outline: SQUARE })] });
  const goingIn: TravelWay = { direction: "in", map: { id: "inn", name: "Inn" }, area: "door" };

  it("lands inside the area it came out of, going up", () => {
    const way: TravelWay = { direction: "up", map: { id: "inn", name: "Inn" }, area: "door" };
    const [x, y] = travelLanding(way, inn, []);
    expect(x).toBeCloseTo(0.2);
    expect(y).toBeCloseTo(0.2);
  });

  it("lands beside a party member already there, else in the middle", () => {
    expect(travelLanding(goingIn, inn, [])).toEqual([0.5, 0.5]);
    const [x, y] = travelLanding(goingIn, inn, [[0.3, 0.6]]);
    expect(x).toBeCloseTo(0.34);
    expect(y).toBe(0.6);
    // Not off the edge.
    expect(travelLanding(goingIn, inn, [[0.99, 0.6]])[0]).toBeCloseTo(0.95);
  });

  it("lands on a square on a battle map that snaps", () => {
    const battle = { ...inn, grid: { square: 0.1, origin: [0, 0] as [number, number], lines: 1 } };
    expect(travelLanding(goingIn, battle, [])).toEqual([0.55, 0.5]);
    expect(travelLanding(goingIn, { ...battle, snapToGrid: false }, [])).toEqual([0.5, 0.5]);
  });
});
