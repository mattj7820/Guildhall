/**
 * The people who can sign in to Guildhall. Isomorphic: stored by the server, shown to the DM on
 * the Members page.
 */
import type { PlayerId } from "~/campaign/types";
import type { Theme } from "~/theme/themes";
import type { WikiLook } from "~/wiki/looks";

/** A Discord user's ID ("snowflake"): a long number, kept as a string. */
export type DiscordId = string;

export interface Member {
  discordId: DiscordId;
  /** Discord's display name, falling back to the username. Refreshed at each sign-in. */
  name: string;
  username: string;
  /** Newcomers wait for the DM to let them in. */
  status: "pending" | "approved";
  /** Which player they are, linking them to their PC notes (`player:` in frontmatter). */
  playerId?: PlayerId;
  /**
   * Random, and part of every session cookie. A new key signs the member out everywhere, and a
   * removed member who comes back gets a new one, so their old cookies never work again.
   */
  sessionKey: string;
  requestedAt: string;
  approvedAt?: string;
  lastSignInAt: string;
  /** The look they picked; without one, Guildhall follows their device's light or dark mode. */
  theme?: Theme;
  /** How they read the wiki; without one, it's plain pages. */
  wikiLook?: WikiLook;
  /** Their 3D dice settings. The dice themselves are in `dice.json` (`DiceCollections`). */
  dice?: MemberDice;
}

export interface MemberDice {
  /** They'd rather see rolls only as text. */
  off?: boolean;
  /** Their dice make no sound. */
  quiet?: boolean;
  /**
   * Dice sets the DM gave before packs (style IDs): each counts as a full kit of that style, kept
   * for good. Nothing writes it any more.
   */
  given?: string[];
  /** The set they picked before packs: their favourite for each type they haven't chosen one for. */
  set?: string;
}

/** Who someone is on Discord, as read when they sign in. */
export interface DiscordProfile {
  discordId: DiscordId;
  username: string;
  name: string;
}
