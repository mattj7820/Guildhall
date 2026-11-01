/**
 * Changes to the board, the same in the browser and on the server, which applies them to what's
 * stored now. Each says what it does to one card or string; whether the actor may is decided here
 * too, so a refused change and a change to something missing look the same.
 */
import { cardWidth, clampToBoard } from "./layout";
import {
  FIXED_CARDS,
  type Board,
  type BoardAuthor,
  type BoardCard,
  type BoardPoint,
  type BoardString,
} from "./types";

export type BoardAction =
  | { type: "place"; id: string; at: BoardPoint }
  /** The DM's: a vault note, by entity ID. Starts DM only. */
  | { type: "pin"; id: string; noteId: string; caption?: string; at: BoardPoint }
  /** Anyone's short card: a player's is shown at once, the DM's starts DM only. */
  | { type: "write"; id: string; text: string; at: BoardPoint }
  /** The DM shows one of their own cards to players, or hides it again. */
  | { type: "show"; id: string; shown: boolean }
  | { type: "takeDown"; id: string }
  | { type: "tie"; id: string; from: string; to: string; label?: string }
  | { type: "cut"; id: string };

/** Short cards stay short. */
export const MOST_OF_A_CARD = 140;
export const MOST_OF_A_LABEL = 40;
/** Enough for a long campaign, small enough that the board never grows without end. */
export const MOST_CARDS = 300;
export const MOST_STRINGS = 600;

/** The fixed cards, where they start. */
export const STARTING_CARDS: BoardCard[] = [
  { id: "next", kind: "next", x: 0.03, y: 0.05 },
  { id: "sessions", kind: "sessions", x: 0.04, y: 0.42 },
];

/** The board as stored, with the fixed cards in their places if it never had them. */
export function withFixedCards(board: Board): Board {
  const missing = STARTING_CARDS.filter((card) => !board.cards.some((each) => each.id === card.id));
  return missing.length ? { ...board, cards: [...missing, ...board.cards] } : board;
}

const sameAuthor = (a: BoardAuthor, b: BoardAuthor) =>
  a.dm ? b.dm : !b.dm && a.player === b.player;

/** Whether the actor may move, take down or show something: the DM anything, a player their own. */
export function owns(actor: BoardAuthor, thing: BoardCard | BoardString): boolean {
  if (actor.dm) return true;
  return "by" in thing && sameAuthor(actor, thing.by);
}

const isFixed = (id: string) => (FIXED_CARDS as readonly string[]).includes(id);

/**
 * Applies one change for an actor who sees the cards `canSee` allows, or answers undefined when
 * it isn't theirs to make (or names something they can't see, or something missing).
 */
export function applyBoardAction(
  board: Board,
  action: BoardAction,
  actor: BoardAuthor,
  canSee: (card: BoardCard) => boolean,
): Board | undefined {
  const card = (id: string) => {
    const found = board.cards.find((each) => each.id === id);
    return found && canSee(found) ? found : undefined;
  };
  const taken = (id: string) =>
    board.cards.some((each) => each.id === id) || board.strings.some((each) => each.id === id);
  const placed = (at: BoardPoint, kind: BoardCard["kind"]) => clampToBoard(at, cardWidth({ kind }));

  switch (action.type) {
    case "place": {
      const target = card(action.id);
      if (!target || !owns(actor, target)) return undefined;
      const at = placed(action.at, target.kind);
      return {
        ...board,
        cards: board.cards.map((each) => (each.id === target.id ? { ...each, ...at } : each)),
      };
    }
    case "pin": {
      if (!actor.dm || taken(action.id) || board.cards.length >= MOST_CARDS) return undefined;
      const caption = action.caption?.trim().slice(0, MOST_OF_A_CARD);
      const pinned: BoardCard = {
        id: action.id,
        kind: "note",
        noteId: action.noteId,
        shown: false,
        by: actor,
        ...placed(action.at, "note"),
        ...(caption && { caption }),
      };
      return { ...board, cards: [...board.cards, pinned] };
    }
    case "write": {
      const text = action.text.trim().slice(0, MOST_OF_A_CARD);
      if (!text || taken(action.id) || board.cards.length >= MOST_CARDS) return undefined;
      const written: BoardCard = {
        id: action.id,
        kind: "text",
        text,
        shown: !actor.dm,
        by: actor,
        ...placed(action.at, "text"),
      };
      return { ...board, cards: [...board.cards, written] };
    }
    case "show": {
      const target = card(action.id);
      // Only the DM's own cards can be hidden: a player's card is the party's.
      if (!actor.dm || !target || !("by" in target) || !target.by.dm) return undefined;
      return {
        ...board,
        cards: board.cards.map((each) =>
          each.id === target.id ? { ...target, shown: action.shown } : each,
        ),
      };
    }
    case "takeDown": {
      const target = card(action.id);
      if (!target || isFixed(target.id) || !owns(actor, target)) return undefined;
      return {
        cards: board.cards.filter((each) => each.id !== target.id),
        strings: board.strings.filter((each) => each.from !== target.id && each.to !== target.id),
      };
    }
    case "tie": {
      const [from, to] = [card(action.from), card(action.to)];
      if (!from || !to || from.id === to.id || taken(action.id)) return undefined;
      if (board.strings.length >= MOST_STRINGS) return undefined;
      const label = action.label?.trim().slice(0, MOST_OF_A_LABEL);
      const tied: BoardString = {
        id: action.id,
        from: from.id,
        to: to.id,
        by: actor,
        ...(label && { label }),
      };
      return { ...board, strings: [...board.strings, tied] };
    }
    case "cut": {
      const target = board.strings.find((each) => each.id === action.id);
      const seen = target && card(target.from) && card(target.to);
      if (!target || !seen || !owns(actor, target)) return undefined;
      return { ...board, strings: board.strings.filter((each) => each.id !== target.id) };
    }
  }
}
