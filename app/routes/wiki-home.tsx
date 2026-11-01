import { Link, useRouteLoaderData } from "react-router";
import { requireDm } from "~/.server/not-found";
import { bookFolderFor } from "~/.server/wiki/book";
import { inBook } from "~/wiki/tome";
import { TitlePage } from "~/components/wiki/Cover";
import { TypeBadge } from "~/components/TypeBadge";
import { accountContext, servicesContext, viewerContext } from "~/context";
import type { SearchHit } from "~/wiki/types";
import { noteUrl } from "~/wiki/urls";
import type { Route } from "./+types/wiki-home";

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: loaderData?.query ? `Search: ${loaderData.query} · Guildhall` : "Wiki · Guildhall" },
  ];
}

/**
 * The wiki landing page, which doubles as search results when `?q=` is present. In the tome it's
 * the closed book's cover, and once opened its title page.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const { vault, campaigns } = context.get(servicesContext);
  const viewer = context.get(viewerContext);
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  // In the tome, with a book folder picked, only notes in the book are found and counted.
  const bookFolder = bookFolderFor(vault, viewer, context.get(accountContext));

  const results: SearchHit[] = vault.current
    .search(query, viewer)
    .filter(({ note }) => inBook(note.slug, bookFolder))
    .map(({ note, snippet }) => ({
      slug: note.slug,
      title: note.title,
      type: note.type,
      snippet,
    }));
  return {
    query,
    results,
    noteCount: vault.current.notes(viewer).filter((note) => inBook(note.slug, bookFolder)).length,
    campaignName: (await campaigns.active()).name,
    canName: viewer.role === "dm",
  };
}

/**
 * The DM names the running campaign on the tome's cover; an empty name clears it. Which folder
 * is the campaign (and so the book) is chosen in Settings.
 */
export async function action({ request, context }: Route.ActionArgs) {
  const viewer = context.get(viewerContext);
  requireDm(viewer);
  const { campaigns } = context.get(servicesContext);
  const form = await request.formData();
  const { id } = await campaigns.active();
  await campaigns.rename(id, String(form.get("campaignName") ?? ""));
  return { ok: true };
}

export default function WikiHome({ loaderData }: Route.ComponentProps) {
  const { query, results, noteCount, campaignName } = loaderData;
  const wiki = useRouteLoaderData("routes/wiki") as { look: string } | undefined;

  if (!query && wiki?.look === "tome") {
    return <TitlePage name={campaignName} noteCount={noteCount} />;
  }

  if (!query) {
    return (
      <main>
        <h1 className="font-serif text-3xl font-bold">{campaignName ?? "Campaign wiki"}</h1>
        <p className="mt-2 text-muted">{noteCount} notes. Pick one from the sidebar, or search.</p>
      </main>
    );
  }

  return (
    <main>
      <h1 className="font-serif text-3xl font-bold">Search results</h1>
      <p className="mt-1 text-muted">
        {results.length === 0
          ? `Nothing matches “${query}”.`
          : `${results.length} ${results.length === 1 ? "note matches" : "notes match"} “${query}”.`}
      </p>
      <ol aria-label="Search results" className="mt-6 space-y-4">
        {results.map((result) => (
          <li key={result.slug}>
            <div className="flex items-center gap-2">
              <Link to={noteUrl(result.slug)} className="font-semibold text-link hover:underline">
                {result.title}
              </Link>
              {result.type && <TypeBadge type={result.type} />}
            </div>
            <p className="text-xs text-muted">{result.slug}</p>
            {result.snippet && <p className="mt-1 text-sm text-ink">{result.snippet}</p>}
          </li>
        ))}
      </ol>
    </main>
  );
}
