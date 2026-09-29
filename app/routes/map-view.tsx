import { data, isRouteErrorResponse, Link } from "react-router";
import { loadMapView, mapVersion } from "~/.server/maps/load";
import { loadTokens, partyPlacements } from "~/.server/maps/tokens";
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
  const tokens = await loadTokens(services, map, viewer);
  // Only the DM gets the vault's image list (for a moved image) and the party to place; players
  // get just the map and the tokens they may see.
  if (viewer.role !== "dm") {
    const version = await mapVersion(services, map);
    return { forDm: false as const, map: view, tokens, version };
  }
  return {
    forDm: true as const,
    map: view,
    tokens,
    party: await partyPlacements(services, maps),
    images: services.vault.current.mapImages(),
  };
}

export default function MapPage({ loaderData }: Route.ComponentProps) {
  if (!loaderData.forDm) {
    return (
      <PlayerMapViewer
        key={loaderData.map.id}
        map={loaderData.map}
        tokens={loaderData.tokens}
        version={loaderData.version}
      />
    );
  }
  return (
    <MapViewer
      key={loaderData.map.id}
      map={loaderData.map}
      tokens={loaderData.tokens}
      party={loaderData.party}
      images={loaderData.images}
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
