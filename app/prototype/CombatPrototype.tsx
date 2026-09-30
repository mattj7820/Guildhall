// PROTOTYPE (removed before the PR): a fight run from the map page. The side panel is the real
// tracker (turn order, statblock, adding combatants), the dice log floats over the map, a turn
// strip runs across its top, and tokens link to combatants: selecting one selects the other, the
// active one is ringed, monsters show HP bars. Everything lives in this page; nothing is saved,
// and party members move only here.
import { useMemo, useState } from "react";
import { AddCombatants } from "~/components/combat/AddCombatants";
import { CombatantRow } from "~/components/combat/CombatantRow";
import { DiceRoller } from "~/components/combat/DiceRoller";
import { StatblockPanel } from "~/components/combat/StatblockPanel";
import { TiePrompts } from "~/components/combat/TiePrompts";
import { TurnBar } from "~/components/combat/TurnBar";
import { GridLayer } from "~/components/maps/GridLayer";
import { MapCanvas, type CanvasTools } from "~/components/maps/MapCanvas";
import { initials, TOKEN_RADIUS, TokenLayer } from "~/components/maps/TokenLayer";
import { createEncounter } from "~/combat/encounter";
import { statblockKey, type CombatCatalogue, type Combatant } from "~/combat/types";
import { useEncounter } from "~/combat/useEncounter";
import { useRollLog } from "~/dice/useRollLog";
import { normalise, toPixels } from "~/maps/geometry";
import { snapToGrid, toPixels as gridInPixels } from "~/maps/grid/grid";
import type { TokenView } from "~/maps/tokens/types";
import type { MapView, Point } from "~/maps/types";

type Positions = Record<string, Point>;

export function CombatPrototype({
  map,
  tokens: partyTokens,
  catalogue,
}: {
  map: MapView;
  tokens: TokenView[];
  catalogue: CombatCatalogue;
}) {
  const [initial] = useState(createEncounter);
  const tracker = useEncounter(initial);
  const { encounter, dispatch } = tracker;
  const rolls = useRollLog(tracker.rng);
  const creatures = useMemo(
    () => new Map(catalogue.creatures.map((creature) => [creature.key, creature])),
    [catalogue.creatures],
  );
  const [positions, setPositions] = useState<Positions>({});
  const [adding, setAdding] = useState(true);
  const [moved, setMoved] = useState<Positions>({});
  const [selectedId, setSelectedId] = useState<string>();
  const shownId = selectedId ?? encounter.activeId ?? undefined;
  const shown = encounter.combatants.find((c) => c.id === shownId);
  const squares = map.grid && gridInPixels(map.grid, map.size);

  // Monsters join without a place on the map; the next click drops them there.
  const unplaced = encounter.combatants.filter((c) => c.kind === "monster" && !positions[c.id]);

  /** The token standing for a combatant: a party member's by their note, a monster's own. */
  const tokenFor = (combatant: Combatant): TokenView | undefined => {
    if (combatant.kind === "player") {
      const party = partyTokens.find((token) => token.note && token.note === combatant.entityId);
      return party && { ...party, at: moved[party.id] ?? party.at };
    }
    const at = positions[combatant.id];
    return (
      at && {
        id: combatant.id,
        kind: "marker",
        at,
        size: 1,
        name: combatant.name,
        colour: combatant.hp.current > 0 ? "red" : "grey",
        movable: true,
      }
    );
  };
  const combatantOf = (tokenId: string) =>
    encounter.combatants.find((c) => c.id === tokenId || tokenFor(c)?.id === tokenId);

  const onMap = [
    ...partyTokens
      .filter((token) => !encounter.combatants.some((c) => tokenFor(c)?.id === token.id))
      .map((token) => ({ ...token, at: moved[token.id] ?? token.at })),
    ...encounter.combatants.flatMap((c) => tokenFor(c) ?? []),
  ];
  const selectedToken = shown && tokenFor(shown);

  function place(at: Point) {
    const step = map.grid ? map.grid.square : 0.03;
    setPositions((current) => {
      const next = { ...current };
      unplaced.forEach((monster, index) => {
        let point: Point = [at[0] + step * index, at[1]];
        if (squares) {
          const [x, y] = snapToGrid(squares, toPixels(point, map.size));
          point = normalise(x, y, map.size);
        }
        next[monster.id] = point;
      });
      return next;
    });
  }

  const activeName = encounter.combatants.find((c) => c.id === encounter.activeId)?.name;

  return (
    <main className="flex h-[calc(100dvh-3.5rem)] flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-stone-200 px-4 py-2 text-sm dark:border-stone-800">
        <a href={`/maps/${map.id}`} className="font-serif font-bold hover:underline">
          ← {map.name}
        </a>
        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-900 dark:text-amber-100">
          Prototype: a pretend fight in this page only; nothing is saved
        </span>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="relative flex min-w-0 flex-1">
          {encounter.phase === "active" && (
            <TurnStrip
              combatants={encounter.combatants}
              activeId={encounter.activeId}
              round={encounter.round}
              activeName={activeName}
              onSelect={setSelectedId}
            />
          )}
          {unplaced.length > 0 && (
            <p
              role="status"
              className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-lg bg-sky-900 px-3 py-2 text-sm text-white shadow"
            >
              Click the map to place {unplaced.map((m) => m.name).join(", ")}
            </p>
          )}
          <div className="absolute bottom-3 left-3 z-10 w-72 opacity-95">
            <DiceRoller rolls={rolls} />
          </div>
          <MapCanvas
            name={map.name}
            size={map.size}
            imageUrl={map.image.url}
            className="flex-1"
            onCanvasClick={(point) => {
              if (unplaced.length > 0) place(normalise(point[0], point[1], map.size));
            }}
          >
            {(canvas) => (
              <>
                {map.grid && <GridLayer grid={map.grid} size={map.size} />}
                <CombatOverlay
                  combatants={encounter.combatants}
                  activeId={encounter.activeId}
                  tokenFor={tokenFor}
                  canvas={canvas}
                  map={map}
                />
                <TokenLayer
                  tokens={onMap}
                  size={map.size}
                  canvas={canvas}
                  grid={map.grid}
                  snap={map.snapToGrid}
                  selectedId={selectedToken?.id}
                  onSelect={(token) => setSelectedId(combatantOf(token.id)?.id)}
                  mover={{
                    drag: () => {},
                    drop: (id, at) => {
                      if (positions[id]) setPositions({ ...positions, [id]: at });
                      else setMoved({ ...moved, [id]: at });
                    },
                    cancel: () => {},
                  }}
                  takeHeld
                />
              </>
            )}
          </MapCanvas>
        </div>
        <aside className="flex w-[27rem] flex-col gap-3 overflow-y-auto border-l border-stone-200 p-3 dark:border-stone-800">
          <TurnBar
            encounter={encounter}
            dispatch={dispatch}
            canUndo={tracker.canUndo}
            onUndo={tracker.undo}
            onNew={tracker.startNew}
          />
          <TiePrompts combatants={encounter.combatants} dispatch={dispatch} />
          {encounter.combatants.length > 0 && (
            <ol aria-label="Turn order" className="divide-y divide-stone-200 dark:divide-stone-800">
              {encounter.combatants.map((combatant, index) => (
                <CombatantRow
                  key={combatant.id}
                  combatant={combatant}
                  isActive={combatant.id === encounter.activeId}
                  isShown={combatant.id === shownId}
                  isFirst={index === 0}
                  isLast={index === encounter.combatants.length - 1}
                  dispatch={dispatch}
                  onShowStatblock={() => setSelectedId(combatant.id)}
                />
              ))}
            </ol>
          )}
          <details open={adding} onToggle={(event) => setAdding(event.currentTarget.open)}>
            <summary className="cursor-pointer font-semibold">Add to the fight</summary>
            <div className="mt-2">
              <AddCombatants
                catalogue={catalogue}
                encounter={encounter}
                dispatch={dispatch}
                rng={tracker.rng}
              />
            </div>
          </details>
          <StatblockPanel
            combatantName={shown?.name}
            creature={shown?.statblock ? creatures.get(statblockKey(shown.statblock)) : undefined}
            hasStatblock={Boolean(shown?.statblock)}
            onRoll={rolls.roll}
          />
        </aside>
      </div>
    </main>
  );
}

