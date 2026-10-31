import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { RouterContextProvider } from "react-router";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Characters } from "~/.server/characters/characters";
import { CurrentFight } from "~/.server/combat/current-fight";
import { loadConfig } from "~/.server/config";
import { CampaignMaps } from "~/.server/maps/campaign-maps";
import { MapFogs } from "~/.server/maps/map-fogs";
import { MapTokens } from "~/.server/maps/map-tokens";
import { Vault } from "~/.server/vault/vault";
import { DM_VIEWER, type Viewer, type Visibility } from "~/campaign/types";
import { encounter } from "~/combat/test-builders";
import { accountContext, servicesContext, viewerContext, type Services } from "~/context";
import { buildArea } from "~/maps/test-builders";
import { aCharacterToken } from "~/maps/tokens/test-builders";
import type { CampaignMap } from "~/maps/types";
import { FIXTURE_VAULT } from "../../tests/support/fixture-vault";
import { action } from "./map-travel";

/** The travel route over the fixture vault, with data in a temporary folder. */
const playerOne: Viewer = { role: "player", playerId: "player one" };
const playerTwo: Viewer = { role: "player", playerId: "player two" };
const IMAGE = { path: "Maps/Fixture World.png", width: 400, height: 200 };

let vault: Vault;
beforeAll(async () => {
  vault = await Vault.load(FIXTURE_VAULT);
});

let folder: string;
let services: Services;
let changed: string[];
let town: CampaignMap;
let inn: CampaignMap;
beforeEach(async () => {
  folder = await mkdtemp(path.join(tmpdir(), "guildhall-travel-"));
  changed = [];
  services = {
    config: loadConfig({ VAULT_PATH: FIXTURE_VAULT, DATA_PATH: folder }),
    vault: { current: vault },
    maps: CampaignMaps.inFolder(folder),
    fogs: MapFogs.inFolder(folder),
    tokens: MapTokens.inFolder(folder),
    fight: CurrentFight.inFolder(folder),
    characters: Characters.inFolder(folder),
    live: {
      mapChanged: async (map: string) => void changed.push(map),
      heldByOther: () => undefined,
    },
  } as unknown as Services;
  town = await services.maps.create({ name: "Town", image: IMAGE });
  inn = await services.maps.create({ name: "Inn", image: IMAGE });
  await linkInn("players");
  await services.maps.setVisibility(town.id, "players");
  await services.maps.setVisibility(inn.id, "players");
  await services.tokens.apply(
    town.id,
    [{ type: "place", token: aCharacterToken({ map: town.id, at: [0.9, 0.9] }) }],
    () => true,
  );
});
afterEach(() => rm(folder, { recursive: true, force: true }));

/** Town's door to the Inn: the top-left square of the map. */
async function linkInn(visibility: Visibility) {
  await services.maps.update(town.id, {
    name: "Town",
    areas: [buildArea({ id: "inn-door", name: "Inn door", map: inn.id, visibility })],
  });
}

async function reveal(map: CampaignMap) {
  await services.fogs.apply(map.id, map.image, [
    { type: "paint", mode: "reveal", shape: { kind: "all" } },
  ]);
}

/** What the route answered, as status and body, or a thrown 404. */
async function travel(viewer: Viewer, from: string, to: string, token = "pc-one-token") {
  const context = new RouterContextProvider();
  context.set(servicesContext, services);
  context.set(viewerContext, viewer);
  context.set(accountContext, { kind: "dm" } as never);
  const request = new Request(`http://guildhall.test/maps/${from}/travel`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, to }),
  });
  try {
    const response = (await action({
      request,
      params: { id: from },
      context,
    } as never)) as Response;
    return { status: response.status, body: await response.json() };
  } catch (thrown) {
    return { status: (thrown as { init?: { status?: number } }).init?.status };
  }
}

const where = async () => (await services.tokens.list()).find((each) => each.id === "pc-one-token");

describe("the travel route", () => {
  it("takes a player's token into the deeper map, beside nobody: the middle", async () => {
    await reveal(town);
    expect(await travel(playerOne, town.id, inn.id)).toEqual({
      status: 200,
      body: { map: inn.id },
    });
    expect(await where()).toMatchObject({ map: inn.id, at: [0.5, 0.5] });
    expect(changed.sort()).toEqual([town.id, inn.id].sort());
  });

  it("brings it back up inside the area it came out of", async () => {
    await reveal(town);
    await travel(playerOne, town.id, inn.id);
    expect((await travel(playerOne, inn.id, town.id)).status).toBe(200);
    const token = await where();
    expect(token?.map).toBe(town.id);
    expect(token?.at[0]).toBeCloseTo(0.2);
    expect(token?.at[1]).toBeCloseTo(0.2);
  });

  it("is a 404, as for a missing map, through an area under the fog or a secret one", async () => {
    expect((await travel(playerOne, town.id, inn.id)).status).toBe(404);
    await reveal(town);
    await linkInn("dm");
    expect((await travel(playerOne, town.id, inn.id)).status).toBe(404);
    expect((await travel(playerOne, town.id, "no-such-map")).status).toBe(404);
    expect((await where())?.map).toBe(town.id);
  });

  it("is a 404 into a map that isn't shared", async () => {
    await reveal(town);
    await services.maps.setVisibility(inn.id, "dm");
    expect((await travel(playerOne, town.id, inn.id)).status).toBe(404);
  });

  it("refuses someone else's token", async () => {
    await reveal(town);
    expect((await travel(playerTwo, town.id, inn.id)).status).toBe(403);
    expect((await travel(playerOne, town.id, inn.id, "no-such-token")).status).toBe(403);
    expect((await where())?.map).toBe(town.id);
  });

  it("refuses walking into a map with a fight on it", async () => {
    await reveal(town);
    await services.fight.save(encounter([]), 0, inn.id);
    expect(await travel(playerOne, town.id, inn.id)).toMatchObject({ status: 409 });
  });

  it("lets the DM use it too, fog or not", async () => {
    expect((await travel(DM_VIEWER, town.id, inn.id)).status).toBe(200);
  });
});
