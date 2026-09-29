import { mkdtemp, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import type { Config } from "../config";
import { createSessions } from "../auth/sessions";
import { Members } from "../members/members";
import { LiveSockets, type Admitted } from "./sockets";

const PUBLIC_URL = "http://guildhall.test";
const config = {
  publicUrl: PUBLIC_URL,
  publicUrlIsSet: true,
  devLogin: false,
  dmDiscordIds: ["100000000000000001"],
} as Pick<Config, "publicUrl" | "publicUrlIsSet" | "devLogin" | "dmDiscordIds"> as Config;
const sessions = createSessions({
  secrets: ["test-secret-test-secret-test-secret"],
  secure: false,
});

let folder: string;
let members: Members;
let live: LiveSockets;
let server: Server;
let base: string;
let admitted: Admitted[];

beforeEach(async () => {
  folder = await mkdtemp(path.join(tmpdir(), "guildhall-live-"));
  members = Members.inFolder(folder);
  admitted = [];
  live = new LiveSockets({ config, members, sessions }, (socket, who) => {
    admitted.push(who);
    socket.send("hello");
  });
  server = createServer((_req, res) => res.end());
  server.on("upgrade", (req, socket, head) => void live.handleUpgrade(req, socket, head));
  server.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `ws://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  live.close();
  await new Promise((resolve) => server.close(resolve));
  await rm(folder, { recursive: true, force: true });
});

/** A signed session cookie for someone, as their browser would send it. */
async function cookieFor(discordId: string, { approve = true, playerId = "" } = {}) {
  const signedIn = await members.signIn(
    { discordId, username: discordId, name: discordId },
    {
      approve,
    },
  );
  if (!("member" in signedIn)) throw new Error("Not signed in");
  if (playerId) await members.assignPlayer(discordId, playerId);
  const session = await sessions.getSession();
  session.set("discordId", discordId);
  session.set("sessionKey", signedIn.member.sessionKey);
  session.set("issuedAt", Date.now());
  return (await sessions.commitSession(session)).split(";")[0];
}

/** Opens a connection and says how it went: the first message, or the HTTP status it got. */
function connect(
  headers: Record<string, string>,
  pathname = "/live",
): Promise<{ opened: string } | { status: number }> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`${base}${pathname}`, { headers });
    socket.once("message", (data) => {
      resolve({ opened: String(data) });
      socket.close();
    });
    socket.once("unexpected-response", (_req, res) => resolve({ status: res.statusCode ?? 0 }));
    socket.once("error", (error) => {
      if (!("code" in error && error.code === "ECONNRESET")) reject(error);
    });
  });
}

describe("LiveSockets", () => {
  it("lets a signed-in player in, as the player they are", async () => {
    const cookie = await cookieFor("100000000000000002", { playerId: "player one" });
    expect(await connect({ Cookie: cookie, Origin: PUBLIC_URL })).toEqual({ opened: "hello" });
    expect(admitted[0].viewer).toEqual({ role: "player", playerId: "player one" });
  });

  it("lets the DM in with the DM's view", async () => {
    const cookie = await cookieFor("100000000000000001");
    expect(await connect({ Cookie: cookie, Origin: PUBLIC_URL })).toEqual({ opened: "hello" });
    expect(admitted[0].viewer).toEqual({ role: "dm" });
  });

  it("refuses a connection without a session", async () => {
    expect(await connect({ Origin: PUBLIC_URL })).toEqual({ status: 401 });
  });

  it("refuses a forged cookie", async () => {
    const cookie = await cookieFor("100000000000000002");
    const forged = cookie.replace(/=(.)/, (_, first) => `=${first === "e" ? "f" : "e"}`);
    expect(await connect({ Cookie: forged, Origin: PUBLIC_URL })).toEqual({ status: 401 });
  });

  it.each([
    ["another site", { Origin: "https://evil.example.net" }],
    ["no Origin at all", {}],
  ])("refuses a signed-in member's connection from %s", async (_name, origin) => {
    const cookie = await cookieFor("100000000000000002");
    expect(await connect({ Cookie: cookie, ...origin })).toEqual({ status: 403 });
    expect(admitted).toEqual([]);
  });

  it("refuses someone still waiting for the DM", async () => {
    const cookie = await cookieFor("100000000000000003", { approve: false });
    expect(await connect({ Cookie: cookie, Origin: PUBLIC_URL })).toEqual({ status: 403 });
  });

  it("refuses a removed member, whose cookie is still validly signed", async () => {
    const cookie = await cookieFor("100000000000000002");
    await members.remove("100000000000000002");
    expect(await connect({ Cookie: cookie, Origin: PUBLIC_URL })).toEqual({ status: 401 });
  });

  it("answers anything other than the live path with 404", async () => {
    const cookie = await cookieFor("100000000000000002");
    expect(await connect({ Cookie: cookie, Origin: PUBLIC_URL }, "/elsewhere")).toEqual({
      status: 404,
    });
  });

  it("closes open connections as restarting when it's closed, so browsers reconnect", async () => {
    const cookie = await cookieFor("100000000000000002");
    const socket = new WebSocket(`${base}/live`, {
      headers: { Cookie: cookie, Origin: PUBLIC_URL },
    });
    await new Promise((resolve) => socket.once("message", resolve));
    const closed = new Promise((resolve) => socket.once("close", resolve));
    live.close();
    expect(await closed).toBe(1012);
  });
});
