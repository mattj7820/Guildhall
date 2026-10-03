import { mapVersion } from "~/.server/maps/load";
import { loadMapTokens } from "~/.server/maps/tokens";
import { notFound } from "~/.server/not-found";
import { canView } from "~/campaign/visibility";
import { servicesContext, viewerContext } from "~/context";
import type { Route } from "./+types/map-version";

/**
 * JSON: `{ version, tokens }`: the map's version, which changes whenever anything about the map
 * might have (decision 40), and its tokens as the viewer may see them. An open map asks for it
 * only while its live connection is down, and reloads its data only when the version changes. A map the viewer can't see is the same 404 as one that doesn't exist, so
 * a map that stops being shared closes on the players' screens.
 */
export async function loader({ params, context }: Route.LoaderArgs) {
  const services = context.get(servicesContext);
  const viewer = context.get(viewerContext);
  const map = await services.maps.get(params.id);
  if (!map || !canView(viewer, map.visibility)) {
    notFound();
  }
  return Response.json(
    { version: await mapVersion(services, map), ...(await loadMapTokens(services, map, viewer)) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
