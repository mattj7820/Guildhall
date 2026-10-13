import { mapSource } from "~/.server/maps/load";
import { notFound } from "~/.server/not-found";
import { canView } from "~/campaign/visibility";
import { servicesContext, viewerContext } from "~/context";
import { thumbnailVersion } from "~/maps/urls";
import type { Route } from "./+types/map-thumbnail";

/**
 * A small picture of the whole map, for the Maps page: one pixel per fog cell. The DM's is all of
 * it; players' is masked by the fog as it is now, whatever the URL's version asked for, and a map
 * they can't see, or can't see any of yet, is the same 404 as one that doesn't exist.
 */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const services = context.get(servicesContext);
  const viewer = context.get(viewerContext);
  const { maps, fogs, playerImages } = services;
  const map = await maps.get(params.id);
  if (!map || !canView(viewer, map.visibility)) notFound();
  const source = await mapSource(services, map);
  if (!source) notFound();

  const fog = await fogs.get(map.id, map.image);
  const dm = viewer.role === "dm";
  const image = dm
    ? await playerImages.thumbnail(source, fog.mask)
    : await playerImages.playerThumbnail(source, map.id, fog);
  if (!image) notFound();

  const version = thumbnailVersion(source.version, dm ? undefined : fog.version);
  const current = new URL(request.url).searchParams.get("v") === version;
  return new Response(new Uint8Array(image), {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(image.length),
      "Cache-Control": current ? "private, max-age=31536000, immutable" : "private, no-cache",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
