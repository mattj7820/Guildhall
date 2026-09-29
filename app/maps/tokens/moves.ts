/**
 * A map's tokens in the browser: what the server last said, with this viewer's own moves on top
 * until the server has them (so a token never jumps back while its move is on the way), and
 * others' drags as they happen. Pure, so it can be tested without a browser.
 */
import type { Point } from "../types";
import type { TokenId, TokenView } from "./types";

/**
 * Someone else's drag is forgotten when nothing more is heard of it for this long: they closed
 * the tab mid-drag. It matches how long the server holds a token for them.
 */
export const OTHERS_DRAG_MS = 3000;

interface OthersDrag {
  at: Point;
  by: string;
  /** When it was last heard of, in milliseconds. */
  heard: number;
}

export interface Moves {
  /** The tokens as the server last said. */
  server: TokenView[];
  /** The token being dragged (or moved by keys) here now, and where it is. */
  drag?: { id: TokenId; at: Point };
  /** Moves made here and sent, not yet answered. */
  pending: Record<TokenId, Point>;
  /** Requests on their way: pushes are left alone meanwhile, since the answer will be newer. */
  sending: number;
  /** Tokens others are dragging now. */
  others: Record<TokenId, OthersDrag>;
}

export type MovesEvent =
  /** The server pushed the tokens (live), or the page's data was reloaded. */
  | { type: "pushed"; tokens: TokenView[] }
  | { type: "dragged"; id: TokenId; at: Point }
  /** Let go: the move is about to be sent. */
  | { type: "dropped"; id: TokenId; at: Point }
  /** Put back where it was, or someone else has it (the server said so). */
  | { type: "cancelled" }
  | { type: "sent" }
  /** The server answered a request, with the tokens as they are now (or nothing, if it failed). */
  | { type: "answered"; tokens?: TokenView[] }
  | { type: "othersMoving"; id: TokenId; at: Point; by: string; now: number }
  /** Time passing: others' drags nothing more has been heard of are forgotten. */
  | { type: "tick"; now: number };

export const startMoves = (tokens: TokenView[]): Moves => ({
  server: tokens,
  pending: {},
  sending: 0,
  others: {},
});

export function movesReducer(state: Moves, event: MovesEvent): Moves {
  switch (event.type) {
    case "pushed":
      if (state.sending > 0) return state;
      return {
        ...state,
        server: event.tokens,
        others: withoutLanded(state.others, state.server, event.tokens),
      };
    case "dragged":
      return { ...state, drag: { id: event.id, at: event.at } };
    case "dropped":
      return { ...state, drag: undefined, pending: { ...state.pending, [event.id]: event.at } };
    case "cancelled":
      return { ...state, drag: undefined };
    case "sent":
      return { ...state, sending: state.sending + 1 };
    case "answered": {
      const sending = Math.max(0, state.sending - 1);
      const server = event.tokens ?? state.server;
      return {
        ...state,
        sending,
        server,
        others: withoutLanded(state.others, state.server, server),
        // Everything sent has been answered: the server's copy now has it, or refused it.
        ...(sending === 0 && { pending: {} }),
      };
    }
    case "othersMoving":
      return {
        ...state,
        others: { ...state.others, [event.id]: { at: event.at, by: event.by, heard: event.now } },
      };
    case "tick": {
      const kept = Object.entries(state.others).filter(
        ([, drag]) => event.now - drag.heard < OTHERS_DRAG_MS,
      );
      if (kept.length === Object.keys(state.others).length) return state;
      return { ...state, others: Object.fromEntries(kept) };
    }
  }
}

/** Others' drags that have landed: the token's saved place moved (or it's gone). */
function withoutLanded(
  others: Moves["others"],
  before: TokenView[],
  after: TokenView[],
): Moves["others"] {
  const ids = Object.keys(others);
  if (ids.length === 0) return others;
  const at = (tokens: TokenView[], id: TokenId) => tokens.find((token) => token.id === id)?.at;
  const kept = ids.filter((id) => {
    const was = at(before, id);
    const now = at(after, id);
    return was && now && was[0] === now[0] && was[1] === now[1];
  });
  return kept.length === ids.length
    ? others
    : Object.fromEntries(kept.map((id) => [id, others[id]]));
}

/** A token as drawn: where it's heading, and who else is moving it. */
export interface ShownToken extends TokenView {
  /** Someone else is dragging it, so it's theirs just now. */
  movingBy?: string;
  /** This viewer is moving it: it follows the pointer exactly, rather than gliding. */
  inHand?: boolean;
}

/** The tokens to draw: the drag here, then unanswered moves, then others' drags, then saved. */
export function shownTokens(state: Moves): ShownToken[] {
  return state.server.map((token) => {
    if (state.drag?.id === token.id) return { ...token, at: state.drag.at, inHand: true };
    const pending = state.pending[token.id];
    if (pending) return { ...token, at: pending, inHand: true };
    const other = state.others[token.id];
    if (other) return { ...token, at: other.at, movingBy: other.by };
    return token;
  });
}
