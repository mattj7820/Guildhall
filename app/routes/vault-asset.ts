import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { data } from "react-router";
import { servicesContext, viewerContext } from "~/context";
import type { Route } from "./+types/vault-asset";

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
};

/**
 * Streams an attachment (image, PDF…) from the vault. Read-only, and only files the vault index
 * already knows about can be served, which rules out path traversal by construction; the
 * containment check below is a second line of defence.
 */
export async function loader({ params, context }: Route.LoaderArgs) {
  const { config, vault } = context.get(servicesContext);
  const vaultPath = vault.current.getAsset(params["*"] ?? "", context.get(viewerContext));
  if (!vaultPath) throw data("Not found", { status: 404 });

  const absolute = path.resolve(config.vaultPath, vaultPath);
  if (!absolute.startsWith(config.vaultPath + path.sep)) throw data("Not found", { status: 404 });

  const stats = await stat(absolute);
  const stream = Readable.toWeb(createReadStream(absolute)) as ReadableStream<Uint8Array>;
  return new Response(stream, {
    headers: {
      "Content-Type":
        CONTENT_TYPES[path.extname(absolute).toLowerCase()] ?? "application/octet-stream",
      "Content-Length": String(stats.size),
      "Cache-Control": "private, max-age=60",
      "X-Content-Type-Options": "nosniff",
      // SVGs can carry scripts; never let a vault file run code in the app's origin.
      "Content-Security-Policy":
        "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
