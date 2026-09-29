import { describe, expect, it } from "vitest";
import { aCharacter, aCompanion } from "~/characters/test-builders";
import { parseNote, type Note } from "../vault/parse-note";
import { controllersOf } from "./controllers";

const note = (frontmatter: string): Note =>
  parseNote("Party/Kit.md", `---\n${frontmatter}\n---\nFixture: a note.`);

const lookup = (found?: Note) => () => found;

describe("controllersOf", () => {
  it("gives a PC to the player named in its note, however the name is spaced or cased", () => {
    expect(controllersOf(aCharacter(), lookup(note("type: pc\nplayer: ' Player  One'")))).toEqual({
      players: ["player one"],
    });
  });

  it("gives a PC with no player named to nobody but the DM", () => {
    expect(controllersOf(aCharacter(), lookup(note("type: pc")))).toEqual({ players: [] });
  });

  it("shares a companion with the whole party, unless its note names a player", () => {
    expect(controllersOf(aCompanion(), lookup(note("type: companion")))).toBe("party");
    expect(
      controllersOf(aCompanion(), lookup(note("type: companion\nplayer: Player Two"))),
    ).toEqual({ players: ["player two"] });
  });

  it.each([
    ["the note has gone", aCharacter(), undefined],
    ["a PC's note is no longer a PC", aCharacter(), note("type: npc\nplayer: Player One")],
    ["a companion's note is no longer a companion", aCompanion(), note("type: npc")],
  ])("is unknown when %s", (_, character, found) => {
    expect(controllersOf(character, lookup(found))).toBe("unknown");
  });
});
