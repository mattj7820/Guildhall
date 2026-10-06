import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DM_VIEWER, PLAYER_VIEWER, type Viewer } from "~/campaign/types";
import type { Services } from "~/context";
import type { FogChange } from "~/maps/fog/types";
import { aCharacterToken, aMarker } from "~/maps/tokens/test-builders";
import type { MarkerToken, Token } from "~/maps/tokens/types";
import type { Area, CampaignMap, Point } from "~/maps/types";
import { FIXTURE_VAULT } from "../../../tests/support/fixture-vault";
import { Characters } from "../characters/characters";
import { CurrentFight } from "../combat/current-fight";
import { Vault } from "../vault/vault";
import { CampaignMaps } from "./campaign-maps";
import { MapFogs } from "./map-fogs";
import { MapTokens } from "./map-tokens";
import { loadMapTokens, tokensElsewhere, whereabouts } from "./tokens";

/**
 * Where the party is, over the fixture vault (Player One plays Fixture PC One, Player Two Fixture
 * PC Two, and everyone shares Fixture Companion), with maps in a temporary folder: a shared world
 * whose "Town" area leads to a shared town, which leads to a keep.
 */
let vault: Vault;
beforeAll(async () => {
  vault = await Vault.load(FIXTURE_VAULT);
});

const playerOne: Viewer = { role: "player", playerId: "player one" };
const IMAGE = { path: "Maps/Fixture World.png", width: 400, height: 200 };
const LEFT_HALF: Point[] = [
  [0, 0],
  [0.5, 0],
  [0.5, 1],
  [0, 1],
];
const revealLeftHalf: FogChange = {
  type: "paint",
  mode: "reveal",
  shape: { kind: "polygon", points: LEFT_HALF },
};
/** An area in the left quarter of a map, so revealed with its left half. */
const area = (fields: Partial<Area> & Pick<Area, "id">): Area => ({
  name: fields.id,
  outline: [
    [0.05, 0.1],
    [0.2, 0.1],
    [0.2, 0.9],
    [0.05, 0.9],
  ],
  visibility: "players",
  ...fields,
});

let folder: string;
let services: Pick<Services, "vault" | "characters" | "tokens" | "fogs" | "maps" | "fight">;
let world: CampaignMap;
let town: CampaignMap;
let keep: CampaignMap;

beforeEach(async () => {
  folder = await mkdtemp(path.join(tmpdir(), "guildhall-party-"));
  services = {
    vault: { current: vault } as Services["vault"],
    characters: Characters.inFolder(folder),
    tokens: MapTokens.inFolder(folder),
    fogs: MapFogs.inFolder(folder),
    maps: CampaignMaps.inFolder(folder),
    fight: CurrentFight.inFolder(folder),
  };
  const { maps, fogs } = services;
  [world, town, keep] = await Promise.all(
    ["World", "Town", "Keep"].map((name) => maps.create({ name, image: IMAGE })),
  );
  await maps.update(world.id, { name: "World", areas: [area({ id: "town", map: town.id })] });
  await maps.update(town.id, { name: "Town", areas: [area({ id: "keep", map: keep.id })] });
  for (const map of [world, town, keep]) {
    await maps.setVisibility(map.id, "players");
    await fogs.apply(map.id, IMAGE, [revealLeftHalf]);
  }
});
afterEach(() => rm(folder, { recursive: true, force: true }));

const LIT: Point = [0.1, 0.5];
const DARK: Point = [0.9, 0.5];

async function place(...tokens: Token[]) {
  await services.tokens.apply(
    tokens[0].map,
    tokens.map((token) => ({ type: "place", token })),
    () => true,
  );
}
const pcOne = (map: string, at = LIT) => aCharacterToken({ id: "one", map, at });
const pcTwo = (map: string, at = LIT) =>
  aCharacterToken({ id: "two", map, at, note: "Party/Fixture PC Two" });

async function insideWorld(viewer: Viewer) {
  const current = (await services.maps.get(world.id))!;
  return (await loadMapTokens(services, current, viewer)).inside;
}
const names = (badges: { members: { name: string }[] }[]) =>
  badges.flatMap((badge) => badge.members.map((member) => member.name));

