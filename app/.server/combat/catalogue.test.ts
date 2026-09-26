import { beforeAll, describe, expect, it } from "vitest";
import { DM_VIEWER } from "~/campaign/types";
import type { CombatCatalogue } from "~/combat/types";
import { FIXTURE_VAULT } from "../../../tests/support/fixture-vault";
import { Vault } from "../vault/vault";
import { combatCatalogue } from "./catalogue";

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
      "Fixture Bare",
      "Fixture Companion",
      "Fixture Minion",
      "Fixture Secret Form",
      "Test Creature",
    ]);
  });

  it("sends each statblock pre-rendered in the book layout", () => {
    const html = creature("Fixture Minion")?.html ?? "";
    expect(html).toContain('aria-label="Statblock: Fixture Minion"');
    expect(html).toContain("Fixture Jab");
  });

  it("lists the party with the player who controls each character", () => {
    expect(catalogue.party).toEqual([
      {
        entityId: "Party/Fixture PC One",
        name: "Fixture PC One",
        noteUrl: "/wiki/Party/Fixture%20PC%20One",
        player: { id: "player one", name: "Player One" },
      },
      {
        entityId: "Party/Fixture PC Two",
        name: "Fixture PC Two",
        noteUrl: "/wiki/Party/Fixture%20PC%20Two",
        player: { id: "player two", name: "Player Two" },
      },
    ]);
  });
});
