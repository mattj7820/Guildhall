import type { NoteSummary } from "~/wiki/types";

/** The notice board as one viewer sees it: shapes shared with the browser. */
export interface BoardPage {
  /** When the table next meets: an instant (ISO 8601), shown in each browser's time zone. */
  nextSession?: string;
  /** The session notes the viewer may read, newest first. */
  sessions: { title: string; url: string }[];
  /** Notes the DM may pin (none for players). */
  notes: NoteSummary[];
}

/** Who put a card or a string up: the DM's are gold, the party's red. */
export type BoardAuthor = { dm: true } | { dm: false; name: string };

/** Where a card sits: its top-left corner, as fractions of the board (0..1). */
export interface BoardPoint {
  x: number;
  y: number;
}

/**
 * A card on the board. The next session and the sessions list are always there; the DM pins
 * notes, and anyone writes a short card.
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