describe("who's inside an area", () => {
  it("shows party members on the map an area leads to, or deeper, on the area", async () => {
    await place(pcOne(town.id));
    await place(pcTwo(keep.id));
    expect(await insideWorld(DM_VIEWER)).toEqual([
      { area: "town", members: [{ name: "Fixture PC One" }, { name: "Fixture PC Two" }] },
    ]);
  });

  it("shows players only those they'd see there: others in the dark are left out", async () => {
    await place(pcOne(town.id, DARK));
    await place(pcTwo(town.id, DARK));
    expect(names(await insideWorld(playerOne))).toEqual(["Fixture PC One"]);
  });

  it("shows players nothing through an area they can't see", async () => {
    await place(pcOne(town.id));
    const secret = area({ id: "town", map: town.id, visibility: "dm" });
    await services.maps.update(world.id, { name: "World", areas: [secret] });
    expect(await insideWorld(playerOne)).toEqual([]);
    expect(names(await insideWorld(DM_VIEWER))).toEqual(["Fixture PC One"]);
  });

  it("shows players nothing through an area still under the fog", async () => {
    await place(pcOne(town.id));
    const inTheDark = area({
      id: "town",
      map: town.id,
      outline: [
        [0.7, 0.1],
        [0.9, 0.1],
        [0.9, 0.9],
        [0.7, 0.9],
      ],
    });
    await services.maps.update(world.id, { name: "World", areas: [inTheDark] });
    expect(await insideWorld(playerOne)).toEqual([]);
  });

  it("shows players nothing of maps that aren't shared, even deeper ones", async () => {
    await place(pcOne(keep.id));
    await services.maps.setVisibility(keep.id, "dm");
    expect(await insideWorld(playerOne)).toEqual([]);
    await services.maps.setVisibility(town.id, "dm");
    expect(await insideWorld(playerOne)).toEqual([]);
  });

  it("has no badge on an area with nobody inside", async () => {
    await place(pcOne(world.id));
    expect(await insideWorld(DM_VIEWER)).toEqual([]);
  });
});

describe("whereabouts", () => {
  const where = async (viewer: Viewer) =>
    (await whereabouts(services, viewer)).map(({ name, map, theirs }) => ({
      name,
      on: map?.name,
      theirs,
    }));

  it("tells a player where their own party members are", async () => {
    await place(pcOne(town.id));
    await place(pcTwo(keep.id));
    await place(aCharacterToken({ id: "dog", map: world.id, note: "Bestiary/Fixture Companion" }));
    expect(await where(playerOne)).toEqual([
      { name: "Fixture PC One", on: "Town", theirs: true },
      { name: "Fixture Companion", on: "World", theirs: true },
    ]);
  });

  it("gives a player no map for one they can't open, as if nowhere yet", async () => {
    await place(pcOne(keep.id));
    await services.maps.setVisibility(keep.id, "dm");
    expect(await where(playerOne)).toContainEqual({
      name: "Fixture PC One",
      on: undefined,
      theirs: true,
    });
  });

  it("tells the DM where everyone is", async () => {
    await place(pcTwo(keep.id));
    expect(await where(DM_VIEWER)).toEqual([
      { name: "Fixture PC One", on: undefined, theirs: false },
      { name: "Fixture PC Two", on: "Keep", theirs: false },
      { name: "Fixture Companion", on: undefined, theirs: false },
    ]);
  });

  it("tells a player the DM hasn't assigned only about the shared companion", async () => {
    expect((await where(PLAYER_VIEWER)).map((member) => member.name)).toEqual([
      "Fixture Companion",
    ]);
  });
});

describe("tokensElsewhere", () => {
  const marker = (fields: Partial<MarkerToken>) => aMarker({ id: "m", map: world.id, ...fields });

  it("lists NPCs on other maps and markers set aside, never plain markers elsewhere", async () => {
    await services.tokens.apply(
      world.id,
      [
        marker({ id: "here", map: town.id, note: "NPCs/Mira Stonehand", name: "Mira" }),
        marker({ id: "npc", map: keep.id, note: "NPCs/Mira Stonehand", name: "Mira 2" }),
        marker({ id: "chest", map: keep.id, name: "Chest" }),
        marker({ id: "aside", map: town.id, name: "Innkeeper", aside: true }),
      ].map((token) => ({ type: "place" as const, token })),
      () => true,
    );
    const listed = await tokensElsewhere(services, [world, town, keep], town);
    expect(listed.map(({ token, map, aside }) => [token.name, map?.name, aside])).toEqual([
      ["Innkeeper", "Town", true],
      ["Mira 2", "Keep", false],
    ]);
  });

  it("gives each the DM's view, with its picture by the token", async () => {
    await services.tokens.apply(
      world.id,
      [{ type: "place", token: marker({ note: "NPCs/Mira Stonehand", picture: "note" }) }],
      () => true,
    );
    const [listed] = await tokensElsewhere(services, [world, town, keep], town);
    expect(listed.token.portraitUrl).toMatch(new RegExp(`^/maps/${world.id}/tokens/m/picture`));
    expect(listed.token.marker).toEqual({ note: "NPCs/Mira Stonehand", picture: "note" });
  });
});
