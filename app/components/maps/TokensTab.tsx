import { useState } from "react";
import type { MapGrid } from "~/maps/grid/grid";
import { buttonClass, labelClass } from "~/components/styles";
import type { TokenAction } from "~/maps/tokens/actions";
import type { PartyPlacement, TokenView } from "~/maps/tokens/types";
import type { MapId, Size } from "~/maps/types";
import { PartyTokens } from "./PartyTokens";
import { PlacingHint, type Placing } from "./PlacingHint";
import { TokenDistances } from "./TokenDistances";
import { MarkerForm, TokenSettings } from "./TokenSettings";

interface Props {
  mapId: MapId;
  party: PartyPlacement[];
  tokens: TokenView[];
  selected?: TokenView;
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

/**
 * The DM's Tokens tab: every token on this map and the party wherever they are, adding and
 * placing, and the chosen token's settings.
 */
export function TokensTab({
  mapId,
  party,
  tokens,
  selected,
  placing,
  error,
  onPlace,
  onSelect,
  onFind,
  send,
  grid,
  size,
}: Props) {
  const [addingMarker, setAddingMarker] = useState(false);
  const markers = tokens.filter((token) => token.kind === "marker");

  return (
    <>
      {error && (
        <p role="alert" className="text-sm text-rose-700 dark:text-rose-400">
          {error}
        </p>
      )}
      {placing && <PlacingHint placing={placing} onCancel={() => onPlace(undefined)} />}
      <PartyTokens
        mapId={mapId}
        party={party}
        tokens={tokens}
        onPlace={onPlace}
        onSelect={onSelect}
        onFind={onFind}
      />

      <section aria-labelledby="markers-heading" className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h2 id="markers-heading" className={`${labelClass} mr-auto`}>
            Markers
          </h2>
          {!addingMarker && (
            <button type="button" className={buttonClass} onClick={() => setAddingMarker(true)}>
              Add marker
            </button>
          )}
        </div>
        {addingMarker && (
          <MarkerForm
            label="New marker"
            submitLabel="Place on the map"
            onCancel={() => setAddingMarker(false)}
            onSubmit={(marker) => {
              setAddingMarker(false);
              onPlace({ kind: "marker", ...marker });
            }}
          />
        )}
        {markers.length > 0 && (
          <ul aria-label="Markers" className="flex flex-col text-sm">
            {markers.map((marker) => (
              <li key={marker.id}>
                <button
                  type="button"
                  onClick={() => onSelect(marker)}
                  className="block w-full rounded px-1 py-0.5 text-left hover:bg-stone-100 dark:hover:bg-stone-800"
                >
                  {marker.name}
                  {marker.hidden === "secret" && (
                    <span className="ml-1 text-xs text-stone-500">(DM only)</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selected && (
        <TokenSettings
          key={selected.id}
          token={selected}
          onClose={() => onSelect(undefined)}
          send={send}
        >
          {grid && <TokenDistances from={selected} tokens={tokens} grid={grid} size={size} />}
        </TokenSettings>
      )}
    </>
  );
}
