import { describe, expect, it } from "vitest";
import { DM_VIEWER, PLAYER_VIEWER } from "~/campaign/types";
import type { Member } from "~/members/types";
import { ANONYMOUS, resolveAccount, viewerFor } from "./account";

const member = (fields: Partial<Member> = {}): Member => ({
  discordId: "123456789012345678",
  name: "Sam",
  username: "sam",
  status: "approved",
  playerId: "player one",
  sessionKey: "key-1-long-enough-for-schema",
  requestedAt: "2026-09-28T19:00:00.000Z",
  lastSignInAt: "2026-09-28T19:00:00.000Z",
  ...fields,
});
const session = { discordId: "123456789012345678", sessionKey: "key-1-long-enough-for-schema" };
const noDms = new Set<string>();

describe("resolveAccount", () => {
  it("recognises an approved member", () => {
    expect(resolveAccount(session, member(), noDms)).toEqual({
      kind: "member",
      member: member(),
      isDm: false,
    });
  });

  it("keeps someone the DM hasn't let in yet waiting", () => {
    const waiting = member({ status: "pending" });
    expect(resolveAccount(session, waiting, noDms)).toEqual({ kind: "waiting", member: waiting });
  });

  it("lets the DM in even before they're approved, since the settings name them", () => {
    const dm = member({ status: "pending" });
    expect(resolveAccount(session, dm, new Set([dm.discordId]))).toMatchObject({
      kind: "member",
      isDm: true,
    });
  });

  it.each([
    ["no session", {}, member()],
    ["a removed member", session, undefined],
    ["an old session key (signed out everywhere)", session, member({ sessionKey: "key-2-new" })],
    ["a session missing its key", { discordId: session.discordId }, member()],
    ["someone else's member record", session, member({ discordId: "999999999999999999" })],
  ])("treats %s as anonymous", (_name, data, found) => {
    expect(resolveAccount(data, found, noDms)).toBe(ANONYMOUS);
  });
});

describe("viewerFor", () => {
  const dm = { kind: "member" as const, member: member(), isDm: true };
  const player = { kind: "member" as const, member: member(), isDm: false };

  it("gives the DM the DM's view, or a preview of the players' view", () => {
    expect(viewerFor(dm, false)).toBe(DM_VIEWER);
    expect(viewerFor(dm, true)).toBe(PLAYER_VIEWER);
  });

  it("gives a player the players' view as themselves, whatever the preview setting", () => {
    expect(viewerFor(player, false)).toEqual({ role: "player", playerId: "player one" });
    expect(viewerFor(player, true)).toEqual({ role: "player", playerId: "player one" });
  });

  it("gives a player with no character yet the general players' view", () => {
    const unassigned = { ...player, member: member({ playerId: undefined }) };
    expect(viewerFor(unassigned, false)).toBe(PLAYER_VIEWER);
  });

  it("gives nothing to someone not let in", () => {
    expect(viewerFor(ANONYMOUS, false)).toBeUndefined();
    expect(viewerFor({ kind: "waiting", member: member() }, false)).toBeUndefined();
  });
});
