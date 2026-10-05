import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CharacterAction } from "~/characters/actions";
import { ITEMS_MAX } from "~/characters/schema";
import { aFeature, anItem } from "~/characters/test-builders";
import type { PlayerCharacter } from "~/characters/types";
import { idSequence } from "~/combat/test-builders";
import { DataFileError } from "../data/json-store";
import { Characters } from "./characters";

let folder: string;
beforeEach(async () => {
  folder = await mkdtemp(path.join(tmpdir(), "guildhall-characters-"));
});
afterEach(() => rm(folder, { recursive: true, force: true }));

/** A store with a controllable clock and predictable IDs. */
function store() {
  let minute = 0;
  const now = () => new Date(Date.UTC(2026, 8, 29, 10, minute++));
  return Characters.inFolder(folder, { now, createId: idSequence("id") });
}

async function created(characters: Characters, note = "Party/Fixture PC One") {
  const result = await characters.create({ kind: "pc", note });
  if ("problem" in result) throw new Error(result.problem);
  return result.character as PlayerCharacter;
}

const addItem = (id: string, name = "Rope"): CharacterAction => ({
  type: "inventory",
  change: { type: "add", item: anItem({ id, name }) },
});

describe("Characters", () => {
  it("starts empty", async () => {
    expect(await store().list()).toEqual([]);
  });

  it("creates a PC with a blank sheet and an empty bag", async () => {
    const character = await created(store());
    expect(character).toMatchObject({
      kind: "pc",
      id: "id-1",
      note: "Party/Fixture PC One",
      revision: 0,
      sheet: { level: 1, name: "" },
      inventory: { items: [], purse: { gp: 0 } },
    });
  });

  it("creates a companion at full hit points from its statblock", async () => {
    const result = await store().create({
      kind: "companion",
      note: "Bestiary/Fixture Companion",
      maxHp: 22,
    });
    expect(result).toMatchObject({
      character: { kind: "companion", hp: { current: 22, max: 22, temp: 0 } },
    });
  });

  it("makes only one sheet per note, even for two requests at once", async () => {
    const characters = store();
    const results = await Promise.all([
      characters.create({ kind: "pc", note: "Party/Fixture PC One" }),
      characters.create({ kind: "pc", note: "Party/Fixture PC One" }),
    ]);
    expect(results.filter((result) => "problem" in result)).toHaveLength(1);
    expect(await characters.list()).toHaveLength(1);
  });

  it("keeps characters in the data folder, so they survive a restart", async () => {
    const { id } = await created(store());
    await store().apply(id, [{ type: "text", field: "name", value: "Kit" }], 0);

    const again = await Characters.inFolder(folder).get(id);
    expect(again?.kind === "pc" && again.sheet.name).toBe("Kit");
    const onDisk = JSON.parse(await readFile(path.join(folder, "characters.json"), "utf8"));
    expect(onDisk).toMatchObject({ version: 1, characters: [{ id, sheet: { name: "Kit" } }] });
  });

  it("finds a character by its note", async () => {
    const character = await created(store());
    expect(await store().forNote("Party/Fixture PC One")).toEqual(character);
    expect(await store().forNote("Party/Nobody")).toBeUndefined();
  });

  describe("apply", () => {
    it("applies actions, raising the revision once per batch that changes something", async () => {
      const characters = store();
      const { id } = await created(characters);
      const applied = await characters.apply(
        id,
        [
          { type: "ability", ability: "dex", value: 16 },
          { type: "ability", ability: "str", value: 8 },
        ],
        0,
      );
      expect(applied).toMatchObject({
        character: { revision: 1, updatedAt: "2026-09-29T10:01:00.000Z" },
        changedElsewhere: false,
      });

      const unchanged = await characters.apply(
        id,
        [{ type: "ability", ability: "dex", value: 16 }],
        1,
      );
      expect(unchanged).toMatchObject({ character: { revision: 1 } });
    });

    it("loses nothing when two people change different things at the same moment", async () => {
      const characters = store();
      const { id } = await created(characters);
      await Promise.all([
        characters.apply(id, [{ type: "damage", amount: 0 }, addItem("rope")], 0),
        characters.apply(
          id,
          [addItem("torch", "Torch"), { type: "text", field: "species", value: "Elf" }],
          0,
        ),
      ]);
      const character = (await characters.get(id)) as PlayerCharacter;
      expect(character.inventory.items.map((item) => item.id).sort()).toEqual(["rope", "torch"]);
      expect(character.sheet.species).toBe("Elf");
      expect(character.revision).toBe(2);
    });

    it("says when someone else changed the character since the sender's copy", async () => {
      const characters = store();
      const { id } = await created(characters);
      await characters.apply(id, [addItem("rope")], 0);
      const applied = await characters.apply(id, [{ type: "heal", amount: 1 }], 0);
      expect(applied).toMatchObject({ changedElsewhere: true });
    });

    it("reports actions about items that have gone, without failing the rest", async () => {
      const characters = store();
      const { id } = await created(characters);
      const applied = await characters.apply(
        id,
        [
          { type: "inventory", change: { type: "remove", id: "gone" } },
          { type: "text", field: "name", value: "Kit" },
        ],
        0,
      );
      expect(applied && "results" in applied && applied.results.map((r) => r.outcome)).toEqual([
        "dropped",
        "changed",
      ]);
    });

    it("refuses a batch that would overfill the bag, changing nothing", async () => {
      const characters = store();
      const { id } = await created(characters);
      const fill = Array.from({ length: ITEMS_MAX }, (_, index) =>
        addItem(`i${index}`, `Item ${index}`),
      );
      await characters.apply(id, fill.slice(0, 200), 0);
      await characters.apply(id, fill.slice(200, 400), 1);
      await characters.apply(id, fill.slice(400), 2);
      expect(await characters.apply(id, [addItem("one-too-many", "Extra")], 3)).toEqual({
        problem: "That change can't be saved.",
      });
      expect((await characters.get(id))?.inventory.items).toHaveLength(ITEMS_MAX);
    });

    it("is undefined for a character that has been deleted", async () => {
      expect(await store().apply("gone", [{ type: "heal", amount: 1 }], 0)).toBeUndefined();
    });
  });

  describe("give", () => {
    async function twoCharacters() {
      const characters = store();
      const giver = await created(characters, "Party/Fixture PC One");
      const receiver = await created(characters, "Party/Fixture PC Two");
      await characters.apply(
        giver.id,
        [
          {
            type: "inventory",
            change: { type: "add", item: anItem({ id: "arrows", name: "Arrows", quantity: 20 }) },
          },
        ],
        0,
      );
      return { characters, giver, receiver };
    }

    it("moves part of a stack to another bag in one write", async () => {
      const { characters, giver, receiver } = await twoCharacters();
      const gift = await characters.give(giver.id, {
        item: "arrows",
        amount: 5,
        to: receiver.id,
        givenBy: "Kit",
      });
      expect(gift && "from" in gift).toBe(true);

      const [from, to] = await Promise.all([characters.get(giver.id), characters.get(receiver.id)]);
      expect(from?.inventory.items[0].quantity).toBe(15);
      expect(to?.inventory.items[0]).toMatchObject({
        name: "Arrows",
        quantity: 5,
        unseen: true,
        givenBy: "Kit",
      });
      expect([from?.revision, to?.revision]).toEqual([2, 1]);
    });

    it.each<[string, { item: string; amount: number }]>([
      ["an item that has gone", { item: "gone", amount: 1 }],
      ["more than there is", { item: "arrows", amount: 21 }],
    ])("changes neither bag for %s", async (_, gift) => {
      const { characters, giver, receiver } = await twoCharacters();
      const result = await characters.give(giver.id, { ...gift, to: receiver.id, givenBy: "Kit" });
      expect(result).toEqual({ problem: "That item isn't there any more." });
      expect((await characters.get(receiver.id))?.inventory.items).toEqual([]);
      expect((await characters.get(giver.id))?.revision).toBe(1);
    });

    it("refuses to give to the same bag, or to a character that has gone", async () => {
      const { characters, giver } = await twoCharacters();
      const gift = { item: "arrows", amount: 1, givenBy: "Kit" };
      expect(await characters.give(giver.id, { ...gift, to: giver.id })).toEqual({
        problem: "That's the same bag.",
      });
      expect(await characters.give(giver.id, { ...gift, to: "gone" })).toBeUndefined();
    });
  });

  it("relinks a character to another note, but not to one that already has a sheet", async () => {
    const characters = store();
    const one = await created(characters, "Party/Old Name");
    await created(characters, "Party/Fixture PC Two");
    expect(await characters.relink(one.id, "pc-kit")).toMatchObject({
      character: { note: "pc-kit", revision: 1 },
    });
    expect(await characters.relink(one.id, "Party/Fixture PC Two")).toEqual({
      problem: "That note already has a sheet.",
    });
  });

  it("deletes a character", async () => {
    const characters = store();
    const { id } = await created(characters);
    expect(await characters.delete(id)).toBe(true);
    expect(await characters.delete(id)).toBe(false);
    expect(await characters.list()).toEqual([]);
  });

  it("refuses to overwrite a damaged file, reporting it instead", async () => {
    const file = path.join(folder, "characters.json");
    await writeFile(file, "{ not json");
    await expect(store().list()).rejects.toThrow(DataFileError);
    await expect(store().create({ kind: "pc", note: "Party/Fixture PC One" })).rejects.toThrow(
      DataFileError,
    );
    expect(await readFile(file, "utf8")).toBe("{ not json");
  });
});

