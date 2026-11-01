import { z } from "zod";
import { MOST_OF_A_CARD, MOST_OF_A_LABEL } from "./actions";
import type { BoardCard, BoardString } from "./types";

const id = z.string().min(1).max(100);
const fraction = z.number().min(0).max(1);
const point = z.object({ x: fraction, y: fraction });

// Stored: lenient, since the board is live data. A position out of range is clamped, and a card
// or string that can't be read at all is left out rather than the file refused.
const storedFraction = z
  .number()
  .catch(0)
  .transform((value) => Math.min(Math.max(value, 0), 1));
const storedAuthor = z.union([
  z.object({ dm: z.literal(true) }),
  z.object({ dm: z.literal(false), player: id }),
]);
const storedCard = z.object({ id, x: storedFraction, y: storedFraction }).and(
  z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("next") }),
    z.object({ kind: z.literal("sessions") }),
    z.object({
      kind: z.literal("note"),
      noteId: id,
      caption: z.string().optional().catch(undefined),
      shown: z.boolean().catch(false),
      by: storedAuthor,
    }),
    z.object({
      kind: z.literal("text"),
      text: z.string(),
      shown: z.boolean().catch(false),
      by: storedAuthor,
    }),
  ]),
);
const storedString = z.object({
  id,
  from: id,
  to: id,
  label: z.string().optional().catch(undefined),
  by: storedAuthor,
});

/** Keeps the items that read; drops the rest. */
function readable<T>(schema: z.ZodType<T>) {
  return z
    .array(z.unknown())
    .catch([])
    .transform((items) =>
      items.flatMap((item) => {
        const parsed = schema.safeParse(item);
        return parsed.success ? [parsed.data] : [];
      }),
    );
}

export const boardFileSchema = z.object({
  version: z.literal(1),
  cards: readable<BoardCard>(storedCard as z.ZodType<BoardCard>),
  strings: readable<BoardString>(storedString as z.ZodType<BoardString>),
});
export type BoardFile = z.infer<typeof boardFileSchema>;

/** A browser's changes: strict, and checked again by `applyBoardAction`. */
export const boardActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("place"), id, at: point }),
  z.object({
    type: z.literal("pin"),
    id,
    noteId: id,
    caption: z.string().max(MOST_OF_A_CARD).optional(),
    at: point,
  }),
  z.object({
    type: z.literal("write"),
    id,
    text: z.string().min(1).max(MOST_OF_A_CARD),
    at: point,
  }),
  z.object({ type: z.literal("show"), id, shown: z.boolean() }),
  z.object({ type: z.literal("takeDown"), id }),
  z.object({
    type: z.literal("tie"),
    id,
    from: id,
    to: id,
    label: z.string().max(MOST_OF_A_LABEL).optional(),
  }),
  z.object({ type: z.literal("cut"), id }),
]);

export const boardActionsSchema = z.array(boardActionSchema).min(1).max(20);
