import { beforeAll, describe, expect, it } from "vitest";
import { DM_VIEWER, PLAYER_VIEWER, type Viewer } from "~/campaign/types";
import { aCharacter, aCompanion, anItem, aSheet } from "~/characters/test-builders";
import type { Character } from "~/characters/types";
import { FIXTURE_VAULT } from "../../../tests/support/fixture-vault";
import { Vault } from "../vault/vault";
import {
  characterPage,
  itemCatalogue,
  partyCards,
  portraitChoices,
  portraitPath,
  spellCatalogue,
} from "./load";

/** Integration tests over the fixture vault: two PCs (Player One, Player Two) and a companion. */
let vault: Vault;
beforeAll(async () => {
  vault = await Vault.load(FIXTURE_VAULT);
});

const playerOne: Viewer = { role: "player", playerId: "player one" };

const pcOne = aCharacter({
  id: "one",
  note: "Party/Fixture PC One",
  sheet: aSheet({ name: "Kit", species: "Halfling", className: "Rogue", level: 3 }),
  items: [
    anItem({ name: "Dagger", icon: { builtin: "dagger" }, equipped: true }),
    anItem({ name: "Secret map", icon: { builtin: "map" } }),
  ],
});
const pcTwo = aCharacter({
  id: "two",
  note: "Party/Fixture PC Two",
  sheet: aSheet({ species: "Elf", className: "Wizard", level: 2 }),
  items: [anItem({ name: "Staff", icon: { builtin: "staff" }, equipped: true })],
});
const orphan = aCharacter({ id: "lost", note: "Party/Renamed Without An Id" });

const cardFor = (viewer: Viewer, note: string, characters: Character[] = [pcOne, pcTwo, orphan]) =>
  partyCards(vault, characters, viewer).cards.find((card) => card.note === note);

describe("partyCards", () => {
  it("lists every PC, then the companion, for the DM, who can open them all", () => {
    const { cards } = partyCards(vault, [pcOne, pcTwo], DM_VIEWER);
    expect(cards.map((card) => [card.name, card.canOpen, card.canStart])).toEqual([
      ["Kit", true, false],
      ["Fixture PC Two", true, false],
      ["Fixture Companion", false, true],
    ]);
  });

  it("gives a player their own character in full", () => {
    expect(cardFor(playerOne, "Party/Fixture PC One")).toMatchObject({
      canOpen: true,
      hp: { current: 0 },
    });
  });

  it("gives a player only a summary of someone else's character", () => {
    const card = cardFor(playerOne, "Party/Fixture PC Two");
    expect(card).toEqual({
      kind: "pc",
      note: "Party/Fixture PC Two",
      name: "Fixture PC Two",
      id: "two",
      canOpen: false,
      canStart: false,
      species: "Elf",
      className: "Wizard",
      level: 2,
      equipped: [{ name: "Staff", icon: { builtin: "staff" } }],
    });
  });

  it("shares the companion with every player, with its statblock's numbers", () => {
    expect(cardFor(playerOne, "Bestiary/Fixture Companion")).toMatchObject({
      kind: "companion",
      canStart: true,
      armourClass: 13,
      speed: "40 ft.",
    });
    // Players not yet assigned to anyone, and the DM previewing as a player, share it too.
    expect(cardFor(PLAYER_VIEWER, "Bestiary/Fixture Companion")).toMatchObject({
      canStart: true,
    });
  });

  it("shows a companion's current hit points to those who can open it", () => {
    const companion = aCompanion({ hp: { current: 9, max: 22, temp: 0 } });
    expect(cardFor(playerOne, "Bestiary/Fixture Companion", [companion])).toMatchObject({
      canOpen: true,
      hp: { current: 9 },
    });
  });

  it("lists sheets whose note has gone for the DM only", () => {
    expect(partyCards(vault, [orphan], DM_VIEWER).orphans).toEqual([
      { id: "lost", name: "Unnamed character", note: "Party/Renamed Without An Id" },
    ]);
    expect(partyCards(vault, [orphan], playerOne).orphans).toEqual([]);
  });
});

describe("characterPage", () => {
  it("includes the PC note as the character's story, as the viewer may read it", () => {
    const page = characterPage(vault, pcOne, playerOne);
    expect(page.name).toBe("Kit");
    expect(page.story).toMatchObject({
      title: "Fixture PC One",
      url: "/wiki/Party/Fixture%20PC%20One",
    });
    expect(page.story?.html).toContain("Fixture: a player character note.");
  });

  it("includes a companion's statblock, never the one hidden in a DM comment", () => {
    const page = characterPage(vault, aCompanion(), playerOne);
    expect(page.statblockHtml).toContain("Fixture Companion");
    expect(page.statblockHtml).not.toContain("Fixture Secret Form");
    expect(page).toMatchObject({ armourClass: 13, speed: "40 ft." });
  });
});

