import { describe, expect, it } from "vitest";
import {
  byTitle,
  chapterOf,
  chaptersOf,
  markQuery,
  notesIn,
  slugOf,
  TOP_NOTES,
  turnDirection,
} from "./tome";
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
  const order = ["Home", "NPCs/Mira", "NPCs/Voss"];
  const link = { popped: false, fromIdx: 1, toIdx: 2, order };

  it("turns towards where a linked note is in the book", () => {
    expect(turnDirection({ ...link, fromSlug: "Home", toSlug: "NPCs/Voss" })).toBe("forward");
    expect(turnDirection({ ...link, fromSlug: "NPCs/Voss", toSlug: "NPCs/Mira" })).toBe("back");
  });

  it("turns forward to or from a page that isn't a note in the book", () => {
    expect(turnDirection({ ...link, fromSlug: undefined, toSlug: "Home" })).toBe("forward");
    expect(turnDirection({ ...link, fromSlug: "NPCs/Voss", toSlug: "Gone" })).toBe("forward");
  });

  it("turns the way the browser goes through history on Back and Forward", () => {
    const popped = { popped: true, order, fromSlug: "Home", toSlug: "NPCs/Voss" };
    expect(turnDirection({ ...popped, fromIdx: 3, toIdx: 2 })).toBe("back");
    expect(
      turnDirection({ ...popped, fromIdx: 2, toIdx: 3, fromSlug: "NPCs/Voss", toSlug: "Home" }),
    ).toBe("forward");
    expect(turnDirection({ ...popped, fromIdx: undefined, toIdx: 1 })).toBe("forward");
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

describe("byTitle", () => {
  const notes = ["Old Mill", "Mill Pond", "Miller", "Brindleford"].map(note);

  it("ranks exact names, then starts, then words, then anywhere", () => {
    expect(byTitle(notes, " mill ").map((n) => n.title)).toEqual([
      "Mill Pond",
      "Miller",
      "Old Mill",
    ]);
    expect(byTitle(notes, "ford").map((n) => n.title)).toEqual(["Brindleford"]);
  });

  it("lists every note by name when nothing's typed, up to the limit", () => {
    expect(byTitle(notes, "", 2).map((n) => n.title)).toEqual(["Brindleford", "Mill Pond"]);
  });
});

describe("notesIn", () => {
  it("gathers the notes of a folder and its folders", () => {
    const root = { ...folder("", ["Home"]), folders: [folder("NPCs", ["NPCs/Mira"])] };
    expect(notesIn(root).map((n) => n.slug)).toEqual(["Home", "NPCs/Mira"]);
  });
});
