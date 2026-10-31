import { useState } from "react";
import { statblockKey, type CreatureOption } from "~/combat/types";
import type { MapGrid } from "~/maps/grid/grid";
import { buttonClass, iconButtonClass, labelClass } from "~/components/styles";
import type { TokenAction } from "~/maps/tokens/actions";
import type { PartyPlacement, TokenElsewhere, TokenTools, TokenView } from "~/maps/tokens/types";
import type { MapId, Size } from "~/maps/types";
import { AddTokenForm } from "./AddTokenForm";
import { PartyTokens } from "./PartyTokens";
import { PlacingHint, type Placing } from "./PlacingHint";
import { TokenDistances } from "./TokenDistances";
import { TokenSettings } from "./TokenSettings";
import { PickBox } from "./PickBox";
import { TokenThumb } from "./TokenThumb";

interface Props {
  mapId: MapId;
  party: PartyPlacement[];
  tools: TokenTools;
  /** The statblocks a marker may join a fight with. */
  creatures: CreatureOption[];
  tokens: TokenView[];
  selected?: TokenView;
  /** The tokens picked on the map, for a fight. */
  picked: readonly string[];
  onTogglePick: (id: string) => void;
  placing?: Placing;
  error?: string;
  onPlace: (placing: Placing | undefined) => void;
  onSelect: (token: TokenView | undefined) => void;
  /** Centres the map on a token. */
  onFind: (token: TokenView) => void;
  send: (actions: TokenAction[]) => void;
  /** On a battle map, the chosen token lists how far the others are. */
  grid?: MapGrid;
  size: Size;
}

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, undefined, { numeric: true });

/**
 * The DM's Tokens tab: the party wherever they are; NPCs and markers on this map, each shown or
 * hidden in one click; adding them; those set aside or on other maps, to bring here; and the
 * chosen token's settings. Monsters in the fight stay in the tracker.
 */
export function TokensTab({
  mapId,
  party,
  tools,
  creatures,
  tokens,
  selected,
  picked,
  onTogglePick,
  placing,
  error,
  onPlace,
  onSelect,
  onFind,
  send,
  grid,
  size,
}: Props) {
  const [adding, setAdding] = useState(false);
  const byKey = new Map(creatures.map((creature) => [creature.key, creature]));
  const monsterOf = (token: TokenView) =>
    token.marker?.statblock && byKey.get(statblockKey(token.marker.statblock));
  const markers = tokens.filter((token) => token.kind === "marker").sort(byName);
  const aside = tools.elsewhere.filter((each) => each.aside);
  const elsewhere = tools.elsewhere.filter((each) => !each.aside);
  const bring = ({ token }: TokenElsewhere) =>
    onPlace({ kind: "bring", id: token.id, name: token.name });

  return (
    <>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {placing && <PlacingHint placing={placing} onCancel={() => onPlace(undefined)} />}
      <PartyTokens
        mapId={mapId}
        party={party}
        tokens={tokens}
        picked={picked}
        onTogglePick={onTogglePick}
        onPlace={onPlace}
        onSelect={onSelect}
        onFind={onFind}
      />

      <section aria-labelledby="on-this-map-heading" className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h2 id="on-this-map-heading" className={`${labelClass} mr-auto`}>
            On this map
          </h2>
          {!adding && (
            <button type="button" className={buttonClass} onClick={() => setAdding(true)}>
              Add
            </button>
          )}
        </div>
        {adding && (
          <AddTokenForm
            notes={tools.notes}
            creatures={creatures}
            existing={markers.map((marker) => marker.name)}
            onCancel={() => setAdding(false)}
            onPlace={(drafts) => {
              setAdding(false);
              const first = drafts[0].name;
              const last = drafts.at(-1)?.name;
              onPlace({
                kind: "markers",
                name: drafts.length > 1 ? `${first} to ${last}` : first,
                markers: drafts,
              });
            }}
          />
        )}
        {markers.length === 0 && !adding && (
          <p className="text-sm text-muted">No NPCs or markers here yet.</p>
        )}
        {markers.length > 0 && (
          <ul aria-label="On this map" className="flex flex-col text-sm">
            {markers.map((marker) => (
              <MarkerRow
                key={marker.id}
                marker={marker}
                chosen={marker.id === selected?.id}
                monster={monsterOf(marker)}
                picked={picked.includes(marker.id)}
                onTogglePick={() => onTogglePick(marker.id)}
                onSelect={() => onSelect(marker)}
                send={send}
              />
            ))}
          </ul>
        )}
      </section>

      {aside.length > 0 && (
        <section aria-labelledby="set-aside-heading" className="flex flex-col gap-1 text-sm">
          <h2 id="set-aside-heading" className={labelClass}>
            Set aside
          </h2>
          <ElsewhereList label="Set aside" entries={aside} action="Place" onBring={bring} />
        </section>
      )}

      {elsewhere.length > 0 && (
        <details className="text-sm">
          <summary className={`${labelClass} cursor-pointer`}>
            NPCs elsewhere ({elsewhere.length})
          </summary>
          <ElsewhereList
            label="NPCs elsewhere"
            entries={elsewhere}
            action="Bring here"
            onBring={bring}
          />
        </details>
      )}

      {selected && (
        <TokenSettings
          key={selected.id}
          token={selected}
          tools={tools}
          creatures={creatures}
          monster={monsterOf(selected)}
          onClose={() => onSelect(undefined)}
          send={send}
        >
          {grid && <TokenDistances from={selected} tokens={tokens} grid={grid} size={size} />}
        </TokenSettings>
      )}
    </>
  );
}

