/** Helpers for tests of live connections over a real server. */
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket } from "ws";
import type { Sessions } from "../auth/sessions";
import type { Members } from "../members/members";

export const PUBLIC_URL = "http://guildhall.test";

export const DISCORD_IDS = {
  dm: "100000000000000001",
  playerOne: "100000000000000002",
  newcomer: "100000000000000003",
} as const;

/** A plain HTTP server handing upgrades to `handleUpgrade`; its `ws://` address. */
export async function serveUpgrades(
  handleUpgrade: (req: IncomingMessage, socket: Duplex, head: Buffer) => Promise<void>,
): Promise<{ base: string; server: Server }> {
  const server = createServer((_req, res) => res.end());
  server.on("upgrade", (req, socket, head) => void handleUpgrade(req, socket, head));
  server.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  return { server, base: `ws://127.0.0.1:${(server.address() as AddressInfo).port}` };
}

/** Signs someone in and returns the session cookie their browser would send. */
export async function cookieFor(
  { members, sessions }: { members: Members; sessions: Sessions },
  discordId: string,
  { approve = true, playerId = "" } = {},
): Promise<string> {
  const signedIn = await members.signIn(
    { discordId, username: discordId, name: discordId },
    { approve },
  );
  if (!("member" in signedIn)) throw new Error("Not signed in");
  if (playerId) await members.assignPlayer(discordId, playerId);
  const session = await sessions.getSession();
  session.set("discordId", discordId);
  session.set("sessionKey", signedIn.member.sessionKey);
  session.set("issuedAt", Date.now());
  return (await sessions.commitSession(session)).split(";")[0];
}

/** An open connection that keeps everything it's sent, parsed. */
export interface Client {
  socket: WebSocket;
  received: unknown[];
  send(message: unknown): void;
  /** Waits for a message matching the test, arriving from now on, and returns it. */
  next(match: (message: never) => boolean, timeoutMs?: number): Promise<unknown>;
  closed: Promise<number>;
}

export async function openClient(base: string, cookie: string): Promise<Client> {
  const socket = new WebSocket(`${base}/live`, { headers: { Cookie: cookie, Origin: PUBLIC_URL } });
  const received: unknown[] = [];
  const waiting = new Set<() => void>();
  socket.on("message", (data) => {
    received.push(JSON.parse(String(data)));
    for (const check of waiting) check();
  });
  const closed = new Promise<number>((resolve) => socket.once("close", resolve));
  await new Promise((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });
  return {
    socket,
    received,
    closed,
    send: (message) => socket.send(JSON.stringify(message)),
    next(match, timeoutMs = 2000) {
      const from = received.length;
      return new Promise((resolve, reject) => {
        const check = () => {
          const found = received.slice(from).find((message) => match(message as never));
          if (found) {
            waiting.delete(check);
            clearTimeout(timer);
            resolve(found);
          }
        };
        const timer = setTimeout(() => {
          waiting.delete(check);
          reject(new Error(`Nothing matching arrived; got ${JSON.stringify(received)}`));
        }, timeoutMs);
        waiting.add(check);
        check();
      });
    },
  };
}

/** Lets messages already on their way arrive. */
export const briefly = () => new Promise((resolve) => setTimeout(resolve, 100));
