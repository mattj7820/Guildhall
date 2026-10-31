import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import type { DmFightView } from "~/combat/fight";
import { startPreparedOnMap, type PartyChoice } from "~/combat/prepared";
import {
  statblockKey,
  type CombatCatalogue,
  type Combatant,
  type MonsterCombatant,
  type PreparedEncounter,
  type PreparedPlacement,
} from "~/combat/types";
import { useSharedFight } from "~/combat/useSharedFight";
import { AddCombatants } from "~/components/combat/AddCombatants";
import { CombatantRow } from "~/components/combat/CombatantRow";
import { DiceRoller } from "~/components/combat/DiceRoller";
import { FightStatus } from "~/components/combat/FightStatus";
import { MonsterDamage } from "~/components/combat/MonsterDamage";
import { SaveAsPrepared } from "~/components/combat/SaveAsPrepared";
import { StartPrepared } from "~/components/combat/StartPrepared";
import { buttonClass } from "~/components/styles";
import { StatblockPanel } from "~/components/combat/StatblockPanel";
import { TiePrompts } from "~/components/combat/TiePrompts";
import { TurnBar } from "~/components/combat/TurnBar";
import { TurnStrip } from "~/components/combat/TurnStrip";
import { usePrefetchStatblocks } from "~/combat/statblocks";
import { useRollLog } from "~/dice/useRollLog";
import { normalise, offset, toPixels } from "~/maps/geometry";
import { snapToGrid, toPixels as gridInPixels } from "~/maps/grid/grid";
import type { TokenAction } from "~/maps/tokens/actions";
import type { TokenView } from "~/maps/tokens/types";
import type { MapView, Point } from "~/maps/types";
import { mapUrl } from "~/maps/urls";
import { newId } from "~/shared/ids";
import { joinFromToken, perform } from "~/combat/encounter";
import { monsterMarker } from "~/maps/tokens/fight-markers";
import { EndFight } from "./EndFight";
import { TOKEN_RADIUS } from "./TokenLayer";

interface Options {
  map: MapView;
  fight: DmFightView | null;
  catalogue: CombatCatalogue;
  tokens: readonly TokenView[];
  send: (actions: TokenAction[]) => unknown;
  /** Centres the map on a token. */
  onFind: (token: TokenView) => void;
  /** A prepared fight to start here; null if it no longer exists. */
  starting?: PreparedEncounter | null;
  /** The next click on the map places the whole party. */
  onBringParty: () => void;
  /** The tokens the DM has picked on the map. */
  pickedTokens: readonly string[];
  onClearPick: () => void;
}

/**
 * The fight the table is in, run from the map page: the tracker in the side panel, the turn strip
 * and dice log over the map, and monsters' tokens linked to their combatants. Monsters join
 * without a place, and the next click on the map puts them there, sized from their statblocks.
 * Whatever's changed here moves the fight to this map.
 */
