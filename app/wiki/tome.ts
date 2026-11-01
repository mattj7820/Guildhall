/**
 * The tome's bookkeeping: its chapters (as ribbons), which one a note is in, which way a page
 * turns, and marking a query in a result. Isomorphic and pure.
 */
import { byName, matchRank } from "~/shared/name-search";
import type { FolderNode, NoteSummary } from "./types";

export interface Chapter {
  /** Unique: the folder's path, with a `/` after it for only its own notes. */
  key: string;
  name: string;
  /** The notes the chapter holds (for front pages, the folder without its folders). */
  folder: FolderNode;
  /** Only the folder's own notes, not those in its folders. */
  shallow?: boolean;
}

/** The ribbon for notes outside any chapter: the book's own, or those at the vault's top. */
export const TOP_NOTES = "Front pages";

/**
 * The tome's chapters. With a book folder (the DM's pick), they're its folders, its own notes
 * first; nothing outside it is in the book. Without one (or one the tree doesn't have), they're
 * the vault's top folders, with any notes at the top first.
 */
export function chaptersOf(root: FolderNode, bookFolder?: string): Chapter[] {
  const book = (bookFolder && root.folders.find((folder) => folder.path === bookFolder)) || root;
  const front: Chapter[] =
    book.notes.length === 0
      ? []
      : [
          {
            key: `${book.path}/`,
            name: TOP_NOTES,
            folder: { ...book, folders: [] },
            shallow: true,
          },
        ];
  return [
    ...front,
    ...book.folders.map((folder) => ({ key: folder.path, name: folder.name, folder })),
  ];
}

/** Whether a note is in the book: inside its folder, or anywhere when the book is the vault. */
export function inBook(slug: string, bookFolder: string | undefined): boolean {
  return !bookFolder || slug.toLowerCase().startsWith(`${bookFolder.toLowerCase()}/`);
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
  // Ignoring case, like note URLs.
  const folder = slug.includes("/") ? slug.slice(0, slug.lastIndexOf("/")).toLowerCase() : "";
  const path = (chapter: Chapter) => chapter.folder.path.toLowerCase();
  const own = chapters.find((chapter) => chapter.shallow && path(chapter) === folder);
  const within = chapters.find(
    (chapter) =>
      !chapter.shallow && (folder === path(chapter) || folder.startsWith(`${path(chapter)}/`)),
  );
  return (own ?? within)?.key;
}

export type TurnDirection = "forward" | "back";

export interface Turn {
  /** The browser's Back or Forward (a "POP"), rather than following a link. */
  popped: boolean;
  /** React Router numbers each history entry (`idx`): a lower number is an earlier page. */
  fromIdx: unknown;
  toIdx: unknown;
  fromSlug: string | undefined;
  toSlug: string | undefined;
  /** Every note's slug in the book's order: the chapters' contents, one after another. */
  order: readonly string[];
}

/**
 * Which way the page turns. Back and Forward in the browser turn the way they go through
 * history; following a link (from a note, the contents or a search) turns towards where the note
 * is in the book, so a note earlier in the book turns the page back.
 */
export function turnDirection(turn: Turn): TurnDirection {
  if (turn.popped) {
    return typeof turn.fromIdx === "number" &&
      typeof turn.toIdx === "number" &&
      turn.toIdx < turn.fromIdx
      ? "back"
      : "forward";
  }
  const from = turn.fromSlug === undefined ? -1 : turn.order.indexOf(turn.fromSlug);
  const to = turn.toSlug === undefined ? -1 : turn.order.indexOf(turn.toSlug);
  return from >= 0 && to >= 0 && to < from ? "back" : "forward";
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
