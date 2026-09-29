// PROTOTYPE (removed before the PR): the feel of revealing fog. Nothing is saved.
import { data } from "react-router";
import { loadMapView } from "~/.server/maps/load";
import { FogPrototype } from "~/prototype/FogPrototype";
import { servicesContext, viewerContext } from "~/context";
import type { Route } from "./+types/map-fog-prototype";

export async function loader({ params, context }: Route.LoaderArgs) {
  const viewer = context.get(viewerContext);
  if (viewer.role !== "dm") throw data("Not found", { status: 404 });
  const services = context.get(servicesContext);
  const maps = await services.maps.list();
  const map = maps.find((candidate) => candidate.id === params.id);
  const view = map && (await loadMapView(services, map, maps, viewer));
  if (!view) throw data("Map not found", { status: 404 });
  return { map: view };
}

export default function FogPrototypePage({ loaderData }: Route.ComponentProps) {
  return <FogPrototype key={loaderData.map.id} map={loaderData.map} />;
}
