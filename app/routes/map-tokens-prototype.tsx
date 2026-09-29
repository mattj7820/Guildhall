// PROTOTYPE (removed before the PR): the feel of dragging party tokens live between browsers.
import { data } from "react-router";
import { partyCards } from "~/.server/characters/load";
import { partyNotes, prototypeAccess } from "~/.server/live/prototype-tokens";
import { loadMapView } from "~/.server/maps/load";
import { servicesContext, viewerContext } from "~/context";
import { TokensPrototype, type PrototypeToken } from "~/prototype/TokensPrototype";
import type { Route } from "./+types/map-tokens-prototype";

export function meta() {
  return [{ title: "Tokens prototype · Guildhall" }];
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const viewer = context.get(viewerContext);
  const services = context.get(servicesContext);
  const maps = await services.maps.list();
  const map = maps.find((candidate) => candidate.id === params.id);
  const view = map && (await loadMapView(services, map, maps, viewer));
  if (!view) throw data("Map not found", { status: 404 });

  const { cards } = partyCards(services.vault.current, await services.characters.list(), viewer);
  const tokens: PrototypeToken[] = partyNotes(services.vault).flatMap((note) => {
    const card = cards.find((each) => each.note === note.id);
    if (!card) return [];
    return [
      {
        id: note.id,
        name: card.name,
        portraitUrl: card.portraitUrl,
        movable: prototypeAccess(viewer, note) === "edit",
      },
    ];
  });
  return { map: view, tokens };
}

export default function TokensPrototypePage({ loaderData }: Route.ComponentProps) {
  return (
    <TokensPrototype key={loaderData.map.id} map={loaderData.map} tokens={loaderData.tokens} />
  );
}
