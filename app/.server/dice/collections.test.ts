import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EMPTY_COLLECTION, MOST_OF_A_DIE } from "~/dice/collection";
import { sequenceRng, type Rng } from "~/dice/rng";
import { DIE_TYPES } from "~/dice/styles";
import { DICE_STYLES } from "./catalogue";
import { DiceCollections, everyDie, usableDice } from "./collections";
import { testStyle } from "./test-styles";

let folder: string;
beforeEach(async () => {
  folder = await mkdtemp(path.join(tmpdir(), "guildhall-dice-"));
});
afterEach(() => rm(folder, { recursive: true, force: true }));

const MEMBER = "100000000000000001";
const OTHER = "100000000000000002";

/** A common style and a rare one: 50 tickets and 13. */
const STYLES = [testStyle("plain", "common"), testStyle("shiny", "rare")];

function store(rng: Rng = sequenceRng([])) {
  let minute = 0;
  const now = () => new Date(Date.UTC(2026, 9, 31, 19, minute++));
  return DiceCollections.inFolder(folder, { rng, now, styles: STYLES });
}

/** The pack's ID, once given. */
async function givenPack(dice: DiceCollections, reason?: string) {
  await dice.givePack(MEMBER, reason);
  return (await dice.get(MEMBER)).packs.at(-1)!.id;
}

