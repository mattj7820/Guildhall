import { useEffect, useState } from "react";
import type { AreaId, AreaView } from "~/maps/types";

/**
 * What's shown of the areas beyond their pins: every place's outline and name (the Places switch,
 * or P), the one picked out in the side panel's list, and on touch the one tapped once.
 */
export function usePlaces() {
  const [all, setAll] = useState(false);
  const [highlighted, setHighlighted] = useState<AreaId>();
  const [previewed, setPreviewed] = useState<AreaId>();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable]")) return;
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      if (event.key.toLowerCase() === "p") setAll((on) => !on);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return {
    all,
    toggle: () => setAll((on) => !on),
    /** Props for an area on the map. */
    areaProps: (area: AreaView) => ({
      lit: all || area.id === highlighted,
      previewed: area.id === previewed,
      onPreview: (tapped: AreaView) => setPreviewed(tapped.id),
    }),
    /** Picks an area out from a list, or stops (undefined). */
    highlight: setHighlighted,
  };
}

export type Places = ReturnType<typeof usePlaces>;

/** The switch beside the zoom buttons. */
export function PlacesButton({ places }: { places: Places }) {
  return (
    <button
      type="button"
      aria-pressed={places.all}
      title="Show every place's outline and name (P)"
      onClick={places.toggle}
      className={`rounded px-2 py-1 font-semibold ${places.all ? "bg-accent text-on-accent" : "hover:bg-line"}`}
    >
      Places
    </button>
  );
}
