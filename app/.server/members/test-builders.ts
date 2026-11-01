import type { Member } from "~/members/types";
import type { Account } from "../auth/account";

/** An approved member for tests; IDs are 18 digits, like Discord's. */
export function aMember(n: number, changes: Partial<Member> = {}): Member {
  return {
    discordId: `1${String(n).padStart(17, "0")}`,
    name: `Member ${n}`,
    username: `member${n}`,
    status: "approved",
    sessionKey: `session-key-for-member-${n}`,
    requestedAt: "2026-10-31T19:00:00.000Z",
    approvedAt: "2026-10-31T19:00:00.000Z",
    lastSignInAt: "2026-10-31T19:00:00.000Z",
    ...changes,
  };
}

/** Signed in as this member (the DM with `isDm`). */
export const signedInAs = (member: Member, isDm = false): Account => ({
  kind: "member",
  member,
  isDm,
});
