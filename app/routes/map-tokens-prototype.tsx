// PROTOTYPE (removed before the PR): the DM's Tokens tab and NPC tokens, with pretend data.
import { loadMapView } from "~/.server/maps/load";
import { loadMapTokens, partyPlacements } from "~/.server/maps/tokens";
import { notFound, requireDm } from "~/.server/not-found";
import { servicesContext, viewerContext } from "~/context";
import { TokensPrototype } from "~/prototype/npc-tokens/TokensPrototype";
import { assetUrl } from "~/wiki/urls";
import type { Route } from "./+types/map-tokens-prototype";

export function meta() {
  return [{ title: "Tokens tab prototype · Guildhall" }];
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
  const vault = services.vault.current;
  const notes = vault.notes(viewer).map((note) => {
    const image = vault.firstImage(note, viewer);
    return {
      id: note.id,
      slug: note.slug,
      title: note.title,
      npc: note.type === "npc",
      ...(image && { imageUrl: assetUrl(image) }),
    };
  });
  return {
    map: view,
    tokens,
    party: await partyPlacements(services, maps),
    notes,
    otherMaps: maps
      .filter((each) => each.id !== map.id)
      .map((each) => ({ id: each.id, name: each.name })),
  };
}

export default function MapTokensPrototypePage({ loaderData }: Route.ComponentProps) {
  return <TokensPrototype key={loaderData.map.id} {...loaderData} />;
}
