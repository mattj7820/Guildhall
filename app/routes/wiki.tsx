import { Form, Outlet, useSearchParams } from "react-router";
import { FolderTree } from "~/components/FolderTree";
import { servicesContext, viewerContext } from "~/context";
import type { Route } from "./+types/wiki";

export function loader({ context }: Route.LoaderArgs) {
  const { vault } = context.get(servicesContext);
  return { tree: vault.current.folderTree(context.get(viewerContext)) };
}

export default function WikiLayout({ loaderData }: Route.ComponentProps) {
  const [searchParams] = useSearchParams();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-6 md:flex-row">
      <aside className="md:sticky md:top-4 md:max-h-[calc(100vh-2rem)] md:w-64 md:shrink-0 md:overflow-y-auto">
        <Form method="get" action="/wiki" role="search" className="mb-4">
          <label htmlFor="wiki-search" className="sr-only">
            Search the wiki
          </label>
          <input
            id="wiki-search"
            type="search"
            name="q"
            defaultValue={searchParams.get("q") ?? ""}
            placeholder="Search the wiki…"
            className="w-full rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-900"
          />
        </Form>
        <FolderTree root={loaderData.tree} />
      </aside>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
