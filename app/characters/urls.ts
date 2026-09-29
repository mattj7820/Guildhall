import type { CharacterId } from "./types";

export const CHARACTERS_URL = "/characters";

export const characterUrl = (id: CharacterId) => `/characters/${encodeURIComponent(id)}`;

/** Where an open sheet saves its changes, and polls for others'. */
export const changesUrl = (id: CharacterId) => `${characterUrl(id)}/changes`;

/** Where a sheet sends gifts to another party member's bag. */
export const giveUrl = (id: CharacterId) => `${characterUrl(id)}/give`;

/**
 * A character's portrait. The version changes when the image does, so a new portrait shows at
 * once; it's a hash rather than the file's path, which stays out of URLs.
 */
export const portraitUrl = (id: CharacterId, imagePath: string) =>
  `${characterUrl(id)}/portrait?v=${shortHash(imagePath)}`;

/** FNV-1a, for cache-busting only. */
function shortHash(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}
