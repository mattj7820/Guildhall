/** zod schemas for tokens crossing a trust boundary: the data file and requests. */
import { z } from "zod";
import type { Visibility } from "~/campaign/types";
import type { TokenAction } from "./actions";
import { MARKER_COLOURS, TOKEN_SIZES, type Token } from "./types";

export const MARKER_NAME_MAX = 60;
/** Enough for every party member and plenty of markers on every map. */
export const TOKENS_MAX = 2000;
export const ACTIONS_MAX = 50;

/** Missing or unrecognised visibility fails closed to DM-only, as for notes and maps. */
const visibility: z.ZodType<Visibility> = z.enum(["dm", "players"]).catch("dm");
const id = z.string().min(1).max(100);
const coordinate = z.number().min(0).max(1);
const point = z.tuple([coordinate, coordinate]);
const markerName = z.string().trim().min(1).max(MARKER_NAME_MAX);
const colour = z.enum(MARKER_COLOURS);
const size = z.union(TOKEN_SIZES.map((each) => z.literal(each)));

export const tokenSchema: z.ZodType<Token> = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("character"),
    id,
    map: id,
    at: point,
    size: size.optional(),
    note: z.string().min(1),
  }),
  z.object({
    kind: z.literal("marker"),
    id,
    map: id,
    at: point,
    size: size.optional(),
    name: markerName,
    colour,
    visibility,
  }),
  z.object({
    kind: z.literal("combatant"),
    id,
    map: id,
    at: point,
    size: size.optional(),
    combatant: id,
  }),
]);

export const tokensSchema = z
  .array(tokenSchema)
  .max(TOKENS_MAX)
  .refine((tokens) => new Set(tokens.map((token) => token.id)).size === tokens.length, {
    message: "Two tokens share an ID",
  })
  .refine(
    (tokens) => {
      const notes = tokens.flatMap((token) => (token.kind === "character" ? [token.note] : []));
      return new Set(notes).size === notes.length;
    },
    { message: "A character is in two places" },
  );

export const tokenActionSchema: z.ZodType<TokenAction> = z.discriminatedUnion("type", [
  z.object({ type: z.literal("place"), token: tokenSchema }),
  z.object({
    type: z.literal("move"),
    id,
    to: point,
    from: point.optional(),
    map: id.optional(),
  }),
  z.object({ type: z.literal("remove"), id }),
  z.object({ type: z.literal("setSize"), id, size }),
  z.object({
    type: z.literal("editMarker"),
    id,
    name: markerName.optional(),
    colour: colour.optional(),
    visibility: z.enum(["dm", "players"]).optional(),
  }),
]);

export const tokenActionsSchema = z.array(tokenActionSchema).min(1).max(ACTIONS_MAX);