describe("DiceCollections", () => {
  it("starts everyone with no dice and no packs", async () => {
    expect(await store().get(MEMBER)).toEqual(EMPTY_COLLECTION);
  });

  it("keeps the packs the DM gives, with why, until they're opened", async () => {
    const dice = store();
    await dice.givePack(MEMBER, "  For the session recap  ");
    await dice.givePack(MEMBER);
    const { packs } = await dice.get(MEMBER);
    expect(packs).toEqual([
      {
        id: expect.any(String),
        givenAt: "2026-10-31T19:00:00.000Z",
        reason: "For the session recap",
      },
      { id: expect.any(String), givenAt: "2026-10-31T19:01:00.000Z" },
    ]);
    expect((await dice.get(OTHER)).packs).toEqual([]);
  });

  it("draws a pack's die on the server as it's opened, and adds it to their dice", async () => {
    // Ticket 63 is the last, rare one, and type 6 is the d20.
    const dice = store(sequenceRng([63, 6]));
    const pack = await givenPack(dice, "For the recap");
    expect(await dice.openPack(MEMBER, pack)).toEqual({
      opened: {
        at: "2026-10-31T19:01:00.000Z",
        style: "shiny",
        sides: 20,
        pack,
        reason: "For the recap",
        count: 1,
        isNew: true,
      },
    });
    const collection = await dice.get(MEMBER);
    expect(collection.packs).toEqual([]);
    expect(collection.owned).toEqual([{ style: "shiny", sides: 20, count: 1 }]);
    expect(collection.history).toHaveLength(1);
  });

  it("counts a second of the same die, which lets them roll two at once", async () => {
    const dice = store(sequenceRng([63, 6, 63, 6]));
    await dice.openPack(MEMBER, await givenPack(dice));
    const second = await dice.openPack(MEMBER, await givenPack(dice));
    expect(second).toMatchObject({ opened: { count: 2, isNew: false } });
    expect((await dice.get(MEMBER)).owned).toEqual([{ style: "shiny", sides: 20, count: 2 }]);
  });

  it("opens each pack only once, and only its owner's", async () => {
    const dice = store(sequenceRng([63, 6]));
    const pack = await givenPack(dice);
    expect(await dice.openPack(OTHER, pack)).toBeUndefined();
    const [first, second] = await Promise.all([
      dice.openPack(MEMBER, pack),
      dice.openPack(MEMBER, pack),
    ]);
    expect([first, second].filter(Boolean)).toHaveLength(1);
  });

  it("keeps a pack unopened when there's nothing left worth giving", async () => {
    const dice = store();
    const pack = await givenPack(dice);
    expect(await dice.openPack(MEMBER, pack, everyDie(STYLES))).toEqual({ full: true });
    expect((await dice.get(MEMBER)).packs).toHaveLength(1);
  });

  it("never draws a die they already have a full kit of from an old dice set", async () => {
    // With the rare style's kit had, its 13 tickets go, and the last of the 50 left is common.
    const kit = everyDie(STYLES).filter((die) => die.style === "shiny");
    const dice = store(sequenceRng([50, 1]));
    const opened = await dice.openPack(MEMBER, await givenPack(dice), kit);
    expect(opened).toMatchObject({ opened: { style: "plain" } });
  });

  it("lets the DM give a particular die, up to the most worth having", async () => {
    const dice = store();
    for (let n = 0; n < MOST_OF_A_DIE[12]; n++)
      expect(await dice.giveDie(MEMBER, "plain", 12)).toBe(true);
    expect(await dice.giveDie(MEMBER, "plain", 12)).toBe(false);
    expect(await dice.giveDie(MEMBER, "no such style", 12)).toBe(false);
    const collection = await dice.get(MEMBER);
    expect(collection.owned).toEqual([{ style: "plain", sides: 12, count: MOST_OF_A_DIE[12] }]);
    expect(collection.history.at(-1)).toEqual({
      at: expect.any(String),
      style: "plain",
      sides: 12,
    });
  });

  it("keeps each type's favourite style, and none when asked", async () => {
    const dice = store();
    await dice.chooseFavourite(MEMBER, 20, "bone");
    await dice.chooseFavourite(MEMBER, 6, "glass");
    await dice.chooseFavourite(MEMBER, 20, "blood");
    expect((await dice.get(MEMBER)).favourites).toEqual([
      { sides: 6, style: "glass" },
      { sides: 20, style: "blood" },
    ]);
    await dice.chooseFavourite(MEMBER, 6, undefined);
    expect((await dice.get(MEMBER)).favourites).toEqual([
      { sides: 20, style: "blood" },
      { sides: 6, style: "" },
    ]);
  });

  it("drops damaged entries rather than refusing the file", async () => {
    const dice = store();
    await dice.giveDie(MEMBER, "plain", 6);
    await dice.giveDie(OTHER, "shiny", 8);
    const filePath = path.join(folder, "dice.json");
    const onDisk = JSON.parse(await readFile(filePath, "utf8"));
    onDisk.collections[0].owned.push({ style: "plain", sides: 7, count: 1 }, "not a die");
    onDisk.collections[0].packs = "not a list";
    onDisk.collections.push({ discordId: 12 });
    await writeFile(filePath, JSON.stringify(onDisk));
    const collection = await store().get(MEMBER);
    expect(collection.owned).toEqual([{ style: "plain", sides: 6, count: 1 }]);
    expect(collection.packs).toEqual([]);
    expect((await store().get(OTHER)).owned).toHaveLength(1);
  });
});

describe("usableDice", () => {
  it("gives the DM every die", () => {
    expect(usableDice(EMPTY_COLLECTION, undefined, true)).toHaveLength(
      DICE_STYLES.length * DIE_TYPES.length,
    );
  });

  it("is someone's collection, with a full kit of each old set the DM gave them", () => {
    const usable = usableDice(
      {
        ...EMPTY_COLLECTION,
        owned: [
          { style: "glass", sides: 20, count: 1 },
          { style: "bone", sides: 20, count: 1 },
        ],
      },
      ["bone"],
      false,
    );
    expect(usable).toContainEqual({ style: "glass", sides: 20, count: 1 });
    expect(usable).toContainEqual({ style: "bone", sides: 20, count: MOST_OF_A_DIE[20] });
    expect(usable.filter((die) => die.style === "bone")).toHaveLength(DIE_TYPES.length);
  });

  it("leaves out styles no longer in the app", () => {
    const owned = [{ style: "a style from the future", sides: 20 as const, count: 1 }];
    expect(usableDice({ ...EMPTY_COLLECTION, owned }, ["gone too"], false)).toEqual([]);
  });
});
