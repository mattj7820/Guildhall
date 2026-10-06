import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { RouterContextProvider } from "react-router";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CurrentFight } from "~/.server/combat/current-fight";
import { Characters } from "~/.server/characters/characters";
import { loadConfig } from "~/.server/config";
import { CampaignMaps } from "~/.server/maps/campaign-maps";
import { MapFogs } from "~/.server/maps/map-fogs";
import { MapTokens } from "~/.server/maps/map-tokens";
import { Vault } from "~/.server/vault/vault";
import { DM_VIEWER, type Viewer } from "~/campaign/types";
import { servicesContext, viewerContext, type Services } from "~/context";
import { aMarker } from "~/maps/tokens/test-builders";
import type { MarkerToken } from "~/maps/tokens/types";
import type { CampaignMap } from "~/maps/types";
import { FIXTURE_VAULT } from "../../tests/support/fixture-vault";
import { loader } from "./map-token-picture";

/** The NPC token picture route over the fixture vault, with data in a temporary folder. */
const playerOne: Viewer = { role: "player", playerId: "player one" };
const IMAGE = "Attachments/fixture-hidden-npc.png";

let vault: Vault;
beforeAll(async () => {
  vault = await Vault.load(FIXTURE_VAULT);
});

let folder: string;
let services: Services;
let map: CampaignMap;
beforeEach(async () => {
  folder = await mkdtemp(path.join(tmpdir(), "guildhall-token-picture-"));
  services = {
    config: loadConfig({ VAULT_PATH: FIXTURE_VAULT, DATA_PATH: folder }),
    vault: { current: vault },
    maps: CampaignMaps.inFolder(folder),
    fogs: MapFogs.inFolder(folder),
    tokens: MapTokens.inFolder(folder),
    fight: CurrentFight.inFolder(folder),
    characters: Characters.inFolder(folder),
  } as unknown as Services;
  map = await services.maps.create({
    name: "Shared",
    image: { path: "Maps/Fixture World.png", width: 400, height: 200 },
  });
  await services.maps.setVisibility(map.id, "players");
});
afterEach(() => rm(folder, { recursive: true, force: true }));

/** The hidden NPC's token, disguised, on the shared map. */
function npc(fields: Partial<MarkerToken> = {}): MarkerToken {
  return aMarker({
    id: "stranger",
    map: map.id,
    name: "Hooded figure",
    note: "NPCs/Fixture Hidden NPC",
    picture: "note",
    ...fields,
  });
}

async function place(token: MarkerToken) {
  await services.tokens.apply(map.id, [{ type: "place", token }], () => true);
}

async function revealAll() {
  await services.fogs.apply(map.id, map.image, [
    { type: "paint", mode: "reveal", shape: { kind: "all" } },
  ]);
}

/** What the route answers, or what it threw (a 404 is thrown). */
async function picture(viewer: Viewer, token = "stranger", mapId = map.id): Promise<unknown> {
  const context = new RouterContextProvider();
  context.set(servicesContext, services);
  context.set(viewerContext, viewer);
  const request = new Request(`http://guildhall.test/maps/${mapId}/tokens/${token}/picture`);
  try {
    return await loader({ request, params: { id: mapId, token }, context } as never);
  } catch (thrown) {
    return thrown;
  }
}

const MISSING = () => picture(playerOne, "no-such-token");

describe("the token picture route", () => {
  it("gives the DM a DM-only NPC's picture: its note's first image", async () => {
    await place(npc({ visibility: "dm" }));
    const response = (await picture(DM_VIEWER)) as Response;
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    const bytes = Buffer.from(await response.arrayBuffer());
    expect(bytes.equals(await readFile(path.join(FIXTURE_VAULT, IMAGE)))).toBe(true);
  });

  it("gives a player the same 404 as a missing token for a DM-only NPC", async () => {
    await place(npc({ visibility: "dm" }));
    await revealAll();
    expect(await picture(playerOne)).toEqual(await MISSING());
  });

  it("gives a player the same 404 for a shown NPC still under the fog", async () => {
    await place(npc({ visibility: "players" }));
    expect(await picture(playerOne)).toEqual(await MISSING());
  });

  it("gives a player the same 404 for a shown NPC set aside", async () => {
    await place(npc({ visibility: "players", aside: true }));
    await revealAll();
    expect(await picture(playerOne)).toEqual(await MISSING());
    expect(((await picture(DM_VIEWER)) as Response).status).toBe(200);
  });

  it("gives a player the picture once the NPC is shown and revealed", async () => {
    await place(npc({ visibility: "players" }));
    await revealAll();
    expect(((await picture(playerOne)) as Response).status).toBe(200);
  });

  it("gives the same 404 for a token showing an icon, or with no note", async () => {
    await place(npc({ visibility: "players", picture: "icon", icon: "hood" }));
    await place(npc({ id: "plain", visibility: "players", note: undefined }));
    await revealAll();
    expect(await picture(DM_VIEWER)).toEqual(await picture(DM_VIEWER, "no-such-token"));
    expect(await picture(DM_VIEWER, "plain")).toEqual(await picture(DM_VIEWER, "no-such-token"));
  });

  it("gives the same 404 for a token asked for through another map", async () => {
    await place(npc({ visibility: "players" }));
    await revealAll();
    const other = await services.maps.create({
      name: "Other",
      image: { path: "Maps/Fixture World.png", width: 400, height: 200 },
    });
    await services.maps.setVisibility(other.id, "players");
    expect(await picture(DM_VIEWER, "stranger", other.id)).toEqual(await MISSING());
  });
});
