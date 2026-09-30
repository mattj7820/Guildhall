// PROTOTYPE (removed before the PR): the feel of a battle grid: snapping, token sizes, measuring
// and spell shapes. Nothing is saved.
import { data } from "react-router";
import { loadMapView } from "~/.server/maps/load";
import { servicesContext, viewerContext } from "~/context";
import { GridPrototype } from "~/prototype/GridPrototype";
import type { Route } from "./+types/map-grid-prototype";

export function meta() {
  return [{ title: "Grid prototype · Guildhall" }];
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const viewer = context.get(viewerContext);
  const services = context.get(servicesContext);
  const maps = await services.maps.list();
  const map = maps.find((candidate) => candidate.id === params.id);
  const view = map && (await loadMapView(services, map, maps, viewer));
  if (!view) throw data("Map not found", { status: 404 });
  return { map: view };
}

export default function GridPrototypePage({ loaderData }: Route.ComponentProps) {
  return <GridPrototype key={loaderData.map.id} map={loaderData.map} />;
}
