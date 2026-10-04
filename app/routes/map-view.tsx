import { isRouteErrorResponse, Link } from "react-router";
import { partyCards } from "~/.server/characters/load";
import { combatCatalogue } from "~/.server/combat/catalogue";
import { fightView } from "~/.server/combat/fight-view";
import { loadMapView, mapVersion } from "~/.server/maps/load";
import { loadMapTokens, partyPlacements } from "~/.server/maps/tokens";
import { notFound } from "~/.server/not-found";
import { MapViewer } from "~/components/maps/MapViewer";
import { PlayerMapViewer } from "~/components/maps/PlayerMapViewer";
import type { Viewer } from "~/campaign/types";
import type { CharacterChoice } from "~/characters/view";
import type { PreparedEncounter } from "~/combat/types";
import { servicesContext, viewerContext, type Services } from "~/context";
import type { Route } from "./+types/map-view";

export function meta({ loaderData }: Route.MetaArgs) {
  const name = loaderData?.map.name ?? "Map";
  return [{ title: `${name} · Guildhall` }];
}

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const viewer = context.get(viewerContext);
  const services = context.get(servicesContext);
  const maps = await services.maps.list();
  const map = maps.find((candidate) => candidate.id === params.id);
  // A map the viewer can't see gets the same 404 as one that doesn't exist.
  const view = map && (await loadMapView(services, map, maps, viewer));
  if (!map || !view) notFound("Map not found");
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
      characters: await openableCharacters(services, viewer),
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
    // By their paths inside the sounds folder, as the sounds route takes them.
    sounds: services.vault.current
      .soundsIn(services.config.soundsFolder)
      .map((path) => path.slice(services.config.soundsFolder.length + 1)),
    fight: fight?.forDm ? fight : null,
    catalogue: combatCatalogue(services.vault.current, viewer),
    starting: await startingPrepared(services, request),
  };
}

/**
 * The characters this player may open beside the map (their own and the companion the party
 * shares), by name only: the sheet itself is loaded when it's opened.
 */
async function openableCharacters(
  services: Pick<Services, "vault" | "characters">,
  viewer: Viewer,
): Promise<CharacterChoice[]> {
  const { cards } = partyCards(services.vault.current, await services.characters.list(), viewer);
  return cards.flatMap(({ id, name, kind, canOpen }) =>
    id && canOpen ? [{ id, name, kind }] : [],
  );
}

/** A prepared fight to start here (`?start=<id>`); null if it no longer exists. */
async function startingPrepared(
  services: Pick<Services, "preparedEncounters">,
  request: Request,
): Promise<PreparedEncounter | null | undefined> {
  const id = new URL(request.url).searchParams.get("start");
  if (!id) return undefined;
  return (await services.preparedEncounters.get(id)) ?? null;
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
        characters={loaderData.characters}
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
      sounds={loaderData.sounds}
      fight={loaderData.fight}
      catalogue={loaderData.catalogue}
      starting={loaderData.starting}
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
