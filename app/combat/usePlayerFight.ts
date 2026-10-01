import { useState } from "react";
import { FIGHT_ROOM } from "~/live/messages";
import { useLiveMap } from "~/live/useLive";
import type { PlayerFightView } from "./fight";
import { FIGHT_URL } from "./useSharedFight";

/**
 * The fight as this player may see it, kept up to date as it changes, and a way to end their own
 * turn when it's theirs.
 */
export function usePlayerFight(fromPage: PlayerFightView | null) {
  const [state, setState] = useState({ fromPage, fight: fromPage });
  // The page's data was reloaded: it's newer.
  if (state.fromPage !== fromPage) setState({ fromPage, fight: fromPage });
  const [error, setError] = useState<string>();
  const [ending, setEnding] = useState(false);

  useLiveMap(FIGHT_ROOM, (message) => {
    if (message.type !== "fight") return;
    const fight = message.fight;
    setState((current) => ({ ...current, fight: fight && !fight.forDm ? fight : null }));
  });

  async function endTurn() {
    setEnding(true);
    setError(undefined);
    try {
      const response = await fetch(FIGHT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ intent: "endTurn" }),
      });
      if (!response.ok) setError("It's not your turn any more.");
    } catch {
      setError("Couldn't reach Guildhall. Try again in a moment.");
    } finally {
      setEnding(false);
    }
  }

  return { fight: state.fight, endTurn, ending, error };
}
