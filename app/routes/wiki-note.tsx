import type { MouseEvent } from "react";
import { data, isRouteErrorResponse, Link, useNavigate } from "react-router";
import { TypeBadge } from "~/components/TypeBadge";
import { servicesContext, viewerContext } from "~/context";
import type { Route } from "./+types/wiki-note";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: loaderData ? `${loaderData.title} · Guildhall` : "Not found · Guildhall" }];
}

export function loader({ params, context }: Route.LoaderArgs) {
  const { vault } = context.get(servicesContext);
  const viewer = context.get(viewerContext);
  const note = vault.current.getNote(params["*"] ?? "", viewer);

  // Hidden notes get the same 404 as missing ones, so the player view doesn't reveal they exist.
  if (!note) throw data("Note not found", { status: 404 });

  return {
    id: note.id,
    title: note.title,
    type: note.type,
    tags: note.tags,
    aliases: note.aliases,
    visibility: note.visibility,
    hasOwnTitle: note.hasOwnTitle,
    html: vault.current.render(note, viewer),
    showVisibility: viewer.role === "dm",
  };
}

export default function WikiNote({ loaderData: note }: Route.ComponentProps) {
  const navigate = useNavigate();

  /** Wikilinks arrive as plain HTML; route in-app ones client-side instead of reloading the page. */
  function handleBodyClick(event: MouseEvent<HTMLDivElement>) {
    const link = (event.target as Element).closest<HTMLAnchorElement>("a.wikilink");
    const isPlainClick =
      event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
    if (
      !link ||
      !isPlainClick ||
      !link.pathname.startsWith("/wiki/") ||
      link.origin !== location.origin
    )
      return;
    event.preventDefault();
    navigate(link.pathname + link.hash);
  }

  return (
    <article data-entity-id={note.id}>
      <header className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        {note.type && <TypeBadge type={note.type} />}
        {note.showVisibility && (
          <span
            className={
              note.visibility === "players"
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-rose-700 dark:text-rose-400"
            }
          >
            {note.visibility === "players" ? "Visible to players" : "DM only"}
          </span>
        )}
        {note.aliases.length > 0 && (
          <span className="text-stone-500">Also known as {note.aliases.join(", ")}</span>
        )}
        {note.tags.map((tag) => (
          <span key={tag} className="text-stone-500">
            #{tag}
          </span>
        ))}
      </header>
      {/* Skip the title when the body opens with its own `# Heading`, so there's exactly one h1. */}
      {!note.hasOwnTitle && <h1 className="mb-4 font-serif text-4xl font-bold">{note.title}</h1>}
      {/* Server-rendered from the vault and sanitised in app/.server/vault/render.ts. */}
      <div
        onClick={handleBodyClick}
        className="note-body prose prose-stone max-w-none dark:prose-invert"
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
          <Link to="/wiki" className="text-amber-800 underline dark:text-amber-400">
            Back to the wiki
          </Link>
        </p>
      </main>
    );
  }
  throw error;
}
