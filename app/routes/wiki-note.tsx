import { isRouteErrorResponse, Link } from "react-router";
import { DataFileError } from "~/.server/data/json-store";
import { notFound } from "~/.server/not-found";
import { bookFolderFor } from "~/.server/wiki/book";
import { inBook } from "~/wiki/tome";
import type { CampaignMaps } from "~/.server/maps/campaign-maps";
import { TypeBadge } from "~/components/TypeBadge";
import { accountContext, servicesContext, viewerContext } from "~/context";
import { mapUrl } from "~/maps/urls";
import { useWikilinkNavigation } from "~/wiki/useWikilinkNavigation";
import type { Route } from "./+types/wiki-note";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: loaderData ? `${loaderData.title} · Guildhall` : "Not found · Guildhall" }];
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const { vault, maps } = context.get(servicesContext);
  const viewer = context.get(viewerContext);
  const account = context.get(accountContext);
  const note = vault.current.getNote(params["*"] ?? "", viewer);
  // Only notes in the tome's book count, when a book folder is picked.
  const linkedFromBook = async () => {
    const bookFolder = bookFolderFor(vault, viewer, account);
    return note
      ? vault.current.linkedFrom(note, viewer).filter((n) => inBook(n.slug, bookFolder))
      : [];
  };

  // Hidden notes get the same 404 as missing ones, so the player view doesn't reveal they exist.
  if (!note) notFound("Note not found");

  return {
    id: note.id,
    title: note.title,
    type: note.type,
    tags: note.tags,
    aliases: note.aliases,
    visibility: note.visibility,
    hasOwnTitle: vault.current.hasOwnTitle(note, viewer),
    html: vault.current.render(note, viewer),
    showVisibility: viewer.role === "dm",
    /** Scrying, in the tome: the notes that link here, as this viewer may read them. */
    linkedFrom:
      account.kind === "member" && account.member.wikiLook === "tome" ? await linkedFromBook() : [],
    /** Maps of this place. DM-only, like the maps themselves for now. */
    maps: viewer.role === "dm" ? await mapsOf(maps, note.id) : [],
  };
}

async function mapsOf(maps: CampaignMaps, noteId: string) {
  try {
    return (await maps.forNote(noteId)).map(({ id, name }) => ({ id, name }));
  } catch (error) {
    // A damaged maps file is reported on the maps pages; the note should still open.
    if (error instanceof DataFileError) return [];
    throw error;
  }
}

export default function WikiNote({ loaderData: note }: Route.ComponentProps) {
  const handleBodyClick = useWikilinkNavigation();

  return (
    <article data-entity-id={note.id}>
      <header className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        {note.type && <TypeBadge type={note.type} />}
        {note.showVisibility && (
          <span className={note.visibility === "players" ? "text-good" : "text-danger"}>
            {note.visibility === "players" ? "Visible to players" : "DM only"}
          </span>
        )}
        {note.aliases.length > 0 && (
          <span className="text-muted">Also known as {note.aliases.join(", ")}</span>
        )}
        {note.maps.map((map) => (
          <Link
            key={map.id}
            to={mapUrl(map.id)}
            className="rounded-full bg-accent-surface px-2 py-0.5 font-medium text-title hover:ring-1 hover:ring-trim"
          >
            Open map: {map.name}
          </Link>
        ))}
        {note.tags.map((tag) => (
          <span key={tag} className="text-muted">
            #{tag}
          </span>
        ))}
      </header>
      {/* Skip the title when the body opens with its own `# Heading`, so there's exactly one h1. */}
      {!note.hasOwnTitle && <h1 className="mb-4 font-serif text-4xl font-bold">{note.title}</h1>}
      {/* Server-rendered from the vault and sanitised in app/.server/vault/render.ts. */}
      <div
        onClick={handleBodyClick}
        className="note-body prose prose-theme max-w-none"
        dangerouslySetInnerHTML={{ __html: note.html }}
      />
    </article>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <main>
        <h1 className="font-serif text-3xl font-bold">Note not found</h1>
        <p className="mt-2">
          There's no note at this address.{" "}
          <Link to="/wiki" className="text-link underline">
            Back to the wiki
          </Link>
        </p>
      </main>
    );
  }
  throw error;
}
