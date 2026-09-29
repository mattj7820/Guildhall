import { data } from "react-router";
import { mapSource } from "~/.server/maps/load";
import { canView } from "~/campaign/visibility";
import { servicesContext, viewerContext } from "~/context";
import type { Route } from "./+types/map-tile";

const WHOLE_NUMBER = /^\d{1,4}$/;

/**
 * One tile of a map's image, as players may see it: the fog as it is now decides, whatever the
 * URL's version asked for, and a tile the fog hides entirely is the same 404 as one that doesn't
 * exist. Anyone who can see the map may ask; the DM can see every map.
 *
 * A URL whose version matches the tile now never changes its answer, so the browser keeps it; an
 * old one gets today's tile, to be checked again next time.
 */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const services = context.get(servicesContext);
  const { maps, fogs, playerImages } = services;
  const map = await maps.get(params.id);
  if (!map || !canView(context.get(viewerContext), map.visibility)) throw notFound();
  if (!WHOLE_NUMBER.test(params.x) || !WHOLE_NUMBER.test(params.y)) throw notFound();

  const source = await mapSource(services, map);
  if (!source) throw notFound();
  const fog = playerImages.playerFog(map.id, await fogs.get(map.id, map.image));
  const tile = await playerImages.tile(source, fog, Number(params.x), Number(params.y));
  if (!tile) throw notFound();

  const current = new URL(request.url).searchParams.get("v") === `${source.version}.${tile.key}`;
  return new Response(new Uint8Array(tile.data), {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(tile.data.length),
      "Cache-Control": current ? "private, max-age=31536000, immutable" : "private, no-cache",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}

function notFound() {
  return data("Not found", { status: 404 });
}
