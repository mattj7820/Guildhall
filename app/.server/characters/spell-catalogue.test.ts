import { gzipSync } from "node:zlib";
import { beforeAll, describe, expect, it } from "vitest";
import { DM_VIEWER, type Viewer } from "~/campaign/types";
import { aCharacter, aSheet, aSpell } from "~/characters/test-builders";
import { FIXTURE_VAULT } from "../../../tests/support/fixture-vault";
import { Vault } from "../vault/vault";
import { characterPage } from "./load";
import { sheetSpellTexts, spellOptions, spellText } from "./spell-catalogue";

/** Integration tests over the fixture vault's spell notes and the SRD's spells. */
let vault: Vault;
beforeAll(async () => {
  vault = await Vault.load(FIXTURE_VAULT);
});

const playerOne: Viewer = { role: "player", playerId: "player one" };
const mine = (viewer: Viewer) => spellOptions(vault, viewer).filter((option) => option.note);

describe("spellOptions", () => {
  it("offers players every SRD spell and the spell notes they may read", () => {
    const options = spellOptions(vault, playerOne);
    expect(options.filter((option) => option.srd?.source === "srd-5.1")).toHaveLength(319);
    expect(options.filter((option) => option.srd?.source === "srd-5.2")).toHaveLength(339);
    expect(mine(playerOne).map((option) => option.name)).toEqual([
      "Fixture Artificer Spell",
      "Fixture Spark",
    ]);
  });

  it("never offers players a DM-only spell note", () => {
    const json = JSON.stringify(spellOptions(vault, playerOne));
    expect(json).not.toContain("Fixture Secret Spell");
    expect(json).not.toContain("hiddenFromPlayers");
  });

  it("offers the DM every spell note, saying which players can't read", () => {
    expect(mine(DM_VIEWER).find((option) => option.name === "Fixture Secret Spell")).toMatchObject({
      note: "Spells/Fixture Secret Spell",
      hiddenFromPlayers: true,
    });
    expect(mine(DM_VIEWER).find((option) => option.name === "Fixture Spark")).not.toHaveProperty(
      "hiddenFromPlayers",
    );
  });

  it("fills a note's option in from its frontmatter", () => {
    expect(mine(playerOne)[0]).toEqual({
      key: "note/Spells/Fixture Artificer Spell",
      name: "Fixture Artificer Spell",
      level: 1,
      school: "Evocation",
      classes: ["Artificer"],
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S",
      duration: "Instantaneous",
      concentration: false,
      ritual: false,
      attack: false,
      save: "dex",
      roll: "2d6",
      effect: "thunder",
      area: { shape: "cube", feet: 10 },
      note: "Spells/Fixture Artificer Spell",
    });
  });

  it("keeps the picker's list small: no text, and a budget for all of it", () => {
    const json = JSON.stringify({ spells: spellOptions(vault, playerOne) });
    expect(json).not.toContain("bright streak");
    expect(gzipSync(json).length).toBeLessThan(BUDGET);
  });
});

/** Gzipped bytes for the picker's list of every spell (about 20 KB when this was set). */
const BUDGET = 30_000;

describe("spellText", () => {
  it("gives an SRD spell's text, credited to its SRD", () => {
    const text = spellText(vault, playerOne, "srd-5.2/fireball");
    expect(text?.source).toBe("SRD 5.2.1");
    expect(text?.html).toContain("A bright streak flashes from you");
    expect(text?.html).toContain("<em>Material:</em> a ball of bat guano and sulfur");
    expect(text?.html).toContain("At higher levels");
  });

  it("gives a reaction's trigger, which the sheet's casting time leaves out", () => {
    expect(spellText(vault, playerOne, "srd-5.2/shield")?.html).toContain(
      "<em>Casting time:</em> Reaction, which you take when you are hit",
    );
  });

  it("renders 2014's tables as tables", () => {
    expect(spellText(vault, playerOne, "srd-5.1/confusion")?.html).toContain("<table>");
  });

  it("gives players a shared spell note without its DM parts", () => {
    const text = spellText(vault, playerOne, "note/Spells/Fixture Spark");
    expect(text).toMatchObject({ source: "Fixture Spark", url: "/wiki/Spells/Fixture%20Spark" });
    expect(text?.html).toContain("Players see this paragraph");
    expect(text?.html).not.toContain("sparksecretcallout");
    expect(text?.html).not.toContain("sparksecretsection");
  });

  it("gives a DM-only note to the DM, and to players nothing, as for one that isn't there", () => {
    expect(spellText(vault, DM_VIEWER, "note/Spells/Fixture Secret Spell")).toBeDefined();
    expect(spellText(vault, playerOne, "note/Spells/Fixture Secret Spell")).toBeUndefined();
    expect(spellText(vault, playerOne, "note/Spells/Nowhere")).toBeUndefined();
  });

  it.each(["", "fireball", "srd-9.9/fireball", "srd-5.2/no-such-spell", "note/Home"])(
    "gives nothing for %j",
    (key) => {
      expect(spellText(vault, DM_VIEWER, key)).toBeUndefined();
    },
  );
});

describe("a sheet's SRD spells", () => {
  const linked = aSpell({ id: "a", srd: { source: "srd-5.2", id: "fireball" } });
  const gone = aSpell({ id: "b", srd: { source: "srd-5.2", id: "no-such-spell" } });
  const typed = aSpell({ id: "c" });

  it("come with the sheet's page, and only those", () => {
    const sheet = aSheet({ spells: [linked, gone, typed] });
    expect(Object.keys(sheetSpellTexts(sheet))).toEqual(["srd-5.2/fireball"]);
    const page = characterPage(
      vault,
      aCharacter({ note: "Party/Fixture PC One", sheet }),
      playerOne,
    );
    expect(Object.keys(page.spellTexts ?? {})).toEqual(["srd-5.2/fireball"]);
  });

  it("add a few kilobytes to a page, for a sheet of twenty", () => {
    const ids = ["fireball", "cure-wounds", "shield", "misty-step", "counterspell", "web", "sleep"];
    const spells = Array.from({ length: 20 }, (_, index) =>
      aSpell({ id: `s${index}`, srd: { source: "srd-5.2", id: ids[index % ids.length] } }),
    );
    const size = (sheet: ReturnType<typeof aSheet>) =>
      gzipSync(
        JSON.stringify(
          characterPage(vault, aCharacter({ note: "Party/Fixture PC One", sheet }), playerOne),
        ),
      ).length;
    const added =
      size(aSheet({ spells })) - size(aSheet({ spells: spells.map(({ srd: _, ...s }) => s) }));
    expect(added).toBeLessThan(8_000);
  });
});
