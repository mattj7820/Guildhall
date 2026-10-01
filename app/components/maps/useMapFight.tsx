import { useMemo, useState, type ReactNode } from "react";
import type { EncounterAction } from "~/combat/encounter";
import type { DmFightView } from "~/combat/fight";
import { statblockKey, type CombatCatalogue, type Combatant } from "~/combat/types";
import { useSharedFight } from "~/combat/useSharedFight";
import { AddCombatants } from "~/components/combat/AddCombatants";
import { CombatantRow } from "~/components/combat/CombatantRow";
import { DiceRoller } from "~/components/combat/DiceRoller";
import { FightStatus } from "~/components/combat/FightStatus";
import { StatblockPanel } from "~/components/combat/StatblockPanel";
import { TiePrompts } from "~/components/combat/TiePrompts";
import { TurnBar } from "~/components/combat/TurnBar";
import { TurnStrip } from "~/components/combat/TurnStrip";
import { useRollLog } from "~/dice/useRollLog";
import { normalise, offset, toPixels } from "~/maps/geometry";
import { snapToGrid, toPixels as gridInPixels } from "~/maps/grid/grid";
import type { TokenAction } from "~/maps/tokens/actions";
import type { TokenView } from "~/maps/tokens/types";
import type { MapView, Point } from "~/maps/types";
import { newId } from "~/shared/ids";
import { EndFight } from "./EndFight";

interface Options {
  map: MapView;
  fight: DmFightView | null;
  catalogue: CombatCatalogue;
  tokens: readonly TokenView[];
  send: (actions: TokenAction[]) => unknown;
  /** Centres the map on a token. */
  onFind: (token: TokenView) => void;
}

/**
 * The fight the table is in, run from the map page: the tracker in the side panel, the turn strip
 * and dice log over the map, and monsters' tokens linked to their combatants. Monsters join
 * without a place, and the next click on the map puts them there, sized from their statblocks.
 * Whatever's changed here moves the fight to this map.
 */
export function useMapFight({ map, fight, catalogue, tokens, send, onFind }: Options) {
  const { tracker, status, hp, freeMovement, changeFreeMovement } = useSharedFight(fight, map.id);
  const { encounter } = tracker;
  const rolls = useRollLog(tracker.rng);
  const creatures = useMemo(
    () => new Map(catalogue.creatures.map((creature) => [creature.key, creature])),
    [catalogue.creatures],
  );
  const [open, setOpen] = useState(() => !!fight && fight.map === map.id);
  const [shownId, setShownId] = useState<string>();
  const [adding, setAdding] = useState(true);
  const shown = encounter.combatants.find((c) => c.id === (shownId ?? encounter.activeId));
  const tokenOf = (combatant: string) => tokens.find((token) => token.combatant === combatant);
  const active = encounter.phase === "active" ? encounter.activeId : null;
  const unplaced = encounter.combatants.filter((c) => c.kind === "monster" && !tokenOf(c.id));
  const squaresOf = (c: Combatant) =>
    (c.statblock && creatures.get(statblockKey(c.statblock))?.squares) || 1;

  /** Taking a monster out of the fight takes its token off the map too. */
  const dispatch = (action: EncounterAction) => {
    if (action.type === "remove") {
      const token = tokenOf(action.id);
      if (token?.kind === "combatant") void send([{ type: "remove", id: token.id }]);
    }
    tracker.dispatch(action);
  };

  /** The monsters without a place go side by side from the click, on squares on a battle map. */
  function placeMonsters(at: Point, scale: number) {
    const pixels = map.grid && gridInPixels(map.grid, map.size);
    let x = at[0];
    const placed = unplaced.map((monster): TokenAction => {
      const size = squaresOf(monster);
      const width = map.grid ? map.grid.square * size : 40 / scale / map.size.width;
      let point = offset([x, at[1]], width / 2, 0);
      x += width;
      if (pixels && map.snapToGrid) {
        const [sx, sy] = snapToGrid(pixels, toPixels(point, map.size), size);
        point = normalise(sx, sy, map.size);
      }
      return {
        type: "place",
        token: {
          kind: "combatant",
          id: newId(),
          map: map.id,
          at: point,
          ...(size > 1 && { size }),
          combatant: monster.id,
        },
      };
    });
    void send(placed);
  }

  const select = (id: string) => {
    setShownId(id);
    const token = tokenOf(id);
    if (token) onFind(token);
  };

  const panel = (
    <section aria-label="Fight" className="flex flex-col gap-3">
      {fight?.map && fight.map !== map.id && encounter.combatants.length > 0 && (
        <p className="text-sm text-amber-800 dark:text-amber-300">
          This fight is on another map. Changing it here brings it to this one.
        </p>
      )}
      <div className="flex items-center gap-2">
        <FightStatus status={status} />
        {encounter.combatants.length > 0 && (
          <EndFight onEnded={() => setOpen(false)} className="ml-auto" />
        )}
      </div>
      {encounter.phase === "active" && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={freeMovement}
            onChange={(event) => void changeFreeMovement(event.target.checked)}
          />
          Free movement
          <span className="text-stone-500">
            {freeMovement ? "players move any time" : "players move on their turn"}
          </span>
        </label>
      )}
      <TurnBar
        encounter={encounter}
        dispatch={dispatch}
        canUndo={tracker.canUndo}
        onUndo={tracker.undo}
      />
      <TiePrompts combatants={encounter.combatants} dispatch={dispatch} />
      {encounter.combatants.length > 0 && (
        <ol aria-label="Turn order" className="divide-y divide-stone-200 dark:divide-stone-800">
          {encounter.combatants.map((combatant, index) => (
            <CombatantRow
              key={combatant.id}
              combatant={combatant}
              isActive={combatant.id === encounter.activeId}
              isShown={combatant.id === shown?.id}
              isFirst={index === 0}
              isLast={index === encounter.combatants.length - 1}
              dispatch={dispatch}
              onShowStatblock={() => select(combatant.id)}
              sheetHp={hp[combatant.id]}
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
    </section>
  );

  const overMap: ReactNode = (
    <>
      {encounter.phase === "active" && (
        <TurnStrip
          floating
          round={encounter.round}
          turnOrder={encounter.combatants.map((c) => ({
            id: c.id,
            name: c.name,
            kind: c.kind,
            isActive: c.id === encounter.activeId,
            dim: c.kind === "monster" && (c.hidden || c.hp.current <= 0),
          }))}
          onSelect={select}
        />
      )}
      {unplaced.length > 0 && (
        <p
          role="status"
          className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-lg bg-sky-900 px-3 py-2 text-sm text-white shadow"
        >
          Click the map to place {unplaced.map((monster) => monster.name).join(", ")}
        </p>
      )}
      <div className="absolute bottom-3 left-3 z-10 w-72 opacity-95">
        <DiceRoller rolls={rolls} />
      </div>
    </>
  );

  return {
    open,
    setOpen,
    panel,
    overMap,
    /** The token whose turn it is, ringed. */
    activeTokenId: active ? tokenOf(active)?.id : undefined,
    /** Whether the next click on the map places monsters. */
    placing: unplaced.length > 0,
    placeMonsters,
    /** A token chosen on the map shows its combatant in the tracker. */
    selectToken: (token: TokenView) => {
      if (token.combatant) setShownId(token.combatant);
    },
  };
}
