import type { EntityId, Viewer } from "~/campaign/types";
import { canView } from "~/campaign/visibility";
import { areaRevealed } from "~/maps/fog/coverage";
import { encodeCells } from "~/maps/fog/mask";
import type { FogMask } from "~/maps/fog/types";
import { polygonArea } from "~/maps/geometry";
import { ancestors } from "~/maps/tree";
import type { AreaView, CampaignMap, MapImageView, MapView, NoteLink } from "~/maps/types";
import { mapImageUrl } from "~/maps/urls";
import type { FoundImage } from "../vault/vault";

export interface MapViewInput {
  map: CampaignMap;
  /** Every map, for breadcrumbs and area links. */
  maps: readonly CampaignMap[];
  viewer: Viewer;
  /** Where the map's image was found, with a version that changes when the file does. */
  image: (FoundImage & { version: string }) | undefined;
  /** A note the viewer may see, rendered for them; undefined if it's hidden or missing. */
  note: (id: EntityId) => NoteLink | undefined;
  /** The map's fog of war as stored now. */
  fog: { mask: FogMask; version: number };
}

/**
 * Prepares a map for one viewer. Hidden things are left out rather than marked, so the player view
 * can't tell them from nothing being there:
 *
 * - a map the viewer can't see gives undefined, the same as a map that doesn't exist;
 * - secret areas are dropped, and so are areas less than half revealed through the fog;
 * - links to hidden maps and notes are removed, so the area looks as if it leads nowhere yet;
 * - breadcrumbs start below the innermost hidden ancestor.
 *
 * Only the DM is told about broken links and where the image file is, and gets its URL: players
 * only ever get the parts of the image the fog reveals.
 */
export function mapView({
  map,
  maps,
  viewer,
  image,
  note,
  fog,
}: MapViewInput): MapView | undefined {
  if (!canView(viewer, map.visibility)) return undefined;
  const isDm = viewer.role === "dm";
  const visibleMap = (id: string) => {
    const found = maps.find((candidate) => candidate.id === id);
    return found && canView(viewer, found.visibility) ? found : undefined;
  };

  const chain = ancestors(map.id, maps);
  let shownAncestors = chain;
  chain.forEach((ancestor, index) => {
    if (!canView(viewer, ancestor.visibility)) shownAncestors = chain.slice(index + 1);
  });
  const breadcrumbs = [...shownAncestors, map].map(({ id, name }) => ({ id, name }));

  const areas = map.areas
    .filter(
      (area) => canView(viewer, area.visibility) && (isDm || areaRevealed(fog.mask, area.outline)),
    )
    .sort((a, b) => polygonArea(b.outline) - polygonArea(a.outline))
    .map((area): AreaView => {
      const child = area.map ? visibleMap(area.map) : undefined;
      const linkedNote = area.note ? note(area.note) : undefined;
      const broken: AreaView["broken"] = [];
      if (isDm && area.map && !child) broken.push("map");
      if (isDm && area.note && !linkedNote) broken.push("note");
      return {
        id: area.id,
        name: area.name,
        outline: area.outline,
        ...(child ? { map: { id: child.id, name: child.name } } : {}),
        ...(linkedNote ? { note: linkedNote } : {}),
        broken,
      };
    });

  const mapNote = map.note ? note(map.note) : undefined;
  return {
    id: map.id,
    name: map.name,
    size: { width: map.image.width, height: map.image.height },
    image: imageView(map, image, isDm),
    ...(mapNote ? { note: mapNote } : {}),
    noteBroken: isDm && !!map.note && !mapNote,
    breadcrumbs,
    areas,
    fog: {
      cols: fog.mask.cols,
      rows: fog.mask.rows,
      cells: encodeCells(fog.mask.cells),
      version: fog.version,
    },
    ...(isDm ? { shared: map.visibility === "players" } : {}),
  };
}

function imageView(map: CampaignMap, found: MapViewInput["image"], isDm: boolean): MapImageView {
  if (!found) return { status: "missing", ...(isDm ? { path: map.image.path } : {}) };
  if (!isDm) return { status: "ok" };
  const url = mapImageUrl(map.id, found.version);
  return found.moved
    ? { url, status: "moved", path: map.image.path, movedTo: found.path }
    : { url, status: "ok", path: found.path };
}
