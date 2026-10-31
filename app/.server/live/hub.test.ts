import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { WebSocket } from "ws";
import { DM_VIEWER, type Viewer } from "~/campaign/types";
import { CLOSE_ACCESS_CHANGED, type ClientMessage, type ServerMessage } from "~/live/messages";
import type { Member } from "~/members/types";
import { LiveHub, stillLetIn, type Connection } from "./hub";
import type { Admitted } from "./sockets";

/** Stands in for a websocket: records what's sent, and lets a test say what arrives. */
class FakeSocket extends EventEmitter {
  readonly OPEN = 1;
  readyState = 1;
  sent: ServerMessage[] = [];
  closed?: number;
  pings = 0;
  terminated = false;
  /** Like a browser that's still there, answers pings. */
  answersPings = true;
  send(text: string) {
    this.sent.push(JSON.parse(text));
  }
  close(code: number) {
    this.closed = code;
    this.readyState = 3;
    this.emit("close");
  }
  ping() {
    this.pings++;
    if (this.answersPings) queueMicrotask(() => this.emit("pong"));
  }
  terminate() {
    this.terminated = true;
    this.close(1006);
  }
  /** A message from the browser. */
  says(message: unknown) {
    this.emit("message", Buffer.from(JSON.stringify(message)), false);
  }
}

const member = (discordId: string, extra: Partial<Member> = {}): Member => ({
  discordId,
  name: discordId,
  username: discordId,
  status: "approved",
  sessionKey: `key-${discordId}`,
  requestedAt: "2026-09-29T00:00:00.000Z",
  lastSignInAt: "2026-09-29T00:00:00.000Z",
  ...extra,
});

const playerOne: Viewer = { role: "player", playerId: "player one" };
const DRAG: ClientMessage = { type: "drag", map: "m", token: "dog", at: [0.5, 0.5] };
const dm = (): Admitted => ({
  account: { kind: "member", member: member("dm"), isDm: true },
  viewer: DM_VIEWER,
});
const player = (id = "p1", playerId = "player one"): Admitted => ({
  account: { kind: "member", member: member(id, { playerId }), isDm: false },
  viewer: { role: "player", playerId },
});

let stored: Map<string, Member>;
let hub: LiveHub;
let join: Mock<(map: string, viewer: Viewer) => Promise<ServerMessage[]>>;
let other: Mock<(connection: Connection, message: ClientMessage) => void>;
let closed: Mock<(connection: Connection) => void>;
let opened: Mock<(connection: Connection) => void>;

beforeEach(() => {
  vi.useFakeTimers();
  stored = new Map([
    ["dm", member("dm")],
    ["p1", member("p1", { playerId: "player one" })],
  ]);
  join = vi.fn(async (map: string, viewer: Viewer): Promise<ServerMessage[]> => [
    viewer.role === "dm" || map === "shared"
      ? { type: "map", map, version: "v1" }
      : { type: "gone", map },
  ]);
  other = vi.fn<(connection: Connection, message: ClientMessage) => void>();
  closed = vi.fn<(connection: Connection) => void>();
  opened = vi.fn<(connection: Connection) => void>();
  hub = new LiveHub(
    {
      join,
      members: { get: async (id) => stored.get(id) },
      onMessage: other,
      onOpen: opened,
      onClose: closed,
    },
    { heartbeatMs: 1000, recheckMs: 60_000 },
  );
});

afterEach(() => {
  hub.close();
  vi.useRealTimers();
});

function connect(who: Admitted): FakeSocket {
  return connectWith(who).socket;
}

function connectWith(who: Admitted) {
  const socket = new FakeSocket();
  return { socket, connection: hub.connect(socket as unknown as WebSocket, who) };
}

/** Lets the hub's promises settle. */
const settle = () => vi.advanceTimersByTimeAsync(0);

