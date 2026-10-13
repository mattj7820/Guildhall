import { beforeAll, describe, expect, it } from "vitest";
import { loadConfig } from "~/.server/config";
import { Vault } from "~/.server/vault/vault";
import { DM_VIEWER, type Viewer } from "~/campaign/types";
import type { Services } from "~/context";
import { fogGrid, hiddenMask } from "~/maps/fog/mask";
import type { FogMask } from "~/maps/fog/types";
import { buildArea, buildMap } from "~/maps/test-builders";
import type { CampaignMap } from "~/maps/types";
import { FIXTURE_VAULT } from "../../../tests/support/fixture-vault";
import { facesByMap, listMaps } from "./maps-page";

const playerOne: Viewer = { role: "player", playerId: "player one" };
const IMAGE = { path: "Maps/Fixture World.png", width: 400, height: 200 };
const LEFT: [number, number][] = [
  [0.1, 0.1],
  [0.3, 0.1],
  [0.3, 0.3],
  [0.1, 0.3],
];
const RIGHT: [number, number][] = LEFT.map(([x, y]) => [x + 0.6, y]);

let vault: Vault;
beforeAll(async () => {
  vault = await Vault.load(FIXTURE_VAULT);
});

/** The left half revealed: the area on the left is seen, the one on the right isn't. */
function leftHalf(): FogMask {
  const mask = hiddenMask(fogGrid(IMAGE));
  for (let row = 0; row < mask.rows; row++)
    mask.cells.fill(1, row * mask.cols, row * mask.cols + mask.cols / 2);
  return mask;
}

function servicesWith(maps: CampaignMap[], fogs: Record<string, FogMask> = {}) {
  return {
    config: loadConfig({ VAULT_PATH: FIXTURE_VAULT, DATA_PATH: "unused" }),
    vault: { current: vault },
    maps: { list: async () => maps },
    fogs: {
      getMany: async (wanted: CampaignMap[]) =>
        new Map(
          wanted.map(({ id }) => [
            id,
            { mask: fogs[id] ?? hiddenMask(fogGrid(IMAGE)), version: 3 },
          ]),
        ),
    },
  } as unknown as Services;
}

/** A shared world with a seen area leading to a shared town, an unseen one to a shared keep, a
 * secret one leading to a shared cave, and an area leading to a map players can't see. */
const world = buildMap({
  id: "world",
  image: IMAGE,
  visibility: "players",
  areas: [
    buildArea({ id: "a-town", name: "Town", outline: LEFT, map: "town", visibility: "players" }),
    buildArea({ id: "a-keep", name: "Keep", outline: RIGHT, map: "keep", visibility: "players" }),
    buildArea({ id: "a-cave", name: "Cave", outline: LEFT, map: "cave", visibility: "dm" }),
    buildArea({ id: "a-lair", name: "Lair", outline: LEFT, map: "lair", visibility: "players" }),
  ],
});
const maps = [
  world,
  buildMap({ id: "town", image: IMAGE, visibility: "players" }),
  buildMap({ id: "keep", image: IMAGE, visibility: "players" }),
  buildMap({ id: "cave", image: IMAGE, visibility: "players" }),
  buildMap({ id: "lair", image: IMAGE }),
  buildMap({ id: "lost", image: { ...IMAGE, path: "Maps/No Such Image.png" } }),
];

describe("listMaps", () => {
  it("gives the DM every map, with thumbnails, every map's pin and what's missing", async () => {
    const listed = await listMaps(servicesWith(maps), DM_VIEWER);
    expect(listed.map((map) => map.id)).toEqual(["world", "town", "keep", "cave", "lair", "lost"]);
    const [shared] = listed;
    expect(shared.thumbnail).toMatch(/^\/maps\/world\/thumbnail\?v=[^.]+$/);
    expect(shared.pins.map((pin) => pin.map)).toEqual(["town", "keep", "cave", "lair"]);
    expect(shared.pins[0].at[0]).toBeCloseTo(0.2);
    expect(shared).toMatchObject({ shared: true, imageMissing: false });
    expect(listed.find((map) => map.id === "lost")).toMatchObject({
      thumbnail: undefined,
      imageMissing: true,
    });
  });

  it("gives players shared maps only, with pins only on the areas they see", async () => {
    const listed = await listMaps(servicesWith(maps, { world: leftHalf() }), playerOne);
    expect(listed.map((map) => map.id)).toEqual(["world", "town", "keep", "cave"]);
    const [shared] = listed;
    expect(shared.thumbnail).toMatch(/^\/maps\/world\/thumbnail\?v=.+\.3$/);
    expect(shared.pins.map((pin) => pin.map)).toEqual(["town"]);
    // Links nest the list, without the areas' names; never to a map they can't see.
    expect(shared.areas.map((area) => [area.map, area.name])).toEqual([
      ["town", ""],
      ["keep", ""],
      ["cave", ""],
    ]);
    expect(shared).not.toHaveProperty("shared");
    expect(shared).not.toHaveProperty("imageMissing");
  });

  it("gives players no thumbnail of a map they haven't seen any of", async () => {
    const listed = await listMaps(servicesWith(maps), playerOne);
    expect(listed.every((map) => map.thumbnail === undefined)).toBe(true);
    expect(listed[0].pins).toEqual([]);
  });
});

describe("facesByMap", () => {
  it("puts each member on their map and every map above it", async () => {
    const listed = await listMaps(servicesWith(maps), DM_VIEWER);
    const faces = facesByMap(
      [
        { name: "One", portraitUrl: "/one.png", theirs: false, map: { id: "town", name: "town" } },
        { name: "Two", theirs: false },
      ],
      listed,
    );
    expect(faces).toEqual({
      town: [{ name: "One", portraitUrl: "/one.png" }],
      world: [{ name: "One", portraitUrl: "/one.png" }],
    });
  });
});
