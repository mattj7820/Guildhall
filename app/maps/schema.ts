/** zod schemas for map data that crosses a trust boundary: the data file and requests. */
import { z } from "zod";
import type { Visibility } from "~/campaign/types";
import type { MapGrid } from "./grid/grid";
import type { Area, CampaignMap, MapChanges, MapImage } from "./types";

export const MAP_NAME_MAX = 100;
export const AREA_NAME_MAX = 100;
export const OUTLINE_MIN = 3;
export const OUTLINE_MAX = 500;
export const AREAS_MAX = 500;
const IMAGE_SIDE_MAX = 100_000;

/** Missing or unrecognised visibility fails closed to DM-only, as it does for notes. */
const visibility: z.ZodType<Visibility> = z.enum(["dm", "players"]).catch("dm");

const coordinate = z.number().min(0).max(1);
const entityId = z.string().trim().min(1);

export const mapImageSchema: z.ZodType<MapImage> = z.object({
  path: z.string().trim().min(1).max(1024),
  width: z.number().int().positive().max(IMAGE_SIDE_MAX),
  height: z.number().int().positive().max(IMAGE_SIDE_MAX),
});

export const areaSchema: z.ZodType<Area> = z.object({
  id: z.string().min(1),
  name: z.string().max(AREA_NAME_MAX),
  outline: z
    .array(z.tuple([coordinate, coordinate]))
    .min(OUTLINE_MIN)
    .max(OUTLINE_MAX),
  map: z.string().min(1).optional(),
  note: entityId.optional(),
  visibility,
});

const areas = z
  .array(areaSchema)
  .max(AREAS_MAX)
  .refine((list) => new Set(list.map((area) => area.id)).size === list.length, {
    message: "Two areas have the same ID",
  });

export const gridSchema: z.ZodType<MapGrid> = z.object({
  square: z.number().positive().max(1),
  origin: z.tuple([coordinate, coordinate]),
  lines: z.number().min(0).max(1),
});

export const campaignMapSchema: z.ZodType<CampaignMap> = z.object({
  id: z.string().min(1),
  name: z.string().max(MAP_NAME_MAX),
  image: mapImageSchema,
  note: entityId.optional(),
  visibility,
  areas,
  grid: gridSchema.optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

/** The editor's save body. */
export const mapChangesSchema: z.ZodType<MapChanges> = z.object({
  name: z.string().max(MAP_NAME_MAX),
  note: entityId.optional(),
  areas,
  grid: gridSchema.optional(),
});
