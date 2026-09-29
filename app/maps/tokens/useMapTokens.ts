import { useCallback, useState } from "react";
import type { LiveStatus } from "~/live/client";
import { useLiveMap } from "~/live/useLive";
import { mapTokensUrl } from "../urls";
import type { MapId, Point } from "../types";
import type { TokenAction } from "./actions";
import { movesReducer, shownTokens, startMoves, type MovesEvent } from "./moves";
import type { TokenId, TokenView } from "./types";

export interface MapTokensState {
  /** The tokens to draw, with this viewer's own moves where they're heading. */
  tokens: TokenView[];
  error?: string;
  status: LiveStatus;
  send: (actions: TokenAction[]) => Promise<void>;
  /** A token follows the pointer (or the arrow keys); nothing is sent yet. */
  drag: (id: TokenId, at: Point) => void;
  /** Let go: the move is sent, and the token stays there unless the server refuses it. */
  drop: (id: TokenId, at: Point, from: Point) => void;
  cancel: () => void;
  /** Tokens from somewhere else: the version check while the live connection is down. */
  pushed: (tokens: TokenView[]) => void;
}

/**
 * A map's tokens as this viewer may see them, kept up to date as they change (pushed over the
 * live connection, as the server decides this viewer may see them), and the viewer's own changes:
 * each goes to the server, which checks it and answers with the tokens as they are now.
 */
export function useMapTokens(map: MapId, fromPage: TokenView[]): MapTokensState {
  const [state, setState] = useState(() => ({
    fromPage,
    moves: startMoves(fromPage),
    error: undefined as string | undefined,
  }));
  // The page's data was reloaded: its tokens are newer than what's held here.
  if (state.fromPage !== fromPage) {
    setState({
      ...state,
      fromPage,
      moves: movesReducer(state.moves, { type: "pushed", tokens: fromPage }),
    });
  }

  const dispatch = useCallback(
    (event: MovesEvent, error?: string | null) =>
      setState((current) => ({
        ...current,
        moves: movesReducer(current.moves, event),
        ...(error !== undefined && { error: error ?? undefined }),
      })),
    [],
  );

  const status = useLiveMap(map, (message) => {
    if (message.type === "tokens") dispatch({ type: "pushed", tokens: message.tokens });
  });

  const send = useCallback(
    async (actions: TokenAction[]) => {
      dispatch({ type: "sent" });
      let body: { tokens?: TokenView[]; error?: string };
      let ok = false;
      try {
        const response = await fetch(mapTokensUrl(map), {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ actions }),
        });
        ok = response.ok;
        body = await response.json();
      } catch {
        body = { error: "Couldn't reach Guildhall, so that didn't save. Try again in a moment." };
      }
      dispatch(
        { type: "answered", tokens: body.tokens },
        ok ? null : (body.error ?? "That couldn't be saved."),
      );
    },
    [map, dispatch],
  );

  return {
    tokens: shownTokens(state.moves),
    error: state.error,
    status,
    send,
    drag: useCallback((id, at) => dispatch({ type: "dragged", id, at }), [dispatch]),
    drop: useCallback(
      (id, at, from) => {
        dispatch({ type: "dropped", id, at });
        void send([{ type: "move", id, to: at, from }]);
      },
      [dispatch, send],
    ),
    cancel: useCallback(() => dispatch({ type: "cancelled" }), [dispatch]),
    pushed: useCallback((tokens) => dispatch({ type: "pushed", tokens }), [dispatch]),
  };
}
