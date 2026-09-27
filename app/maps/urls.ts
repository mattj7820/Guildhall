/** In-app URLs for maps. Isomorphic, so server rendering and client components agree. */
import type { AreaId, MapId } from "./types";

export function mapUrl(id: MapId): string {
  return `/maps/${encodeURIComponent(id)}`;
}

/** The editor, optionally with an area already selected (e.g. to attach a map to it). */
export function mapEditUrl(id: MapId, areaId?: AreaId): string {
  return `${mapUrl(id)}/edit${areaId ? `?area=${encodeURIComponent(areaId)}` : ""}`;
}

/** The map's image. The version changes when the file does, so a re-export shows at once. */
export function mapImageUrl(id: MapId, version: string): string {
  return `${mapUrl(id)}/image?v=${encodeURIComponent(version)}`;
}
