import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { RouterContextProvider } from "react-router";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Account } from "~/.server/auth/account";
import { DiceCollections } from "~/.server/dice/collections";
import { Members } from "~/.server/members/members";
import { aMember, signedInAs } from "~/.server/members/test-builders";
import { Vault } from "~/.server/vault/vault";
import { accountContext, servicesContext, type Services } from "~/context";
import { MOST_OF_A_DIE } from "~/dice/collection";
import type { Member } from "~/members/types";
import { FIXTURE_VAULT } from "../../tests/support/fixture-vault";
import { action } from "./members";

/** The Members page's gifts: packs and particular dice, from the DM only, to members only. */
const dm = aMember(9);

let vault: Vault;
beforeAll(async () => {
  vault = await Vault.load(FIXTURE_VAULT);
});

let folder: string;
let services: Services;
let member: Member;
beforeEach(async () => {
  folder = await mkdtemp(path.join(tmpdir(), "guildhall-members-route-"));
  services = {
    vault: { current: vault },
    members: Members.inFolder(folder),
    dice: DiceCollections.inFolder(folder),
    live: { memberChanged: async () => {} },
  } as unknown as Services;
  const signedIn = await services.members.signIn(
    { discordId: aMember(1).discordId, username: "member1", name: "Member 1" },
    { approve: true },
  );
  if (!("member" in signedIn)) throw new Error("Expected a member");
  member = signedIn.member;
});
afterEach(() => rm(folder, { recursive: true, force: true }));

/** The status the action answered (200 for a plain answer), or of what it threw. */
async function post(account: Account, fields: Record<string, string>) {
  const context = new RouterContextProvider();
  context.set(servicesContext, services);
  context.set(accountContext, account);
  const request = new Request("http://guildhall.test/members", {
    method: "POST",
    body: new URLSearchParams(fields),
  });
  try {
    const answer = await action({ request, params: {}, context } as never);
    return (answer as { init?: { status?: number } }).init?.status ?? 200;
  } catch (thrown) {
    return (thrown as { init?: { status?: number } }).init?.status;
  }
}

const theirs = () => services.dice.get(member.discordId);
const givePack = (account: Account, discordId = member.discordId) =>
  post(account, { intent: "pack", discordId, reason: "For the recap" });
const giveDie = (account: Account, style: string, sides: string, discordId = member.discordId) =>
  post(account, { intent: "die", discordId, style, sides });

describe("giving dice on the Members page", () => {
  it("gives a member a pack, with why, and a particular die", async () => {
    expect(await givePack(signedInAs(dm, true))).toBe(200);
    expect(await giveDie(signedInAs(dm, true), "bone", "20")).toBe(200);
    const collection = await theirs();
    expect(collection.packs).toMatchObject([{ reason: "For the recap" }]);
    expect(collection.owned).toEqual([{ style: "bone", sides: 20, count: 1 }]);
  });

  it("is a 404 for anyone but the DM, who gives nothing", async () => {
    expect(await givePack(signedInAs(member))).toBe(404);
    expect(await giveDie(signedInAs(member), "gilded", "20")).toBe(404);
    expect(await theirs()).toMatchObject({ packs: [], owned: [] });
  });

  it("gives nothing to someone who isn't a member", async () => {
    const stranger = aMember(5).discordId;
    expect(await givePack(signedInAs(dm, true), stranger)).toBe(400);
    expect(await giveDie(signedInAs(dm, true), "bone", "20", stranger)).toBe(400);
    expect(await services.dice.all()).toEqual(new Map());
  });

  it("refuses a die that isn't one, or past the most worth having", async () => {
    expect(await giveDie(signedInAs(dm, true), "a style from the future", "20")).toBe(400);
    expect(await giveDie(signedInAs(dm, true), "bone", "100")).toBe(400);
    for (let n = 0; n < MOST_OF_A_DIE[12]; n++) {
      expect(await giveDie(signedInAs(dm, true), "bone", "12")).toBe(200);
    }
    expect(await giveDie(signedInAs(dm, true), "bone", "12")).toBe(400);
    expect((await theirs()).owned).toEqual([
      { style: "bone", sides: 12, count: MOST_OF_A_DIE[12] },
    ]);
  });
});
