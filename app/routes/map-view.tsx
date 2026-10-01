import { data, isRouteErrorResponse, Link } from "react-router";
import { combatCatalogue } from "~/.server/combat/catalogue";
import { fightView } from "~/.server/combat/fight-view";
import { loadMapView, mapVersion } from "~/.server/maps/load";
import { loadMapTokens, partyPlacements } from "~/.server/maps/tokens";
import { MapViewer } from "~/components/maps/MapViewer";
import { PlayerMapViewer } from "~/components/maps/PlayerMapViewer";
import { servicesContext, viewerContext } from "~/context";
import type { Route } from "./+types/map-view";

export function meta({ loaderData }: Route.MetaArgs) {
  const name = loaderData?.map.name ?? "Map";
  return [{ title: `${name} · Guildhall` }];
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const viewer = context.get(viewerContext);
  const services = context.get(servicesContext);
  const maps = await services.maps.list();
  const map = maps.find((candidate) => candidate.id === params.id);
  // A map the viewer can't see gets the same 404 as one that doesn't exist.
  const view = map && (await loadMapView(services, map, maps, viewer));
  if (!map || !view) throw data("Map not found", { status: 404 });
  const { tokens, inside } = await loadMapTokens(services, map, viewer);
  // Only the DM gets the vault's image list (for a moved image) and the party to place; players
  // get just the map and the tokens they may see.
  if (viewer.role !== "dm") {
    const version = await mapVersion(services, map);
    // Only the fight on this map: the page needn't carry one elsewhere.
    const current = await services.fight.get();
    const fight = current?.map === map.id ? await fightView(services, current, viewer) : null;
    return {
      forDm: false as const,
      map: view,
      tokens,
      inside,
      version,
      fight: fight && !fight.forDm ? fight : null,
    };
  }
  // The fight wherever it is: running it from here brings it to this map.
  const current = await services.fight.get();
  const fight = current && (await fightView(services, current, viewer));
  return {
    forDm: true as const,
    map: view,
    tokens,
    inside,
    party: await partyPlacements(services, maps),
    images: services.vault.current.mapImages(),
    fight: fight?.forDm ? fight : null,
    catalogue: combatCatalogue(services.vault.current, viewer),
  };
}

export default function MapPage({ loaderData }: Route.ComponentProps) {
  if (!loaderData.forDm) {
    return (
      <PlayerMapViewer
        key={loaderData.map.id}
        map={loaderData.map}
        tokens={loaderData.tokens}
        inside={loaderData.inside}
        version={loaderData.version}
        fight={loaderData.fight}
      />
    );
  }
  return (
    <MapViewer
      key={loaderData.map.id}
      map={loaderData.map}
      tokens={loaderData.tokens}
      inside={loaderData.inside}
      party={loaderData.party}
      images={loaderData.images}
      fight={loaderData.fight}
      catalogue={loaderData.catalogue}
    />
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-serif text-3xl font-bold">Map not found</h1>
        <p className="mt-2">
          There's no map at this address; it may have been deleted.{" "}
          <Link to="/maps" className="text-amber-800 underline dark:text-amber-400">
            All maps
          </Link>
        </p>
      </main>
    );
  }
  throw error;
}
