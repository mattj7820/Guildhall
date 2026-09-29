/** zod schemas for fog changes, which cross a trust boundary: the DM's requests. */
import { z } from "zod";
import { OUTLINE_MAX, OUTLINE_MIN } from "../schema";
import type { Point } from "../types";
import { LONG_SIDE_CELLS } from "./mask";
import type { FogChange, FogShape } from "./types";

/** Brush sizes as a share of the image's longer side. */
export const BRUSH_MIN = 0.001;
export const BRUSH_MAX = 0.5;
/** A long drag at one point per cell; strokes are sent when the pointer is released. */
export const STROKE_POINTS_MAX = 4000;
/** Changes sent in one request. */
export const FOG_BATCH_MAX = 100;
/** The most ranges a change can need: every other cell (a checkerboard), as start and length. */
const RANGES_MAX = LONG_SIDE_CELLS * LONG_SIDE_CELLS;

const coordinate = z.number().min(0).max(1);
const point: z.ZodType<Point> = z.tuple([coordinate, coordinate]);
const cellIndex = z.number().int().nonnegative();

const shape: z.ZodType<FogShape> = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("stroke"),
    points: z.array(point).min(1).max(STROKE_POINTS_MAX),
    radius: z.number().min(BRUSH_MIN).max(BRUSH_MAX),
  }),
  z.object({
    kind: z.literal("polygon"),
    points: z.array(point).min(OUTLINE_MIN).max(OUTLINE_MAX),
  }),
  z.object({ kind: z.literal("all") }),
]);

const mode = z.enum(["reveal", "hide"]);

export const fogChangeSchema: z.ZodType<FogChange> = z.discriminatedUnion("type", [
  z.object({ type: z.literal("paint"), mode, shape }),
  z.object({
    type: z.literal("cells"),
    mode,
    ranges: z
      .array(cellIndex)
      .max(RANGES_MAX)
      .refine((ranges) => ranges.length % 2 === 0, { message: "Ranges come in pairs" }),
  }),
]);

export const fogChangesSchema = z.array(fogChangeSchema).min(1).max(FOG_BATCH_MAX);
