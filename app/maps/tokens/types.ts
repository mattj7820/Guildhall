/**
 * Tokens on maps: where each party member is, and the DM's own markers. Isomorphic: stored and
 * checked by the server, drawn and moved in the browser.
 */
import type { EntityId, Visibility } from "~/campaign/types";
import type { CombatantId } from "~/combat/types";
import type { AreaId, MapId, Point } from "../types";

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
  /** Squares across on a battle map: 1 (Medium or smaller) to 4 (Gargantuan). 1 if not given. */
  size?: TokenSize;
}

export const TOKEN_SIZES = [1, 2, 3, 4] as const;
export type TokenSize = (typeof TOKEN_SIZES)[number];

/** The rules' names for each size, as the DM chooses them. */
export const SIZE_NAMES: Record<TokenSize, string> = {
  1: "Medium",
  2: "Large",
  3: "Huge",
  4: "Gargantuan",
};

/**
 * A party member (a PC or the companion), by their vault note. Each is in one place at a time:
 * on one map, at one point. Who may move it comes from the note, every time.
 */
export interface CharacterToken extends TokenBase {
  kind: "character";
  note: EntityId;
}

/** What a marker shows: its note's picture, a built-in icon, or (if neither) initials. */
export type MarkerPicture = "note" | "icon";

/**
 * The DM's own token: an NPC (linked to their note), a point of interest, a monster left after a
 * fight. DM-only unless the DM shows it. Its name is its own, never read from the note, so a
 * shown NPC can go by another name ("Hooded figure") without the note's title reaching players.
 */
export interface MarkerToken extends TokenBase {
  kind: "marker";
  name: string;
  colour: MarkerColour;
  visibility: Visibility;
  /** The NPC's note, for its picture and the DM's link to it. */
  note?: EntityId;
  picture?: MarkerPicture;
  /** A built-in icon (`TOKEN_ICONS`), drawn when `picture` is "icon". */
  icon?: string;
  /**
   * Off the map but kept, to place again (an innkeeper who's walked off): drawn nowhere and sent
   * to no one, and listed for the DM. `map` is where it was last.
   */
  aside?: true;
}

/**
 * A monster in the fight, by its combatant: its name, size and hit points come from the fight.
 * Placed when it joins the fight on a map, and cleared (or left as a marker) when the fight ends.
 */
export interface CombatantToken extends TokenBase {
  kind: "combatant";
  combatant: CombatantId;
}

export type Token = CharacterToken | MarkerToken | CombatantToken;

/** A token as one viewer may see it, ready to draw. */
export interface TokenView {
  id: TokenId;
  kind: Token["kind"];
  at: Point;
  /** Squares across on a battle map. */
  size: TokenSize;
  name: string;
  /** Party members with a portrait on their sheet. */
  portraitUrl?: string;
  /** Markers. */
  colour?: MarkerColour;
  /** Markers: a built-in icon drawn on the colour, instead of initials. */
  icon?: string;
  /** DM only: a marker's own settings, for its form (what's drawn is above). */
  marker?: Pick<MarkerToken, "note" | "picture" | "icon">;
  /** Whether this viewer may drag it. */
  movable: boolean;
  /** Players: their own token, somewhere still under the fog. */
  inTheDark?: boolean;
  /** DM only: what players can't see of it. */
  hidden?: "secret" | "fog";
  /** DM only: the marker's own visibility, for its form. */
  visibility?: Visibility;
  /** DM only: which party member, for the party panel. (A note's path could name a secret.) */
  note?: EntityId;
  /** The combatant it stands for in the fight: a monster's own, or a party member's. */
  combatant?: CombatantId;
  /** A monster at 0 hit points. */
  down?: boolean;
  /** DM only: a monster's hit points, for its bar. */
  hp?: { current: number; max: number };
}

/** A party member as a badge shows them. */
export interface PartyFace {
  name: string;
  portraitUrl?: string;
}

/**
 * Party members inside an area of a map: on the map it leads to, or on a map inside that. Only
 * those the viewer would see there, through areas and links they can see.
 */
export interface InsideBadge {
  area: AreaId;
  members: PartyFace[];
}

/** A map's tokens, and who's inside its areas, as one viewer may see them. */
export interface MapTokensView {
  tokens: TokenView[];
  inside: InsideBadge[];
}

/** Where a party member is, for the Maps page: on a map the viewer may open, or nowhere known. */
export interface Whereabouts extends PartyFace {
  map?: { id: MapId; name: string };
  /** One of the viewer's own (their PC, or the companion they share). */
  theirs: boolean;
}

/** A note the DM may link an NPC token to, with its picture (DM only: it's served by path). */
export interface NoteChoice {
  id: EntityId;
  slug: string;
  title: string;
  /** `type: npc`, offered first. */
  npc: boolean;
  imageUrl?: string;
}

/** What the DM's Tokens tab needs besides the map's tokens and the party. */
export interface TokenTools {
  notes: NoteChoice[];
  elsewhere: TokenElsewhere[];
  /** Maps to send a token to. */
  otherMaps: { id: MapId; name: string }[];
}

/** For the DM: a marker on another map, or set aside, to bring here. */
export interface TokenElsewhere {
  token: TokenView;
  /** Where it is (or, set aside, where it was last), if that map still exists. */
  map?: { id: MapId; name: string };
  /** Off every map, to place again; otherwise on another map. */
  aside: boolean;
}

/** A party member for the DM's panel, and which map their token is on, if any. */
export interface PartyPlacement {
  note: EntityId;
  name: string;
  portraitUrl?: string;
  on?: { id: MapId; name: string };
}
