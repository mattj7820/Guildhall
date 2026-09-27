import { describe, expect, it } from "vitest";
import type { Member } from "~/members/types";
import { ANONYMOUS, type Account } from "./account";
import { access } from "./access";

const someone = { discordId: "123456789012345678", name: "Sam" } as Member;
const member: Account = { kind: "member", member: someone, isDm: false };
const waiting: Account = { kind: "waiting", member: someone };
const page = { wantsPage: true };
const at = (path: string) => new URL(path, "http://localhost");
const notPage = { wantsPage: false };

describe("access", () => {
  it.each(["/login", "/logout", "/auth/discord", "/auth/discord/callback"])(
    "lets anyone reach %s",
    (path) => {
      expect(access(ANONYMOUS, at(path), page)).toEqual({ allow: true });
      expect(access(waiting, at(path), notPage)).toEqual({ allow: true });
    },
  );

  it("sends someone signed out to sign in, and back to where they were going after", () => {
    expect(access(ANONYMOUS, at("/wiki/NPCs/Mira Stonehand"), page)).toEqual({
      // The path is already percent-encoded, and is encoded once more as a query value.
      redirect: "/login?redirectTo=%2Fwiki%2FNPCs%2FMira%2520Stonehand",
    });
    expect(access(ANONYMOUS, at("/"), page)).toEqual({ redirect: "/login" });
  });

  it("remembers the query too, such as an encounter to start", () => {
    expect(access(ANONYMOUS, at("/combat?start=abc"), page)).toEqual({
      redirect: "/login?redirectTo=%2Fcombat%3Fstart%3Dabc",
    });
  });

  it("refuses images and data to someone signed out, with nothing to redirect", () => {
    expect(access(ANONYMOUS, at("/vault-asset/Attachments/map.png"), notPage)).toEqual({
      status: 401,
    });
  });

  it("keeps someone waiting for the DM on the waiting page", () => {
    expect(access(waiting, at("/wiki"), page)).toEqual({ redirect: "/waiting" });
    expect(access(waiting, at("/waiting"), page)).toEqual({ allow: true });
    expect(access(waiting, at("/vault-asset/Attachments/map.png"), notPage)).toEqual({
      status: 401,
    });
  });

  it("lets members everywhere, and past the waiting page once they're in", () => {
    expect(access(member, at("/combat"), page)).toEqual({ allow: true });
    expect(access(member, at("/vault-asset/Attachments/map.png"), notPage)).toEqual({
      allow: true,
    });
    expect(access(member, at("/waiting"), page)).toEqual({ redirect: "/" });
  });

  it("keeps the waiting page from someone signed out", () => {
    expect(access(ANONYMOUS, at("/waiting"), page)).toEqual({
      redirect: "/login?redirectTo=%2Fwaiting",
    });
  });
});
