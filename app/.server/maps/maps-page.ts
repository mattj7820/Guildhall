import type { Viewer } from "~/campaign/types";
import { canView } from "~/campaign/visibility";
import type { Services } from "~/context";
import { revealedCount } from "~/maps/fog/mask";
import { labelPoint } from "~/maps/geometry";
import { ancestors } from "~/maps/tree";
import type { PartyFace, Whereabouts } from "~/maps/tokens/types";
import type { CampaignMap, ListedMap, MapId } from "~/maps/types";
import { mapThumbnailUrl, thumbnailVersion } from "~/maps/urls";
import { mapSource } from "./load";
import { linksSeen } from "./view";

/** Pins sit where an area's name would: its label point, as a fraction of the image. */
const FRACTIONS = { width: 1, height: 1 };

/**
 * The maps the viewer may see, for the Maps page: every map for the DM; for players, shared maps,
 * with thumbnails of what they've seen and pins only on the areas they see.
 */
export async function listMaps(
  services: Pick<Services, "config" | "vault" | "maps" | "fogs">,
  viewer: Viewer,
): Promise<ListedMap[]> {
  const all = await services.maps.list();
  const isDm = viewer.role === "dm";
  const visible = all.filter((map) => canView(viewer, map.visibility));
  const shown = new Set(visible.map((map) => map.id));
  const fogs = await services.fogs.getMany(visible);
  return Promise.all(
    visible.map(async (map): Promise<ListedMap> => {
      const source = await mapSource(services, map);
      const fog = fogs.get(map.id)!;
      const pinFor = (area: CampaignMap["areas"][number]) => ({
        map: area.map!,
        at: labelPoint(area.outline, FRACTIONS),
      });
      const listed = {
        id: map.id,
        name: map.name,
        size: { width: map.image.width, height: map.image.height },
      };
      if (isDm) {
        return {
          ...listed,
          areas: map.areas.map(({ id, name, map: child }) => ({ id, name, map: child })),
          thumbnail: source && mapThumbnailUrl(map.id, thumbnailVersion(source.version)),
          pins: map.areas.filter((area) => area.map).map(pinFor),
          shared: map.visibility === "players",
          imageMissing: !source,
        };
      }
      const seen = new Set(linksSeen(map, all, viewer, fog.mask).map((link) => link.area));
      const anythingSeen = revealedCount(fog.mask) > 0;
      return {
        ...listed,
        // Area names and outlines stay on the server: only the links between shared maps.
        areas: map.areas.flatMap((area) =>
          area.map && shown.has(area.map) ? [{ id: area.id, name: "", map: area.map }] : [],
        ),
        thumbnail:
          source && anythingSeen
            ? mapThumbnailUrl(map.id, thumbnailVersion(source.version, fog.version))
            : undefined,
        pins: map.areas.filter((area) => seen.has(area.id)).map(pinFor),
      };
    }),
  );
}

/** Who's on each map, or on a map inside it, from where the viewer may see they are. */
export function facesByMap(
  party: readonly Whereabouts[],
  maps: readonly ListedMap[],
): Record<MapId, PartyFace[]> {
  const faces: Record<MapId, PartyFace[]> = {};
  for (const { name, portraitUrl, map } of party) {
    if (!map || !maps.some((each) => each.id === map.id)) continue;
    const face = { name, ...(portraitUrl && { portraitUrl }) };
    for (const on of [map.id, ...ancestors(map.id, maps).map((each) => each.id)]) {
      (faces[on] ??= []).push(face);
    }
  }
  return faces;
}
