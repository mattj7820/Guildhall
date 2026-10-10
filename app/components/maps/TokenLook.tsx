import { useState } from "react";
import { labelClass } from "~/components/styles";
import { tokenIcon } from "~/maps/tokens/icons";
import { TOKEN_ICONS } from "~/maps/tokens/token-icons";
import { MARKER_COLOURS, type MarkerColour, type MarkerPicture } from "~/maps/tokens/types";
import { MARKER_BACKGROUNDS } from "./TokenThumb";

/** How a marker looks: its picture (the note's, an icon, or initials) and its colour. */
export interface Look {
  picture?: MarkerPicture;
  icon?: string;
  colour: MarkerColour;
}

/**
 * Choosing a marker's look. The note's picture is offered only when its note has one; the icon is
 * picked from a grid drawn in the marker's colour.
 */
export function TokenLook({
  look,
  noteImage,
  onChange,
}: {
  look: Look;
  /** A preview of the note's picture, if the token has a note with one. */
  noteImage?: string;
  onChange: (look: Look) => void;
}) {
  const [picking, setPicking] = useState(false);
  const icon = tokenIcon(look.icon);
  return (
    <div className="flex flex-col gap-2 text-sm">
      <fieldset className="flex flex-wrap items-center gap-3">
        <legend className={`${labelClass} mb-1`}>Picture</legend>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={look.picture === "note"}
            disabled={!noteImage}
            onChange={() => onChange({ ...look, picture: "note" })}
          />
          Note&rsquo;s picture
          {noteImage && (
            <img src={noteImage} alt="" className="h-6 w-6 rounded-full object-cover object-top" />
          )}
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={look.picture === "icon"}
            onChange={() => onChange({ ...look, picture: "icon", icon: look.icon ?? "person" })}
            // Clicked again, it opens the icons to choose another.
            onClick={() => setPicking(true)}
          />
          Icon
        </label>
        {look.picture === "icon" && (
          <button
            type="button"
            aria-expanded={picking}
            className="underline"
            onClick={() => setPicking(!picking)}
          >
            {icon?.label ?? "Choose"} ▾
          </button>
        )}
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={!look.picture}
            onChange={() => onChange({ ...look, picture: undefined })}
          />
          Initials
        </label>
      </fieldset>
      {picking && look.picture === "icon" && (
        <div
          role="listbox"
          aria-label="Icons"
          className="grid max-h-40 grid-cols-8 gap-1 overflow-y-auto rounded border border-stone-200 p-1 dark:border-stone-800"
        >
          {TOKEN_ICONS.map((each) => (
            <button
              key={each.id}
              type="button"
              role="option"
              aria-selected={each.id === look.icon}
              aria-label={each.label}
              title={each.label}
              onClick={() => {
                onChange({ ...look, picture: "icon", icon: each.id });
                setPicking(false);
              }}
              className={`flex h-8 w-8 items-center justify-center rounded ${MARKER_BACKGROUNDS[look.colour]} ${
                each.id === look.icon ? "ring-2 ring-sky-500" : "opacity-80 hover:opacity-100"
              }`}
            >
              <svg viewBox="0 0 512 512" aria-hidden="true" className="h-5 w-5">
                <path d={each.path} className="fill-white" />
              </svg>
            </button>
          ))}
        </div>
      )}
      <fieldset className="flex flex-wrap items-center gap-1">
        <legend className={`${labelClass} mb-1`}>Colour</legend>
        {MARKER_COLOURS.map((colour) => (
          <button
            key={colour}
            type="button"
            aria-label={colour}
            aria-pressed={look.colour === colour}
            onClick={() => onChange({ ...look, colour })}
            className={`h-6 w-6 rounded-full ${MARKER_BACKGROUNDS[colour]} ${
              look.colour === colour ? "ring-2 ring-sky-500 ring-offset-1" : ""
            }`}
          />
        ))}
      </fieldset>
    </div>
  );
}
