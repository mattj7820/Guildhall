import { mkdtemp, rm } from "node:fs/promises";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Services } from "~/context";
import type { CampaignMap } from "~/maps/types";
import { FIXTURE_VAULT } from "../../../tests/support/fixture-vault";
import { createSessions } from "../auth/sessions";
import { loadConfig } from "../config";
import { CampaignMaps } from "../maps/campaign-maps";
import { MapFogs } from "../maps/map-fogs";
import { Members } from "../members/members";
import { Vault } from "../vault/vault";
import { Live } from "./live";
import {
  briefly,
  cookieFor,
  DISCORD_IDS,
  openClient,
  PUBLIC_URL,
  serveUpgrades,
  type Client,
} from "./test-support";

/**
 * Live updates over a real server, with the fixture vault and maps kept in a temporary folder:
 * what each viewer hears about maps, and who stays connected.
 */
let vault: Vault;
beforeAll(async () => {
  vault = await Vault.load(FIXTURE_VAULT);
});

let folder: string;
let services: Omit<Services, "live">;
let live: Live;
let server: Server;
let base: string;
let shared: CampaignMap;
let secret: CampaignMap;
const open: Client[] = [];

beforeEach(async () => {
  folder = await mkdtemp(path.join(tmpdir(), "guildhall-live-"));
  services = {
    config: loadConfig({
      VAULT_PATH: FIXTURE_VAULT,
      DATA_PATH: folder,
      PUBLIC_URL,
      DM_DISCORD_IDS: DISCORD_IDS.dm,
    }),
    vault: { current: vault } as Services["vault"],
    maps: CampaignMaps.inFolder(folder),
    fogs: MapFogs.inFolder(folder),
    members: Members.inFolder(folder),
    sessions: createSessions({ secrets: ["test-secret-test-secret-test-secret"], secure: false }),
  } as Omit<Services, "live">;
  const image = { path: "Maps/Fixture World.png", width: 400, height: 200 };
  shared = await services.maps.create({ name: "Shared", image });
  await services.maps.setVisibility(shared.id, "players");
  secret = await services.maps.create({ name: "Secret", image });
  live = new Live(services);
  ({ server, base } = await serveUpgrades((req, socket, head) =>
    live.handleUpgrade(req, socket, head),
  ));
});

afterEach(async () => {
  for (const client of open.splice(0)) client.socket.terminate();
  live.close();
  await new Promise((resolve) => server.close(resolve));
  await rm(folder, { recursive: true, force: true });
});

async function connect(discordId: string, playerId = ""): Promise<Client> {
  const client = await openClient(base, await cookieFor(services, discordId, { playerId }));
  open.push(client);
  return client;
}

const about = (map: string) => (message: { map?: string }) => message.map === map;
const mapMessage = (message: { type: string }) => message.type === "map";
const aboutMap = (client: Client, map: string) =>
  client.received.filter((message) => (message as { map?: string }).map === map);

describe("Live", () => {
  it("tells a player watching a shared map its version", async () => {
    const player = await connect(DISCORD_IDS.playerOne, "player one");
    const reply = player.next(about(shared.id));
    player.send({ type: "watch", map: shared.id });
    expect(await reply).toEqual({ type: "map", map: shared.id, version: expect.any(String) });
  });

  it("answers a player watching a DM-only map exactly as for one that doesn't exist", async () => {
    const player = await connect(DISCORD_IDS.playerOne, "player one");
    const hidden = player.next(about(secret.id));
    const missing = player.next(about("no-such-map"));
    player.send({ type: "watch", map: secret.id });
    player.send({ type: "watch", map: "no-such-map" });
    const [a, b] = [await hidden, await missing];
    expect(a).toEqual({ type: "gone", map: secret.id });
    expect(b).toEqual({ type: "gone", map: "no-such-map" });
  });

  it("never tells a player anything more about a DM-only map as it changes", async () => {
    const player = await connect(DISCORD_IDS.playerOne, "player one");
    const dm = await connect(DISCORD_IDS.dm);
    for (const client of [player, dm]) client.send({ type: "watch", map: secret.id });
    await briefly();
    const dmHears = dm.next(mapMessage);
    await services.fogs.apply(secret.id, secret.image, [
      { type: "paint", mode: "reveal", shape: { kind: "all" } },
    ]);
    await live.mapChanged(secret.id);
    await dmHears;
    await briefly();
    expect(aboutMap(player, secret.id)).toEqual([{ type: "gone", map: secret.id }]);
  });

  it("never sends a player anything on a map they can't see, though they're still watching it", async () => {
    const player = await connect(DISCORD_IDS.playerOne, "player one");
    const dm = await connect(DISCORD_IDS.dm);
    for (const client of [player, dm]) client.send({ type: "watch", map: secret.id });
    await briefly();
    // PROTOTYPE: the DM drops a token on the hidden map; real tokens will replace this.
    const dmHears = dm.next((message: { type: string }) => message.type === "positions");
    dm.send({ type: "drop", map: secret.id, token: "Party/Fixture PC One", at: [0.1, 0.1] });
    await dmHears;
    await briefly();
    expect(aboutMap(player, secret.id)).toEqual([{ type: "gone", map: secret.id }]);
  });

  it("pushes a fog reveal to everyone watching, each with a new version", async () => {
    const player = await connect(DISCORD_IDS.playerOne, "player one");
    const first = player.next(about(shared.id));
    player.send({ type: "watch", map: shared.id });
    const before = (await first) as { version: string };
    const pushed = player.next(about(shared.id));
    await services.fogs.apply(shared.id, shared.image, [
      { type: "paint", mode: "reveal", shape: { kind: "all" } },
    ]);
    await live.mapChanged(shared.id);
    expect(((await pushed) as { version: string }).version).not.toBe(before.version);
  });

  it("tells a player a map has gone when the DM stops sharing it", async () => {
    const player = await connect(DISCORD_IDS.playerOne, "player one");
    player.send({ type: "watch", map: shared.id });
    await briefly();
    const gone = player.next(about(shared.id));
    await services.maps.setVisibility(shared.id, "dm");
    await live.mapChanged(shared.id);
    expect(await gone).toEqual({ type: "gone", map: shared.id });
  });

  it("closes a removed member's connection, and refuses them when they try again", async () => {
    const player = await connect(DISCORD_IDS.playerOne, "player one");
    const cookie = await cookieFor(services, DISCORD_IDS.playerOne, { playerId: "player one" });
    const dm = await connect(DISCORD_IDS.dm);
    await services.members.remove(DISCORD_IDS.playerOne);
    await live.memberChanged(DISCORD_IDS.playerOne);
    expect(await player.closed).toBe(4000);
    expect(dm.socket.readyState).toBe(dm.socket.OPEN);
    // cookieFor signed them in again above, so remove them for good before retrying.
    await services.members.remove(DISCORD_IDS.playerOne);
    await expect(openClient(base, cookie)).rejects.toThrow(/401/);
  });
});
