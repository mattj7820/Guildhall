import { useState } from "react";
import { buttonClass, inputClass } from "~/components/styles";
import type { EditorAction } from "~/maps/editor";
import { AREA_NAME_MAX } from "~/maps/schema";
import type { Area } from "~/maps/types";

interface Props {
  area: Area;
  dispatch: (action: EditorAction) => void;
  onBlur: () => void;
}

/** The selected area's name and links. */
export function AreaForm({ area, dispatch, onBlur }: Props) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
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
