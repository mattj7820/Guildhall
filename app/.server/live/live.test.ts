import { mkdtemp, rm } from "node:fs/promises";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Services } from "~/context";
import { inCombat, monster, player as player_ } from "~/combat/test-builders";
import { FIGHT_ROOM, PARTY_ROOM } from "~/live/messages";
import type { StuntEvent } from "~/maps/stunts";
import { aCharacterToken, aMarker } from "~/maps/tokens/test-builders";
import type { Token } from "~/maps/tokens/types";
import type { CampaignMap, Point } from "~/maps/types";
import { FIXTURE_VAULT } from "../../../tests/support/fixture-vault";
import { createSessions } from "../auth/sessions";
import { loadConfig } from "../config";
import { CampaignMaps } from "../maps/campaign-maps";
import { Characters } from "../characters/characters";
import { CurrentFight } from "../combat/current-fight";
import { MapFogs } from "../maps/map-fogs";
import { MapTokens } from "../maps/map-tokens";
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
    tokens: MapTokens.inFolder(folder),
    fight: CurrentFight.inFolder(folder),
    characters: Characters.inFolder(folder),
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
const moving = (token: string) => (message: unknown) =>
  (message as { type: string; token?: string }).type === "moving" &&
  (message as { token?: string }).token === token;
const LIT: Point = [0.1, 0.5];

async function placeOn(map: string, token: Token) {
  await services.tokens.apply(map, [{ type: "place", token }], () => true);
  await live.mapChanged(map);
}
const mapMessage = (message: { type: string }) => message.type === "map";
const aboutMap = (client: Client, map: string) =>
  client.received.filter((message) => (message as { map?: string }).map === map);

