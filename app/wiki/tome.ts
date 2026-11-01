/**
 * The tome's bookkeeping: its chapters (the vault's top folders, as ribbons), which one a note is
 * in, which way a page turns, and marking a query in a result. Isomorphic and pure.
 */
import { byName, matchRank } from "~/shared/name-search";
import type { FolderNode, NoteSummary } from "./types";

export interface Chapter {
  /** The top folder's path, or `` for notes at the top of the vault. */
  key: string;
  name: string;
  folder: FolderNode;
}

/** The ribbon for notes that aren't in any folder. */
export const TOP_NOTES = "Front pages";

export function chaptersOf(root: FolderNode): Chapter[] {
  const chapters = root.folders.map((folder) => ({ key: folder.path, name: folder.name, folder }));
  if (root.notes.length === 0) return chapters;
  return [{ key: "", name: TOP_NOTES, folder: { ...root, folders: [] } }, ...chapters];
}

/** The note's slug from a wiki URL, or undefined for the wiki's own pages. */
export function slugOf(pathname: string): string | undefined {
  const match = /^\/wiki\/(.+)$/.exec(pathname);
  if (!match) return undefined;
  try {
    return match[1].split("/").map(decodeURIComponent).join("/");
  } catch {
    return undefined;
  }
}

/** The chapter a note is in, or undefined if there's none (a missing note, the wiki's home). */
export function chapterOf(slug: string | undefined, chapters: Chapter[]): string | undefined {
  if (slug === undefined) return undefined;
  const top = slug.includes("/") ? slug.slice(0, slug.indexOf("/")).toLowerCase() : "";
  return chapters.find((chapter) => chapter.key.toLowerCase() === top)?.key;
}

export type TurnDirection = "forward" | "back";

/**
 * Going back through history turns the page back; anything else turns it forward. React Router
 * numbers each history entry (`idx`), so a lower number is an earlier page.
 */
export function turnDirection(fromIdx: unknown, toIdx: unknown): TurnDirection {
  return typeof fromIdx === "number" && typeof toIdx === "number" && toIdx < fromIdx
    ? "back"
    : "forward";
}

export interface MarkedPart {
  text: string;
  marked: boolean;
}

/** Splits text so each word of the query (and what it starts) can be marked, ignoring case. */
export function markQuery(text: string, query: string): MarkedPart[] {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 1);
  if (words.length === 0) return text ? [{ text, marked: false }] : [];
  const escaped = words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(${escaped.join("|")})`, "gi");
  return text
    .split(pattern)
    .filter(Boolean)
    .map((part) => ({ text: part, marked: words.includes(part.toLowerCase()) }));
}

/** The tome's spells, in order. Their names are the SRD's, so the table knows them at once. */
export const SPELLS = [
  {
    id: "locate",
    name: "Locate Object",
    does: "Search every note",
    key: "/",
    short: "Locate",
    plain: "Search",
  },
  {
    id: "misty",
    name: "Misty Step",
    does: "Jump to a note by name",
    key: "Ctrl K",
    short: "Misty",
    plain: "Jump",
  },
  {
    id: "detect",
    name: "Detect Magic",
    does: "Show notes by tag",
    key: undefined,
    short: "Detect",
    plain: "Tags",
  },
  {
    id: "scry",
    name: "Scrying",
    does: "What links to this note",
    key: undefined,
    short: "Scry",
    plain: "Links",
  },
] as const;
export type SpellId = (typeof SPELLS)[number]["id"];

/** Every note in a folder and those under it. */
export function notesIn(folder: FolderNode): NoteSummary[] {
  return [...folder.notes, ...folder.folders.flatMap(notesIn)];
}

/** Notes whose title matches, best first (as the pickers rank names), at most `limit`. */
export function byTitle(notes: NoteSummary[], query: string, limit = 30): NoteSummary[] {
  const wanted = query.trim().toLowerCase();
  return notes
    .flatMap((note) => {
      const rank = matchRank([note.title], wanted);
      return rank === undefined ? [] : [{ note, rank }];
    })
    .sort((a, b) => a.rank - b.rank || byName.compare(a.note.title, b.note.title))
    .slice(0, limit)
    .map(({ note }) => note);
}
