/**
 * Tokens on maps: where each party member is, and the DM's own markers. Isomorphic: stored and
 * checked by the server, drawn and moved in the browser.
 */
import type { EntityId, Visibility } from "~/campaign/types";
import type { MapId, Point } from "../types";

export type TokenId = string;

export const MARKER_COLOURS = [
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "purple",
  "grey",
] as const;
export type MarkerColour = (typeof MARKER_COLOURS)[number];

interface TokenBase {
  id: TokenId;
  map: MapId;
  /** Its centre, in fractions of the image, like outlines. */
  at: Point;
}

/**
 * A party member (a PC or the companion), by their vault note. Each is in one place at a time:
 * on one map, at one point. Who may move it comes from the note, every time.
 */
export interface CharacterToken extends TokenBase {
  kind: "character";
  note: EntityId;
}

/** The DM's own marker: an NPC, a point of interest. DM-only unless the DM shows it. */
export interface MarkerToken extends TokenBase {
  kind: "marker";
  name: string;
  colour: MarkerColour;
  visibility: Visibility;
}

export type Token = CharacterToken | MarkerToken;

/** A token as one viewer may see it, ready to draw. */
export interface TokenView {
  id: TokenId;
  kind: Token["kind"];
  at: Point;
  name: string;
  /** Party members with a portrait on their sheet. */
  portraitUrl?: string;
  /** Markers. */
  colour?: MarkerColour;
  /** Whether this viewer may drag it. */
  movable: boolean;
  /** Players: their own token, somewhere still under the fog. */
  inTheDark?: boolean;
  /** DM only: what players can't see of it. */
  hidden?: "secret" | "fog";
  /** DM only: the marker's own visibility, for its form. */
  visibility?: Visibility;
}
