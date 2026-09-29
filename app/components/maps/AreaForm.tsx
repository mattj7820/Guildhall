import { useState } from "react";
import { Link } from "react-router";
import { buttonClass, inputClass, labelClass, primaryButtonClass } from "~/components/styles";
import type { EditorAction } from "~/maps/editor";
import { AREA_NAME_MAX } from "~/maps/schema";
import type { Area, MapImage, MapLink } from "~/maps/types";
import { mapUrl } from "~/maps/urls";
import type { NoteSummary } from "~/wiki/types";
import { ImagePicker } from "./ImagePicker";
import { NotePicker } from "./NotePicker";

export type NoteOption = Pick<NoteSummary, "id" | "slug" | "title">;

interface Props {
  area: Area;
  /** Maps this area may lead to without breaking the tree, including the one it leads to now. */
  attachable: MapLink[];
  notes: NoteOption[];
  images: string[];
  dispatch: (action: EditorAction) => void;
  onBlur: () => void;
  /** Makes a new map from an image for this area to lead to. */
  onCreateChild: (name: string, image: MapImage) => void;
  creatingChild: boolean;
}

/** The selected area's name, where it leads, and deleting it. */
export function AreaForm({
  area,
  attachable,
  notes,
  images,
  dispatch,
  onBlur,
  onCreateChild,
  creatingChild,
}: Props) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);
  const linkedMap = attachable.find((map) => map.id === area.map);

  return (
    <section aria-label="Selected area" className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Area name</span>
        <input
          type="text"
          value={area.name}
          maxLength={AREA_NAME_MAX}
          autoFocus
          onFocus={(event) => event.target.select()}
          onChange={(event) =>
            dispatch({ type: "renameArea", id: area.id, name: event.target.value })
          }
          onBlur={onBlur}
          className={`${inputClass} font-serif text-lg font-semibold`}
        />
      </label>

      <div className="flex flex-col gap-1 text-sm">
        <label className="flex flex-col gap-1">
          <span className="font-medium">Leads to map</span>
          <select
            value={area.map ?? ""}
            className={inputClass}
            onChange={(event) =>
              dispatch({ type: "linkArea", id: area.id, map: event.target.value || undefined })
            }
          >
            <option value="">Not mapped yet</option>
            {attachable.map((map) => (
              <option key={map.id} value={map.id}>
                {map.name}
              </option>
            ))}
          </select>
        </label>
        {linkedMap && (
          <Link to={mapUrl(linkedMap.id)} onClick={onBlur} className="text-xs hover:underline">
            Open {linkedMap.name}
          </Link>
        )}
        {!area.map && !pickingImage && (
          <button
            type="button"
            className={`${buttonClass} self-start`}
            onClick={() => setPickingImage(true)}
          >
            New map from image…
          </button>
        )}
      </div>

      {pickingImage && !area.map && (
        <NewChildMap
          defaultName={area.name}
          images={images}
          busy={creatingChild}
          onCreate={(name, image) => {
            onCreateChild(name, image);
            setPickingImage(false);
          }}
          onCancel={() => setPickingImage(false)}
        />
      )}

      <AreaNotePicker area={area} notes={notes} dispatch={dispatch} onBlur={onBlur} />

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={area.visibility === "dm"}
          onChange={(event) =>
            dispatch({ type: "setAreaSecret", id: area.id, secret: event.target.checked })
          }
        />
        <span>
          <span className="font-medium">Secret</span>
          <span className="block text-xs text-stone-500">
            Players never see this area, even where the map is revealed.
          </span>
        </span>
      </label>

      <div className="flex flex-wrap gap-2">
        {confirmingDelete ? (
          <>
            <button
              type="button"
              className="rounded-md bg-rose-700 px-2.5 py-1 text-sm font-semibold text-white hover:bg-rose-800"
              onClick={() => dispatch({ type: "deleteArea", id: area.id })}
            >
              Delete {area.name || "this area"}
            </button>
            <button
              type="button"
              className={buttonClass}
              onClick={() => setConfirmingDelete(false)}
            >
              Keep it
            </button>
          </>
        ) : (
          <button type="button" className={buttonClass} onClick={() => setConfirmingDelete(true)}>
            Delete area…
          </button>
        )}
      </div>
    </section>
  );
}

/**
 * Links a note by typing its path. The link changes only once the text names a real note (or is
 * cleared), so half-typed text never unlinks anything.
 */
export function AreaNotePicker({
  area,
  notes,
  dispatch,
  onBlur,
}: {
  area: Area;
  notes: NoteOption[];
  dispatch: (action: EditorAction) => void;
  onBlur: () => void;
}) {
  const linked = notes.find((note) => note.id === area.note);
  const [text, setText] = useState(linked?.slug ?? "");
  return (
    <div className="flex flex-col gap-1">
      <NotePicker
        label="Wiki note"
        notes={notes}
        value={text}
        onBlur={onBlur}
        onChange={(slug) => {
          setText(slug);
          const note = notes.find((candidate) => candidate.slug === slug);
          if (note) dispatch({ type: "linkArea", id: area.id, note: note.id });
          else if (!slug.trim()) dispatch({ type: "linkArea", id: area.id, note: undefined });
        }}
      />
      {area.note && !linked && (
        <p className="text-xs text-rose-700 dark:text-rose-400">
          The linked note (“{area.note}”) is no longer in the vault. Choose another, or clear the
          field.
        </p>
      )}
    </div>
  );
}

function NewChildMap({
  defaultName,
  images,
  busy,
  onCreate,
  onCancel,
}: {
  defaultName: string;
  images: string[];
  busy: boolean;
  onCreate: (name: string, image: MapImage) => void;
  onCancel: () => void;
}) {
  const [image, setImage] = useState<MapImage>();
  const [name, setName] = useState(defaultName);
  return (
    <div
      role="group"
      aria-label="New map for this area"
      className="flex flex-col gap-3 rounded-md border border-stone-200 p-3 dark:border-stone-800"
    >
      <p className={labelClass}>New map for this area</p>
      <ImagePicker images={images} compact onChange={(chosen) => setImage(chosen)} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Map name</span>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={inputClass}
        />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          className={primaryButtonClass}
          disabled={!image || busy}
          onClick={() => image && onCreate(name, image)}
        >
          Create and link
        </button>
        <button type="button" className={buttonClass} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
