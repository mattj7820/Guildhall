import { useMemo, useState } from "react";
import { Link } from "react-router";
import { fogMask } from "~/maps/fog/editor";
import type { AreaView, MapView, NoteLink, Size, TileLayer } from "~/maps/types";
import { mapUrl } from "~/maps/urls";
import { AreaShape } from "./AreaShape";
import { useFogImage } from "./FogLayer";
import { MapBreadcrumbs } from "./MapBreadcrumbs";
import { MapCanvas } from "./MapCanvas";
import { NotePanel } from "./NotePanel";

const REVEALED_ID = "revealed-by-fog";

/**
 * A map as players see it: black where the fog is, the tiles they may have where it isn't, and
 * the areas they can see, drawn only over the revealed parts. The server has already left out
 * everything else, so this only lays out what it was given.
 */
export function PlayerMapViewer({ map }: { map: MapView }) {
  const [selectedId, setSelectedId] = useState<string>();
  const selected = map.areas.find((area) => area.id === selectedId);
  const mask = useMemo(() => fogMask(map.fog), [map.fog]);
  const revealed = useFogImage(mask, "revealed");
  const tiles = map.image.tiles;
  const nothingYet = !tiles || tiles.tiles.length === 0;

  return (
    <main className="flex h-[calc(100dvh-3.5rem)] flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-stone-200 px-4 py-2 dark:border-stone-800">
        <MapBreadcrumbs crumbs={map.breadcrumbs} />
        <h1 className="sr-only">{map.name}</h1>
      </div>
      <div className="flex min-h-0 flex-1 flex-col bg-stone-50 md:flex-row dark:bg-stone-950">
        <div className="relative flex min-h-[50vh] flex-1">
          <MapCanvas
            name={map.name}
            size={map.size}
            className="flex-1"
            backdrop={<Tiles size={map.size} layer={tiles} />}
          >
            {({ scale }) => (
              <>
                {revealed && (
                  <defs>
                    <mask id={REVEALED_ID} maskUnits="userSpaceOnUse" x={0} y={0} {...map.size}>
                      <image href={revealed} {...map.size} preserveAspectRatio="none" />
                    </mask>
                  </defs>
                )}
                <g
                  aria-label="Map areas"
                  role="group"
                  mask={revealed ? `url(#${REVEALED_ID})` : undefined}
                >
                  {map.areas.map((area) => (
                    <AreaShape
                      key={area.id}
                      area={area}
                      size={map.size}
                      scale={scale}
                      selected={area.id === selectedId}
                      onSelect={(chosen) => setSelectedId(chosen.id)}
                      plain
                    />
                  ))}
                </g>
              </>
            )}
          </MapCanvas>
          {nothingYet && (
            <p className="pointer-events-none absolute inset-x-0 top-1/2 text-center font-serif text-lg text-stone-300">
              Nothing explored here yet.
            </p>
          )}
        </div>
        <aside
          aria-label="Map details"
          className="flex w-full flex-col gap-4 overflow-y-auto border-stone-200 p-4 md:w-80 md:border-l dark:border-stone-800"
        >
          {selected ? (
            <SelectedArea area={selected} onClose={() => setSelectedId(undefined)} />
          ) : (
            map.note && hasContent(map.note) && <NotePanel note={map.note} />
          )}
          <AreaList areas={map.areas} onSelect={(area) => setSelectedId(area.id)} />
        </aside>
      </div>
    </main>
  );
}

/** The tiles players may have, each at its place, over black. */
function Tiles({ size, layer }: { size: Size; layer?: TileLayer }) {
  const scaleX = layer ? size.width / layer.width : 1;
  const scaleY = layer ? size.height / layer.height : 1;
  return (
    <g>
      <rect {...size} fill="black" />
      {layer?.tiles.map(({ x, y, url }) => {
        const left = x * layer.size;
        const top = y * layer.size;
        // Each tile carries a pixel more on its right and bottom, under its neighbours.
        const width = Math.min(layer.width, left + layer.size + layer.overlap) - left;
        const height = Math.min(layer.height, top + layer.size + layer.overlap) - top;
        return (
          <image
            key={`${x}-${y}`}
            href={url}
            x={left * scaleX}
            y={top * scaleY}
            width={width * scaleX}
            height={height * scaleY}
            preserveAspectRatio="none"
          />
        );
      })}
    </g>
  );
}

/** An area's panel: its note if players can read any of it, or just its name. */
function SelectedArea({ area, onClose }: { area: AreaView; onClose: () => void }) {
  return (
    <section aria-label={area.name} className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <h2 className="mr-auto font-serif text-xl font-bold">{area.name}</h2>
        <button type="button" onClick={onClose} className="text-sm text-stone-500 hover:underline">
          Close
        </button>
      </div>
      {area.note && hasContent(area.note) ? (
        <NotePanel note={area.note} headingLevel={3} />
      ) : (
        <p className="text-sm text-stone-500">Nothing more is known yet.</p>
      )}
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
        Places
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
                className="block w-full rounded px-1 py-0.5 text-left hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                {area.name}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Whether a note has anything for players to read: a shared note may be all DM parts, which are
 * already taken out, leaving nothing but its title.
 */
function hasContent(note: NoteLink): boolean {
  if (/<(img|audio|video|table)\b/i.test(note.html)) return true;
  const text = note.html
    .replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/i, "")
    .replace(/<[^>]*>/g, "")
    .trim();
  return text.length > 0;
}
