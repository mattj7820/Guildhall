import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveStatus } from "~/live/client";
import { Throttle } from "~/live/throttle";
import { sendLive, useLiveMap } from "~/live/useLive";
import { mapTokensUrl } from "../urls";
import type { MapId, Point } from "../types";
import type { TokenAction } from "./actions";
import { movesReducer, shownTokens, startMoves, type MovesEvent, type ShownToken } from "./moves";
import type { TokenId, TokenView } from "./types";

/** How often a drag is sent to the others: smooth enough, and light on the connection. */
export const DRAGS_PER_SECOND = 20;

export interface MapTokensState {
  /** The tokens to draw, with this viewer's own moves and others' drags where they are now. */
  tokens: ShownToken[];
  error?: string;
  status: LiveStatus;
  send: (actions: TokenAction[]) => Promise<void>;
  /** A token follows the pointer (or the arrow keys), and the others see it move. */
  drag: (id: TokenId, at: Point) => void;
  /** Let go: the move is saved, and the token stays there unless the server refuses it. */
  drop: (id: TokenId, at: Point, from: Point) => void;
  /** Put back where it was. */
  cancel: (id: TokenId) => void;
  /** Tokens from somewhere else: the version check while the live connection is down. */
  pushed: (tokens: TokenView[]) => void;
}

/**
 * A map's tokens as this viewer may see them, kept up to date as they change (pushed over the
 * live connection, as the server decides this viewer may see them), and the viewer's own changes:
 * each goes to the server, which checks it and answers with the tokens as they are now. While a
 * token is dragged, where it is goes to the others 20 times a second; the server holds it for
 * whoever picked it up first, and says so to anyone else who tries.
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

  const [throttle] = useState(() => new Throttle(DRAGS_PER_SECOND));
  const inHand = useRef<TokenId | undefined>(undefined);

  const status = useLiveMap(map, (message) => {
    if (message.type === "tokens") dispatch({ type: "pushed", tokens: message.tokens });
    if (message.type === "moving") {
      dispatch({
        type: "othersMoving",
        id: message.token,
        at: message.at,
        by: message.by,
        now: Date.now(),
      });
    }
    if (message.type === "held" && inHand.current === message.token) {
      inHand.current = undefined;
      throttle.cancel();
      dispatch({ type: "cancelled" }, `${message.by} is moving that.`);
    }
  });

  // Others' drags that stop without landing (a closed tab) are forgotten after a while.
  const othersMoving = Object.keys(state.moves.others).length > 0;
  useEffect(() => {
    if (!othersMoving) return;
    const timer = setInterval(() => dispatch({ type: "tick", now: Date.now() }), 500);
    return () => clearInterval(timer);
  }, [othersMoving, dispatch]);

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

  const drag = useCallback(
    (id: TokenId, at: Point) => {
      inHand.current = id;
      dispatch({ type: "dragged", id, at });
      throttle.push(() => sendLive({ type: "drag", map, token: id, at }));
    },
    [map, dispatch, throttle],
  );

  const drop = useCallback(
    (id: TokenId, at: Point, from: Point) => {
      inHand.current = undefined;
      throttle.cancel();
      dispatch({ type: "dropped", id, at });
      // Held until the move is saved, so nobody else picks it up in between.
      void send([{ type: "move", id, to: at, from }]).then(() =>
        sendLive({ type: "release", map, token: id }),
      );
    },
    [map, dispatch, send, throttle],
  );

  const cancel = useCallback(
    (id: TokenId) => {
      inHand.current = undefined;
      throttle.cancel();
      dispatch({ type: "cancelled" });
      sendLive({ type: "release", map, token: id });
    },
    [map, dispatch, throttle],
  );

  return {
    tokens: shownTokens(state.moves),
    error: state.error,
    status,
    send,
    drag,
    drop,
    cancel,
    pushed: useCallback((tokens) => dispatch({ type: "pushed", tokens }), [dispatch]),
  };
}
