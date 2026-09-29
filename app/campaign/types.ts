/**
 * The shared campaign model: types every module (wiki, maps, characters, combat…) builds on.
 * Isomorphic: safe to import from both server and browser code.
 */

/** Who is looking. Passed explicitly into every visibility decision so real users can slot in later. */
export type Role = "dm" | "player";

export interface Viewer {
  role: Role;
  /**
   * Which player is looking, once players have their own views. A player viewer without one
   * controls nothing, so sees only what's shared with every player.
   */
  playerId?: PlayerId;
}

export const DM_VIEWER: Viewer = { role: "dm" };
export const PLAYER_VIEWER: Viewer = { role: "player" };

/**
 * Identifies a player (a person at the table, not their character). Derived from the name the DM
 * writes in PC notes' `player` frontmatter, so "Sam" and " sam " are the same player.
 */
export type PlayerId = string;

export interface Player {
  id: PlayerId;
  /** As first written, for display. */
  name: string;
}

/** A player from a name as written in frontmatter or typed in; undefined for a blank name. */
export function playerFromName(name: string): Player | undefined {
  const trimmed = name.trim().replace(/\s+/g, " ");
  return trimmed ? { id: trimmed.toLowerCase(), name: trimmed } : undefined;
}

/**
 * Who a piece of campaign content is visible to.
 * - `dm`: only the DM (the default for anything not explicitly shared).
 * - `players`: the DM and all players.
 */
export type Visibility = "dm" | "players";

/**
 * Stable identifier for a campaign entity. For vault notes this is the frontmatter `id` when present,
 * otherwise the vault-relative path without the `.md` extension (e.g. `NPCs/Mira Stonehand`).
 */
export type EntityId = string;

/**
 * Entity types the app knows about. The frontmatter `type` field accepts any string so the vault is
 * never "wrong"; these are the conventional values that future modules will give behaviour to.
 */
export const KNOWN_ENTITY_TYPES = [
  "npc",
  "pc",
  "companion",
  "location",
  "faction",
  "item",
  "session",
  "lore",
  "map",
] as const;

export type KnownEntityType = (typeof KNOWN_ENTITY_TYPES)[number];
