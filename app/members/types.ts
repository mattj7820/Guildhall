/**
 * The people who can sign in to Guildhall. Isomorphic: stored by the server, shown to the DM on
 * the Members page.
 */
import type { PlayerId } from "~/campaign/types";

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
}

/** Who someone is on Discord, as read when they sign in. */
export interface DiscordProfile {
  discordId: DiscordId;
  username: string;
  name: string;
}
