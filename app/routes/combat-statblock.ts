import { statblockView } from "~/.server/combat/catalogue";
import { notFound, requireDm } from "~/.server/not-found";
import { servicesContext, viewerContext } from "~/context";
import type { Route } from "./+types/combat-statblock";

/**
 * JSON: one statblock for the DM's combat tools (`?key=`, as `statblockKey` makes it), rendered
 * with its rolls marked. Loaded when a statblock is shown, rather than every statblock coming
 * with the page. Players get the same 404 as for a statblock that isn't there.
 */
export function loader({ request, context }: Route.LoaderArgs) {
  const viewer = context.get(viewerContext);
  requireDm(viewer);
  const key = new URL(request.url).searchParams.get("key") ?? "";
  const view = statblockView(context.get(servicesContext).vault.current, viewer, key);
  if (!view) notFound();
  // The browser checks back each time: an edit to the note shows when the page next loads it.
  return Response.json(view, { headers: { "Cache-Control": "private, no-cache" } });
}
