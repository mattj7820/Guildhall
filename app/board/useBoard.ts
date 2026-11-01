import { useState } from "react";
import { BOARD_ROOM } from "~/live/messages";
import { useLiveMap } from "~/live/useLive";
import type { BoardAction } from "./actions";
import type { BoardPoint, BoardView } from "./types";

/**
 * The notice board in the browser: the server's copy as this viewer sees it, kept up to date by the
 * live connection, with the viewer's own cards where they're dragging them. Every change is sent
 * as an action and the server's answer replaces the copy.
 */
export function useBoard(initial: BoardView) {
  const [board, setBoard] = useState(initial);
  // Where the viewer's own cards are while they drag them, until the server has the move.
  const [moving, setMoving] = useState<Record<string, BoardPoint>>({});
  const [error, setError] = useState<string>();

  // A revalidated page brings a newer board.
  const [loaded, setLoaded] = useState(initial);
  if (loaded !== initial) {
    setLoaded(initial);
    setBoard(initial);
  }
  const status = useLiveMap(BOARD_ROOM, (message) => {
    if (message.type === "board") setBoard(message.board);
  });

  async function send(action: BoardAction): Promise<boolean> {
    let body: { board?: BoardView; error?: string };
    let ok = false;
    try {
      const response = await fetch("/board/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ actions: [action] }),
      });
      ok = response.ok;
      body = await response.json();
    } catch {
      body = { error: "Couldn't reach Guildhall, so that didn't save. Try again in a moment." };
    }
    if (body.board) setBoard(body.board);
    setError(ok ? undefined : (body.error ?? "That didn't save."));
    return ok;
  }

  return {
    board: {
      ...board,
      cards: board.cards.map((card) => (moving[card.id] ? { ...card, ...moving[card.id] } : card)),
    },
    status,
    error,
    send,
    /** Shows a card where it's being dragged, without saving. */
    drag(id: string, at: BoardPoint) {
      setMoving((all) => ({ ...all, [id]: at }));
    },
    /** Saves where a card was put down. */
    async drop(id: string, at: BoardPoint) {
      setMoving((all) => ({ ...all, [id]: at }));
      await send({ type: "place", id, at });
      setMoving(({ [id]: _, ...rest }) => rest);
    },
  };
}
