/** In-app URLs for maps. Isomorphic, so server rendering and client components agree. */
import { shortHash } from "~/shared/short-hash";
import type { TokenId } from "./tokens/types";
import type { AreaId, MapId } from "./types";

export function mapUrl(id: MapId): string {
  return `/maps/${encodeURIComponent(id)}`;
}

/** The editor, optionally with an area already selected (e.g. to attach a map to it). */
export function mapEditUrl(id: MapId, areaId?: AreaId): string {
  return `${mapUrl(id)}/edit${areaId ? `?area=${encodeURIComponent(areaId)}` : ""}`;
}

/**
 * One tile of the map's image as players may see it. The version names the image file's version
 * and the fog around the tile, so it changes exactly when the tile does.
 */
export function mapTileUrl(id: MapId, x: number, y: number, version: string): string {
  return `${mapUrl(id)}/tiles/${x}/${y}?v=${encodeURIComponent(version)}`;
}

/** Where the DM's fog tools save. */
export function mapFogUrl(id: MapId): string {
  return `${mapUrl(id)}/fog`;
}

/** The map's image. The version changes when the file does, so a re-export shows at once. */
export function mapImageUrl(id: MapId, version: string): string {
  return `${mapUrl(id)}/image?v=${encodeURIComponent(version)}`;
}

/** What an open map polls to learn whether anything about it has changed. */
export function mapVersionUrl(id: MapId): string {
  return `${mapUrl(id)}/version`;
}

/** Where token changes are sent, as JSON. */
export function mapTokensUrl(id: MapId): string {
  return `${mapUrl(id)}/tokens`;
}

/**
 * An NPC token's picture, by the token, never by the image's path or the note. The version is a
 * hash of both, so it changes with the picture but can't match two tokens showing the same one.
 */
export function tokenPictureUrl(map: MapId, token: TokenId, imagePath: string): string {
  const version = shortHash(`${token}/${imagePath}`);
  return `${mapTokensUrl(map)}/${encodeURIComponent(token)}/picture?v=${version}`;
}

/** A sound from the DM's sound board, by its path inside the sounds folder. */
export function soundUrl(sound: string): string {
  return `/sounds/${sound.split("/").map(encodeURIComponent).join("/")}`;
}

/** Where the DM plays a stunt on a map, as JSON. */
export function mapStuntsUrl(id: MapId): string {
  return `${mapUrl(id)}/stunts`;
}
