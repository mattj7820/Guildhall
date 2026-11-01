/**
 * The board as one viewer may see it. Players get shown cards whose notes they may read, and
 * string only between cards they see: a hidden card is absent, never hinted at.
 */
import type { PlayerId } from "~/campaign/types";
import { owns } from "./actions";
import type { AuthorView, Board, BoardAuthor, BoardCard, BoardView, CardView } from "./types";

export interface BoardLookups {
  /** A note as the viewer may see it, by entity ID; none if it's missing or not theirs to see. */
  note: (id: string) => { title: string; url: string } | undefined;
  /** A player's name, for their cards. */
  playerName: (id: PlayerId) => string;
}

/** Whether a viewer (the DM, or a player who may be no one yet) sees a card. */
export function seesCard(forDm: boolean, card: BoardCard, note: BoardLookups["note"]): boolean {
  if (forDm) return true;
  switch (card.kind) {
    case "next":
    case "sessions":
      return true;
    case "note":
      return card.shown && note(card.noteId) !== undefined;
    case "text":
      return card.shown;
  }
}

/**
 * The board for one viewer. `actor` is who they are on the board: the DM, a player, or no one
 * (a player without a character, who may look but not put anything up).
 */
export function boardForViewer(
  board: Board,
  actor: BoardAuthor | undefined,
  lookups: BoardLookups,
): BoardView {
  const forDm = actor?.dm === true;
  const author = (by: BoardAuthor): AuthorView =>
    by.dm ? { dm: true } : { dm: false, name: lookups.playerName(by.player) };
  const mine = (thing: Parameters<typeof owns>[1]) => actor !== undefined && owns(actor, thing);

  const cards = board.cards
    .filter((card) => seesCard(forDm, card, lookups.note))
    .map((card): CardView => {
      const common = { id: card.id, x: card.x, y: card.y };
      switch (card.kind) {
        case "next":
        case "sessions":
          return { ...common, kind: card.kind, mine: forDm };
        case "note": {
          const note = lookups.note(card.noteId);
          return {
            ...common,
            kind: "note",
            mine: mine(card),
            shown: card.shown,
            by: author(card.by),
            ...(note && { note }),
            ...(card.caption && { caption: card.caption }),
          };
        }
        case "text":
          return {
            ...common,
            kind: "text",
            mine: mine(card),
            text: card.text,
            shown: card.shown,
            by: author(card.by),
          };
      }
    });
  const seen = new Set(cards.map((card) => card.id));
  const strings = board.strings
    .filter((string) => seen.has(string.from) && seen.has(string.to))
    .map((string) => ({
      id: string.id,
      from: string.from,
      to: string.to,
      dm: string.by.dm,
      mine: mine(string),
      ...(string.label && { label: string.label }),
    }));
  return { cards, strings };
}
