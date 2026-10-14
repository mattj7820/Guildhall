import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkNote } from "./check-note";

const fixture = (path: string) =>
  readFileSync(new URL(`../../../tests/fixtures/vault/${path}`, import.meta.url), "utf8");

const fence = (...lines: string[]) => ["```statblock", ...lines, "```"].join("\n");

describe("checkNote", () => {
  it("passes the fixture vault's monster, spell and item notes", () => {
    for (const [path, kind] of [
      ["Bestiary/Fixture 2024 Statblock.md", "monster"],
      ["Spells/Fixture Spark.md", "spell"],
      ["Items/Fixture Rope.md", "item"],
    ] as const) {
      expect(checkNote(path, fixture(path), kind).problems, path).toEqual([]);
    }
  });

  it("describes a statblock's numbers and who can read the note", () => {
    const path = "Bestiary/Fixture 2024 Statblock.md";
    expect(checkNote(path, fixture(path), "monster").notes).toEqual([
      "DM-only: players can't see it.",
      "Statblock Fixture 2024 Statblock: AC 14, HP 11 (2d8 + 2), initiative 3",
    ]);
  });

  it("finds statblocks that can't be read, or that the tracker can't use", () => {
    const source = [fence("ac: 12"), fence("name: Thin", "cr: 1")].join("\n\n");
    expect(checkNote("Thin.md", source, "monster").problems).toEqual([
      "A statblock can't be read: The statblock has no name.",
      "Thin has no armour class (ac).",
      "Thin has no hit points (hp).",
    ]);
  });

  it("wants a statblock in a monster note", () => {
    expect(checkNote("Empty.md", "Just text.", "monster").problems).toEqual([
      "It has no ```statblock block, so the combat tracker won't find it.",
    ]);
  });

  it("says what the spell picker fills in", () => {
    const source = "---\ntype: spell\nlevel: 1\nclasses: [Wizard]\nroll: 2d6\n---\n";
    expect(checkNote("Bolt.md", source, "spell").notes).toContain(
      "The spell picker fills in: level, classes, roll.",
    );
    const path = "Spells/Fixture Spark.md";
    expect(checkNote(path, fixture(path), "spell").notes).toContain(
      "The spell picker fills in nothing: the player types the spell's details.",
    );
  });

  it("finds spell fields the picker would leave out", () => {
    const source = "---\ntype: spell\nlevel: eleven\nsave: luck\nroll: lots\n---\n";
    expect(checkNote("Odd.md", source, "spell").problems).toEqual([
      "`level: eleven` can't be read, so the picker leaves it out.",
      "`save: luck` can't be read, so the picker leaves it out.",
      "`roll: lots` can't be read, so the picker leaves it out.",
    ]);
  });

  it("wants the type that lists a spell or an item", () => {
    expect(checkNote("Ring.md", "---\nvisibility: players\n---\n", "item")).toEqual({
      problems: ["It needs `type: item` to be listed as an item."],
      notes: ["Players can read this note."],
    });
  });

  it("finds frontmatter that can't be read", () => {
    const { problems } = checkNote("Bad.md", "---\ntype: [spell\n---\n", "spell");
    expect(problems[0]).toMatch(/^The frontmatter can't be read/);
  });
});
