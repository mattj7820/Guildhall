import { useId } from "react";
import { inputClass } from "~/components/styles";
import type { NoteSummary } from "~/wiki/types";

interface Props {
  label: string;
  notes: readonly NoteSummary[];
  /** The note's path without `.md`, as typed or picked from the suggestions. */
  value: string;
  onChange: (slug: string) => void;
  name?: string;
  onBlur?: () => void;
}

/**
 * Picks a wiki note by path, with the browser's own suggestions as you type. Paths rather than
 * titles, since titles aren't unique; the caller turns the path into the note's entity ID.
 */
export function NotePicker({ label, notes, value, onChange, name, onBlur }: Props) {
  const listId = useId();
  const known = !value || notes.some((note) => note.slug === value);
  // The suggestions and the warning sit outside the label, so they aren't read as its name.
  return (
    <div className="flex flex-col gap-1 text-sm">
      <label className="flex flex-col gap-1">
        <span className="font-medium">{label}</span>
        <input
          type="text"
          name={name}
          list={listId}
          value={value}
          placeholder="Start typing a note's name"
          aria-invalid={!known}
          className={inputClass}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
        />
      </label>
      <datalist id={listId}>
        {notes.map((note) => (
          <option key={note.slug} value={note.slug}>
            {note.title}
          </option>
        ))}
      </datalist>
      {!known && <span className="text-xs text-danger">No such note.</span>}
    </div>
  );
}
