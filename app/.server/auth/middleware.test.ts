import { RouterContextProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { accountContext, servicesContext, viewerContext } from "~/context";
import type { Member } from "~/members/types";
import { authMiddleware } from "./middleware";
import { createSessions, REFRESH_AFTER_MS } from "./sessions";

const ORIGIN = "https://guildhall.example";
const sessions = createSessions({ secrets: ["test"], secure: true });
const player: Member = {
  discordId: "p1",
  name: "Player One",
  username: "p1",
  status: "approved",
  sessionKey: "key",
  playerId: "player one",
  requestedAt: "2026-01-01T00:00:00.000Z",
  lastSignInAt: "2026-01-01T00:00:00.000Z",
};

/** Runs the middleware for a request; answers with what it returned or threw, and the context. */
async function run(
  path: string,
  { method = "GET", accept = "text/html", origin, cookie }: Partial<Record<string, string>> = {},
) {
  const context = new RouterContextProvider();
  context.set(servicesContext, {
    sessions,
    members: { get: async (id: string) => (id === player.discordId ? player : undefined) },
    config: { publicUrl: ORIGIN, publicUrlIsSet: true, dmDiscordIds: [], devLogin: false },
  } as never);
  const headers = new Headers({ Accept: accept });
  if (origin) headers.set("Origin", origin);
  if (cookie) headers.set("Cookie", cookie);
  const request = new Request(`${ORIGIN}${path}`, { method, headers });
  const url = new URL(request.url.replace(/\.data$/, ""));
  const next = vi.fn(async () => new Response("the page"));
  let result: unknown;
  try {
    result = await authMiddleware({ request, context, url, params: {} } as never, next);
  } catch (thrown) {
    result = thrown;
  }
  return { result, next, context };
}

/** The player's session cookie, issued this long ago. */
async function playerCookie(age = 0) {
  const session = await sessions.getSession();
  session.set("discordId", player.discordId);
  session.set("sessionKey", player.sessionKey);
  session.set("issuedAt", Date.now() - age);
  return (await sessions.commitSession(session)).split(";")[0];
}

const status = (result: unknown) =>
  result instanceof Response
    ? result.status
    : (result as { init?: { status?: number } }).init?.status;

describe("authMiddleware", () => {
  it("refuses a change posted from another site, before reading who it's from", async () => {
    const { result, next } = await run("/logout", {
      method: "POST",
      origin: "https://evil.example",
    });
    expect(status(result)).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("sends someone signed out to sign in, and back to the page afterwards", async () => {
    const { result } = await run("/wiki/Home");
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).headers.get("Location")).toBe("/login?redirectTo=%2Fwiki%2FHome");
  });

  it("refuses files to someone signed out, with nowhere to send them", async () => {
    const { result } = await run("/vault-asset/a.png", { accept: "image/*" });
    expect(status(result)).toBe(401);
  });

  it("treats React Router's data requests as pages", async () => {
    const { result } = await run("/wiki/Home.data", { accept: "*/*" });
    expect((result as Response).headers.get("Location")).toMatch(/^\/login/);
  });

  it("lets a member in, with their account and the view of the player they are", async () => {
    const { result, next, context } = await run("/wiki", { cookie: await playerCookie() });
    expect(next).toHaveBeenCalled();
    expect(await (result as Response).text()).toBe("the page");
    expect(context.get(accountContext)).toMatchObject({ kind: "member", isDm: false });
    expect(context.get(viewerContext)).toEqual({ role: "player", playerId: "player one" });
  });

  it("refreshes a day-old session cookie when a page loads, and only then", async () => {
    const old = await playerCookie(REFRESH_AFTER_MS + 1000);
    const refreshed = await run("/wiki", { cookie: old });
    expect((refreshed.result as Response).headers.get("Set-Cookie")).toMatch(/^__Host-guildhall=/);

    for (const notAPage of [
      await run("/wiki.data", { cookie: old, accept: "*/*" }),
      await run("/wiki", { cookie: await playerCookie() }),
    ]) {
      expect((notAPage.result as Response).headers.get("Set-Cookie")).toBeNull();
    }
  });
});
