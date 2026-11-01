import type { PlayerId } from "~/campaign/types";
import type { NoteSummary } from "~/wiki/types";

/** Where a card sits: its top-left corner, as fractions of the board (0..1). */
export interface BoardPoint {
  x: number;
  y: number;
}

/** Who put a card or a string up: the DM, or a player (by who they are, never their name). */
export type BoardAuthor = { dm: true } | { dm: false; player: PlayerId };

/** The two cards always on the board, which only the DM moves. */
export const FIXED_CARDS = ["next", "sessions"] as const;
export type FixedCardId = (typeof FIXED_CARDS)[number];

/**
 * A card as stored. The next session and the sessions list are always there; the DM pins notes
 * (by entity ID), and anyone writes a short card. Shown cards are the players' too; a player's
 * own card is always shown.
 */
export type BoardCard = BoardPoint & { id: string } & (
    | { kind: "next" }
    | { kind: "sessions" }
    | { kind: "note"; noteId: string; caption?: string; shown: boolean; by: BoardAuthor }
    | { kind: "text"; text: string; shown: boolean; by: BoardAuthor }
  );

/** String between two cards, perhaps labelled ("owes money to"). */
export interface BoardString {
  id: string;
  from: string;
  to: string;
  label?: string;
  by: BoardAuthor;
}

/** The whole board, as stored. */
export interface Board {
  cards: BoardCard[];
  strings: BoardString[];
}

/** Who put something up, as one viewer is told: the DM, or a player's name. */
export type AuthorView = { dm: true } | { dm: false; name: string };

/** A card as one viewer sees it; `mine` when they may move it, take it down or show it. */
export type CardView = BoardPoint & { id: string; mine: boolean } & (
    | { kind: "next" }
    | { kind: "sessions" }
    | {
        kind: "note";
        /** The note as the viewer may see it; none when it's gone (only ever the DM's). */
        note?: { title: string; url: string };
        caption?: string;
        shown: boolean;
        by: AuthorView;
      }
    | { kind: "text"; text: string; shown: boolean; by: AuthorView }
  );

export interface StringView {
  id: string;
  from: string;
  to: string;
  label?: string;
  /** The DM's string (gold), or the party's (red). */
  dm: boolean;
  mine: boolean;
}

/** The board as one viewer sees it: only cards they may see, and string between those. */
export interface BoardView {
  cards: CardView[];
  strings: StringView[];
}

/** The notice board's page for one viewer: shapes shared with the browser. */
export interface BoardPage {
  /** When the table next meets: an instant (ISO 8601), shown in each browser's time zone. */
  nextSession?: string;
  /** The session notes the viewer may read, newest first. */
  sessions: { title: string; url: string }[];
  /** Notes the DM may pin (none for players). */
  notes: NoteSummary[];
  board: BoardView;
  /** Whether the viewer may put anything up: the DM, or a player with a character. */
  canWrite: boolean;
}
