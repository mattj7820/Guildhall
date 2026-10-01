/**
 * What travels over the live connection. Isomorphic: the browser sends `ClientMessage`s, and the
 * server sends `ServerMessage`s, each one built on the server for the viewer who gets it.
 */
import { z } from "zod";
import type { FightView } from "~/combat/fight";
import type { MapTokensView, TokenId } from "~/maps/tokens/types";
import type { MapId, Point } from "~/maps/types";

/** Where browsers open their live connection. */
export const LIVE_PATH = "/live";

/** The room for the fight the table is in (rooms are otherwise maps, by ID). */
export const FIGHT_ROOM = "fight";

const mapId = z.string().min(1).max(100);
const tokenId = z.string().min(1).max(100);
const coordinate = z.number().min(0).max(1);

export const clientMessageSchema = z.discriminatedUnion("type", [
  /** Hear about a map while it's open. */
  z.object({ type: z.literal("watch"), map: mapId }),
  z.object({ type: z.literal("unwatch"), map: mapId }),
  /**
   * A token being dragged, a few times a second: shown to the others as it moves, never saved.
   * The move itself is saved when it's let go, through the tokens endpoint.
   */
  z.object({
    type: z.literal("drag"),
    map: mapId,
    token: tokenId,
    at: z.tuple([coordinate, coordinate]),
  }),
  /** Let go, or put back: anyone may pick it up now. */
  z.object({ type: z.literal("release"), map: mapId, token: tokenId }),
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;

export type ServerMessage =
  /** The map as this viewer sees it may have changed: reload its data if the version differs. */
  | { type: "map"; map: MapId; version: string }
  /** The map is missing, or no longer visible to this viewer: the same either way. */
  | { type: "gone"; map: MapId }
  /** The map's tokens and who's inside its areas, as this viewer may see them, when that changes. */
  | ({ type: "tokens"; map: MapId } & MapTokensView)
  /** Someone is dragging a token this viewer can see, there. */
  | { type: "moving"; map: MapId; token: TokenId; at: Point; by: string }
  /** The token this viewer picked up is someone else's to move just now. */
  | { type: "held"; map: MapId; token: TokenId; by: string }
  /** The fight as this viewer may see it, or none, whenever that changes. */
  | { type: "fight"; map: typeof FIGHT_ROOM; fight: FightView | null };

/**
 * Messages that say how something is now, rather than that something happened. Only the latest
 * matters, so one that's the same as the last sent under its key isn't sent again: a player never
 * hears that something changed when nothing they can see did.
 */
export function stateKey(message: ServerMessage): string | undefined {
  switch (message.type) {
    case "map":
    case "gone":
      return `map:${message.map}`;
    case "tokens":
      return `tokens:${message.map}`;
    case "fight":
      return "fight";
    default:
      return undefined;
  }
}

/** Closing codes of our own (4000–4999 are for applications). */
export const CLOSE_ACCESS_CHANGED = 4000;
