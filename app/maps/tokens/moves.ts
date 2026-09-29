/**
 * A map's tokens in the browser: what the server last said, with this viewer's own moves on top
 * until the server has them, so a token never jumps back while its move is on the way. Pure, so
 * it can be tested without a browser.
 */
import type { Point } from "../types";
import type { TokenId, TokenView } from "./types";

export interface Moves {
  /** The tokens as the server last said. */
  server: TokenView[];
  /** The token being dragged (or moved by keys) now, and where it is. */
  drag?: { id: TokenId; at: Point };
  /** Moves made here and sent, not yet answered. */
  pending: Record<TokenId, Point>;
  /** Requests on their way: pushes are left alone meanwhile, since the answer will be newer. */
  sending: number;
}

export type MovesEvent =
  /** The server pushed the tokens (live), or the page's data was reloaded. */
  | { type: "pushed"; tokens: TokenView[] }
  | { type: "dragged"; id: TokenId; at: Point }
  /** Let go: the move is about to be sent. */
  | { type: "dropped"; id: TokenId; at: Point }
  | { type: "cancelled" }
  | { type: "sent" }
  /** The server answered a request, with the tokens as they are now (or nothing, if it failed). */
  | { type: "answered"; tokens?: TokenView[] };

export const startMoves = (tokens: TokenView[]): Moves => ({
  server: tokens,
  pending: {},
  sending: 0,
});

export function movesReducer(state: Moves, event: MovesEvent): Moves {
  switch (event.type) {
    case "pushed":
      return state.sending > 0 ? state : { ...state, server: event.tokens };
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
      return {
        ...state,
        sending,
        ...(event.tokens && { server: event.tokens }),
        // Everything sent has been answered: the server's copy now has it, or refused it.
        ...(sending === 0 && { pending: {} }),
      };
    }
  }
}

/** The tokens to draw: the server's, with the drag and unanswered moves where they're heading. */
export function shownTokens(state: Moves): TokenView[] {
  return state.server.map((token) => {
    const at = state.drag?.id === token.id ? state.drag.at : (state.pending[token.id] ?? token.at);
    return at === token.at ? token : { ...token, at };
  });
}

/** Whether the viewer is moving this token right now. */
export const isMoving = (state: Moves, id: TokenId) => state.drag?.id === id || id in state.pending;