describe("Characters, tracking what gets used up", () => {
  /** A PC with two 1st-level slots, three d8 hit dice and a use that resets on a short rest. */
  async function caster(characters: Characters) {
    const { id } = await created(characters);
    await characters.apply(
      id,
      [
        { type: "hp", field: "max", value: 20 },
        { type: "hp", field: "current", value: 5 },
        { type: "limit", counter: { slot: 1 }, value: 2 },
        { type: "limit", counter: { hitDie: "d8" }, value: 3 },
        {
          type: "features",
          change: {
            type: "add",
            item: aFeature({ id: "focus", uses: { max: 2, used: 2, reset: "short" } }),
          },
        },
      ],
      0,
    );
    return id;
  }

  it("keeps a rest in one tab and a slot spent in another at the same moment", async () => {
    const characters = store();
    const id = await caster(characters);
    await Promise.all([
      characters.apply(id, [{ type: "rest", rest: "short", hitDice: [{ die: "d8", face: 4 }] }], 1),
      characters.apply(id, [{ type: "count", counter: { slot: 1 }, by: 1 }], 1),
    ]);
    const { sheet, revision } = (await characters.get(id)) as PlayerCharacter;
    expect(sheet.spellSlots[0].used).toBe(1);
    expect(sheet.hitDice.d8.used).toBe(1);
    expect(sheet.hp.current).toBe(9);
    expect(sheet.features[0].uses?.used).toBe(0);
    expect(revision).toBe(3);
  });

  it("keeps two ticks of the same use from two tabs, rather than one replacing the other", async () => {
    const characters = store();
    const id = await caster(characters);
    await characters.apply(id, [{ type: "rest", rest: "long" }], 1);
    const tick = { type: "count", counter: { feature: "focus" }, by: 1 } as const;
    await Promise.all([characters.apply(id, [tick], 2), characters.apply(id, [tick], 2)]);
    const { sheet } = (await characters.get(id)) as PlayerCharacter;
    expect(sheet.features[0].uses?.used).toBe(2);
  });

  it("spends only the hit dice left when two tabs rest at once", async () => {
    const characters = store();
    const id = await caster(characters);
    const rest: CharacterAction = {
      type: "rest",
      rest: "short",
      hitDice: [
        { die: "d8", face: 1 },
        { die: "d8", face: 1 },
      ],
    };
    await Promise.all([characters.apply(id, [rest], 1), characters.apply(id, [rest], 1)]);
    const { sheet } = (await characters.get(id)) as PlayerCharacter;
    expect(sheet.hitDice.d8).toEqual({ max: 3, used: 3 });
  });

  it("loads a file saved before tracking existed, and saving it loses nothing", async () => {
    const file = path.join(folder, "characters.json");
    const before = {
      version: 1,
      characters: [
        {
          kind: "pc",
          id: "kit",
          note: "Party/Fixture PC One",
          revision: 7,
          createdAt: "2026-09-29T10:00:00.000Z",
          updatedAt: "2026-09-30T10:00:00.000Z",
          inventory: {
            items: [anItem({ id: "rope", name: "Rope", quantity: 2 })],
            purse: { cp: 0, sp: 4, ep: 0, gp: 12, pp: 0 },
          },
          sheet: {
            name: "Kit",
            level: 2,
            abilities: { str: 8, dex: 16, con: 12, int: 10, wis: 13, cha: 14 },
            skills: { stealth: "expertise" },
            hp: { current: 11, max: 15, temp: 0 },
            notes: "Fixture: notes from before the tracking fields",
          },
        },
      ],
    };
    await writeFile(file, JSON.stringify(before));

    const characters = store();
    await characters.apply("kit", [{ type: "count", counter: { slot: 1 }, by: 1 }], 7);
    await characters.apply("kit", [{ type: "heal", amount: 1 }], 7);

    const saved = JSON.parse(await readFile(file, "utf8"));
    const [kit] = saved.characters;
    expect(kit).toMatchObject({
      ...before.characters[0],
      revision: 8,
      updatedAt: expect.any(String),
      sheet: { ...before.characters[0].sheet, hp: { current: 12, max: 15, temp: 0 } },
    });
    expect(kit.sheet).toMatchObject({ spells: [], features: [], attacks: [], concentrating: "" });
  });
});