function MarkerRow({
  marker,
  chosen,
  monster,
  picked,
  onTogglePick,
  onSelect,
  send,
}: {
  marker: TokenView;
  chosen: boolean;
  /** The statblock it joins a fight with. */
  monster?: CreatureOption;
  picked: boolean;
  onTogglePick: () => void;
  onSelect: () => void;
  send: (actions: TokenAction[]) => void;
}) {
  const shown = marker.visibility === "players";
  return (
    <li
      className={`flex items-center gap-2 rounded px-1 py-0.5 ${chosen ? "bg-info-surface" : ""}`}
    >
      <PickBox name={marker.name} picked={picked} onToggle={onTogglePick} />
      <TokenThumb token={marker} />
      <button
        type="button"
        className="mr-auto truncate text-left hover:underline"
        onClick={onSelect}
      >
        {marker.name}
        {monster && (
          <span className="ml-1 text-xs text-muted" title={`Joins a fight as ${monster.name}`}>
            ⚔ {monster.name}
          </span>
        )}
        {marker.down && <span className="ml-1 text-xs text-danger">down</span>}
        {marker.hidden === "fog" && shown && (
          <span className="ml-1 text-xs text-muted">(under the fog)</span>
        )}
      </button>
      <button
        type="button"
        aria-label={shown ? `Hide ${marker.name} from players` : `Show ${marker.name} to players`}
        title={
          shown
            ? "Players can see it where it's revealed. Click to hide it."
            : "Only you can see it. Click to show players."
        }
        className={`${iconButtonClass} whitespace-nowrap text-xs`}
        onClick={() =>
          send([{ type: "editMarker", id: marker.id, visibility: shown ? "dm" : "players" }])
        }
      >
        {shown ? "👁 Shown" : "DM only"}
      </button>
    </li>
  );
}

function ElsewhereList({
  label,
  entries,
  action,
  onBring,
}: {
  label: string;
  entries: TokenElsewhere[];
  action: string;
  onBring: (entry: TokenElsewhere) => void;
}) {
  return (
    <ul aria-label={label} className="mt-1 flex flex-col gap-1">
      {entries.map((entry) => (
        <li key={entry.token.id} className="flex items-center gap-2">
          <TokenThumb token={entry.token} />
          <span className="mr-auto truncate">
            {entry.token.name}{" "}
            {entry.map && (
              <span className="text-xs text-muted">
                {entry.aside ? "last on" : "on"} {entry.map.name}
              </span>
            )}
          </span>
          <button
            type="button"
            aria-label={`${action}: ${entry.token.name}`}
            className={buttonClass}
            onClick={() => onBring(entry)}
          >
            {action}
          </button>
        </li>
      ))}
    </ul>
  );
}
