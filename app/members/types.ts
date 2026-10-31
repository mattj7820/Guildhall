/**
 * The people who can sign in to Guildhall. Isomorphic: stored by the server, shown to the DM on
 * the Members page.
 */
import type { PlayerId } from "~/campaign/types";
import type { Theme } from "~/theme/themes";

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
  /** Their 3D dice. Without it, their rolls are thrown as dice in the theme's colours. */
  dice?: MemberDice;
}

export interface MemberDice {
  /** They'd rather see rolls only as text. */
  off?: boolean;
  /** Their dice make no sound. */
  quiet?: boolean;
  /** The dice sets the DM has given them (`DiceSetId`s; any no longer in the app are ignored). */
  given?: string[];
  /** The set they use; without one (or once it's taken back), the theme's dice. */
  set?: string;
}

/** Who someone is on Discord, as read when they sign in. */
export interface DiscordProfile {
  discordId: DiscordId;
  username: string;
  name: string;
}
