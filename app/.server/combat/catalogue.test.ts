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

const creature = (name: string) => catalogue.creatures.find((c) => c.name === name);

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

  it("sorts creatures by name", () => {
    expect(catalogue.creatures.map((c) => c.name)).toEqual([
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

  it("gives players nothing from a note they can't read", () => {
    expect(statblockView(vault, PLAYER_VIEWER, minion)).toBeUndefined();
  });
});