describe("Live", () => {
  it("tells the front page who's here, as they come and go", async () => {
    const presence = (message: { type: string }) => message.type === "presence";
    const player = await connect(DISCORD_IDS.playerOne, "player one");
    const first = player.next(presence);
    player.send({ type: "watch", map: PARTY_ROOM });
    // Their own PC, by its name on the party card; the companion is never anyone's.
    expect(await first).toEqual({
      type: "presence",
      map: PARTY_ROOM,
      online: { dm: false, party: ["Fixture PC One"] },
    });

    const dmCame = player.next(presence);
    const dm = await connect(DISCORD_IDS.dm);
    expect(await dmCame).toMatchObject({ online: { dm: true, party: ["Fixture PC One"] } });
    const dmWent = player.next(presence);
    dm.socket.close();
    expect(await dmWent).toMatchObject({ online: { dm: false } });
  });

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
    await placeOn(secret.id, aMarker({ id: "m", map: secret.id, visibility: "players" }));
    const player = await connect(DISCORD_IDS.playerOne, "player one");
    const [dm, dmElsewhere] = [await connect(DISCORD_IDS.dm), await connect(DISCORD_IDS.dm)];
    for (const client of [player, dm, dmElsewhere]) client.send({ type: "watch", map: secret.id });
    await briefly();
    const seen = dmElsewhere.next(moving("m"));
    dm.send({ type: "drag", map: secret.id, token: "m", at: [0.2, 0.2] });
    await seen;
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

  it("tells a player nothing at all when a token they can't see is placed or moved", async () => {
    const player = await connect(DISCORD_IDS.playerOne, "player one");
    const dm = await connect(DISCORD_IDS.dm);
    for (const client of [player, dm]) client.send({ type: "watch", map: shared.id });
    await briefly();
    const before = aboutMap(player, shared.id).length;

    const place = async (token: Token) => {
      const dmHears = dm.next(about(shared.id));
      await services.tokens.apply(shared.id, [{ type: "place", token }], () => true);
      await live.mapChanged(shared.id);
      await dmHears;
      await briefly();
    };
    // A DM-only marker, and another player's PC under the fog (all of it is fogged).
    await place(aMarker({ id: "secret", map: shared.id, visibility: "dm" }));
    await place(aCharacterToken({ id: "two", map: shared.id, note: "Party/Fixture PC Two" }));
    expect(aboutMap(player, shared.id)).toHaveLength(before);

    // Their own PC, which they always see, does reach them.
    const heard = player.next(about(shared.id));
    await services.tokens.apply(
      shared.id,
      [{ type: "place", token: aCharacterToken({ id: "one", map: shared.id }) }],
      () => true,
    );
    await live.mapChanged(shared.id);
    expect(await heard).toMatchObject({
      type: "tokens",
      map: shared.id,
      tokens: [{ name: "Fixture PC One", inTheDark: true, movable: true }],
    });
    expect(JSON.stringify(player.received)).not.toMatch(/secret|Fixture PC Two/);
  });

  it("never sends a player a hidden NPC, nor a shown one's note, its title or image", async () => {
    await services.fogs.apply(shared.id, shared.image, [
      { type: "paint", mode: "reveal", shape: { kind: "all" } },
    ]);
    const player = await connect(DISCORD_IDS.playerOne, "player one");
    const dm = await connect(DISCORD_IDS.dm);
    for (const client of [player, dm]) client.send({ type: "watch", map: shared.id });
    await briefly();
    const npc = aMarker({
      id: "stranger",
      map: shared.id,
      at: LIT,
      name: "Hooded figure",
      note: "NPCs/Fixture Hidden NPC",
      picture: "note",
      visibility: "dm",
    });

    // DM-only: the DM hears of it, the player nothing at all.
    const dmHears = dm.next(about(shared.id));
    await placeOn(shared.id, npc);
    expect(await dmHears).toMatchObject({ tokens: [{ name: "Hooded figure" }] });
    await briefly();
    expect(JSON.stringify(player.received)).not.toMatch(/stranger|Hooded/);

    // Shown: the player gets its own name and a picture by the token, and nothing of the note.
    const heard = player.next(about(shared.id));
    await services.tokens.apply(
      shared.id,
      [{ type: "editMarker", id: "stranger", visibility: "players" }],
      () => true,
    );
    await live.mapChanged(shared.id);
    expect(await heard).toMatchObject({
      type: "tokens",
      tokens: [
        {
          name: "Hooded figure",
          portraitUrl: expect.stringMatching(/\/tokens\/stranger\/picture/),
        },
      ],
    });
    expect(JSON.stringify(player.received)).not.toMatch(
      /Fixture Hidden NPC|fixture-hidden-npc|NPCs\//,
    );
  });

  it("shows everyone the fight as they may see it: players get no HP, initiative or DM notes", async () => {
    const player = await connect(DISCORD_IDS.playerOne, "player one");
    const dm = await connect(DISCORD_IDS.dm);
    const none = player.next((message: { type: string }) => message.type === "fight");
    player.send({ type: "watch", map: FIGHT_ROOM });
    dm.send({ type: "watch", map: FIGHT_ROOM });
    expect(await none).toEqual({ type: "fight", map: FIGHT_ROOM, fight: null });
    await briefly();

    const fight = inCombat(
      [
        player_("Aria", { controller: { id: "player one", name: "Player One" }, initiative: 18 }),
        monster("Goblin 1", { initiative: 9, note: "Secret plan" }),
      ],
      "Aria",
    );
    const playerHears = player.next((message: { type: string }) => message.type === "fight");
    const dmHears = dm.next((message: { type: string }) => message.type === "fight");
    await services.fight.save(fight, 0);
    await live.fightChanged();

    const forPlayer = JSON.stringify(await playerHears);
    expect(forPlayer).toContain('"theirTurn":true');
    expect(forPlayer).not.toMatch(/Secret plan|"hp"|"initiative"|"revision"/);
    expect(JSON.stringify(await dmHears)).toContain("Secret plan");
  });

  describe("stunts", () => {
    const isStunt = (message: unknown) => (message as { type: string }).type === "stunt";

    it("plays a stunt for everyone watching a map they may see, and nobody else", async () => {
      const player = await connect(DISCORD_IDS.playerOne, "player one");
      const dm = await connect(DISCORD_IDS.dm);
      player.send({ type: "watch", map: shared.id });
      player.send({ type: "watch", map: secret.id });
      dm.send({ type: "watch", map: shared.id });
      await briefly();

      const impact: StuntEvent = { id: "s1", kind: "impact", at: [0.9, 0.9], size: 0.1 };
      const playerHears = player.next(isStunt);
      const dmHears = dm.next(isStunt);
      await live.stunt(shared.id, impact);
      expect(await playerHears).toEqual({ type: "stunt", map: shared.id, stunt: impact });
      expect(await dmHears).toEqual({ type: "stunt", map: shared.id, stunt: impact });

      await live.stunt(secret.id, { id: "s2", kind: "shake" });
      await briefly();
      expect(player.received.filter(isStunt)).toHaveLength(1);
    });

    it("plays a token's stunt only for those who may see the token", async () => {
      await placeOn(
        shared.id,
        aMarker({ id: "secret-marker", map: shared.id, visibility: "dm", at: LIT }),
      );
      const player = await connect(DISCORD_IDS.playerOne, "player one");
      const dm = await connect(DISCORD_IDS.dm);
      player.send({ type: "watch", map: shared.id });
      dm.send({ type: "watch", map: shared.id });
      await briefly();

      const dmHears = dm.next(isStunt);
      await live.stunt(shared.id, { id: "s3", kind: "glow", token: "secret-marker", light: 0.2 });
      await dmHears;
      await briefly();
      expect(player.received.filter(isStunt)).toEqual([]);
    });
  });

  describe("dragging", () => {
    /** The shared map with its left half revealed. */
    beforeEach(async () => {
      await services.fogs.apply(shared.id, shared.image, [
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
    });

    async function watching(...clients: Client[]) {
      for (const client of clients) client.send({ type: "watch", map: shared.id });
      await briefly();
    }

    it("shows a drag to those who may see the token there, and to nobody else", async () => {
      await placeOn(
        shared.id,
        aMarker({ id: "shown", map: shared.id, visibility: "players", at: LIT }),
      );
      await placeOn(
        shared.id,
        aMarker({ id: "secret", map: shared.id, visibility: "dm", at: LIT }),
      );
      const player = await connect(DISCORD_IDS.playerOne, "player one");
      const [dm, dmElsewhere] = [await connect(DISCORD_IDS.dm), await connect(DISCORD_IDS.dm)];
      await watching(player, dm, dmElsewhere);

      const playerSees = player.next(moving("shown"));
      dm.send({ type: "drag", map: shared.id, token: "shown", at: [0.3, 0.3] });
      expect(await playerSees).toEqual({
        type: "moving",
        map: shared.id,
        token: "shown",
        at: [0.3, 0.3],
        by: DISCORD_IDS.dm,
      });
      // The one dragging doesn't hear their own drag.
      expect(dm.received.filter(moving("shown"))).toEqual([]);

      const quiet = player.received.length;
      for (const [token, at] of [
        ["secret", [0.3, 0.3]],
        ["shown", [0.8, 0.3]], // into the fog
      ] as const) {
        const dmSees = dmElsewhere.next(
          (message: { at?: Point }) =>
            message.at?.[0] === at[0] && (message as { token?: string }).token === token,
        );
        dm.send({ type: "drag", map: shared.id, token, at });
        await dmSees;
      }
      await briefly();
      expect(player.received).toHaveLength(quiet);
    });

    it("sends nowhere a player's drag of a token that isn't theirs", async () => {
      await placeOn(
        shared.id,
        aCharacterToken({ id: "two", map: shared.id, note: "Party/Fixture PC Two", at: LIT }),
      );
      await placeOn(shared.id, aCharacterToken({ id: "one", map: shared.id, at: LIT }));
      const player = await connect(DISCORD_IDS.playerOne, "player one");
      const dm = await connect(DISCORD_IDS.dm);
      await watching(player, dm);

      player.send({ type: "drag", map: shared.id, token: "two", at: [0.3, 0.3] });
      const own = dm.next(moving("one"));
      player.send({ type: "drag", map: shared.id, token: "one", at: [0.3, 0.3] });
      await own;
      expect(dm.received.filter(moving("two"))).toEqual([]);
    });

    it("in a fight on the map, passes on a player's drag only on their turn", async () => {
      await placeOn(shared.id, aCharacterToken({ id: "one", map: shared.id, at: LIT }));
      const fighting = [
        player_("Fixture PC One", { entityId: "Party/Fixture PC One" }),
        monster("Goblin 1"),
      ];
      await services.fight.save(inCombat(fighting, "Goblin 1"), 0, shared.id);
      await live.fightChanged();
      const player = await connect(DISCORD_IDS.playerOne, "player one");
      const dm = await connect(DISCORD_IDS.dm);
      await watching(player, dm);

      player.send({ type: "drag", map: shared.id, token: "one", at: [0.2, 0.2] });
      await briefly();
      expect(dm.received.filter(moving("one"))).toEqual([]);

      await services.fight.save(inCombat(fighting, "Fixture PC One"), 1);
      await live.fightChanged();
      const own = dm.next(moving("one"));
      player.send({ type: "drag", map: shared.id, token: "one", at: [0.3, 0.3] });
      await own;
    });

    it("never shows players the DM dragging a hidden monster", async () => {
      await services.fight.save(
        inCombat([monster("Ambusher", { hidden: true }), monster("Goblin 1")], "Goblin 1"),
        0,
        shared.id,
      );
      const token = (id: string, combatant: string): Token => ({
        kind: "combatant",
        id,
        map: shared.id,
        at: LIT,
        combatant,
      });
      await placeOn(shared.id, token("ambusher", "Ambusher"));
      await placeOn(shared.id, token("goblin", "Goblin 1"));
      const player = await connect(DISCORD_IDS.playerOne, "player one");
      const dm = await connect(DISCORD_IDS.dm);
      await watching(player, dm);

      dm.send({ type: "drag", map: shared.id, token: "ambusher", at: [0.3, 0.3] });
      const goblin = player.next(moving("goblin"));
      dm.send({ type: "drag", map: shared.id, token: "goblin", at: [0.3, 0.3] });
      await goblin;
      expect(player.received.filter(moving("ambusher"))).toEqual([]);
    });

    it("keeps a token for whoever picked it up, and lets the DM take it", async () => {
      await placeOn(
        shared.id,
        aCharacterToken({ id: "dog", map: shared.id, note: "Bestiary/Fixture Companion", at: LIT }),
      );
      const one = await connect(DISCORD_IDS.playerOne, "player one");
      const two = await connect(DISCORD_IDS.newcomer, "player two");
      const dm = await connect(DISCORD_IDS.dm);
      await watching(one, two, dm);

      const dmSeesOne = dm.next(moving("dog"));
      one.send({ type: "drag", map: shared.id, token: "dog", at: [0.3, 0.3] });
      await dmSeesOne;
      const refused = two.next((message: { type: string }) => message.type === "held");
      two.send({ type: "drag", map: shared.id, token: "dog", at: [0.4, 0.4] });
      expect(await refused).toEqual({
        type: "held",
        map: shared.id,
        token: "dog",
        by: DISCORD_IDS.playerOne,
      });
      expect(live.heldByOther(shared.id, "dog", DISCORD_IDS.newcomer, false)).toBe(
        DISCORD_IDS.playerOne,
      );

      // The DM can always take it.
      const oneSeesDm = one.next(moving("dog"));
      dm.send({ type: "drag", map: shared.id, token: "dog", at: [0.2, 0.2] });
      expect(await oneSeesDm).toMatchObject({ by: DISCORD_IDS.dm });

      // Put down: free for anyone.
      dm.send({ type: "release", map: shared.id, token: "dog" });
      const oneSeesTwo = one.next(moving("dog"));
      two.send({ type: "drag", map: shared.id, token: "dog", at: [0.1, 0.1] });
      expect(await oneSeesTwo).toMatchObject({ by: DISCORD_IDS.newcomer });
    });

    it("frees everything a closed tab held", async () => {
      await placeOn(
        shared.id,
        aCharacterToken({ id: "dog", map: shared.id, note: "Bestiary/Fixture Companion", at: LIT }),
      );
      const one = await connect(DISCORD_IDS.playerOne, "player one");
      const dm = await connect(DISCORD_IDS.dm);
      await watching(one, dm);
      const dmSees = dm.next(moving("dog"));
      one.send({ type: "drag", map: shared.id, token: "dog", at: [0.3, 0.3] });
      await dmSees;
      one.socket.close();
      await one.closed;
      await briefly();
      expect(live.heldByOther(shared.id, "dog", DISCORD_IDS.newcomer, false)).toBeUndefined();
    });
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
