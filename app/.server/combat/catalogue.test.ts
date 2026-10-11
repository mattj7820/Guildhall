import { gzipSync } from "node:zlib";
import { beforeAll, describe, expect, it } from "vitest";
import { DM_VIEWER, PLAYER_VIEWER } from "~/campaign/types";
import { WHOLE_PARTY, type CombatCatalogue } from "~/combat/types";
import { FIXTURE_VAULT } from "../../../tests/support/fixture-vault";
import { Vault } from "../vault/vault";
import { combatCatalogue, statblockView } from "./catalogue";

/** Integration tests over the fixture vault. */
let catalogue: CombatCatalogue;
beforeAll(async () => {
  catalogue = combatCatalogue(await Vault.load(FIXTURE_VAULT), DM_VIEWER);
});

const creature = (name: string) =>
  catalogue.creatures.find((c) => c.name === name && !c.ref.source);
const creatureByKey = (key: string) => catalogue.creatures.find((c) => c.key === key);

describe("combatCatalogue", () => {
  it("offers statblocks with the numbers the tracker uses", () => {
    expect(creature("Fixture Minion")).toMatchObject({
      key: "Bestiary/Fixture Minion#Fixture Minion",
      ref: { entityId: "Bestiary/Fixture Minion", name: "Fixture Minion" },
      noteTitle: "Fixture Minion",
      noteUrl: "/wiki/Bestiary/Fixture%20Minion",
      armorClass: 13,
      hitPoints: 7,
      hitDice: "2d6",
      initiativeBonus: 2,
    });
  });

  it("falls back to +0 initiative and no HP for a bare statblock", () => {
    const bare = creature("Fixture Bare");
    expect(bare?.initiativeBonus).toBe(0);
    expect(bare?.hitPoints).toBeUndefined();
    expect(bare?.hitDice).toBeUndefined();
  });

  it("sorts the vault's statblocks by name", () => {
    expect(catalogue.creatures.filter((c) => !c.ref.source).map((c) => c.name)).toEqual([
      "Fixture 2024 Statblock",
      "Fixture Bare",
      "Fixture Companion",
      "Fixture Informant Disguise",
      "Fixture Minion",
      "Fixture Secret Form",
      "Test Creature",
    ]);
  });

  it("takes a 2024 statblock's own initiative bonus", () => {
    expect(creature("Fixture 2024 Statblock")?.initiativeBonus).toBe(3);
  });

  it("adds every SRD monster from both versions, tagged with which it is", () => {
    const from = (source: string) => catalogue.creatures.filter((c) => c.ref.source === source);
    expect(from("srd-5.1")).toHaveLength(334);
    expect(from("srd-5.2")).toHaveLength(341);
    expect(creatureByKey("srd-5.2:goblin-warrior")).toMatchObject({
      ref: { entityId: "goblin-warrior", name: "Goblin Warrior", source: "srd-5.2" },
      name: "Goblin Warrior",
      challenge: "1/4",
      size: "Small",
      type: "Fey",
      armorClass: 15,
      hitPoints: 10,
      hitDice: "3d6",
      squares: 1,
      initiativeBonus: 2,
    });
    expect(creatureByKey("srd-5.2:goblin-warrior")).not.toHaveProperty("noteUrl");
  });

  it("sizes SRD monsters' tokens from their statblocks", () => {
    expect(creatureByKey("srd-5.2:adult-red-dragon")?.squares).toBe(3);
    expect(creatureByKey("srd-5.1:ogre")?.squares).toBe(2);
  });

  it("lists everything by name, with the vault's own first, then 2024, then 2014", () => {
    const order = { vault: 0, "srd-5.2": 1, "srd-5.1": 2 };
    const { creatures } = catalogue;
    for (let i = 1; i < creatures.length; i++) {
      const [before, after] = [creatures[i - 1], creatures[i]];
      const byName = before.name.localeCompare(after.name, undefined, {
        sensitivity: "base",
        numeric: true,
      });
      expect(byName).toBeLessThanOrEqual(0);
      if (byName === 0) {
        expect(order[before.ref.source ?? "vault"]).toBeLessThanOrEqual(
          order[after.ref.source ?? "vault"],
        );
      }
    }
    const wolves = creatures.filter((c) => c.name === "Wolf").map((c) => c.ref.source);
    expect(wolves).toEqual(["srd-5.2", "srd-5.1"]);
  });

  it("keeps the page small: no statblocks, and a budget for finding them", () => {
    const json = JSON.stringify(catalogue);
    expect(json).not.toContain("statblock-roll");
    // 17 KB compressed (177 KB raw) with every SRD monster, measured 2026-10-11. Every statblock
    // pre-rendered would be 239 KB compressed (3.1 MB raw): this keeps them from coming back.
    expect(gzipSync(json).length).toBeLessThan(40_000);
  });

  it("sends no statblocks with the page: they're loaded when shown", () => {
    expect(JSON.stringify(catalogue)).not.toContain("statblock-roll");
  });

  it("lists the party with the player who controls each character, then the shared companion", () => {
    expect(catalogue.party).toEqual([
      {
        kind: "pc",
        entityId: "Party/Fixture PC One",
        name: "Fixture PC One",
        noteUrl: "/wiki/Party/Fixture%20PC%20One",
        player: { id: "player one", name: "Player One" },
      },
      {
        kind: "pc",
        entityId: "Party/Fixture PC Two",
        name: "Fixture PC Two",
        noteUrl: "/wiki/Party/Fixture%20PC%20Two",
        player: { id: "player two", name: "Player Two" },
      },
      {
        kind: "companion",
        entityId: "Bestiary/Fixture Companion",
        name: "Fixture Companion",
        noteUrl: "/wiki/Bestiary/Fixture%20Companion",
        player: WHOLE_PARTY,
        statblock: { entityId: "Bestiary/Fixture Companion", name: expect.any(String) },
      },
    ]);
  });
});

