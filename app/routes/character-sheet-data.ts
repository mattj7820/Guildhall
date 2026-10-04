import { characterPage } from "~/.server/characters/load";
import { openableCharacter } from "~/.server/characters/openable";
import { servicesContext, viewerContext } from "~/context";
import type { Route } from "./+types/character-sheet-data";

/**
 * A sheet's page data as JSON, for the sheet beside the map: exactly what the sheet page loads,
 * for those who may open it, and the same 404 for anyone else.
 */
export async function loader({ params, context }: Route.LoaderArgs) {
  const viewer = context.get(viewerContext);
  const services = context.get(servicesContext);
  const character = await openableCharacter(services, params.id, viewer);
  return Response.json(
    characterPage(services.vault.current, character, viewer, await services.characters.list()),
  );
}
