import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { buttonClass } from "~/components/styles";
import type { AreaId, AreaView } from "~/maps/types";
import { mapEditUrl, mapUrl } from "~/maps/urls";
import { NotePanel } from "./NotePanel";

/* The smaller parts of the DM's map page. */

/** Fullscreen for the map and its canvas only, with the browser's own Esc to leave. */
export function usePresenting() {
  const stage = useRef<HTMLDivElement>(null);
  const [presenting, setPresenting] = useState(false);
  useEffect(() => {
    const element = stage.current;
    const onChange = () => setPresenting(!!element && document.fullscreenElement === element);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const togglePresenting = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void stage.current?.requestFullscreen();
  };
  return { stage, presenting, togglePresenting };
}

/** A panel for an area without a map (or whose map the viewer can't see): no dead ends. */
export function SelectedArea({
  area,
  mapId,
  onClose,
}: {
  area: AreaView;
  mapId: string;
  onClose: () => void;
}) {
  return (
    <section aria-label={area.name} className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <h2 className="mr-auto font-serif text-xl font-bold">{area.name}</h2>
        <button type="button" onClick={onClose} className="text-sm text-muted hover:underline">
          Close
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">Not mapped yet.</span>
        <Link to={mapEditUrl(mapId, area.id)} className={buttonClass}>
          Attach a map
        </Link>
      </div>
      {area.broken.includes("map") && (
        <p className="text-sm text-danger">The map this area led to has been deleted.</p>
      )}
      {area.broken.includes("note") && (
        <p className="text-sm text-danger">
          The wiki note this area linked to is no longer in the vault.
        </p>
      )}
      {area.note && <NotePanel note={area.note} headingLevel={3} />}
    </section>
  );
}

export function AreaList({
  areas,
  onSelect,
  onHighlight,
}: {
  areas: AreaView[];
  onSelect: (area: AreaView) => void;
  /** Picks the area out on the map while it's pointed at or focused in the list. */
  onHighlight: (area: AreaId | undefined) => void;
}) {
  if (areas.length === 0) return null;
  const sorted = [...areas].sort((a, b) => a.name.localeCompare(b.name));
  const highlighting = (area: AreaView) => ({
    onPointerEnter: () => onHighlight(area.id),
    onPointerLeave: () => onHighlight(undefined),
    onFocus: () => onHighlight(area.id),
    onBlur: () => onHighlight(undefined),
  });
  return (
    <section aria-labelledby="map-areas-heading">
      <h2
        id="map-areas-heading"
        className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase"
      >
        Areas
      </h2>
      <ul aria-label="Areas" className="flex flex-col text-sm">
        {sorted.map((area) => (
          <li key={area.id}>
            {area.map ? (
              <Link
                to={mapUrl(area.map.id)}
                className="block rounded px-1 py-0.5 hover:bg-raised"
                {...highlighting(area)}
              >
                ▸ {area.name}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => onSelect(area)}
                className="block w-full rounded px-1 py-0.5 text-left text-muted hover:bg-raised"
                {...highlighting(area)}
              >
                ◌ {area.name} <span className="text-xs">(not mapped yet)</span>
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** What the pins mean, and how to see every place at once. */
export function Legend() {
  // Each pin on a patch of mid-tone, as it looks over a map, so it reads in every theme.
  const pin = (className: string) => (
    <svg width="16" height="16" viewBox="-8 -8 16 16" aria-hidden="true">
      {/* eslint-disable-next-line no-restricted-syntax */}
      <rect x="-8" y="-8" width="16" height="16" rx="3" className="fill-stone-500" />
      <path d="M 0 -5 L 5 0 L 0 5 L -5 0 Z" strokeWidth="1.5" className={className} />
    </svg>
  );
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 flex flex-col gap-1 rounded-md bg-surface/90 px-2 py-1.5 text-xs shadow">
      <span className="flex items-center gap-2">
        {/* The key matches the pins on the map, which are the same in every theme. */}
        {/* eslint-disable-next-line no-restricted-syntax */}
        {pin("fill-stone-50 stroke-stone-900")} Leads to a map
      </span>
      <span className="flex items-center gap-2">
        {/* eslint-disable-next-line no-restricted-syntax */}
        {pin("fill-stone-900/50 stroke-stone-50")} Not mapped yet
      </span>
      <span className="text-muted">P shows every place</span>
    </div>
  );
}
