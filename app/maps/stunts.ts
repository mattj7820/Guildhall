/**
 * Stunts: brief effects the DM plays on a map for a moment at the table (an impact, a flash, a
 * token wobbling), and sounds from the sound board. Sent to everyone watching the map, built for
 * each viewer on the server. Nothing is kept. Isomorphic.
 */
import { z } from "zod";
import type { Viewer } from "~/campaign/types";
import type { TokenId } from "./tokens/types";
import type { Point } from "./types";

/** Played at a point on the map: anywhere, or a token's. */
export const POINT_STUNTS = ["impact", "flash", "smoke"] as const;
/** Played by a token itself. */
export const TOKEN_STUNTS = ["wobble", "glow", "fall"] as const;

export type PointStuntKind = (typeof POINT_STUNTS)[number];
export type TokenStuntKind = (typeof TOKEN_STUNTS)[number];

export type Stunt =
  /** `at` and `size` (its radius) as fractions of the map's width and height, like outlines. */
  | { kind: PointStuntKind; at: Point; size: number }
  /** A glow lights the map round the token, `light` being the light's radius (of the width). */
  | { kind: TokenStuntKind; token: TokenId; light?: number }
  /** The map jolts, or the DM stands fallen tokens back up. */
  | { kind: "shake" | "stand" }
  /** A sound from the board, by its path inside the sounds folder. */
  | { kind: "sound"; sound: string };

/** A stunt as sent: with an ID, so the tab that played it doesn't play it twice. */
export type StuntEvent = Stunt & { id: string };

const fraction = z.number().min(0).max(1);
const id = z.string().min(1).max(100);

export const stuntEventSchema: z.ZodType<StuntEvent> = z.discriminatedUnion("kind", [
  z.object({ id, kind: z.enum(POINT_STUNTS), at: z.tuple([fraction, fraction]), size: fraction }),
  z.object({ id, kind: z.enum(TOKEN_STUNTS), token: id, light: fraction.optional() }),
  z.object({ id, kind: z.enum(["shake", "stand"]) }),
  z.object({ id, kind: z.literal("sound"), sound: z.string().min(1).max(500) }),
]);

export const isTokenStunt = (stunt: Stunt): stunt is Extract<Stunt, { token: TokenId }> =>
  "token" in stunt;

/**
 * Whether a viewer sees a stunt. The DM chose to play it, so players see it wherever it is, fog
 * or not (it shows nothing of the map beneath); but a token's stunt only if they can see the
 * token, so it never gives away a hidden monster.
 */
export function stuntSeenBy(
  stunt: Stunt,
  viewer: Viewer,
  canSeeToken: (token: TokenId) => boolean,
): boolean {
  if (viewer.role === "dm" || !isTokenStunt(stunt)) return true;
  return canSeeToken(stunt.token);
}
