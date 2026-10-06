import { useState, type ReactNode } from "react";
import { buttonClass, inputClass, labelClass, primaryButtonClass } from "~/components/styles";
import type { TokenAction } from "~/maps/tokens/actions";
import { MARKER_NAME_MAX } from "~/maps/tokens/schema";
import {
  MARKER_COLOURS,
  SIZE_NAMES,
  TOKEN_SIZES,
  type MarkerColour,
  type TokenSize,
  type TokenView,
} from "~/maps/tokens/types";

/** The chosen token, to change or remove. */
export function TokenSettings({
  token,
  onClose,
  send,
  children,
}: {
  token: TokenView;
  onClose: () => void;
  send: (actions: TokenAction[]) => void;
  children?: ReactNode;
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
      {children}
    </section>
  );
}

export interface MarkerFields {
  name: string;
  colour: MarkerColour;
  shown: boolean;
}

export function MarkerForm({
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
