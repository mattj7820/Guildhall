// PROTOTYPE (removed before the PR): a player's sheet and bag beside the map.
import { loadMapView } from "~/.server/maps/load";
import { loadMapTokens } from "~/.server/maps/tokens";
import { notFound, requireDm } from "~/.server/not-found";
import { servicesContext, viewerContext } from "~/context";
import { MapPanelPrototype } from "~/prototype/sheet-tracking/MapPanelPrototype";
import type { Route } from "./+types/map-sheet-prototype";

export function meta() {
  return [{ title: "Sheet panel prototype · Guildhall" }];
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const viewer = context.get(viewerContext);
  requireDm(viewer);
  const services = context.get(servicesContext);
  const maps = await services.maps.list();
  const map = maps.find((candidate) => candidate.id === params.id);
  const view = map && (await loadMapView(services, map, maps, viewer));
  if (!map || !view) notFound("Map not found");
  const { tokens } = await loadMapTokens(services, map, viewer);
  return { map: view, tokens };
}

export default function MapSheetPrototypePage({ loaderData }: Route.ComponentProps) {
  return (
    <MapPanelPrototype key={loaderData.map.id} map={loaderData.map} tokens={loaderData.tokens} />
  );
}
