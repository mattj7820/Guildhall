import { useState } from "react";
import { useRevalidator } from "react-router";
import type { DmFightView } from "~/combat/fight";
import type { CombatCatalogue, PreparedEncounter } from "~/combat/types";
import { buttonClass, primaryButtonClass } from "~/components/styles";
import { areaRevealed } from "~/maps/fog/coverage";
import type { FogMask } from "~/maps/fog/types";
import { normalise, toPixels } from "~/maps/geometry";
import { useStuntSettings } from "~/maps/stunt-settings";
import type { InsideBadge, PartyPlacement, TokenTools, TokenView } from "~/maps/tokens/types";
import type { TokenAction } from "~/maps/tokens/actions";
import { useMapTokens } from "~/maps/tokens/useMapTokens";
import type { AreaView, MapView, Size } from "~/maps/types";
import { AreaShape } from "./AreaShape";
import { ClickCatcher } from "./ClickCatcher";
import { FightPickBar } from "./FightPickBar";
import { FogAreaList } from "./FogAreaList";
import { FogLayer } from "./FogLayer";
import { FogPainter } from "./FogPainter";
import { FogToolbar } from "./FogToolbar";
import { GridLayer } from "./GridLayer";
import { ImageHealth } from "./ImageHealth";
import { InsideBadges } from "./InsideBadges";
import { MapBreadcrumbs } from "./MapBreadcrumbs";
import { MapCanvas } from "./MapCanvas";
import { MapViewerBar } from "./MapViewerBar";
import { AreaList, Legend, SelectedArea, usePresenting } from "./MapViewerParts";
import { PlacesButton, usePlaces } from "./Places";
import { NotePanel } from "./NotePanel";
import {
  FlashOverlay,
  StuntDefs,
  StuntLayer,
  StuntPalette,
  StuntSettingsMenu,
  useStuntPicker,
  useStunts,
} from "./Stunts";
import { TokenLayer } from "./TokenLayer";
import { DmSidePanel } from "./DmSidePanel";
import { PlacingHint } from "./PlacingHint";
import { TokensTab } from "./TokensTab";
import { useBattleTools } from "./useBattleTools";
import { useFogTools } from "./useFogTools";
import { useMapFight } from "./useMapFight";
import { useTokenPick } from "./useTokenPick";
import { useTokenPlacing } from "./useTokenPlacing";

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
  tokenTools,
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
  tokenTools: TokenTools;
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
  const places = usePlaces();
  const [actualSize, setActualSize] = useState<Size>();
  const { stage, presenting, togglePresenting } = usePresenting();
  const [fogMode, setFogMode] = useState(false);
  const fog = useFogTools(map.id, map.fog, fogMode && !presenting);
  const shared = !!map.shared;
  const fogOpacity = presenting ? 1 : DM_FOG_OPACITY;
  const mapTokens = useMapTokens(map.id, { tokens: fromPage, inside: insideFromPage });
  const { tokens, inside, error: tokenError, send: sendTokens } = mapTokens;
  const revalidator = useRevalidator();
  /** Sends token changes; ones that change the party's places or the lists elsewhere reload them. */
  const send = async (actions: TokenAction[]) => {
    await sendTokens(actions);
    if (actions.some(changesElsewhere)) void revalidator.revalidate();
  };
  const [focus, setFocus] = useState<{ at: [number, number]; key: number }>();
  const find = (token: TokenView) =>
    setFocus({ at: toPixels(token.at, map.size), key: (focus?.key ?? 0) + 1 });
  const [selectedTokenId, setSelectedTokenId] = useState<string>();
  const { placing, setPlacing, place } = useTokenPlacing({
    map,
    party,
    send,
    onPlaced: setSelectedTokenId,
  });
  const selectedToken = tokens.find((token) => token.id === selectedTokenId);
  const pick = useTokenPick(tokens, !fogMode && !presenting && !placing);
  const fight = useMapFight({
    map,
    fight: fightFromPage,
    catalogue,
    tokens,
    send,
    onFind: find,
    starting,
    onBringParty: () => setPlacing({ kind: "party", name: "the whole party" }),
    pickedTokens: pick.picked,
    onClearPick: pick.clear,
  });
  const combat = fight.open && !fogMode;
  const placingMonsters = combat && fight.placing && !presenting;
  // The map's tools belong to battle maps, and step aside for the fog tools and placing tokens.
  const battle = useBattleTools({
    map,
    tokens: tokens,
    enabled: !fogMode && !presenting && !placing && !placingMonsters,
  });
  // Choosing a token on the map opens its settings, unless the fight's open; Shift-click picks.
  // In the fight, choosing a monster picks it alone, for damage.
  const [showTokens, setShowTokens] = useState(0);
  const selectToken = (token: TokenView, how?: { additive: boolean }) => {
    if (how?.additive) return pick.toggle(token.id);
    setSelectedTokenId(token.id);
    if (!combat) setShowTokens((count) => count + 1);
    fight.selectToken(token);
    pick.set(combat && fight.isMonster(token) ? [token.id] : []);
  };
  const [stuntMode, setStuntMode] = useState(false);
  const { settings: stuntSettings, change: changeStunts } = useStuntSettings();
  const stunts = useStunts(
    map,
    (id) => {
      const token = tokens.find((each) => each.id === id);
      return token && toPixels(token.at, map.size);
    },
    stuntSettings,
  );
  const picker = useStuntPicker(stunts, map.size);
  const stuntArmed = stuntMode && !!picker.armed;
  /** Stunts' sizes in image pixels: a burst about three squares across, a token's light five. */
  const stuntSizes = (scale: number) => {
    const square = map.grid ? map.grid.square * map.size.width : 70 / scale;
    return { burst: square * 1.5, light: square * 5 };
  };

  return (
    <main className="flex h-[calc(100dvh-3.5rem)] flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-2">
        <MapBreadcrumbs crumbs={map.breadcrumbs} />
        <h1 className="sr-only">{map.name}</h1>
        <MapViewerBar
          map={map}
          stunts={
            <StuntSettingsMenu stunts={stunts} settings={stuntSettings} onChange={changeStunts} />
          }
          combat={combat}
          stuntMode={stuntMode}
          fogMode={fogMode}
          onCombat={() => {
            fight.setOpen(!combat);
            setFogMode(false);
          }}
          onStunts={() => {
            setStuntMode(!stuntMode);
            picker.setArmed(undefined);
          }}
          onFog={() => setFogMode(!fogMode)}
          onPresent={togglePresenting}
        />
      </div>
      <ImageHealth map={map} images={images} actual={actualSize} />
      {map.image.inSharedNote && (
        <p
          role="alert"
          className="border-b border-warn/40 bg-warn-surface px-4 py-2 text-sm text-warn"
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

      <div ref={stage} className="flex min-h-0 flex-1 flex-col bg-raised md:flex-row">
        <div className={`relative flex min-h-[50vh] flex-1 ${stunts.shaking ? "stunt-shake" : ""}`}>
          <FlashOverlay flashKey={stunts.flashKey} />
          {stuntMode && (
            <StuntPalette
              stunts={picker}
              sounds={sounds}
              onClose={() => {
                setStuntMode(false);
                picker.setArmed(undefined);
              }}
            />
          )}
          {battle.toolbar}
          {combat && !presenting && fight.overMap}
          {!presenting && (
            <FightPickBar
              picked={tokens.filter((token) => pick.picked.includes(token.id))}
              onClear={pick.clear}
            />
          )}
          <MapCanvas
            name={map.name}
            size={map.size}
            imageUrl={map.image.url}
            className="flex-1"
            controls={
              map.areas.length > 0 && !fogMode ? <PlacesButton places={places} /> : undefined
            }
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
                            occupied={inside.some((badge) => badge.area === area.id)}
                            onSelect={(chosen) => setSelectedId(chosen.id)}
                            {...places.areaProps(area)}
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
                  <ClickCatcher
                    size={map.size}
                    canvas={canvas}
                    label="Play the stunt"
                    onPoint={(point, scale) => picker.play(point, stuntSizes(scale))}
                  />
                )}
                <StuntLayer under stunts={stunts.points} size={map.size} canvas={canvas} />
                {!stuntArmed && pick.boxLayer(map.size, canvas)}
                <TokenLayer
                  tokens={presenting ? tokens.filter((token) => !token.hidden) : tokens}
                  size={map.size}
                  canvas={canvas}
                  selectedId={presenting ? undefined : selectedTokenId}
                  alsoSelected={presenting ? undefined : pick.picked}
                  onSelect={
                    stuntArmed
                      ? (token) =>
                          picker.play(
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
                  <ClickCatcher
                    size={map.size}
                    canvas={canvas}
                    label="Place the monsters"
                    onPoint={([x, y], scale) =>
                      fight.placeMonsters(normalise(x, y, map.size), scale)
                    }
                  />
                )}
                {placing && !presenting && (
                  <ClickCatcher
                    size={map.size}
                    canvas={canvas}
                    onPoint={([x, y], scale) => place(normalise(x, y, map.size), scale)}
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
          <DmSidePanel
            showTokens={showTokens}
            fog={
              fogMode && (
                <FogAreaList
                  areas={map.areas}
                  mask={fog.mask}
                  shared={shared}
                  onReveal={fog.revealArea}
                  onHide={fog.hideArea}
                />
              )
            }
            fight={
              combat && (
                <>
                  {battle.caught.length > 0 && (
                    <button
                      type="button"
                      className={`${buttonClass} self-start`}
                      onClick={() => pick.set(battle.caught)}
                    >
                      Pick the monsters in the area
                    </button>
                  )}
                  {placing && (
                    <PlacingHint placing={placing} onCancel={() => setPlacing(undefined)} />
                  )}
                  {fight.panel}
                </>
              )
            }
            map={
              <>
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
                    <p className="text-sm text-danger">
                      This map's wiki note is no longer in the vault. Choose another in the editor's
                      map settings.
                    </p>
                  )
                )}
                <AreaList
                  areas={map.areas}
                  onSelect={(area) => setSelectedId(area.id)}
                  onHighlight={places.highlight}
                />
              </>
            }
            tokens={
              <TokensTab
                mapId={map.id}
                party={party}
                tools={tokenTools}
                creatures={catalogue.creatures}
                tokens={tokens}
                selected={selectedToken}
                picked={pick.picked}
                onTogglePick={pick.toggle}
                placing={placing}
                error={tokenError}
                onPlace={setPlacing}
                onSelect={(token) => setSelectedTokenId(token?.id)}
                onFind={find}
                grid={map.grid}
                size={map.size}
                send={(actions) => void send(actions)}
              />
            }
          />
        )}
      </div>
    </main>
  );
}

/** Whether a token change touches more than this map's tokens: the party's places, or the lists. */
function changesElsewhere(action: TokenAction): boolean {
  return (
    action.type === "place" ||
    action.type === "remove" ||
    action.type === "setAside" ||
    (action.type === "move" && !!action.map)
  );
}
