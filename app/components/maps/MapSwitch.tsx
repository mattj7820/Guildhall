import { useFetcher } from "react-router";
import type { MapId } from "~/maps/types";
import { mapEditUrl } from "~/maps/urls";

interface Props {
  mapId: MapId;
  label: string;
  on: boolean;
  /** What to send to the map's editor for the switch's new state. */
  change: (on: boolean) => Record<string, string | boolean>;
}

/**
 * A setting of the map changed from its page, saved at once, outside the editor's autosave and
 * undo: sharing it with players, or snapping tokens to its grid.
 */
export function MapSwitch({ mapId, label, on: saved, change }: Props) {
  const fetcher = useFetcher();
  // Shows the new state while it's being saved.
  const on = fetcher.json ? !saved : saved;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={fetcher.state !== "idle"}
      onClick={() =>
        fetcher.submit(change(!on), {
          method: "post",
          action: mapEditUrl(mapId),
          encType: "application/json",
        })
      }
      className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm font-medium hover:bg-raised disabled:opacity-70"
    >
      <span
        aria-hidden="true"
        className={`relative inline-block h-5 w-9 rounded-full transition-colors ${on ? "bg-accent" : "bg-line-strong"}`}
      >
        <span
          className={`absolute top-0.5 left-0 h-4 w-4 rounded-full bg-surface shadow transition-transform ${on ? "translate-x-4" : "translate-x-0.5"}`}
        />
      </span>
      {label}
    </button>
  );
}
