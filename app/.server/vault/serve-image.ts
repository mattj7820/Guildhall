import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { vaultFile } from "../maps/load";
import { contentType } from "./media";

/**
 * Streams a vault image that the caller has already decided this viewer may see (by map ID, by
 * character ID…), so the file name never has to appear in a URL. Images can be large, so the
 * browser revalidates with an ETag and gets a 304 while the file is unchanged. Undefined if the
 * file isn't inside the vault.
 */
export async function serveVaultImage(
  request: Request,
  vaultRoot: string,
  vaultPath: string,
): Promise<Response | undefined> {
  const absolute = vaultFile(vaultRoot, vaultPath);
  if (!absolute) return undefined;

  const { size, mtime, mtimeMs } = await stat(absolute);
  const etag = `W/"${Math.floor(mtimeMs).toString(36)}-${size.toString(36)}"`;
  const headers = new Headers({
    "Content-Type": contentType(vaultPath),
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
