import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { buttonClass, primaryButtonClass } from "~/components/styles";
import type { AreaView, MapView, Size } from "~/maps/types";
import { mapEditUrl, mapUrl } from "~/maps/urls";
import { AreaShape } from "./AreaShape";
import { ImageHealth } from "./ImageHealth";
import { MapBreadcrumbs } from "./MapBreadcrumbs";
import { MapCanvas } from "./MapCanvas";
import { NotePanel } from "./NotePanel";

/**
 * The table view: the map with its areas, and a side panel with the map's note and a list of its
 * areas. Areas with a map open it; others show here, with their note if they have one. Present
 * fills the screen with just the map, for sharing it on a call.
 */
export function MapViewer({ map, images }: { map: MapView; images: string[] }) {
  const [selectedId, setSelectedId] = useState<string>();
  const selected = map.areas.find((area) => area.id === selectedId);
  const [actualSize, setActualSize] = useState<Size>();
  const { stage, presenting, togglePresenting } = usePresenting();

  return (
    <main className="flex h-[calc(100dvh-3.5rem)] flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-stone-200 px-4 py-2 dark:border-stone-800">
        <MapBreadcrumbs crumbs={map.breadcrumbs} />
        <h1 className="sr-only">{map.name}</h1>
        <div className="ml-auto flex gap-2">
          <button type="button" className={buttonClass} onClick={togglePresenting}>
            Present
          </button>
          <Link to={mapEditUrl(map.id)} className={buttonClass}>
            Edit map
          </Link>
        </div>
      </div>
      <ImageHealth map={map} images={images} actual={actualSize} />

      <div
        ref={stage}
        className="flex min-h-0 flex-1 flex-col bg-stone-50 md:flex-row dark:bg-stone-950"
      >
        <div className="relative flex min-h-[50vh] flex-1">
          <MapCanvas
            name={map.name}
            size={map.size}
            imageUrl={map.image.url}
            className="flex-1"
            onImageMeasured={setActualSize}
          >
            {({ scale }) => (
              <g aria-label="Map areas" role="group">
                {map.areas.map((area) => (
                  <AreaShape
                    key={area.id}
                    area={area}
                    size={map.size}
                    scale={scale}
                    selected={area.id === selectedId}
                    onSelect={(chosen) => setSelectedId(chosen.id)}
                  />
                ))}
              </g>
            )}
          </MapCanvas>
          {!presenting && map.areas.length > 0 && <Legend />}
          {presenting && (
            <button
              type="button"
              className={`${primaryButtonClass} absolute top-3 right-3`}
              onClick={togglePresenting}
            >
              Stop presenting
            </button>
          )}
        </div>
        {!presenting && (
          <aside
            aria-label="Map details"
            className="flex w-full flex-col gap-4 overflow-y-auto border-stone-200 p-4 md:w-80 md:border-l dark:border-stone-800"
          >
            {selected ? (
              <SelectedArea
                area={selected}
                mapId={map.id}
                onClose={() => setSelectedId(undefined)}
              />
            ) : map.note ? (
              <NotePanel note={map.note} />
            ) : (
              map.noteBroken && (
                <p className="text-sm text-rose-700 dark:text-rose-400">
                  This map's wiki note is no longer in the vault. Choose another in the editor's map
                  settings.
                </p>
              )
            )}
            <AreaList areas={map.areas} onSelect={(area) => setSelectedId(area.id)} />
          </aside>
        )}
      </div>
    </main>
  );
}

/** Fullscreen for the map and its canvas only, with the browser's own Esc to leave. */
function usePresenting() {
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
function SelectedArea({
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
        <button type="button" onClick={onClose} className="text-sm text-stone-500 hover:underline">
          Close
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-stone-600 dark:text-stone-400">Not mapped yet.</span>
        <Link to={mapEditUrl(mapId, area.id)} className={buttonClass}>
          Attach a map
        </Link>
      </div>
      {area.broken.includes("map") && (
        <p className="text-sm text-rose-700 dark:text-rose-400">
          The map this area led to has been deleted.
        </p>
      )}
      {area.broken.includes("note") && (
        <p className="text-sm text-rose-700 dark:text-rose-400">
          The wiki note this area linked to is no longer in the vault.
        </p>
      )}
      {area.note && <NotePanel note={area.note} headingLevel={3} />}
    </section>
  );
}

function AreaList({ areas, onSelect }: { areas: AreaView[]; onSelect: (area: AreaView) => void }) {
  if (areas.length === 0) return null;
  const sorted = [...areas].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <section aria-labelledby="map-areas-heading">
      <h2
        id="map-areas-heading"
        className="mb-1 text-xs font-semibold tracking-wide text-stone-500 uppercase"
      >
        Areas
      </h2>
      <ul aria-label="Areas" className="flex flex-col text-sm">
        {sorted.map((area) => (
          <li key={area.id}>
            {area.map ? (
              <Link
                to={mapUrl(area.map.id)}
                className="block rounded px-1 py-0.5 hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                ▸ {area.name}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => onSelect(area)}
                className="block w-full rounded px-1 py-0.5 text-left text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
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

/** What the two outline styles mean. */
function Legend() {
  const swatch = (dashed: boolean, className: string) => (
    <svg width="22" height="12" aria-hidden="true">
      <rect
        x="1"
        y="1"
        width="20"
        height="10"
        strokeWidth="2"
        strokeDasharray={dashed ? "4 3" : undefined}
        className={className}
      />
    </svg>
  );
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 flex flex-col gap-1 rounded-md bg-white/90 px-2 py-1.5 text-xs shadow dark:bg-stone-900/90">
      <span className="flex items-center gap-2">
        {swatch(false, "fill-amber-400/30 stroke-amber-700")} Leads to a map
      </span>
      <span className="flex items-center gap-2">
        {swatch(true, "fill-stone-300/30 stroke-stone-700")} Not mapped yet
      </span>
    </div>
  );
}
