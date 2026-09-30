import { useState } from "react";
import { Link } from "react-router";
import { buttonClass, inputClass, labelClass, primaryButtonClass } from "~/components/styles";
import type { TokenAction } from "~/maps/tokens/actions";
import { MARKER_NAME_MAX } from "~/maps/tokens/schema";
import {
  MARKER_COLOURS,
  SIZE_NAMES,
  TOKEN_SIZES,
  type MarkerColour,
  type TokenSize,
  type PartyPlacement,
  type TokenView,
} from "~/maps/tokens/types";
import type { MapId } from "~/maps/types";
import { mapUrl } from "~/maps/urls";

/** What the DM's next click on the map will place. */
export type Placing =
  | { kind: "character"; note: string; name: string }
  | { kind: "party"; name: string }
  | { kind: "marker"; name: string; colour: MarkerColour; shown: boolean };

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
}

/**
 * The DM's tokens: the party, and where each member is (placing them here, from wherever they
 * were); markers on this map; and the chosen token, to change or remove.
 */
export function TokenPanel({
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
}: Props) {
  const [addingMarker, setAddingMarker] = useState(false);
  const markers = tokens.filter((token) => token.kind === "marker");

  return (
    <section aria-labelledby="tokens-heading" className="flex flex-col gap-3">
      <h2 id="tokens-heading" className={labelClass}>
        Party
      </h2>
      {error && (
        <p role="alert" className="text-sm text-rose-700 dark:text-rose-400">
          {error}
        </p>
      )}
      {placing && (
        <p
          role="status"
          className="rounded bg-sky-50 px-2 py-1 text-sm text-sky-900 dark:bg-sky-950 dark:text-sky-100"
        >
          Click the map to place {placing.name}.{" "}
          <button type="button" className="underline" onClick={() => onPlace(undefined)}>
            Cancel
          </button>
        </p>
      )}
      <ul aria-label="Party" className="flex flex-col gap-1 text-sm">
        {party.map((member) => {
          const here = tokens.find((token) => token.note === member.note);
          const elsewhere = !here && member.on && member.on.id !== mapId ? member.on : undefined;
          return (
            <li key={member.note} className="flex items-center gap-2">
              <span className="mr-auto">
                {member.name}{" "}
                <span className="text-xs text-stone-500">
                  {here ? (
                    "here"
                  ) : elsewhere ? (
                    <>
                      on{" "}
                      <Link to={mapUrl(elsewhere.id)} className="underline">
                        {elsewhere.name}
                      </Link>
                    </>
                  ) : (
                    "not placed"
                  )}
                </span>
              </span>
              {here ? (
                <button
                  type="button"
                  aria-label={`Find ${member.name}`}
                  className={buttonClass}
                  onClick={() => {
                    onSelect(here);
                    onFind(here);
                  }}
                >
                  Find
                </button>
              ) : (
                <button
                  type="button"
                  aria-label={`${elsewhere ? "Bring" : "Place"} ${member.name} here`}
                  className={buttonClass}
                  onClick={() =>
                    onPlace({ kind: "character", note: member.note, name: member.name })
                  }
                >
                  {elsewhere ? "Bring here" : "Place"}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {party.length > 1 && (
        <button
          type="button"
          className={buttonClass}
          onClick={() => onPlace({ kind: "party", name: "the whole party" })}
        >
          Bring everyone here
        </button>
      )}

      <div className="flex items-center gap-2">
        <h2 className={`${labelClass} mr-auto`}>Markers</h2>
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

      {selected && (
        <SelectedToken
          key={selected.id}
          token={selected}
          onClose={() => onSelect(undefined)}
          send={send}
        />
      )}
    </section>
  );
}

function SelectedToken({
  token,
  onClose,
  send,
}: {
  token: TokenView;
  onClose: () => void;
  send: (actions: TokenAction[]) => void;
}) {
  return (
    <section
      aria-label={`Token: ${token.name}`}
      className="flex flex-col gap-2 rounded-md border border-stone-200 p-3 dark:border-stone-800"
    >
      <div className="flex items-baseline gap-2">
        <h3 className="mr-auto font-serif text-lg font-bold">{token.name}</h3>
        <button type="button" onClick={onClose} className="text-sm text-stone-500 hover:underline">
          Close
        </button>
      </div>
      {token.hidden === "fog" && (
        <p className="text-sm text-stone-500">
          Under the fog:{" "}
          {token.kind === "marker"
            ? "players can't see it."
            : "only the players who move it can see it."}
        </p>
      )}
      <label className="flex items-center gap-2 text-sm">
        <span className={labelClass}>Size</span>
        <select
          className={inputClass}
          value={token.size}
          onChange={(event) =>
            send([{ type: "setSize", id: token.id, size: Number(event.target.value) as TokenSize }])
          }
        >
          {TOKEN_SIZES.map((size) => (
            <option key={size} value={size}>
              {SIZE_NAMES[size]} ({size} × {size} squares)
            </option>
          ))}
        </select>
      </label>
      {token.kind === "marker" && (
        <MarkerForm
          initial={{
            name: token.name,
            colour: token.colour ?? "red",
            shown: token.visibility === "players",
          }}
          label="Edit marker"
          submitLabel="Save"
          onSubmit={({ name, colour, shown }) =>
            send([
              {
                type: "editMarker",
                id: token.id,
                name,
                colour,
                visibility: shown ? "players" : "dm",
              },
            ])
          }
        />
      )}
      <button
        type="button"
        className={buttonClass}
        onClick={() => {
          send([{ type: "remove", id: token.id }]);
          onClose();
        }}
      >
        {token.kind === "marker" ? "Remove marker" : "Take off this map"}
      </button>
    </section>
  );
}

interface MarkerFields {
  name: string;
  colour: MarkerColour;
  shown: boolean;
}

function MarkerForm({
  initial = { name: "", colour: "red", shown: false },
  label,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: MarkerFields;
  label: string;
  submitLabel: string;
  onSubmit: (marker: MarkerFields) => void;
  onCancel?: () => void;
}) {
  const [fields, setFields] = useState(initial);
  return (
    <form
      aria-label={label}
      className="flex flex-col gap-2 text-sm"
      onSubmit={(event) => {
        event.preventDefault();
        const name = fields.name.trim();
        if (name) onSubmit({ ...fields, name });
      }}
    >
      <label className="flex flex-col gap-1">
        <span className={labelClass}>Marker name</span>
        <input
          className={inputClass}
          value={fields.name}
          maxLength={MARKER_NAME_MAX}
          required
          onChange={(event) => setFields({ ...fields, name: event.target.value })}
        />
      </label>
      <fieldset className="flex flex-wrap gap-1">
        <legend className={`${labelClass} mb-1`}>Colour</legend>
        {MARKER_COLOURS.map((colour) => (
          <label key={colour} className="flex items-center gap-1 capitalize">
            <input
              type="radio"
              name="colour"
              value={colour}
              checked={fields.colour === colour}
              onChange={() => setFields({ ...fields, colour })}
            />
            {colour}
          </label>
        ))}
      </fieldset>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={fields.shown}
          onChange={(event) => setFields({ ...fields, shown: event.target.checked })}
        />
        Players can see it (where it's revealed)
      </label>
      <div className="flex gap-2">
        <button type="submit" className={primaryButtonClass}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className={buttonClass} onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
