import { Form, Outlet, useSearchParams } from "react-router";
import { FolderTree } from "~/components/FolderTree";
import { Tome } from "~/components/wiki/Tome";
import { accountContext, servicesContext, viewerContext } from "~/context";
import type { Route } from "./+types/wiki";

export function loader({ context }: Route.LoaderArgs) {
  const { vault } = context.get(servicesContext);
  const account = context.get(accountContext);
  return {
    tree: vault.current.folderTree(context.get(viewerContext)),
    look: account.kind === "member" ? (account.member.wikiLook ?? "pages") : "pages",
  };
}

export default function WikiLayout({ loaderData }: Route.ComponentProps) {
  const [searchParams] = useSearchParams();

  if (loaderData.look === "tome") {
    return (
      <Tome tree={loaderData.tree}>
        <Outlet />
      </Tome>
    );
  }

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
            className="w-full rounded-md border border-line-strong bg-surface px-3 py-1.5 text-sm"
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
