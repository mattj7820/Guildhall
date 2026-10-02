import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { data } from "react-router";
import { parseByteRange } from "~/.server/http-range";
import { contentType } from "./media";

/**
 * Streams a vault file the caller has already allowed, with range support so audio can be
 * streamed and seeked. `vaultPath` must come from the vault's own index, which rules out path
 * traversal by construction; the containment check is a second line of defence.
 */
export async function streamVaultFile(
  request: Request,
  vaultRoot: string,
  vaultPath: string,
): Promise<Response> {
  const absolute = path.resolve(vaultRoot, vaultPath);
  if (!absolute.startsWith(vaultRoot + path.sep)) throw data("Not found", { status: 404 });

  const { size } = await stat(absolute);
  const headers = new Headers({
    "Content-Type": contentType(vaultPath),
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=60",
    "X-Content-Type-Options": "nosniff",
    // SVGs can carry scripts; never let a vault file run code in the app's origin.
    "Content-Security-Policy":
      "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
  });

  const range = parseByteRange(request.headers.get("Range"), size);
  if (range === "unsatisfiable") {
    headers.set("Content-Range", `bytes */${size}`);
    return new Response(null, { status: 416, headers });
  }

  const { start, end } = range ?? { start: 0, end: size - 1 };
  headers.set("Content-Length", String(size === 0 ? 0 : end - start + 1));
  if (range) headers.set("Content-Range", `bytes ${start}-${end}/${size}`);

  const stream = size === 0 ? null : createReadStream(absolute, { start, end });
  return new Response(stream && (Readable.toWeb(stream) as ReadableStream<Uint8Array>), {
    status: range ? 206 : 200,
    headers,
  });
}
