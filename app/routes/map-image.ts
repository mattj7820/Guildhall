import { data } from "react-router";
import { serveVaultImage } from "~/.server/vault/serve-image";
import { servicesContext, viewerContext } from "~/context";
import type { Route } from "./+types/map-image";

/**
 * Streams a map's whole image, found by map ID, so the vault file name never appears in a URL.
 * Only ever for the DM (not while previewing as a player), even for a shared, fully revealed map:
 * players get the parts the fog reveals, as tiles (`map-tile`).
 *
 * Map images can be 15 MB, so the browser revalidates with an ETag and gets a 304 while the file
 * is unchanged; the page's image URL also carries a version, so a re-export shows at once.
 */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  if (context.get(viewerContext).role !== "dm") throw data("Not found", { status: 404 });
  const { config, maps, vault } = context.get(servicesContext);

  const map = await maps.get(params.id);
  const found = map && vault.current.findImage(map.image.path);
  const response = found && (await serveVaultImage(request, config.vaultPath, found.path));
  if (!response) throw data("Not found", { status: 404 });
  return response;
}
