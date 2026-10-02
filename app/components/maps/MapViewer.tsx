import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import type { DmFightView } from "~/combat/fight";
import type { CombatCatalogue, PreparedEncounter } from "~/combat/types";
import { buttonClass, primaryButtonClass } from "~/components/styles";
import { areaRevealed } from "~/maps/fog/coverage";
import type { FogMask } from "~/maps/fog/types";
import type { AreaView, MapView, Size } from "~/maps/types";
import { mapEditUrl, mapUrl } from "~/maps/urls";
import { normalise, offset, toPixels } from "~/maps/geometry";
import { snapToGrid, toPixels as gridInPixels } from "~/maps/grid/grid";
import type { TokenAction } from "~/maps/tokens/actions";
import type { InsideBadge, PartyPlacement, Token, TokenView } from "~/maps/tokens/types";
import { useMapTokens } from "~/maps/tokens/useMapTokens";
import type { Point } from "~/maps/types";
import { newId } from "~/shared/ids";
import { AreaShape } from "./AreaShape";
import { FogAreaList } from "./FogAreaList";
import { FogLayer } from "./FogLayer";
import { FogPainter } from "./FogPainter";
import { FogToolbar } from "./FogToolbar";
import { ImageHealth } from "./ImageHealth";
import { MapBreadcrumbs } from "./MapBreadcrumbs";
import { MapCanvas } from "./MapCanvas";
import { NotePanel } from "./NotePanel";
import { MapSwitch } from "./MapSwitch";
import { GridLayer } from "./GridLayer";
import { InsideBadges } from "./InsideBadges";
import { useBattleTools } from "./useBattleTools";
import { useMapFight } from "./useMapFight";
import { FlashOverlay, StuntDefs, StuntLayer, StuntPalette, useStunts } from "./Stunts";
import { TOKEN_RADIUS, TokenLayer } from "./TokenLayer";
import { PlacingHint, TokenPanel, type Placing } from "./TokenPanel";
import { useFogTools } from "./useFogTools";

/** How dark the fog is for the DM, who sees the map through it. */
const DM_FOG_OPACITY = 0.6;

/** The areas players see: not secret, and at least half revealed. For presenting a shared map. */
function seenByPlayers(areas: AreaView[], mask: FogMask): AreaView[] {
  return areas.filter((area) => !area.secret && areaRevealed(mask, area.outline));
}

/**
 * The table view: the map with its areas, and a side panel with the map's note and a list of its
 * areas. Areas with a map open it; others show here, with their note if they have one. Present
 * fills the screen with just the map, for sharing it on a call; on a shared map it shows the fog
 * as players see it. The DM always sees the fog of a shared map, see-through, and Fog opens the
 * tools to reveal and hide.
 */