export function useMapFight({
  map,
  fight,
  catalogue,
  tokens,
  send,
  onFind,
  starting,
  onBringParty,
  pickedTokens,
  onClearPick,
}: Options) {
  const { tracker, status, hp, freeMovement, changeFreeMovement } = useSharedFight(fight, map.id);
  const { encounter } = tracker;
  const rolls = useRollLog(tracker.rng);
  const creatures = useMemo(
    () => new Map(catalogue.creatures.map((creature) => [creature.key, creature])),
    [catalogue.creatures],
  );
  // Everyone in the fight, so the statblock shows at once on their turn.
  usePrefetchStatblocks(
    catalogue,
    encounter.combatants.flatMap((c) => (c.statblock ? [statblockKey(c.statblock)] : [])),
  );
  const [open, setOpen] = useState(
    () => starting !== undefined || (!!fight && fight.map === map.id),
  );
  const navigate = useNavigate();
  const [shownId, setShownId] = useState<string>();
  const [adding, setAdding] = useState(true);
  const shown = encounter.combatants.find((c) => c.id === (shownId ?? encounter.activeId));
  const tokenOf = (combatant: string) => tokens.find((token) => token.combatant === combatant);
  const active = encounter.phase === "active" ? encounter.activeId : null;
  const unplaced = encounter.combatants.filter(
    (c): c is MonsterCombatant => c.kind === "monster" && !tokenOf(c.id),
  );
  const squaresOf = (c: Combatant) =>
    (c.statblock && creatures.get(statblockKey(c.statblock))?.squares) || 1;

  // Taking a monster out of the fight takes its token with it, on the server.
  const { dispatch } = tracker;

  // Monsters picked on the map, for damage or healing all at once.
  const picked = encounter.combatants.filter((c): c is MonsterCombatant => {
    const token = c.kind === "monster" ? tokenOf(c.id) : undefined;
    return !!token && pickedTokens.includes(token.id);
  });

  /**
   * A prepared fight starting here: the chosen party joins, and the monsters stand where they
   * were put. The party is brought onto the map separately, wherever they are now.
   */
  function start(prepared: PreparedEncounter, party: PartyChoice[]) {
    const { encounter: started, placed } = startPreparedOnMap(prepared, party, tracker.rng);
    tracker.replace(started);
    void send(
      placed.flatMap(({ combatant, at }): TokenAction[] => {
        const monster = started.combatants.find((c) => c.id === combatant);
        if (monster?.kind !== "monster") return [];
        const place = { id: newId(), map: map.id, at, size: squaresOf(monster) };
        return [{ type: "place", token: monsterMarker(monster, place) }];
      }),
    );
    void fetch(`/combat/prepared/${encodeURIComponent(prepared.id)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intent: "markRun" }),
    });
    void navigate(mapUrl(map.id), { replace: true });
  }

  /**
   * Tokens picked on the map join the fight, or start one: markers with a statblock as monsters
   * where they stand (each under its own name, with the hit points it kept, hidden if players
   * can't see it), and party members as themselves. One change to the tracker, undone in one.
   */
  function joinFromTokens(picked: readonly TokenView[]) {
    let next = encounter;
    const links: TokenAction[] = [];
    const party = new Set(
      encounter.combatants.flatMap((c) => (c.kind === "player" && c.entityId ? [c.entityId] : [])),
    );
    for (const token of picked) {
      if (token.combatant) continue;
      if (token.kind === "character") {
        const member = catalogue.party.find((each) => each.entityId === token.note);
        if (!member?.player || party.has(member.entityId)) continue;
        next = perform(
          next,
          {
            type: "addPlayerCombatant",
            id: newId(),
            name: member.name,
            controller: member.player,
            entityId: member.entityId,
            statblock: member.statblock,
          },
          tracker.rng,
        );
        continue;
      }
      const statblock = token.marker?.statblock;
      const creature = statblock && creatures.get(statblockKey(statblock));
      if (token.kind !== "marker" || !creature) continue;
      const id = newId();
      const joining = {
        id,
        name: token.name,
        hp: token.hp,
        hidden: token.visibility !== "players",
      };
      next = perform(next, joinFromToken(creature, joining, tracker.rng), tracker.rng);
      links.push({ type: "joinFight", id: token.id, combatant: id });
    }
    if (next === encounter) return;
    tracker.replace(next);
    if (links.length > 0) void send(links);
    setOpen(true);
  }

  /** Where the monsters stand here, for keeping the fight as a prepared one. */
  const placement: PreparedPlacement = {
    map: map.id,
    at: Object.fromEntries(
      encounter.combatants.flatMap((c) => {
        const token = c.kind === "monster" ? tokenOf(c.id) : undefined;
        return token ? [[c.id, token.at]] : [];
      }),
    ),
  };

  /** The monsters without a place go side by side from the click, on squares on a battle map. */
  function placeMonsters(at: Point, scale: number) {
    const pixels = map.grid && gridInPixels(map.grid, map.size);
    let x = at[0];
    const placed = unplaced.map((monster): TokenAction => {
      const size = squaresOf(monster);
      // On a battle map, their squares; otherwise far enough apart on screen for their names.
      const width = map.grid
        ? map.grid.square * size
        : (TOKEN_RADIUS * 4.5) / scale / map.size.width;
      let point = offset([x, at[1]], width / 2, 0);
      x += width;
      if (pixels && map.snapToGrid) {
        const [sx, sy] = snapToGrid(pixels, toPixels(point, map.size), size);
        point = normalise(sx, sy, map.size);
      }
      return {
        type: "place",
        token: monsterMarker(monster, { id: newId(), map: map.id, at: point, size }),
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
      {picked.length > 0 && (
        <MonsterDamage monsters={picked} dispatch={dispatch} onClear={onClearPick} />
      )}
      {starting && (
        <StartPrepared
          key={starting.id}
          prepared={starting}
          party={catalogue.party}
          replacesFight={encounter.combatants.length > 0}
          onStart={(party) => start(starting, party)}
          cancelTo={mapUrl(map.id)}
        />
      )}
      {starting === null && (
        <p role="alert" className="rounded-md bg-warn-surface px-3 py-2 text-sm text-warn">
          That prepared encounter doesn't exist any more.
        </p>
      )}
      {fight?.map && fight.map !== map.id && encounter.combatants.length > 0 && (
        <p className="text-sm text-warn">
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
          <span className="text-muted">
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
        <ol aria-label="Turn order" className="divide-y divide-line">
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
      <button type="button" className={`${buttonClass} self-start`} onClick={onBringParty}>
        Bring the party here
      </button>
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
      {encounter.phase === "setup" && encounter.combatants.length > 0 && (
        <SaveAsPrepared encounter={encounter} placement={placement} />
      )}
      <StatblockPanel
        catalogue={catalogue}
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
          className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-lg bg-ink px-3 py-2 text-sm text-page shadow"
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
    joinFromTokens,
    /** Hides a monster in the fight from players, or reveals it. */
    setHidden: (combatant: string, hidden: boolean) =>
      dispatch({ type: "setHidden", id: combatant, hidden }),
    /** Whether there's a fight to add to, rather than one to start. */
    running: encounter.combatants.length > 0,
    /** A token chosen on the map shows its combatant in the tracker. */
    selectToken: (token: TokenView) => {
      if (token.combatant) setShownId(token.combatant);
    },
    /** Whether a token is a monster in this fight, to pick for damage. */
    isMonster: (token: TokenView) =>
      encounter.combatants.some((c) => c.id === token.combatant && c.kind === "monster"),
  };
}
