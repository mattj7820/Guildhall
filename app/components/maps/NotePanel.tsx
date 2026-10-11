import { Link } from "react-router";
import type { NoteLink } from "~/maps/types";
import { useWikilinkNavigation } from "~/wiki/useWikilinkNavigation";

/** A linked wiki note, rendered in the map's side panel. */
export function NotePanel({ note, headingLevel = 2 }: { note: NoteLink; headingLevel?: 2 | 3 }) {
  const handleClick = useWikilinkNavigation();
  const Heading = `h${headingLevel}` as const;
  return (
    <section aria-label={`Note: ${note.title}`} className="flex flex-col gap-2">
      <p className="flex items-baseline gap-2 text-xs font-semibold tracking-wide text-muted uppercase">
        Wiki note
        <Link to={note.url} className="font-normal tracking-normal normal-case hover:underline">
          Open in the wiki
        </Link>
      </p>
      {!note.hasOwnTitle && (
        <Heading className="font-serif text-2xl font-bold">{note.title}</Heading>
      )}
      {/* Server-rendered from the vault and sanitised in app/.server/vault/render.ts. */}
      <div
        onClick={handleClick}
        className="note-body prose prose-sm prose-theme max-w-none"
        dangerouslySetInnerHTML={{ __html: note.html }}
      />
    </section>
  );
}
