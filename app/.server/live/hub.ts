import type { WebSocket } from "ws";
import type { PlayerId, Viewer } from "~/campaign/types";
import {
  CLOSE_ACCESS_CHANGED,
  CLOSE_CAMPAIGN_CHANGED,
  clientMessageSchema,
  stateKey,
  type ClientMessage,
  type ServerMessage,
} from "~/live/messages";
import type { MapId } from "~/maps/types";
import type { Member } from "~/members/types";
import type { Admitted } from "./sockets";

/** An open live connection: one per browser tab. */
export interface Connection {
  readonly who: Admitted;
  /** The maps it's watching. */
  readonly maps: ReadonlySet<MapId>;
}

/** What someone gets on starting to watch a map: its state as they may see it. */
export type JoinRoom = (map: MapId, viewer: Viewer) => Promise<ServerMessage[]>;

/** Builds one viewer's copy of a message, or nothing if there's nothing for them. */
export type BuildMessage = (
  viewer: Viewer,
) => ServerMessage | undefined | Promise<ServerMessage | undefined>;

interface Options {
  /** How often to check a connection is still there. */
  heartbeatMs?: number;
  /** How often to check everyone is still let in, as they were. */
  recheckMs?: number;
}

/** A tab watches one map at a time; a few more allows for switching. */
const MAX_ROOMS = 8;
/** Messages a connection may send each second; more are ignored, and far more close it. */
const MESSAGES_PER_SECOND = 40;
const CLOSE_AT_PER_SECOND = 200;

interface Open extends Connection {
  readonly socket: WebSocket;
  readonly maps: Set<MapId>;
  /** The last state message sent under each key. */
  readonly sent: Map<string, string>;
  alive: boolean;
  window: { start: number; count: number };
}

/**
 * Every open live connection, with the maps each is watching. The only way to send anything is
 * `publish`, which builds each message for the viewer who gets it, so nothing is ever sent to a
 * room as a whole.
 */
export interface Online {
  dm: boolean;
  players: ReadonlySet<PlayerId>;
}

export class LiveHub {
  private readonly open = new Set<Open>();
  private readonly timers: ReturnType<typeof setInterval>[];

  constructor(
    private readonly deps: {
      join: JoinRoom;
      members: { get(discordId: string): Promise<Member | undefined> };
      /** Messages about what's on a map (dragging tokens), for someone else to handle. */
      onMessage?: (connection: Connection, message: ClientMessage) => void;
      /** A connection has opened. */
      onOpen?: (connection: Connection) => void;
      /** A connection has closed. */
      onClose?: (connection: Connection) => void;
    },
    { heartbeatMs = 25_000, recheckMs = 60_000 }: Options = {},
  ) {
    this.timers = [
      setInterval(() => this.heartbeat(), heartbeatMs),
      setInterval(() => void this.recheck(), recheckMs),
    ];
    for (const timer of this.timers) timer.unref?.();
  }

  get size(): number {
    return this.open.size;
  }

  connect(socket: WebSocket, who: Admitted): Connection {
    const connection: Open = {
      socket,
      who,
      maps: new Set(),
      sent: new Map(),
      alive: true,
      window: { start: Date.now(), count: 0 },
    };
    this.open.add(connection);
    socket.on("close", () => {
      this.open.delete(connection);
      this.deps.onClose?.(connection);
    });
    this.deps.onOpen?.(connection);
    socket.on("pong", () => (connection.alive = true));
    socket.on("message", (data, isBinary) => {
      if (isBinary || !this.withinLimit(connection)) return;
      let message: unknown;
      try {
        message = JSON.parse(String(data));
      } catch {
        return;
      }
      void this.receive(connection, message);
    });
    return connection;
  }

  /**
   * Sends to everyone watching the map, each their own copy (built once per distinct viewer).
   * `except` leaves out the connection a change came from.
   */
  async publish(map: MapId, build: BuildMessage, except?: Connection): Promise<void> {
    const copies = new Map<string, Promise<ServerMessage | undefined>>();
    const watching = [...this.open].filter((each) => each.maps.has(map) && each !== except);
    await Promise.all(
      watching.map(async (connection) => {
        const key = JSON.stringify(connection.who.viewer);
        let copy = copies.get(key);
        if (!copy) {
          copy = Promise.resolve(build(connection.who.viewer));
          copies.set(key, copy);
        }
        const message = await copy;
        if (message) this.send(connection, message);
      }),
    );
  }

