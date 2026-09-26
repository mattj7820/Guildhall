import { describe, expect, it } from "vitest";
import { createLinkResolver, parseWikilink } from "./link-resolver";

describe("parseWikilink", () => {
  it.each([
    ["Mira", { target: "Mira" }],
    ["Mira|the blacksmith", { target: "Mira", alias: "the blacksmith" }],
    ["Session 1#Loot", { target: "Session 1", heading: "Loot" }],
    [
      "Session 1#Loot|what we found",
      { target: "Session 1", heading: "Loot", alias: "what we found" },
    ],
    ["#Market", { target: "", heading: "Market" }],
    ["Lore#Chapter#Section", { target: "Lore", heading: "Section" }],
    ["Note#^abc123", { target: "Note", block: "abc123" }],
    ["map.png|300", { target: "map.png", alias: "300" }],
    ["Mira\\|escaped pipe in a table", { target: "Mira", alias: "escaped pipe in a table" }],
    ["  Mira  |  spaced  ", { target: "Mira", alias: "spaced" }],
  ])("parses [[%s]]", (inner, expected) => {
    expect(parseWikilink(inner)).toEqual({ alias: undefined, ...expected });
  });
});

describe("createLinkResolver", () => {
  const resolver = createLinkResolver([
    "Home.md",
    "NPCs/Mira Stonehand.md",
    "NPCs/Captain Voss.md",
    "Locations/Old Mill.md",
    "Locations/Brindleford/Old Mill.md",
    "Locations/Brindleford/Notice Board.md",
    "Sessions/Session 1.5.md",
    "Attachments/map.png",
    "Attachments/Old Mill.png",
  ]);
  const resolve = (target: string, from = "Home.md") => resolver.resolve(target, from);

  describe("by file name", () => {
    it("finds a note anywhere in the vault", () => {
      expect(resolve("Mira Stonehand")).toBe("NPCs/Mira Stonehand.md");
    });

    it("ignores case", () => {
      expect(resolve("mira stonehand")).toBe("NPCs/Mira Stonehand.md");
    });

    it("accepts an explicit .md extension", () => {
      expect(resolve("Captain Voss.md")).toBe("NPCs/Captain Voss.md");
    });

    it("finds attachments by full file name", () => {
      expect(resolve("map.png")).toBe("Attachments/map.png");
    });

    it("treats dots in note names as part of the name, not an extension", () => {
      expect(resolve("Session 1.5")).toBe("Sessions/Session 1.5.md");
    });

    it("does not confuse a note with an attachment that shares its name", () => {
      expect(resolve("Old Mill")).toBe("Locations/Old Mill.md");
      expect(resolve("Old Mill.png")).toBe("Attachments/Old Mill.png");
    });
  });

  describe("ambiguous file names", () => {
    it("prefers the shortest path", () => {
      expect(resolve("Old Mill", "Home.md")).toBe("Locations/Old Mill.md");
    });

    it("prefers a note in the linking note's own folder", () => {
      expect(resolve("Old Mill", "Locations/Brindleford/Notice Board.md")).toBe(
        "Locations/Brindleford/Old Mill.md",
      );
    });
  });

  describe("by path", () => {
    it("resolves a path from the vault root", () => {
      expect(resolve("Locations/Brindleford/Old Mill")).toBe("Locations/Brindleford/Old Mill.md");
    });

    it("resolves a partial path as a suffix", () => {
      expect(resolve("Brindleford/Old Mill")).toBe("Locations/Brindleford/Old Mill.md");
    });

    it("resolves a path relative to the linking note", () => {
      expect(resolve("../Old Mill", "Locations/Brindleford/Notice Board.md")).toBe(
        "Locations/Old Mill.md",
      );
    });

    it("tolerates a leading slash", () => {
      expect(resolve("/NPCs/Captain Voss")).toBe("NPCs/Captain Voss.md");
    });
  });

  describe("unresolvable targets", () => {
    it.each(["Nobody", "", "   ", "NPCs/Nobody", "../../../etc/passwd"])(
      "returns undefined for %j",
      (target) => {
        expect(resolve(target)).toBeUndefined();
      },
    );
  });
});
