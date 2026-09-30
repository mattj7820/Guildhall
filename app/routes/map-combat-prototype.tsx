// PROTOTYPE (removed before the PR): the feel of running a fight on the map page.
import { data } from "react-router";
import { combatCatalogue } from "~/.server/combat/catalogue";
import { loadMapView } from "~/.server/maps/load";
import { loadMapTokens } from "~/.server/maps/tokens";
import { servicesContext, viewerContext } from "~/context";
import { CombatPrototype } from "~/prototype/CombatPrototype";
import type { Route } from "./+types/map-combat-prototype";

export function meta() {
  return [{ title: "Combat prototype · Guildhall" }];
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const viewer = context.get(viewerContext);
  if (viewer.role !== "dm") throw data("Not found", { status: 404 });
  const services = context.get(servicesContext);
  const maps = await services.maps.list();
  const map = maps.find((candidate) => candidate.id === params.id);
  const view = map && (await loadMapView(services, map, maps, viewer));
  if (!map || !view) throw data("Map not found", { status: 404 });
  const { tokens } = await loadMapTokens(services, map, viewer);
  return { map: view, tokens, catalogue: combatCatalogue(services.vault.current, viewer) };
}

export default function CombatPrototypePage({ loaderData }: Route.ComponentProps) {
  return (
    <CombatPrototype
      key={loaderData.map.id}
      map={loaderData.map}
      tokens={loaderData.tokens}
      catalogue={loaderData.catalogue}
    />
  );
}
