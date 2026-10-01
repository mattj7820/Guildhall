import { useState } from "react";
import { FIGHT_URL } from "~/combat/useSharedFight";
import { buttonClass, panelClass, primaryButtonClass } from "~/components/styles";

/**
 * Ends the fight, back to the plain map: the monsters' tokens are cleared, or left where they
 * fell as markers to tidy later. The tracker empties when the server says the fight is over.
 */
export function EndFight({ onEnded, className = "" }: { onEnded: () => void; className?: string }) {
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string>();

  async function end(monsters: "clear" | "leave") {
    setError(undefined);
    try {
      const response = await fetch(FIGHT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ intent: "end", monsters }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setAsking(false);
      onEnded();
    } catch {
      setError("Couldn't end the fight. Try again in a moment.");
    }
  }

  if (!asking) {
    return (
      <button
        type="button"
        className={`${buttonClass} ${className}`}
        onClick={() => setAsking(true)}
      >
        End fight
      </button>
    );
  }
  return (
    <div
      role="group"
      aria-label="End the fight"
      className={`${panelClass} flex w-full flex-col gap-2 text-sm`}
    >
      <p className="font-semibold">End the fight?</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={primaryButtonClass} onClick={() => void end("clear")}>
          Clear the monsters
        </button>
        <button type="button" className={buttonClass} onClick={() => void end("leave")}>
          Leave them on the map
        </button>
        <button type="button" className={buttonClass} onClick={() => setAsking(false)}>
          Keep fighting
        </button>
      </div>
      {error && (
        <p role="alert" className="text-rose-700 dark:text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}
