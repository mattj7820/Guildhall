/**
 * In-app URLs for vault content. Isomorphic, so server rendering and client components agree.
 * Each path segment is encoded so names with spaces, `#` or `?` survive.
 */
const encodePath = (vaultPath: string) => vaultPath.split("/").map(encodeURIComponent).join("/");

/** URL of a note page, e.g. `/wiki/NPCs/Mira%20Stonehand#background`. */
export function noteUrl(slug: string, headingId?: string): string {
  return `/wiki/${encodePath(slug)}${headingId ? `#${headingId}` : ""}`;
}

/** URL the asset route serves a vault attachment from. */
export function assetUrl(vaultPath: string): string {
  return `/vault-asset/${encodePath(vaultPath)}`;
}
