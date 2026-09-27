/** What kind of vault attachment a file is, by extension, and the Content-Type to serve it with. */

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  // Obsidian's audio recorder saves .webm on desktop and .m4a on iOS.
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  webm: "audio/webm",
  wav: "audio/wav",
  ogg: "audio/ogg",
  flac: "audio/flac",
  "3gp": "audio/3gpp",
  pdf: "application/pdf",
};

function extension(vaultPath: string): string {
  return /\.([^./]+)$/.exec(vaultPath)?.[1]?.toLowerCase() ?? "";
}

export function contentType(vaultPath: string): string {
  return CONTENT_TYPES[extension(vaultPath)] ?? "application/octet-stream";
}

export type MediaKind = "image" | "audio" | "other";

export function mediaKind(vaultPath: string): MediaKind {
  const type = contentType(vaultPath);
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("audio/")) return "audio";
  return "other";
}

/**
 * Whether a file can be a map: a raster image. SVGs are left out, since they have no reliable
 * pixel size to draw areas against.
 */
export function isMapImage(vaultPath: string): boolean {
  return mediaKind(vaultPath) === "image" && extension(vaultPath) !== "svg";
}
