import { randomBytes } from "node:crypto";
import { createCookieSessionStorage, type SessionStorage } from "react-router";
import type { Config } from "../config";

/** What a signed-in browser carries, signed so it can't be forged or edited. */
export interface SessionData {
  discordId: string;
  /** Must match the member's current key; a new key signs them out everywhere. */
  sessionKey: string;
  /** When the cookie was last issued, for refreshing it once a day while it's in use. */
  issuedAt: number;
}

export type Sessions = SessionStorage<SessionData>;

const THIRTY_DAYS = 60 * 60 * 24 * 30;
export const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Session cookies, signed with SESSION_SECRET. Without one (only allowed locally, over HTTP), a
 * random secret is made at startup, so everyone is signed out whenever the server restarts.
 */
export function createSessions(config: Pick<Config, "publicUrl" | "sessionSecrets">): Sessions {
  const secure = config.publicUrl.startsWith("https:");
  let secrets = config.sessionSecrets;
  if (!secrets) {
    console.warn("[auth] SESSION_SECRET is not set; sign-ins will end when the server restarts.");
    secrets = [randomBytes(32).toString("base64url")];
  }
  return createCookieSessionStorage<SessionData>({
    cookie: {
      // The __Host- prefix makes the browser refuse the cookie unless it's secure, for this host
      // only and for the whole site, so another subdomain can't plant one.
      name: secure ? "__Host-guildhall" : "guildhall-session",
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: THIRTY_DAYS,
      secrets,
    },
  });
}
