import type { EntityId, Viewer } from "~/campaign/types";
import { canView } from "~/campaign/visibility";
import { areaRevealed } from "~/maps/fog/coverage";
import { encodeCells } from "~/maps/fog/mask";
import { tileStates, TILE_OVERLAP } from "~/maps/fog/tiles";
import type { FogMask } from "~/maps/fog/types";
import { polygonArea } from "~/maps/geometry";
import { ancestors } from "~/maps/tree";
import type { AreaView, CampaignMap, MapImageView, MapView, NoteLink, Size } from "~/maps/types";
import { mapImageUrl, mapTileUrl } from "~/maps/urls";
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
  /**
   * Players only: the image's real size, the tile size, and the fog's cell opacities
   * (`cellAlpha`), for listing the tiles they may have.
   */
  tiles?: { image: Size; size: number; alpha: Uint8Array };
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
  tiles,
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
        ...(isDm && area.visibility === "dm" ? { secret: true } : {}),
      };
    });

  const mapNote = map.note ? note(map.note) : undefined;
  return {
    id: map.id,
    name: map.name,
    size: { width: map.image.width, height: map.image.height },
    image: isDm ? dmImageView(map, image) : playerImageView(map, image, fog.mask, tiles),
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

/** Players get only the tiles the fog lets them have, never the whole image or its file name. */
function playerImageView(
  map: CampaignMap,
  found: MapViewInput["image"],
  mask: FogMask,
  tiles: MapViewInput["tiles"],
): MapImageView {
  if (!found || !tiles) return { status: found ? "ok" : "missing" };
  return {
    status: "ok",
    tiles: {
      ...tiles.image,
      size: tiles.size,
      overlap: TILE_OVERLAP,
      tiles: tileStates(mask, tiles.alpha, tiles.image, tiles.size).map(({ x, y, key }) => ({
        x,
        y,
        url: mapTileUrl(map.id, x, y, `${found.version}.${key}`),
      })),
    },
  };
}

function dmImageView(map: CampaignMap, found: MapViewInput["image"]): MapImageView {
  if (!found) return { status: "missing", path: map.image.path };
  const url = mapImageUrl(map.id, found.version);
  return found.moved
    ? { url, status: "moved", path: map.image.path, movedTo: found.path }
    : { url, status: "ok", path: found.path };
}
