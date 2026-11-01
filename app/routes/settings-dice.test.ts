import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { RouterContextProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ANONYMOUS, type Account } from "~/.server/auth/account";
import { DICE_STYLES } from "~/.server/dice/catalogue";
import { DiceCollections } from "~/.server/dice/collections";
import { aMember, signedInAs } from "~/.server/members/test-builders";
import { accountContext, servicesContext, type Services } from "~/context";
import { action, loader } from "./settings-dice";

/** Your dice: choosing which die each type rolls first, and what the page sends. */
const one = aMember(1);

let folder: string;
let dice: DiceCollections;
beforeEach(async () => {
  folder = await mkdtemp(path.join(tmpdir(), "guildhall-settings-dice-"));
  dice = DiceCollections.inFolder(folder);
  await dice.giveDie(one.discordId, "bone", 20);
  await dice.giveDie(one.discordId, "glass", 20);
});
afterEach(() => rm(folder, { recursive: true, force: true }));

function contextFor(account: Account) {
  const context = new RouterContextProvider();
  context.set(servicesContext, { dice } as unknown as Services);
  context.set(accountContext, account);
  return context;
}

/** The status the action answered (200 for a plain answer), or of what it threw. */
async function choose(account: Account, fields: Record<string, string>) {
  const request = new Request("http://guildhall.test/settings/dice", {
    method: "POST",
    body: new URLSearchParams(fields),
  });
  try {
    const answer = await action({ request, params: {}, context: contextFor(account) } as never);
    return (answer as { init?: { status?: number } }).init?.status ?? 200;
  } catch (thrown) {
    return (thrown as { init?: { status?: number } }).init?.status;
  }
}

const favourites = async () => (await dice.get(one.discordId)).favourites;

describe("choosing the die a type rolls first", () => {
  it("keeps a die they own as the type's first, and none when asked", async () => {
    expect(await choose(signedInAs(one), { sides: "20", style: "bone" })).toBe(200);
    expect(await favourites()).toEqual([{ sides: 20, style: "bone" }]);
    expect(await choose(signedInAs(one), { sides: "20", style: "" })).toBe(200);
    expect(await favourites()).toEqual([{ sides: 20, style: "" }]);
  });

  it("refuses a die they haven't found, of another type, or not in the app", async () => {
    expect(await choose(signedInAs(one), { sides: "20", style: "gilded" })).toBe(400);
    expect(await choose(signedInAs(one), { sides: "6", style: "bone" })).toBe(400);
    expect(await choose(signedInAs(one), { sides: "20", style: "a style from the future" })).toBe(
      400,
    );
    expect(await favourites()).toEqual([]);
  });

  it("refuses a type that isn't drawn, and anyone signed out", async () => {
    expect(await choose(signedInAs(one), { sides: "100", style: "bone" })).toBe(400);
    expect(await choose(signedInAs(one), { style: "bone" })).toBe(400);
    expect(await choose(ANONYMOUS, { sides: "20", style: "bone" })).toBe(404);
  });

  it("lets the DM choose any die, as they have them all", async () => {
    const dm = aMember(9);
    expect(await choose(signedInAs(dm, true), { sides: "8", style: "gilded" })).toBe(200);
    expect((await dice.get(dm.discordId)).favourites).toEqual([{ sides: 8, style: "gilded" }]);
  });
});

describe("the page", () => {
  const load = (account: Account) =>
    loader({
      request: new Request("http://guildhall.test/settings/dice"),
      params: {},
      context: contextFor(account),
    } as never);

  it("sends a member only the dice they've found, not a word of the others", async () => {
    const page = await load(signedInAs(one));
    expect(page.owned.map((die) => [die.style.id, die.sides])).toEqual([
      ["glass", 20],
      ["bone", 20],
    ]);
    const sent = JSON.stringify(page);
    for (const style of DICE_STYLES.filter(({ id }) => id !== "bone" && id !== "glass")) {
      expect(sent).not.toContain(style.label);
      expect(sent).not.toContain(`"${style.id}"`);
    }
  });

  it("sends the DM every die, and no packs", async () => {
    const page = await load(signedInAs(aMember(9), true));
    expect(new Set(page.owned.map((die) => die.style.id)).size).toBe(DICE_STYLES.length);
    expect(page.packs).toEqual([]);
  });
});
