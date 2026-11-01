import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { RouterContextProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ANONYMOUS, type Account } from "~/.server/auth/account";
import { DICE_STYLES } from "~/.server/dice/catalogue";
import { DiceCollections } from "~/.server/dice/collections";
import { accountContext, servicesContext, type Services } from "~/context";
import { seededRng } from "~/dice/rng";
import { aMember, signedInAs } from "~/.server/members/test-builders";
import { action } from "./dice-open";

/** Opening packs through the route, with real dice and data in a temporary folder. */
const one = aMember(1);
const two = aMember(2);

let folder: string;
let dice: DiceCollections;
beforeEach(async () => {
  folder = await mkdtemp(path.join(tmpdir(), "guildhall-dice-open-"));
  dice = DiceCollections.inFolder(folder, { rng: seededRng(5) });
});
afterEach(() => rm(folder, { recursive: true, force: true }));

async function packFor(member = one, reason?: string) {
  await dice.givePack(member.discordId, reason);
  return (await dice.get(member.discordId)).packs.at(-1)!.id;
}

/** What the route answered, as status and body, or the status of what it threw. */
async function open(account: Account, body: unknown) {
  const context = new RouterContextProvider();
  context.set(servicesContext, { dice } as unknown as Services);
  context.set(accountContext, account);
  const request = new Request("http://guildhall.test/settings/dice/open", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  try {
    const response = (await action({ request, params: {}, context } as never)) as Response;
    return { status: response.status, body: await response.json() };
  } catch (thrown) {
    return { status: (thrown as { init?: { status?: number } }).init?.status, body: undefined };
  }
}

describe("opening a pack", () => {
  it("draws its die and answers with that die's style, and nothing else", async () => {
    const pack = await packFor(one, "For the recap");
    const { status, body } = await open(signedInAs(one), { pack });
    expect(status).toBe(200);
    expect(Object.keys(body)).toEqual(["opened"]);
    expect(body.opened).toMatchObject({ count: 1, isNew: true, reason: "For the recap" });
    const collection = await dice.get(one.discordId);
    expect(collection.packs).toEqual([]);
    expect(collection.owned).toEqual([
      { style: body.opened.style.id, sides: body.opened.sides, count: 1 },
    ]);
    // Of all the dice, only the one drawn is named.
    const others = DICE_STYLES.filter((style) => style.id !== body.opened.style.id);
    const sent = JSON.stringify(body);
    for (const style of others) expect(sent).not.toContain(`"${style.id}"`);
  });

  it("is a 404 for someone else's pack, which stays theirs to open", async () => {
    const pack = await packFor(two);
    expect((await open(signedInAs(one), { pack })).status).toBe(404);
    expect((await dice.get(two.discordId)).packs).toHaveLength(1);
    expect((await dice.get(one.discordId)).owned).toEqual([]);
  });

  it("is a 404 the second time, so a pack can't be opened twice", async () => {
    const pack = await packFor();
    expect((await open(signedInAs(one), { pack })).status).toBe(200);
    expect((await open(signedInAs(one), { pack })).status).toBe(404);
    expect((await dice.get(one.discordId)).owned).toHaveLength(1);
  });

  it("is a 404 for the DM, who has every die and no packs, and for anyone signed out", async () => {
    const pack = await packFor();
    expect((await open(signedInAs(aMember(9), true), { pack })).status).toBe(404);
    expect((await open(ANONYMOUS, { pack })).status).toBe(404);
    expect((await dice.get(one.discordId)).packs).toHaveLength(1);
  });

  it("keeps the pack when there's nothing left worth giving", async () => {
    // Every set given before packs: full kits of every die there is.
    const everything = aMember(1, { dice: { given: DICE_STYLES.map((style) => style.id) } });
    const pack = await packFor(everything);
    const { status, body } = await open(signedInAs(everything), { pack });
    expect(status).toBe(409);
    expect(body.error).toMatch(/every die worth having/);
    expect((await dice.get(everything.discordId)).packs).toHaveLength(1);
  });

  it("refuses a body it can't read", async () => {
    expect((await open(signedInAs(one), { pack: "" })).status).toBe(400);
    expect((await open(signedInAs(one), "not a pack")).status).toBe(400);
  });
});
