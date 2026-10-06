import { shortHash } from "~/shared/short-hash";
import type { CharacterId } from "./types";

export const CHARACTERS_URL = "/characters";

export const characterUrl = (id: CharacterId) => `/characters/${encodeURIComponent(id)}`;

/** Where an open sheet saves its changes, and polls for others'. */
export const changesUrl = (id: CharacterId) => `${characterUrl(id)}/changes`;

/** A sheet's page data as JSON, for opening it beside the map. */
export const sheetDataUrl = (id: CharacterId) => `${characterUrl(id)}/sheet`;

/** Where a sheet sends gifts to another party member's bag. */
export const giveUrl = (id: CharacterId) => `${characterUrl(id)}/give`;

/**
 * A character's portrait. The version changes when the image does, so a new portrait shows at
 * once; it's a hash rather than the file's path, which stays out of URLs.
 */
export const portraitUrl = (id: CharacterId, imagePath: string) =>
  `${characterUrl(id)}/portrait?v=${shortHash(imagePath)}`;