describe("spellCatalogue", () => {
  it("offers players only shared spell notes, without their DM parts", () => {
    const { spellCatalogue: catalogue, spellNotes } = spellCatalogue(vault, playerOne);
    expect(catalogue.map((spell) => spell.title)).toEqual([
      "Fixture Artificer Spell",
      "Fixture Spark",
    ]);
    const spark = spellNotes["Spells/Fixture Spark"].html;
    expect(spark).toContain("Players see this paragraph");
    expect(spark).not.toContain("sparksecretcallout");
    expect(spark).not.toContain("sparksecretsection");
  });

  it("offers the DM every spell note, saying which players can't read", () => {
    const { spellCatalogue: catalogue } = spellCatalogue(vault, DM_VIEWER);
    expect(catalogue).toEqual([
      { id: "Spells/Fixture Artificer Spell", title: "Fixture Artificer Spell" },
      { id: "Spells/Fixture Secret Spell", title: "Fixture Secret Spell", hiddenFromPlayers: true },
      { id: "Spells/Fixture Spark", title: "Fixture Spark" },
    ]);
  });

  it("comes with a PC's sheet, not a companion's", () => {
    expect(characterPage(vault, pcOne, playerOne).spellCatalogue).toHaveLength(2);
    expect(characterPage(vault, aCompanion(), playerOne).spellCatalogue).toBeUndefined();
  });
});

describe("itemCatalogue", () => {
  it("offers players only shared item notes, without their DM parts", () => {
    const { catalogue, itemNotes } = itemCatalogue(vault, playerOne);
    expect(catalogue.map((item) => item.title)).toEqual(["Fixture Cursed Ring", "Fixture Rope"]);
    const ring = itemNotes["Items/Fixture Cursed Ring"].html;
    expect(ring).toContain("Players see this paragraph");
    expect(ring).not.toContain("ringsecretcallout");
    expect(ring).not.toContain("ringsecretsection");
  });

  it("offers the DM every item note, with DM parts boxed", () => {
    const { catalogue, itemNotes } = itemCatalogue(vault, DM_VIEWER);
    expect(catalogue.map((item) => item.title)).toContain("Fixture Secret Relic");
    expect(itemNotes["Items/Fixture Cursed Ring"].html).toContain("ringsecretsection");
  });

  it("tells the DM which item notes players can't read", () => {
    const { catalogue, itemNotes } = itemCatalogue(vault, DM_VIEWER);
    const relic = catalogue.find((item) => item.title === "Fixture Secret Relic");
    const rope = catalogue.find((item) => item.title === "Fixture Rope");
    expect(relic?.hiddenFromPlayers).toBe(true);
    expect(rope?.hiddenFromPlayers).toBeUndefined();
    expect(itemNotes["Items/Fixture Secret Relic"].hiddenFromPlayers).toBe(true);
  });

  it("lists the rest of the party with bags as people to give items to", () => {
    const companion = aCompanion({ id: "dog" });
    const page = characterPage(vault, pcOne, playerOne, [pcOne, pcTwo, companion, orphan]);
    expect(page.recipients).toEqual([
      { id: "two", name: "Fixture PC Two" },
      { id: "dog", name: "Fixture Companion", companion: true },
    ]);
  });

  it("makes the DM's additions gifts, and a player's not", () => {
    expect(characterPage(vault, pcOne, DM_VIEWER).givingAs).toBe("the DM");
    expect(characterPage(vault, pcOne, playerOne).givingAs).toBeUndefined();
  });
});

describe("portraitPath", () => {
  const withNote = (note: string, portrait?: string) =>
    aCharacter({ note, sheet: aSheet(portrait ? { portrait } : {}) });

  it("uses the image chosen on the sheet", () => {
    expect(
      portraitPath(
        vault,
        withNote("Party/Fixture PC One", "Attachments/mira-portrait.png"),
        playerOne,
      ),
    ).toBe("Attachments/mira-portrait.png");
  });

  it("otherwise uses the first image in the note, as the viewer may read it", () => {
    expect(portraitPath(vault, withNote("NPCs/Mira Stonehand"), DM_VIEWER)).toBe(
      "Attachments/mira-portrait.png",
    );
    // The informant's only image is in a DM section; a DM-only note gives players nothing.
    expect(portraitPath(vault, withNote("NPCs/Fixture Informant"), playerOne)).toBeUndefined();
    expect(portraitPath(vault, withNote("Secrets/Villain Plan"), playerOne)).toBeUndefined();
  });

  it("ignores a chosen image the viewer couldn't load anyway", () => {
    expect(
      portraitPath(vault, withNote("Party/Fixture PC One", "Attachments/dm-map.png"), playerOne),
    ).toBeUndefined();
    expect(
      portraitPath(vault, withNote("Party/Fixture PC One", "Attachments/dm-map.png"), DM_VIEWER),
    ).toBe("Attachments/dm-map.png");
  });

  it("offers as portraits only images the viewer may load", () => {
    expect(portraitChoices(vault, playerOne)).toContain("Attachments/mira-portrait.png");
    expect(portraitChoices(vault, playerOne)).not.toContain("Attachments/dm-map.png");
    expect(portraitChoices(vault, DM_VIEWER)).toContain("Attachments/dm-map.png");
  });

  it("ignores a chosen image that has left the vault", () => {
    expect(
      portraitPath(vault, withNote("Party/Fixture PC One", "Attachments/gone.png"), DM_VIEWER),
    ).toBeUndefined();
  });
});
