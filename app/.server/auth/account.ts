import { DM_VIEWER, PLAYER_VIEWER, type Viewer } from "~/campaign/types";
import type { Member } from "~/members/types";
import type { SessionData } from "./sessions";

/** Who is making a request, as far as signing in goes. */
export type Account =
  | { kind: "anonymous" }
  /** Signed in with Discord, but the DM hasn't let them in yet. */
  | { kind: "waiting"; member: Member }
  | { kind: "member"; member: Member; isDm: boolean };

export const ANONYMOUS: Account = { kind: "anonymous" };

/**
 * Decides who a session belongs to. Everything is checked against the current member list and
 * DM settings, not trusted from the cookie: a removed member, or a cookie from before their
 * session key changed, is simply anonymous.
 */
export function resolveAccount(
  session: Partial<SessionData>,
  member: Member | undefined,
  dmDiscordIds: ReadonlySet<string>,
): Account {
  if (!session.discordId || !member || member.discordId !== session.discordId) return ANONYMOUS;
  if (!session.sessionKey || member.sessionKey !== session.sessionKey) return ANONYMOUS;
  const isDm = dmDiscordIds.has(member.discordId);
  if (!isDm && member.status !== "approved") return { kind: "waiting", member };
  return { kind: "member", member, isDm };
}

/**
 * What a member may see. The DM can preview the players' view; for anyone else the preview
 * setting means nothing. Undefined for anyone not let in.
 */
export function viewerFor(account: Account, previewAsPlayer: boolean): Viewer | undefined {
  if (account.kind !== "member") return undefined;
  if (account.isDm) return previewAsPlayer ? PLAYER_VIEWER : DM_VIEWER;
  return account.member.playerId
    ? { role: "player", playerId: account.member.playerId }
    : PLAYER_VIEWER;
}
