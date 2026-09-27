import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { data } from "react-router";
import { vaultFile } from "~/.server/maps/load";
import { contentType } from "~/.server/vault/media";
import { servicesContext, viewerContext } from "~/context";
import type { Route } from "./+types/map-image";

/**
 * Streams a map's image, found by map ID, so the vault file name never appears in a URL. Maps are
 * DM-only for now; when players get a map view, this becomes "if the viewer may see the map",
 * which is independent of which notes embed the file (the rule `vault-asset` follows).
 *
 * Map images can be 15 MB, so the browser revalidates with an ETag and gets a 304 while the file
 * is unchanged; the page's image URL also carries a version, so a re-export shows at once.
 */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  if (context.get(viewerContext).role !== "dm") throw data("Not found", { status: 404 });
  const { config, maps, vault } = context.get(servicesContext);

  const map = await maps.get(params.id);
  const found = map && vault.current.findImage(map.image.path);
  const absolute = found && vaultFile(config.vaultPath, found.path);
  if (!found || !absolute) throw data("Not found", { status: 404 });

  const { size, mtime, mtimeMs } = await stat(absolute);
  const etag = `W/"${Math.floor(mtimeMs).toString(36)}-${size.toString(36)}"`;
  const headers = new Headers({
    "Content-Type": contentType(found.path),
    "Cache-Control": "private, no-cache",
    ETag: etag,
    "Last-Modified": mtime.toUTCString(),
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  });

  if (request.headers.get("If-None-Match") === etag) {
    return new Response(null, { status: 304, headers });
  }
  headers.set("Content-Length", String(size));
  const stream = Readable.toWeb(createReadStream(absolute)) as ReadableStream<Uint8Array>;
  return new Response(stream, { status: 200, headers });
}
