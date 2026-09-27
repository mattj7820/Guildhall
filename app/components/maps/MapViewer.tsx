import { useState } from "react";
import { Link } from "react-router";
import type { AreaView, MapView } from "~/maps/types";
import { mapUrl } from "~/maps/urls";
import { AreaShape } from "./AreaShape";
import { MapBreadcrumbs } from "./MapBreadcrumbs";
import { MapCanvas } from "./MapCanvas";
import { NotePanel } from "./NotePanel";

/** The table view: the map, its areas, and a side panel with the map's note and its areas. */
export function MapViewer({ map }: { map: MapView }) {
  const [selectedId, setSelectedId] = useState<string>();
  const selected = map.areas.find((area) => area.id === selectedId);

  return (
    <main className="flex h-[calc(100dvh-3.5rem)] flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-stone-200 px-4 py-2 dark:border-stone-800">
        <MapBreadcrumbs crumbs={map.breadcrumbs} />
        <h1 className="sr-only">{map.name}</h1>
      </div>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <MapCanvas
          name={map.name}
          size={map.size}
          imageUrl={map.image.url}
          className="min-h-[50vh] flex-1"
        >
          {(scale) => (
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
        <aside
          aria-label="Map details"
          className="flex w-full flex-col gap-4 overflow-y-auto border-stone-200 p-4 md:w-80 md:border-l dark:border-stone-800"
        >
          {selected ? (
            <SelectedArea area={selected} onClose={() => setSelectedId(undefined)} />
          ) : (
            map.note && <NotePanel note={map.note} />
          )}
          <AreaList areas={map.areas} onSelect={(area) => setSelectedId(area.id)} />
        </aside>
      </div>
    </main>
  );
}

function SelectedArea({ area, onClose }: { area: AreaView; onClose: () => void }) {
  return (
    <section aria-label={area.name} className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <h2 className="mr-auto font-serif text-xl font-bold">{area.name}</h2>
        <button type="button" onClick={onClose} className="text-sm text-stone-500 hover:underline">
          Close
        </button>
      </div>
      <p className="text-sm text-stone-600 dark:text-stone-400">Not mapped yet.</p>
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
