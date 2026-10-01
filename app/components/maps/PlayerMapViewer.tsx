import { useMemo, useState } from "react";
import { Link } from "react-router";
import { fogMask } from "~/maps/fog/editor";
import type { AreaView, MapView, NoteLink, Size, TileLayer } from "~/maps/types";
import { mapUrl, mapVersionUrl } from "~/maps/urls";
import { useMapUpdates } from "~/maps/useMapUpdates";
import { LiveStatus } from "../LiveStatus";
import { toPixels } from "~/maps/geometry";
import type { InsideBadge, TokenView } from "~/maps/tokens/types";
import { useMapTokens } from "~/maps/tokens/useMapTokens";
import { AreaShape } from "./AreaShape";
import { useFogImage } from "./FogLayer";
import { MapBreadcrumbs } from "./MapBreadcrumbs";
import { MapCanvas } from "./MapCanvas";
import { GridLayer } from "./GridLayer";
import type { MapGrid } from "~/maps/grid/grid";
import type { PlayerFightView } from "~/combat/fight";
import { usePlayerFight } from "~/combat/usePlayerFight";
import { EndMyTurn } from "~/components/combat/PlayerFight";
import { TurnStrip } from "~/components/combat/TurnStrip";
import { InsideBadges } from "./InsideBadges";
import { useBattleTools } from "./useBattleTools";
import { TokenDistances } from "./TokenDistances";
import { NotePanel } from "./NotePanel";
import { TokenLayer } from "./TokenLayer";

const REVEALED_ID = "revealed-by-fog";

/**
 * A map as players see it: black where the fog is, the tiles they may have where it isn't, and
 * the areas they can see, drawn only over the revealed parts. The server has already left out
 * everything else, so this only lays out what it was given. What the DM reveals shows within a
 * few seconds, without reloading the page.
 */
export function PlayerMapViewer({
  map,
  tokens,
  inside,
  version,
  fight: fightFromPage,
}: {
  map: MapView;
  tokens: TokenView[];
  inside: InsideBadge[];
  version: string;
  /** The fight the table is in, as this player may see it. */
  fight: PlayerFightView | null;
}) {
  const { fight, endTurn, ending } = usePlayerFight(fightFromPage);
  const fightHere = fight?.map === map.id && fight.view.started ? fight : undefined;
  const mapTokens = useMapTokens(map.id, { tokens, inside });
  const activeCombatant = fightHere?.view.turnOrder.find((entry) => entry.isActive)?.id;
  const activeToken = activeCombatant
    ? mapTokens.tokens.find((token) => token.combatant === activeCombatant)
    : undefined;
  const [focus, setFocus] = useState<{ at: [number, number]; key: number }>();
  const battle = useBattleTools({ map, tokens: mapTokens.tokens, enabled: true });
  const find = (token: TokenView) =>
    setFocus({ at: toPixels(token.at, map.size), key: (focus?.key ?? 0) + 1 });
  const status = useMapUpdates(map.id, mapVersionUrl(map.id), version, mapTokens.pushed);
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
        <div className="ml-auto flex items-center gap-3">
          <LiveStatus status={status} />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col bg-stone-50 md:flex-row dark:bg-stone-950">
        <div className="relative flex min-h-[50vh] flex-1">
          {battle.toolbar}
          {fightHere && (
            <TurnStrip floating round={fightHere.view.round} turnOrder={fightHere.view.turnOrder}>
              <EndMyTurn fight={fightHere} onEnd={endTurn} ending={ending} />
            </TurnStrip>
          )}
          <MapCanvas
            name={map.name}
            size={map.size}
            className="flex-1"
            backdrop={<Tiles size={map.size} layer={tiles} />}
            focus={focus}
          >
            {(canvas) => (
              <>
                {revealed && (
                  <defs>
                    <mask id={REVEALED_ID} maskUnits="userSpaceOnUse" x={0} y={0} {...map.size}>
                      <image href={revealed} {...map.size} preserveAspectRatio="none" />
                    </mask>
                  </defs>
                )}
                {/* Only over what's revealed, so it never runs off into the black. */}
                {map.grid && revealed && (
                  <g mask={`url(#${REVEALED_ID})`} aria-label="Battle grid" role="img">
                    <GridLayer grid={map.grid} size={map.size} />
                  </g>
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
                      scale={canvas.scale}
                      selected={area.id === selectedId}
                      onSelect={(chosen) => setSelectedId(chosen.id)}
                      plain
                    />
                  ))}
                </g>
                <InsideBadges
                  badges={mapTokens.inside}
                  areas={map.areas}
                  size={map.size}
                  scale={canvas.scale}
                />
                <TokenLayer
                  tokens={mapTokens.tokens}
                  size={map.size}
                  canvas={canvas}
                  mover={mapTokens}
                  grid={map.grid}
                  snap={map.snapToGrid}
                  sayMovable
                  activeId={activeToken?.id}
                />
                {battle.layers(canvas)}
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
          <PartyHere tokens={mapTokens.tokens} onFind={find} grid={map.grid} size={map.size} />
          <AreaList areas={map.areas} onSelect={(area) => setSelectedId(area.id)} />
        </aside>
      </div>
    </main>
  );
}

/** The party members on this map the player can see, to find them on it: theirs first. */
function PartyHere({
  tokens,
  onFind,
  grid,
  size,
}: {
  tokens: TokenView[];
  onFind: (token: TokenView) => void;
  grid?: MapGrid;
  size: Size;
}) {
  const theirs = tokens.find((token) => token.movable);
  const party = tokens
    .filter((token) => token.kind === "character")
    .sort((a, b) => Number(b.movable) - Number(a.movable));
  if (party.length === 0) return null;
  return (
    <section aria-labelledby="party-here-heading">
      <h2
        id="party-here-heading"
        className="mb-1 text-xs font-semibold tracking-wide text-stone-500 uppercase"
      >
        Party here
      </h2>
      <ul aria-label="Party here" className="flex flex-col gap-1 text-sm">
        {party.map((token) => (
          <li key={token.id} className="flex items-center gap-2">
            <span className="mr-auto">
              {token.name}
              {token.inTheDark && <span className="text-xs text-stone-500"> (in the dark)</span>}
            </span>
            <button
              type="button"
              aria-label={`Find ${token.name}`}
              className="rounded px-2 py-0.5 text-sm hover:bg-stone-100 dark:hover:bg-stone-800"
              onClick={() => onFind(token)}
            >
              Find
            </button>
          </li>
        ))}
      </ul>
      {grid && theirs && (
        <div className="mt-3">
          <h3 className="mb-1 text-xs font-semibold tracking-wide text-stone-500 uppercase">
            How far from {theirs.name}
          </h3>
          <TokenDistances from={theirs} tokens={tokens} grid={grid} size={size} />
        </div>
      )}
    </section>
  );
}

/** The tiles players may have, each at its place, over black. */
export function Tiles({ size, layer }: { size: Size; layer?: TileLayer }) {
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
