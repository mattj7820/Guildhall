import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { RouterContextProvider } from "react-router";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "~/.server/config";
import { FileCache } from "~/.server/data/file-cache";
import { CampaignMaps } from "~/.server/maps/campaign-maps";
import { mapSource } from "~/.server/maps/load";
import { MapFogs } from "~/.server/maps/map-fogs";
import { PlayerImages } from "~/.server/maps/player-image";
import { Vault } from "~/.server/vault/vault";
import { DM_VIEWER, PLAYER_VIEWER, type Viewer } from "~/campaign/types";
import { servicesContext, viewerContext, type Services } from "~/context";
import type { CampaignMap } from "~/maps/types";
import { thumbnailVersion } from "~/maps/urls";
import { FIXTURE_VAULT } from "../../tests/support/fixture-vault";
import { loader } from "./map-thumbnail";

/** The thumbnail route over the fixture vault, with data in a temporary folder. */
const playerOne: Viewer = { role: "player", playerId: "player one" };

let vault: Vault;
beforeAll(async () => {
  vault = await Vault.load(FIXTURE_VAULT);
});

let folder: string;
let services: Services;
let map: CampaignMap;
beforeEach(async () => {
  folder = await mkdtemp(path.join(tmpdir(), "guildhall-thumbnail-"));
  services = {
    config: loadConfig({ VAULT_PATH: FIXTURE_VAULT, DATA_PATH: folder }),
    vault: { current: vault },
    maps: CampaignMaps.inFolder(folder),
    fogs: MapFogs.inFolder(folder),
    playerImages: new PlayerImages(new FileCache(path.join(folder, "cache"))),
  } as unknown as Services;
  map = await services.maps.create({
    name: "Fogged",
    image: { path: "Maps/Fixture Fog.png", width: 1024, height: 512 },
  });
});
afterEach(() => rm(folder, { recursive: true, force: true }));

const share = () => services.maps.setVisibility(map.id, "players");
const revealLeftHalf = () =>
  services.fogs.apply(map.id, map.image, [
    {
      type: "paint",
      mode: "reveal",
      shape: {
        kind: "polygon",
        points: [
          [0, 0],
          [0.5, 0],
          [0.5, 1],
          [0, 1],
        ],
      },
    },
  ]);

/** What the route answers, or what it threw (a 404 is thrown). */
async function thumbnail(viewer: Viewer, mapId = map.id, version = ""): Promise<unknown> {
  const context = new RouterContextProvider();
  context.set(servicesContext, services);
  context.set(viewerContext, viewer);
  const request = new Request(`http://guildhall.test/maps/${mapId}/thumbnail?v=${version}`);
  try {
    return await loader({ request, params: { id: mapId }, context } as never);
  } catch (thrown) {
    return thrown;
  }
}

const MISSING = () => thumbnail(playerOne, "no-such-map");

describe("the thumbnail route", () => {
  it("gives the DM the whole map, shared or not", async () => {
    const response = (await thumbnail(DM_VIEWER)) as Response;
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/webp");
  });

  it("gives a player the same 404 as a missing map for a map that isn't shared", async () => {
    await revealLeftHalf();
    expect(await thumbnail(playerOne)).toEqual(await MISSING());
  });

  it("gives a player the same 404 for a shared map that's all fogged", async () => {
    await share();
    expect(await thumbnail(playerOne)).toEqual(await MISSING());
  });

  it("gives a player what's revealed, and the DM previewing as a player the same", async () => {
    await share();
    await revealLeftHalf();
    const player = (await thumbnail(playerOne)) as Response;
    expect(player.status).toBe(200);
    const preview = (await thumbnail(PLAYER_VIEWER)) as Response;
    const dm = (await thumbnail(DM_VIEWER)) as Response;
    const bytes = async (response: Response) => Buffer.from(await response.arrayBuffer());
    const playerBytes = await bytes(player);
    expect(playerBytes.equals(await bytes(preview))).toBe(true);
    expect(playerBytes.equals(await bytes(dm))).toBe(false);
  });

  it("lets the browser keep a thumbnail only while its version is current", async () => {
    await share();
    await revealLeftHalf();
    const source = (await mapSource(services, map))!;
    const fog = await services.fogs.get(map.id, map.image);
    const current = thumbnailVersion(source.version, fog.version);
    const kept = (await thumbnail(playerOne, map.id, current)) as Response;
    expect(kept.headers.get("Cache-Control")).toContain("immutable");
    const old = (await thumbnail(
      playerOne,
      map.id,
      thumbnailVersion(source.version, 0),
    )) as Response;
    expect(old.headers.get("Cache-Control")).toBe("private, no-cache");
  });
});
