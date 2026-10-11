import { useState } from "react";
import { Form } from "react-router";
import { buttonClass, inputClass } from "~/components/styles";
import type { EditorAction, EditorDoc } from "~/maps/editor";
import { MAP_NAME_MAX } from "~/maps/schema";
import type { NoteOption } from "./AreaForm";
import { NotePicker } from "./NotePicker";

interface Props {
  doc: EditorDoc;
  notes: NoteOption[];
  dispatch: (action: EditorAction) => void;
  onBlur: () => void;
}

/** The map's own name and note, and deleting it; tucked away, since they rarely change. */
export function MapSettings({ doc, notes, dispatch, onBlur }: Props) {
  const linked = notes.find((note) => note.id === doc.note);
  const [noteText, setNoteText] = useState(linked?.slug ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <details className="rounded-md border border-line p-3 text-sm">
      <summary className="cursor-pointer font-semibold">Map settings</summary>
      <div className="mt-3 flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="font-medium">Map name</span>
          <input
            type="text"
            value={doc.name}
            maxLength={MAP_NAME_MAX}
            className={inputClass}
            onChange={(event) => dispatch({ type: "editMap", name: event.target.value })}
            onBlur={onBlur}
          />
        </label>
        <NotePicker
          label="Map's wiki note"
          notes={notes}
          value={noteText}
          onBlur={onBlur}
          onChange={(slug) => {
            setNoteText(slug);
            const note = notes.find((candidate) => candidate.slug === slug);
            if (note) dispatch({ type: "editMap", note: note.id });
            else if (!slug.trim()) dispatch({ type: "editMap", note: null });
          }}
        />
        {confirmingDelete ? (
          <Form method="post" className="flex flex-wrap items-center gap-2">
            <span className="font-medium">
              Delete this map? Areas that lead to it become not mapped yet.
            </span>
            <button
              type="submit"
              name="intent"
              value="delete"
              className="rounded-md bg-danger px-2.5 py-1 font-semibold text-on-danger hover:opacity-90"
            >
              Delete {doc.name}
            </button>
            <button
              type="button"
              className={buttonClass}
              onClick={() => setConfirmingDelete(false)}
            >
              Keep it
            </button>
          </Form>
        ) : (
          <button
            type="button"
            className={`${buttonClass} self-start`}
            onClick={() => setConfirmingDelete(true)}
          >
            Delete map…
          </button>
        )}
      </div>
    </details>
  );
}
