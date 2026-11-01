import { describe, expect, it } from "vitest";
import { chapterOf, chaptersOf, markQuery, slugOf, TOP_NOTES, turnDirection } from "./tome";
import type { FolderNode } from "./types";

const note = (slug: string) => ({ id: slug, slug, title: slug.split("/").pop()! });
const folder = (path: string, notes: string[] = []): FolderNode => ({
  name: path.split("/").pop()!,
  path,
  folders: [],
  notes: notes.map(note),
});

describe("chaptersOf", () => {
  it("makes each top folder a chapter, with notes outside folders first", () => {
    const root: FolderNode = {
      ...folder(""),
      folders: [folder("NPCs"), folder("Locations")],
      notes: [note("Home")],
    };
    expect(chaptersOf(root).map(({ key, name }) => ({ key, name }))).toEqual([
      { key: "", name: TOP_NOTES },
      { key: "NPCs", name: "NPCs" },
      { key: "Locations", name: "Locations" },
    ]);
    expect(chaptersOf(root)[0].folder.folders).toEqual([]);
  });

  it("has no front pages when every note is in a folder", () => {
    expect(chaptersOf({ ...folder(""), folders: [folder("NPCs")] })).toHaveLength(1);
  });
});

describe("slugOf and chapterOf", () => {
  const chapters = chaptersOf({
    ...folder(""),
    folders: [folder("NPCs")],
    notes: [note("Home")],
  });

  it("reads the note from its URL", () => {
    expect(slugOf("/wiki/NPCs/Mira%20Stonehand")).toBe("NPCs/Mira Stonehand");
    expect(slugOf("/wiki")).toBeUndefined();
    expect(slugOf("/wiki/%E0%A4%A")).toBeUndefined();
  });

  it("finds the chapter by the note's top folder, ignoring case like note URLs", () => {
    expect(chapterOf("npcs/Deep/Someone", chapters)).toBe("NPCs");
    expect(chapterOf("Home", chapters)).toBe("");
    expect(chapterOf("Elsewhere/Note", chapters)).toBeUndefined();
    expect(chapterOf(undefined, chapters)).toBeUndefined();
  });
});

describe("turnDirection", () => {
  it("turns back only when going to an earlier history entry", () => {
    expect(turnDirection(3, 2)).toBe("back");
    expect(turnDirection(2, 3)).toBe("forward");
    expect(turnDirection(undefined, 1)).toBe("forward");
  });
});

describe("markQuery", () => {
  it("marks each word of the query, whatever its case", () => {
    expect(markQuery("The Old Mill by the river", "mill RIVER")).toEqual([
      { text: "The Old ", marked: false },
      { text: "Mill", marked: true },
      { text: " by the ", marked: false },
      { text: "river", marked: true },
    ]);
  });

  it("leaves text alone for single letters and characters regex would read", () => {
    expect(markQuery("a (b)", "a")).toEqual([{ text: "a (b)", marked: false }]);
    expect(markQuery("cost (5 gp)", "(5")).toEqual([
      { text: "cost ", marked: false },
      { text: "(5", marked: true },
      { text: " gp)", marked: false },
    ]);
  });
});
