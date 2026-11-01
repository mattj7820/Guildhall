import type { KeyboardEvent, Ref } from "react";
import { Link } from "react-router";
import { markQuery } from "~/wiki/tome";
import { noteUrl } from "~/wiki/urls";

export interface ListedNote {
  slug: string;
  title: string;
  type?: string;
  snippet?: string;
}

/**
 * Notes a spell found, inked onto the page as they arrive (only new ones ink in, so typing more
 * doesn't redraw the list). Up and down move between them; up from the first goes back to `back`.
 */
export function NoteList({
  notes,
  label,
  query = "",
  openSlug,
  listRef,
  back,
  onPick,
}: {
  notes: ListedNote[];
  label: string;
  /** Words to mark in titles and snippets. */
  query?: string;
  openSlug?: string;
  listRef?: Ref<HTMLUListElement>;
  /** Where focus goes from the first note on up. */
  back?: () => void;
  onPick?: () => void;
}) {
  function onKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const links = [...event.currentTarget.querySelectorAll("a")];
    const at = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (at < 0) return;
    event.preventDefault();
    if (event.key === "ArrowUp" && at === 0) back?.();
    else links[Math.min(links.length - 1, at + (event.key === "ArrowDown" ? 1 : -1))]?.focus();
  }

  return (
    <ul ref={listRef} aria-label={label} onKeyDown={onKeyDown} className="mt-4">
      {notes.map((note, i) => (
        <li
          key={note.slug}
          className="gh-tome-ink border-line border-b border-dotted"
          style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
        >
          <Link
            to={noteUrl(note.slug)}
            onClick={onPick}
            aria-current={note.slug === openSlug ? "page" : undefined}
            className="gh-tome-entry flex flex-col gap-0.5 px-1 py-2"
          >
            <span className="flex items-baseline justify-between gap-3">
              <span className="gh-tome-title font-prose text-lg font-semibold">
                <Marked text={note.title} query={query} />
              </span>
              <span className="text-muted shrink-0 text-xs tracking-wide uppercase">
                {note.type ?? folderOf(note.slug)}
              </span>
            </span>
            {note.snippet && (
              <span className="text-muted text-sm">
                <Marked text={note.snippet} query={query} />
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Marked({ text, query }: { text: string; query: string }) {
  return markQuery(text, query).map((part, i) =>
    part.marked ? (
      <mark key={i} className="gh-tome-mark">
        {part.text}
      </mark>
    ) : (
      part.text
    ),
  );
}

function folderOf(slug: string): string {
  const at = slug.lastIndexOf("/");
  return at < 0 ? "" : slug.slice(0, at).split("/").pop()!;
}