/** Portraits in turn order across the top of the map, like a game's: whose turn it is now. */
function TurnStrip({
  combatants,
  activeId,
  round,
  activeName,
  onSelect,
}: {
  combatants: Combatant[];
  activeId: string | null;
  round: number;
  activeName?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex flex-col items-center gap-1">
      <p className="pointer-events-auto rounded-full bg-stone-900/85 px-3 py-1 text-sm font-semibold text-white shadow">
        Round {round} · {activeName ? `${activeName}'s turn` : "…"}
      </p>
      <ol
        aria-label="Turn strip"
        className="pointer-events-auto flex max-w-[90%] gap-1 overflow-x-auto rounded-full bg-white/90 p-1 shadow dark:bg-stone-900/90"
      >
        {combatants.map((c) => {
          const active = c.id === activeId;
          const down = c.kind === "monster" && c.hp.current <= 0;
          return (
            <li key={c.id}>
              <button
                type="button"
                title={c.name}
                onClick={() => onSelect(c.id)}
                className={`flex size-9 items-center justify-center rounded-full font-serif text-sm font-bold text-white ${
                  active ? "ring-3 ring-amber-500" : ""
                } ${c.kind === "monster" ? "bg-red-700" : "bg-stone-700"} ${down ? "opacity-40" : ""}`}
              >
                {initials(c.name)}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Under the tokens: a ring round whoever's turn it is, and monsters' HP bars. */
function CombatOverlay({
  combatants,
  activeId,
  tokenFor,
  canvas,
  map,
}: {
  combatants: Combatant[];
  activeId: string | null;
  tokenFor: (c: Combatant) => TokenView | undefined;
  canvas: CanvasTools;
  map: MapView;
}) {
  const squares = map.grid && gridInPixels(map.grid, map.size);
  return (
    <g className="pointer-events-none">
      {combatants.map((c) => {
        const token = tokenFor(c);
        if (!token) return null;
        const [x, y] = toPixels(token.at, map.size);
        const r = squares
          ? Math.max((token.size * squares.square) / 2, 8 / canvas.scale)
          : (TOKEN_RADIUS + 3) / canvas.scale;
        return (
          <g key={c.id}>
            {c.id === activeId && (
              <circle
                cx={x}
                cy={y}
                r={r + 5 / canvas.scale}
                className="animate-pulse fill-none stroke-amber-400"
                strokeWidth={5 / canvas.scale}
              />
            )}
            {c.kind === "monster" && (
              <g transform={`translate(${x - r * 0.75} ${y - r - 8 / canvas.scale})`}>
                <rect width={1.5 * r} height={5 / canvas.scale} className="fill-stone-900/70" />
                <rect
                  width={(1.5 * r * Math.max(0, c.hp.current)) / Math.max(1, c.hp.max)}
                  height={5 / canvas.scale}
                  className={c.hp.current > c.hp.max / 2 ? "fill-green-500" : "fill-red-500"}
                />
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}
