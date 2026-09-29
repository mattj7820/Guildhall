import { useFetcher } from "react-router";
import type { MapId } from "~/maps/types";
import { mapEditUrl } from "~/maps/urls";

/**
 * Shares the whole map with players, or keeps it DM-only. A shared map starts fully fogged, so
 * sharing shows players nothing until something is revealed. Saved at once, outside the editor's
 * autosave and undo: sharing is deliberate.
 */
export function ShareSwitch({ mapId, shared }: { mapId: MapId; shared: boolean }) {
  const fetcher = useFetcher();
  const pending = fetcher.json as { visibility?: string } | undefined;
  const on = pending?.visibility ? pending.visibility === "players" : shared;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={fetcher.state !== "idle"}
      onClick={() =>
        fetcher.submit(
          { intent: "setVisibility", visibility: on ? "dm" : "players" },
          { method: "post", action: mapEditUrl(mapId), encType: "application/json" },
        )
      }
      className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm font-medium hover:bg-stone-100 disabled:opacity-70 dark:hover:bg-stone-800"
    >
      <span
        aria-hidden="true"
        className={`relative inline-block h-5 w-9 rounded-full transition-colors ${on ? "bg-amber-600" : "bg-stone-300 dark:bg-stone-700"}`}
      >
        <span
          className={`absolute top-0.5 left-0 h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? "translate-x-4" : "translate-x-0.5"}`}
        />
      </span>
      Share with players
    </button>
  );
}
