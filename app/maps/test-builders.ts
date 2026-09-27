/** Builders for map tests: each test states only the fields it depends on. */
import type { Area, CampaignMap, Point } from "./types";

export const SQUARE: Point[] = [
  [0.1, 0.1],
  [0.3, 0.1],
  [0.3, 0.3],
  [0.1, 0.3],
];

export function buildArea(fields: Partial<Area> & Pick<Area, "id">): Area {
  return { name: fields.id, outline: SQUARE, visibility: "dm", ...fields };
}

export function buildMap(fields: Partial<CampaignMap> & Pick<CampaignMap, "id">): CampaignMap {
  return {
    name: fields.id,
    image: { path: "Maps/Fixture World.png", width: 400, height: 200 },
    visibility: "dm",
    areas: [],
    createdAt: "2026-09-27T10:00:00.000Z",
    updatedAt: "2026-09-27T10:00:00.000Z",
    ...fields,
  };
}

/** An area on `from` leading to the map `to`. */
export function link(to: string, id = `to-${to}`): Area {
  return buildArea({ id, name: `Area to ${to}`, map: to });
}