describe("statblockView", () => {
  let vault: Vault;
  beforeAll(async () => {
    vault = await Vault.load(FIXTURE_VAULT);
  });
  const minion = "Bestiary/Fixture Minion#Fixture Minion";

  it("renders a statblock in the book layout", () => {
    const html = statblockView(vault, DM_VIEWER, minion)?.html ?? "";
    expect(html).toContain('aria-label="Statblock: Fixture Minion"');
    expect(html).toContain("Fixture Jab");
  });

  it("marks its rolls, for the tracker to roll", () => {
    expect(statblockView(vault, DM_VIEWER, minion)?.html).toContain(
      'data-roll="1d20 + 4" data-roll-kind="attack" data-roll-label="Fixture Jab attack"',
    );
  });

  it("has nothing for a key that isn't a statblock", () => {
    expect(statblockView(vault, DM_VIEWER, "Bestiary/Fixture Minion#Nobody")).toBeUndefined();
  });

  it("renders an SRD monster's statblock, its 2024 rolls marked", () => {
    const html = statblockView(vault, DM_VIEWER, "srd-5.2:goblin-warrior")?.html ?? "";
    expect(html).toContain('aria-label="Statblock: Goblin Warrior"');
    expect(html).toContain(
      'data-roll="1d20 + 4" data-roll-kind="attack" data-roll-label="Scimitar attack"',
    );
    expect(html).toContain('data-roll-label="Initiative"');
  });

  it("brings the SRD's lore with an SRD monster that has some", () => {
    expect(statblockView(vault, DM_VIEWER, "srd-5.1:blink-dog")?.lore).toMatch(/^A blink dog/);
    expect(statblockView(vault, DM_VIEWER, "srd-5.2:blink-dog")).not.toHaveProperty("lore");
  });

  it("gives players nothing from a note they can't read", () => {
    expect(statblockView(vault, PLAYER_VIEWER, minion)).toBeUndefined();
  });
});