  /** Answers one connection, with a message its caller built for that connection's viewer. */
  reply(connection: Connection, message: ServerMessage): void {
    const open = [...this.open].find((each) => each === connection);
    if (open) this.send(open, message);
  }

  /** Who has a connection open: whether the DM does, and which players. */
  online(): Online {
    const who = [...this.open].map((connection) => connection.who.account);
    return {
      dm: who.some((account) => account.isDm),
      players: new Set(who.flatMap((account) => account.member.playerId ?? [])),
    };
  }

  /** The maps being watched by anyone. */
  watchedMaps(): MapId[] {
    return [...new Set([...this.open].flatMap((connection) => [...connection.maps]))];
  }

  /**
   * Closes the connections of anyone who is no longer let in as they were: removed, signed out
   * everywhere, or now someone else's player. Their browsers reconnect, and are signed in afresh
   * (or refused). Only the given member, if one is named.
   */
  async recheck(discordId?: string): Promise<void> {
    const connections = [...this.open].filter(
      (connection) => !discordId || connection.who.account.member.discordId === discordId,
    );
    const members = new Map<string, Promise<Member | undefined>>();
    await Promise.all(
      connections.map(async (connection) => {
        const was = connection.who.account.member;
        let now = members.get(was.discordId);
        if (!now) {
          now = this.deps.members.get(was.discordId);
          members.set(was.discordId, now);
        }
        if (!stillLetIn(connection.who, await now)) {
          connection.socket.close(CLOSE_ACCESS_CHANGED, "Access changed");
          this.open.delete(connection);
        }
      }),
    );
  }

  /** Closes every connection because the DM switched campaigns: their pages load afresh. */
  campaignChanged(): void {
    for (const connection of this.open) {
      connection.socket.close(CLOSE_CAMPAIGN_CHANGED, "Campaign changed");
    }
    this.open.clear();
  }

  close(): void {
    for (const timer of this.timers) clearInterval(timer);
    for (const connection of this.open) connection.socket.close(1012, "Restarting");
    this.open.clear();
  }

  private async receive(connection: Open, raw: unknown): Promise<void> {
    const parsed = clientMessageSchema.safeParse(raw);
    if (!parsed.success) return;
    const message = parsed.data;
    if (message.type !== "watch" && message.type !== "unwatch") {
      return this.deps.onMessage?.(connection, message);
    }
    if (message.type === "unwatch") {
      connection.maps.delete(message.map);
      forgetSent(connection, message.map);
      return;
    }
    if (!connection.maps.has(message.map) && connection.maps.size >= MAX_ROOMS) return;
    connection.maps.add(message.map);
    const replies = await this.deps.join(message.map, connection.who.viewer);
    // Watching again (after the page reloads its data, say) always gets the state, even if the
    // connection was sent the same before.
    forgetSent(connection, message.map);
    for (const reply of replies) this.send(connection, reply);
  }

  private send(connection: Open, message: ServerMessage): void {
    const text = JSON.stringify(message);
    const key = stateKey(message);
    if (key) {
      if (connection.sent.get(key) === text) return;
      connection.sent.set(key, text);
    }
    if (connection.socket.readyState === connection.socket.OPEN) connection.socket.send(text);
  }

  private withinLimit(connection: Open): boolean {
    const now = Date.now();
    if (now - connection.window.start >= 1000) connection.window = { start: now, count: 0 };
    connection.window.count++;
    if (connection.window.count > CLOSE_AT_PER_SECOND) {
      connection.socket.close(1008, "Too many messages");
      return false;
    }
    return connection.window.count <= MESSAGES_PER_SECOND;
  }

  /** Drops connections that didn't answer the last ping (a closed laptop, a lost network). */
  private heartbeat(): void {
    for (const connection of this.open) {
      if (!connection.alive) {
        connection.socket.terminate();
        this.open.delete(connection);
        continue;
      }
      connection.alive = false;
      connection.socket.ping();
    }
  }
}

function forgetSent(connection: Open, map: MapId): void {
  for (const key of connection.sent.keys()) {
    if (key.endsWith(`:${map}`)) connection.sent.delete(key);
  }
}

/** Whether someone is still let in exactly as when they connected. */
export function stillLetIn({ account }: Admitted, now: Member | undefined): boolean {
  const was = account.member;
  if (!now || now.sessionKey !== was.sessionKey) return false;
  if (!account.isDm && now.status !== "approved") return false;
  return now.playerId === was.playerId;
}
