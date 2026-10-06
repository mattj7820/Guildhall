import { loadTokens, notePicture } from "~/.server/maps/tokens";
import { notFound } from "~/.server/not-found";
import { serveVaultImage } from "~/.server/vault/serve-image";
import { canView } from "~/campaign/visibility";
import { servicesContext, viewerContext } from "~/context";
import type { Route } from "./+types/map-token-picture";

/**
 * An NPC token's picture, by the token: its note's first image as the DM sees it, so showing the
 * token shows what's on it. Only to someone who may see that token now (the DM, or a player it's
 * shown to, where it's revealed); anyone else, and any token without a picture, gets the same 404
 * as a token that doesn't exist. Never by the image's path or the note.
 */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const viewer = context.get(viewerContext);
  const services = context.get(servicesContext);
  const map = await services.maps.get(params.id);
  if (!map || !canView(viewer, map.visibility)) notFound();
  const token = (await services.tokens.onMap(map.id)).find((each) => each.id === params.token);
  if (token?.kind !== "marker" || token.picture !== "note") notFound();
  if (viewer.role !== "dm") {
    // Exactly the tokens this player is sent: shown, revealed and not set aside.
    const seen = await loadTokens(services, map, viewer);
    if (!seen.some((each) => each.id === token.id)) notFound();
  }
  const image = notePicture(services.vault.current, token);
  const response = image && (await serveVaultImage(request, services.config.vaultPath, image));
  if (!response) notFound();
  return response;
}
