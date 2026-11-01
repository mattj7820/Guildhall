import { Link, useRouteLoaderData } from "react-router";
import { requireDm } from "~/.server/not-found";
import { TitlePage } from "~/components/wiki/Cover";
import { TypeBadge } from "~/components/TypeBadge";
import { servicesContext, viewerContext } from "~/context";
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
  const { vault, campaignName } = context.get(servicesContext);
  const viewer = context.get(viewerContext);
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  const results: SearchHit[] = vault.current.search(query, viewer).map(({ note, snippet }) => ({
    slug: note.slug,
    title: note.title,
    type: note.type,
    snippet,
  }));
  return {
    query,
    results,
    noteCount: vault.current.notes(viewer).length,
    campaignName: await campaignName.get(),
    canName: viewer.role === "dm",
  };
}

/** The DM names the campaign, for the tome's cover (an empty name clears it). */
export async function action({ request, context }: Route.ActionArgs) {
  requireDm(context.get(viewerContext));
  const name = String((await request.formData()).get("campaignName") ?? "");
  await context.get(servicesContext).campaignName.set(name);
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