describe("LiveHub", () => {
  it("answers watching a map with its state as that viewer may see it", async () => {
    const socket = connect(player());
    socket.says({ type: "watch", map: "shared" });
    socket.says({ type: "watch", map: "secret" });
    await settle();
    expect(socket.sent).toEqual([
      { type: "map", map: "shared", version: "v1" },
      { type: "gone", map: "secret" },
    ]);
    expect(join).toHaveBeenCalledWith("shared", playerOne);
  });

  it("sends each watcher their own copy, built once per kind of viewer", async () => {
    const [a, b, d] = [connect(player("p1")), connect(player("p1")), connect(dm())];
    for (const socket of [a, b, d]) socket.says({ type: "watch", map: "m" });
    await settle();
    const build = vi.fn((viewer: Viewer): ServerMessage => ({
      type: "map",
      map: "m",
      version: viewer.role,
    }));
    await hub.publish("m", build);
    expect(a.sent.at(-1)).toEqual({ type: "map", map: "m", version: "player" });
    expect(b.sent.at(-1)).toEqual({ type: "map", map: "m", version: "player" });
    expect(d.sent.at(-1)).toEqual({ type: "map", map: "m", version: "dm" });
    expect(build).toHaveBeenCalledTimes(2);
  });

  it("sends nothing to a viewer whose copy is nothing", async () => {
    const [p, d] = [connect(player()), connect(dm())];
    for (const socket of [p, d]) socket.says({ type: "watch", map: "shared" });
    await settle();
    const before = p.sent.length;
    await hub.publish("shared", (viewer) =>
      viewer.role === "dm" ? { type: "map", map: "shared", version: "v2" } : undefined,
    );
    expect(p.sent).toHaveLength(before);
    expect(d.sent.at(-1)).toEqual({ type: "map", map: "shared", version: "v2" });
  });

  it("doesn't repeat a state a connection already has, so nothing hints at hidden changes", async () => {
    const socket = connect(player());
    socket.says({ type: "watch", map: "shared" });
    await settle();
    await hub.publish("shared", () => ({ type: "map", map: "shared", version: "v1" }));
    expect(socket.sent).toEqual([{ type: "map", map: "shared", version: "v1" }]);
  });

  it("sends the state again when a map is watched again, after reconnecting say", async () => {
    const socket = connect(player());
    socket.says({ type: "watch", map: "shared" });
    socket.says({ type: "watch", map: "shared" });
    await settle();
    expect(socket.sent).toHaveLength(2);
  });

  it("only sends to connections watching the map, and not to the one a change came from", async () => {
    const [watching, elsewhere] = [connect(dm()), connect(dm())];
    const source = connectWith(dm());
    watching.says({ type: "watch", map: "m" });
    source.socket.says({ type: "watch", map: "m" });
    elsewhere.says({ type: "watch", map: "other" });
    await settle();
    const counts = [watching, elsewhere, source.socket].map((socket) => socket.sent.length);
    await hub.publish("m", () => ({ type: "gone", map: "m" }), source.connection);
    expect(watching.sent.length).toBe(counts[0] + 1);
    expect(elsewhere.sent.length).toBe(counts[1]);
    expect(source.socket.sent.length).toBe(counts[2]);
  });

  it("stops sending about a map once it's no longer watched", async () => {
    const socket = connect(dm());
    socket.says({ type: "watch", map: "m" });
    socket.says({ type: "unwatch", map: "m" });
    await settle();
    await hub.publish("m", () => ({ type: "map", map: "m", version: "v9" }));
    expect(socket.sent.map((message) => message.type === "map" && message.version)).toEqual(["v1"]);
  });

  it("passes messages about what's on a map on, with who sent them", async () => {
    const socket = connect(player());
    socket.says(DRAG);
    await settle();
    expect(other).toHaveBeenCalledWith(
      expect.objectContaining({ who: expect.objectContaining({ viewer: playerOne }) }),
      DRAG,
    );
  });

  it("ignores messages that aren't JSON, binary, or not one it knows", async () => {
    const socket = connect(player());
    socket.emit("message", Buffer.from("not json"), false);
    socket.emit("message", Buffer.from(JSON.stringify(DRAG)), true);
    socket.says({ type: "something-else" });
    socket.says({ ...DRAG, at: [2, 2] });
    await settle();
    expect(other).not.toHaveBeenCalled();
    expect(socket.closed).toBeUndefined();
  });

  it("ignores messages beyond its limit each second, and closes a flooding connection", async () => {
    const socket = connect(player());
    for (let i = 0; i < 50; i++) socket.says(DRAG);
    await settle();
    expect(other).toHaveBeenCalledTimes(40);
    for (let i = 0; i < 200; i++) socket.says(DRAG);
    expect(socket.closed).toBe(1008);
  });

  it("says when a connection has closed", () => {
    const socket = connect(player());
    socket.close(1000);
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it("says when a connection has opened", () => {
    connect(player());
    expect(opened).toHaveBeenCalledTimes(1);
  });

  it("knows who has a connection open: the DM, and players by ID, until they close", () => {
    expect(hub.online()).toEqual({ dm: false, players: new Set() });
    const theirs = connect(player());
    connect(player("p1", "player one"));
    connect(dm());
    expect(hub.online()).toEqual({ dm: true, players: new Set(["player one"]) });
    theirs.close(1000);
    expect(hub.online().players).toEqual(new Set(["player one"]));
  });

  it("answers one connection only when replying", async () => {
    const [asker, other] = [connectWith(player()), connect(player())];
    hub.reply(asker.connection, { type: "held", map: "m", token: "dog", by: "Player Two" });
    expect(asker.socket.sent).toEqual([{ type: "held", map: "m", token: "dog", by: "Player Two" }]);
    expect(other.sent).toEqual([]);
  });

  it("closes connections that stop answering pings", async () => {
    const quiet = connect(player());
    const lively = connect(player());
    quiet.answersPings = false;
    await vi.advanceTimersByTimeAsync(2000);
    expect(quiet.terminated).toBe(true);
    expect(lively.terminated).toBe(false);
    expect(hub.size).toBe(1);
  });

  describe("rechecking who is let in", () => {
    it("closes a removed member's connections, and leaves others open", async () => {
      const [removed, stays] = [connect(player("p1")), connect(dm())];
      stored.delete("p1");
      await hub.recheck("p1");
      expect(removed.closed).toBe(CLOSE_ACCESS_CHANGED);
      expect(stays.closed).toBeUndefined();
    });

    it("closes the connections of a member now playing someone else", async () => {
      const socket = connect(player("p1", "player one"));
      stored.set("p1", member("p1", { playerId: "player two" }));
      await hub.recheck();
      expect(socket.closed).toBe(CLOSE_ACCESS_CHANGED);
    });

    it("rechecks everyone every minute, without being asked", async () => {
      const socket = connect(player("p1"));
      stored.delete("p1");
      await vi.advanceTimersByTimeAsync(60_000);
      expect(socket.closed).toBe(CLOSE_ACCESS_CHANGED);
    });

    it("stops sending to a closed connection", async () => {
      const socket = connect(player("p1"));
      socket.says({ type: "watch", map: "shared" });
      await settle();
      stored.delete("p1");
      await hub.recheck("p1");
      const before = socket.sent.length;
      await hub.publish("shared", () => ({ type: "map", map: "shared", version: "v2" }));
      expect(socket.sent).toHaveLength(before);
    });
  });

  it("closes every connection as restarting when it's closed", () => {
    const socket = connect(player());
    hub.close();
    expect(socket.closed).toBe(1012);
    expect(hub.size).toBe(0);
  });
});

describe("stillLetIn", () => {
  const was = player("p1", "player one");
  it.each<[string, Member | undefined, boolean]>([
    ["unchanged", member("p1", { playerId: "player one" }), true],
    ["removed", undefined, false],
    [
      "signed out everywhere (a new session key)",
      member("p1", { sessionKey: "new", playerId: "player one" }),
      false,
    ],
    [
      "back on the waiting list",
      member("p1", { status: "pending", playerId: "player one" }),
      false,
    ],
    ["now another player", member("p1", { playerId: "player two" }), false],
    ["now no player at all", member("p1"), false],
  ])("%s: %s", (_name, now, expected) => {
    expect(stillLetIn(was, now)).toBe(expected);
  });
});
