/**
 * Players taking their own tokens between maps: into a deeper map through an area they can see,
 * or back up to the map above. Decided here, on the server, from the explicit Viewer; the browser
 * is only told the ways it may offer.
 */
import type { Services } from "~/context";
import type { EntityId, Viewer } from "~/campaign/types";
import { canView } from "~/campaign/visibility";
import type { Fight } from "~/combat/fight";
import { labelPoint, normalise } from "~/maps/geometry";
import { snapToGrid, toPixels as gridInPixels } from "~/maps/grid/grid";
import type { FogMask } from "~/maps/fog/types";
import { parentLinks } from "~/maps/tree";
import type { TravelWay } from "~/maps/tokens/types";
import type { CampaignMap, MapId, Point } from "~/maps/types";
import { areaSeen, linksSeen } from "./view";

/**
 * Where this viewer may take a token from this map: into each deeper map whose area they see (not
 * secret, at least half revealed) and whose map is shared; and up to the map above, if it's shared
 * and they see the area there that leads here. A hidden map, or one reached only through a hidden
 * area, is simply not a way.
 */
export function travelWays(
  map: CampaignMap,
  maps: readonly CampaignMap[],
  viewer: Viewer,
  fogOf: (id: MapId) => FogMask,
): TravelWay[] {
  if (!canView(viewer, map.visibility)) return [];
  const name = (id: MapId) => maps.find((each) => each.id === id)?.name ?? "";
  const ways: TravelWay[] = linksSeen(map, maps, viewer, fogOf(map.id)).map((link) => ({
    direction: "in",
    map: { id: link.map, name: name(link.map) },
    area: link.area,
  }));
  const parent = parentLinks(maps).get(map.id);
  const above = parent && maps.find((each) => each.id === parent.mapId);
  const area = above?.areas.find((each) => each.id === parent?.areaId);
  if (above && area && canView(viewer, above.visibility)) {
    if (areaSeen(area, viewer, fogOf(above.id))) {
      ways.push({ direction: "up", map: { id: above.id, name: above.name }, area: area.id });
    }
  }
  return ways;
}

/**
 * Why a fight stops this party member travelling, if it does: no one walks into a map with a fight
 * on it, and no one in a fight walks out of it. The DM still moves them as the story needs.
 */
export function fightStopsTravel(
  fight: Fight | undefined,
  from: MapId,
  to: MapId,
  note: EntityId,
): string | undefined {
  if (!fight) return undefined;
  if (fight.map === to) return "There's a fight going on there.";
  const fighting = fight.encounter.combatants.some(
    (each) => each.kind === "player" && each.entityId === note,
  );
  if (fight.map === from && fighting) return "You're in the fight here.";
  return undefined;
}

/**
 * Where a token lands on the map it's taken to. Going up, inside the area it came out of. Going in,
 * beside a party member already there (`beside`, the points the traveller can see), else in the
 * middle. On a battle map that snaps, on a square.
 */
export function travelLanding(
  way: TravelWay,
  target: CampaignMap,
  beside: readonly Point[],
): Point {
  let at: Point;
  if (way.direction === "up") {
    const area = target.areas.find((each) => each.id === way.area);
    const size = { width: target.image.width, height: target.image.height };
    at = area ? normalise(...labelPoint(area.outline, size), size) : [0.5, 0.5];
  } else if (beside.length > 0) {
    // A square to the right on a battle map, else a little way off.
    const step = target.grid ? target.grid.square : 0.04;
    const [x, y] = beside[0];
    at = [x + step <= 1 ? x + step : x - step, y];
  } else {
    at = [0.5, 0.5];
  }
  at = [clamp(at[0]), clamp(at[1])];
  if (!target.grid || target.snapToGrid === false) return at;
  const size = { width: target.image.width, height: target.image.height };
  const pixels = gridInPixels(target.grid, size);
  const [x, y] = snapToGrid(pixels, [at[0] * size.width, at[1] * size.height]);
  return [clamp(x / size.width), clamp(y / size.height)];
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/** `travelWays` with the fog of this map and the one above, as stored now. */
export async function loadTravelWays(
  services: Pick<Services, "fogs">,
  map: CampaignMap,
  maps: readonly CampaignMap[],
  viewer: Viewer,
): Promise<TravelWay[]> {
  const parent = parentLinks(maps).get(map.id);
  const above = parent && maps.find((each) => each.id === parent.mapId);
  const masks = new Map<MapId, FogMask>();
  for (const each of [map, above]) {
    if (each) masks.set(each.id, (await services.fogs.get(each.id, each.image)).mask);
  }
  return travelWays(map, maps, viewer, (id) => masks.get(id) ?? HIDDEN);
}

/** No map without its fog loaded is seen through. */
const HIDDEN: FogMask = { cols: 1, rows: 1, cells: new Uint8Array(1) };
