import { describe, expect, it } from "vitest";
import type { Member } from "~/members/types";
import { serializeViewCookie } from "../viewer";
import { DEV_DM } from "./dev-login";
import { dmDiscordIds, identify } from "./identify";
import { createSessions } from "./sessions";

const sessions = createSessions({ secrets: ["test"], secure: false });

const member = (discordId: string, more: Partial<Member> = {}): Member => ({
  discordId,
  name: discordId,
  username: discordId,
  status: "approved",
  sessionKey: `key-${discordId}`,
  requestedAt: "2026-01-01T00:00:00.000Z",
  lastSignInAt: "2026-01-01T00:00:00.000Z",
  ...more,
});

/** A stand-in for the member list, and the DM's Discord ID in the settings. */
function servicesWith(members: Member[], { devLogin = false } = {}) {
  return {
    sessions,
    members: { get: async (id: string) => members.find((each) => each.discordId === id) },
    config: { dmDiscordIds: ["dm"], devLogin },
  } as unknown as Parameters<typeof identify>[1];
}

/** A request carrying a session for this Discord ID and key, and the preview cookie if asked. */
async function requestAs(discordId: string, sessionKey = `key-${discordId}`, preview = false) {
  const session = await sessions.getSession();
  session.set("discordId", discordId);
  session.set("sessionKey", sessionKey);
  const cookies = [(await sessions.commitSession(session)).split(";")[0]];
  if (preview) cookies.push((await serializeViewCookie("player")).split(";")[0]);
  return new Request("http://localhost/", { headers: { Cookie: cookies.join("; ") } });
}

describe("identify", () => {
  it("knows nobody without a session", async () => {
    const { account, viewer } = await identify(new Request("http://localhost/"), servicesWith([]));
    expect(account).toEqual({ kind: "anonymous" });
    expect(viewer).toBeUndefined();
  });

  it("gives a member let in by the DM the view of the player they are", async () => {
    const services = servicesWith([member("p1", { playerId: "player one" })]);
    const { account, viewer } = await identify(await requestAs("p1"), services);
    expect(account).toMatchObject({ kind: "member", isDm: false });
    expect(viewer).toEqual({ role: "player", playerId: "player one" });
  });

  it("keeps someone still waiting to be let in from seeing anything", async () => {
    const services = servicesWith([member("new", { status: "pending" })]);
    const { account, viewer } = await identify(await requestAs("new"), services);
    expect(account.kind).toBe("waiting");
    expect(viewer).toBeUndefined();
  });

  it("treats a session from before the member's key changed as nobody's", async () => {
    const services = servicesWith([member("p1")]);
    const { account } = await identify(await requestAs("p1", "an old key"), services);
    expect(account).toEqual({ kind: "anonymous" });
  });

  it("gives the DM the DM's view, or the players' while previewing", async () => {
    const services = servicesWith([member("dm")]);
    expect((await identify(await requestAs("dm"), services)).viewer).toEqual({ role: "dm" });
    const previewing = await identify(await requestAs("dm", "key-dm", true), services);
    expect(previewing.viewer).toEqual({ role: "player" });
  });

  it("ignores the preview setting for players, who can't become the DM with it", async () => {
    const services = servicesWith([member("p1")]);
    const { viewer } = await identify(await requestAs("p1", "key-p1", true), services);
    expect(viewer?.role).toBe("player");
  });
});

describe("dmDiscordIds", () => {
  it("adds the pretend DM only while dev sign-in is on", () => {
    const off = dmDiscordIds({ config: { dmDiscordIds: ["dm"], devLogin: false } } as never);
    const on = dmDiscordIds({ config: { dmDiscordIds: ["dm"], devLogin: true } } as never);
    expect([...off]).toEqual(["dm"]);
    expect([...on]).toEqual(["dm", DEV_DM.discordId]);
  });
});
