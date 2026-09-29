import { data } from "react-router";
import { mapVersion } from "~/.server/maps/load";
import { canView } from "~/campaign/visibility";
import { servicesContext, viewerContext } from "~/context";
import type { Route } from "./+types/map-version";

/**
 * JSON: `{ version }`, which changes whenever anything about the map might have (decision 40). An
 * open map polls it and reloads its data only when it changes; later, a websocket can push the
 * same version instead. A map the viewer can't see is the same 404 as one that doesn't exist, so
 * a map that stops being shared closes on the players' screens.
 */
export async function loader({ params, context }: Route.LoaderArgs) {
  const services = context.get(servicesContext);
  const map = await services.maps.get(params.id);
  if (!map || !canView(context.get(viewerContext), map.visibility)) {
    throw data("Not found", { status: 404 });
  }
  return Response.json(
    { version: await mapVersion(services, map) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
