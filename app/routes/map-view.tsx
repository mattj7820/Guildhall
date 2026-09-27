import { data, isRouteErrorResponse, Link } from "react-router";
import { loadMapView } from "~/.server/maps/load";
import { MapsDmOnlyNotice } from "~/components/maps/DmOnlyNotice";
import { MapViewer } from "~/components/maps/MapViewer";
import { servicesContext, viewerContext } from "~/context";
import type { Route } from "./+types/map-view";

export function meta({ loaderData }: Route.MetaArgs) {
  const name = loaderData && !loaderData.dmOnly ? loaderData.map.name : "Map";
  return [{ title: `${name} · Guildhall` }];
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const viewer = context.get(viewerContext);
  if (viewer.role !== "dm") return { dmOnly: true as const };
  const services = context.get(servicesContext);
  const maps = await services.maps.list();
  const map = maps.find((candidate) => candidate.id === params.id);
  // A map the viewer can't see gets the same 404 as one that doesn't exist.
  const view = map && (await loadMapView(services, map, maps, viewer));
  if (!view) throw data("Map not found", { status: 404 });
  return { dmOnly: false as const, map: view };
}

export default function MapPage({ loaderData }: Route.ComponentProps) {
  if (loaderData.dmOnly) return <MapsDmOnlyNotice />;
  return <MapViewer key={loaderData.map.id} map={loaderData.map} />;
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