export function MapViewer({
  map,
  tokens: fromPage,
  inside: insideFromPage,
  party,
  images,
  sounds,
  fight: fightFromPage,
  catalogue,
  starting,
}: {
  map: MapView;
  tokens: TokenView[];
  inside: InsideBadge[];
  party: PartyPlacement[];
  images: string[];
  /** Audio in the vault's sounds folder, by path inside it, for the stunts' sound board. */
  sounds: string[];
  /** The fight the table is in, wherever it is. */
  fight: DmFightView | null;
  catalogue: CombatCatalogue;
  /** A prepared fight to start here; null if it no longer exists. */
  starting?: PreparedEncounter | null;
}) {
  const [selectedId, setSelectedId] = useState<string>();
  const selected = map.areas.find((area) => area.id === selectedId);
  const [actualSize, setActualSize] = useState<Size>();
  const { stage, presenting, togglePresenting } = usePresenting();
  const [fogMode, setFogMode] = useState(false);
  const fog = useFogTools(map.id, map.fog, fogMode && !presenting);
  const shared = !!map.shared;
  const fogOpacity = presenting ? 1 : DM_FOG_OPACITY;
  const mapTokens = useMapTokens(map.id, { tokens: fromPage, inside: insideFromPage });
  const { tokens, inside, error: tokenError, send } = mapTokens;
  const [focus, setFocus] = useState<{ at: [number, number]; key: number }>();
  const find = (token: TokenView) =>
    setFocus({ at: toPixels(token.at, map.size), key: (focus?.key ?? 0) + 1 });
  const [placing, setPlacing] = useState<Placing>();
  const [selectedTokenId, setSelectedTokenId] = useState<string>();
  const selectedToken = tokens.find((token) => token.id === selectedTokenId);
  const fight = useMapFight({
    map,
    fight: fightFromPage,
    catalogue,
    tokens,
    send,
    onFind: find,
    starting,
    onBringParty: () => setPlacing({ kind: "party", name: "the whole party" }),
  });
  const combat = fight.open && !fogMode;
  const placingMonsters = combat && fight.placing && !presenting;
  // The map's tools belong to battle maps, and step aside for the fog tools and placing tokens.
  const battle = useBattleTools({
    map,
    tokens: tokens,
    enabled: !fogMode && !presenting && !placing && !placingMonsters,
  });
  const selectToken = (token: TokenView, how?: { additive: boolean }) => {
    setSelectedTokenId(token.id);
    fight.selectToken(token, how?.additive);
  };
  const [stuntMode, setStuntMode] = useState(false);
  const stunts = useStunts();
  const stuntArmed = stuntMode && !!stunts.armed;
  /** Stunts' sizes in image pixels: a burst about three squares across, a token's light five. */
  const stuntSizes = (scale: number) => {
    const square = map.grid ? map.grid.square * map.size.width : 70 / scale;
    return { burst: square * 1.5, light: square * 5 };
  };

  /** Where a token placed here lands: on a square while tokens snap to the grid. */
  const landing = (point: Point): Point => {
    if (!map.grid || !map.snapToGrid) return point;
    const [x, y] = snapToGrid(gridInPixels(map.grid, map.size), toPixels(point, map.size));
    return normalise(x, y, map.size);
  };

  function place(clicked: Point, scale: number) {
    const at = landing(clicked);
    if (placing?.kind === "party") {
      // Side by side around the click: in neighbouring squares on a battle map, else far enough
      // apart on screen for their names.
      const step = map.grid ? map.grid.square : (TOKEN_RADIUS * 4.5) / scale / map.size.width;
      const first = at[0] - step * Math.floor((party.length - 1) / 2);
      const placed = party.map((member, index): TokenAction => ({
        type: "place",
        token: {
          kind: "character",
          id: newId(),
          map: map.id,
          at: landing(offset([first, at[1]], step * index, 0)),
          note: member.note,
        },
      }));
      void send(placed);
      setPlacing(undefined);
      return;
    }
    const token: Token =
      placing?.kind === "character"
        ? { kind: "character", id: newId(), map: map.id, at, note: placing.note }
        : {
            kind: "marker",
            id: newId(),
            map: map.id,
            at,
            name: placing?.name ?? "",
            colour: placing?.kind === "marker" ? placing.colour : "red",
            visibility: placing?.kind === "marker" && placing.shown ? "players" : "dm",
          };
    void send([{ type: "place", token }]);
    setPlacing(undefined);
    setSelectedTokenId(token.id);
  }

  return (
    <main className="flex h-[calc(100dvh-3.5rem)] flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-stone-200 px-4 py-2 dark:border-stone-800">
        <MapBreadcrumbs crumbs={map.breadcrumbs} />
        <h1 className="sr-only">{map.name}</h1>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <MapSwitch
            mapId={map.id}
            label="Share with players"
            on={shared}
            change={(on) => ({ intent: "setVisibility", visibility: on ? "players" : "dm" })}
          />
          {map.grid && (
            <MapSwitch
              mapId={map.id}
              label="Snap to grid"
              on={!!map.snapToGrid}
              change={(snap) => ({ intent: "setSnapping", snap })}
            />
          )}
          <button
            type="button"
            aria-pressed={combat}
            className={combat ? primaryButtonClass : buttonClass}
            onClick={() => {
              fight.setOpen(!combat);
              setFogMode(false);
            }}
          >
            Combat
          </button>
          <button
            type="button"
            aria-pressed={stuntMode}
            className={stuntMode ? primaryButtonClass : buttonClass}
            onClick={() => {
              setStuntMode(!stuntMode);
              stunts.setArmed(undefined);
            }}
          >
            Stunts
          </button>
          <button
            type="button"
            aria-pressed={fogMode}
            className={fogMode ? primaryButtonClass : buttonClass}
            onClick={() => setFogMode(!fogMode)}
          >
            Fog
          </button>
          <button type="button" className={buttonClass} onClick={togglePresenting}>
            Present
          </button>
          <Link to={mapEditUrl(map.id)} className={buttonClass}>
            Edit map
          </Link>
        </div>
      </div>
      <ImageHealth map={map} images={images} actual={actualSize} />
      {map.image.inSharedNote && (
        <p
          role="alert"
          className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
        >
          This map's image is embedded in a wiki note players can read, so they can see all of it
          there, whatever the fog hides here. Take it out of that note, or make the note DM-only.
        </p>
      )}
      {fogMode && (
        <FogToolbar
          tool={fog.tool}
          onTool={fog.setTool}
          mode={fog.mode}
          onToggleMode={fog.toggleMode}
          radius={fog.radius}
          onRadius={fog.setRadius}
          onRevealAll={fog.revealAll}
          onHideAll={fog.hideAll}
          canUndo={fog.canUndo}
          canRedo={fog.canRedo}
          onUndo={() => fog.editor.undo()}
          onRedo={() => fog.editor.redo()}
          status={fog.status}
          revealed={fog.revealed}
        />
      )}

      <div
        ref={stage}
        className="flex min-h-0 flex-1 flex-col bg-stone-50 md:flex-row dark:bg-stone-950"
      >
        <div className={`relative flex min-h-[50vh] flex-1 ${stunts.shaking ? "stunt-shake" : ""}`}>
          <FlashOverlay flashKey={stunts.flashKey} />
          {stuntMode && (
            <StuntPalette
              stunts={stunts}
              sounds={sounds}
              onClose={() => {
                setStuntMode(false);
                stunts.setArmed(undefined);
              }}
            />
          )}
          {battle.toolbar}
          {combat && !presenting && fight.overMap}
          <MapCanvas
            name={map.name}
            size={map.size}
            imageUrl={map.image.url}
            className="flex-1"
            onImageMeasured={setActualSize}
            onKeyDown={(event) => {
              if (event.key === "Escape" && placing) setPlacing(undefined);
            }}

            focus={focus}
          >
            {(canvas) => (
              <>
                {map.grid && (
                  <g aria-label="Battle grid" role="img">
                    <GridLayer grid={map.grid} size={map.size} />
                  </g>
                )}
                {fogMode && !presenting ? (
                  <FogPainter
                    mask={fog.mask}
                    size={map.size}
                    canvas={canvas}
                    tool={fog.tool}
                    mode={fog.mode}
                    radius={fog.radius}
                    areas={map.areas}
                    panning={fog.panning}
                    opacity={fogOpacity}
                    onChange={fog.change}
                  />
                ) : (
                  <>
                    {shared && <FogLayer mask={fog.mask} size={map.size} opacity={fogOpacity} />}
                    <g aria-label="Map areas" role="group">
                      {(presenting && shared ? seenByPlayers(map.areas, fog.mask) : map.areas).map(
                        (area) => (
                          <AreaShape
                            key={area.id}
                            area={area}
                            size={map.size}
                            scale={canvas.scale}
                            selected={area.id === selectedId}
                            onSelect={(chosen) => setSelectedId(chosen.id)}
                          />
                        ),
                      )}
                    </g>
                  </>
                )}
                <InsideBadges
                  badges={inside}
                  areas={map.areas}
                  size={map.size}
                  scale={canvas.scale}
                />
                {stuntArmed && (
                  <rect
                    {...map.size}
                    fill="transparent"
                    className="cursor-crosshair"
                    aria-label="Play the stunt"
                    onClick={(event) => {
                      event.stopPropagation();
                      const point = canvas.clientToImage(event.clientX, event.clientY);
                      if (point) stunts.play(point, stuntSizes(canvas.scale));
                    }}
                  />
                )}
                <StuntLayer under stunts={stunts.points} size={map.size} canvas={canvas} />
                <TokenLayer
                  tokens={presenting ? tokens.filter((token) => !token.hidden) : tokens}
                  size={map.size}
                  canvas={canvas}
                  selectedId={presenting ? undefined : selectedTokenId}
                  alsoSelected={combat ? fight.pickedTokenIds : undefined}
                  onSelect={
                    stuntArmed
                      ? (token) =>
                          stunts.play(
                            toPixels(token.at, map.size),
                            stuntSizes(canvas.scale),
                            token.id,
                          )
                      : presenting
                        ? undefined
                        : selectToken
                  }
                  activeId={fight.activeTokenId}
                  stunts={stunts.onTokens}
                  mover={presenting ? undefined : mapTokens}
                  grid={map.grid}
                  snap={map.snapToGrid}
                  takeHeld
                />
                {battle.layers(canvas)}
                <StuntDefs />
                <StuntLayer stunts={stunts.points} size={map.size} canvas={canvas} />
                {placingMonsters && !placing && !stuntArmed && (
                  <rect
                    {...map.size}
                    fill="transparent"
                    className="cursor-crosshair"
                    aria-label="Place the monsters"
                    onClick={(event) => {
                      event.stopPropagation();
                      const point = canvas.clientToImage(event.clientX, event.clientY);
                      if (point) {
                        fight.placeMonsters(normalise(point[0], point[1], map.size), canvas.scale);
                      }
                    }}
                  />
                )}
                {placing && !presenting && (
                  <rect
                    {...map.size}
                    fill="transparent"
                    className="cursor-crosshair"
                    onClick={(event) => {
                      event.stopPropagation();
                      const point = canvas.clientToImage(event.clientX, event.clientY);
                      if (point) place(normalise(point[0], point[1], map.size), canvas.scale);
                    }}
                  />
                )}
              </>
            )}
          </MapCanvas>
          {!presenting && !combat && map.areas.length > 0 && <Legend />}
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
            className={`flex w-full flex-col gap-4 overflow-y-auto border-stone-200 p-4 md:border-l dark:border-stone-800 ${
              // The tracker needs the room.
              combat ? "md:w-[27rem]" : "md:w-80"
            }`}
          >
            {combat ? (
              <>
                {battle.caught.length > 0 && (
                  <button
                    type="button"
                    className={`${buttonClass} self-start`}
                    onClick={() => fight.pickTokens(battle.caught)}
                  >
                    Pick the monsters in the area
                  </button>
                )}
                {placing && (
                  <PlacingHint placing={placing} onCancel={() => setPlacing(undefined)} />
                )}
                {fight.panel}
              </>
            ) : fogMode ? (
              <FogAreaList
                areas={map.areas}
                mask={fog.mask}
                shared={shared}
                onReveal={fog.revealArea}
                onHide={fog.hideArea}
              />
            ) : selected ? (
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
            {!fogMode && !combat && (
              <TokenPanel
                mapId={map.id}
                party={party}
                tokens={tokens}
                selected={selectedToken}
                placing={placing}
                error={tokenError}
                onPlace={setPlacing}
                onSelect={(token) => setSelectedTokenId(token?.id)}
                onFind={find}
                grid={map.grid}
                size={map.size}
                send={(actions) => void send(actions)}
              />
            )}
            {!combat && <AreaList areas={map.areas} onSelect={(area) => setSelectedId(area.id)} />}
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
