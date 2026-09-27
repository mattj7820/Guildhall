import { randomBytes } from "node:crypto";
import { createCookie, type Cookie } from "react-router";
import type { CookieSettings } from "./sessions";

/**
 * Remembered between sending someone to Discord and them coming back: a random `state` that
 * the answer must repeat (so nobody can finish a sign-in they didn't start), and where to go
 * afterwards.
 */
export interface SignInAttempt {
  state: string;
  redirectTo: string;
}

/**
 * Lax, because coming back from Discord is a top-level visit from another site, which a strict
 * cookie wouldn't be sent with. Limited to `/auth` and to ten minutes: it's only needed once.
 */
export function createAttemptCookie({ secrets, secure }: CookieSettings): Cookie {
  return createCookie("guildhall-sign-in", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/auth",
    maxAge: 10 * 60,
    secrets,
  });
}

export function newAttempt(redirectTo: string): SignInAttempt {
  return { state: randomBytes(16).toString("base64url"), redirectTo };
}

export type CallbackResult =
  | { code: string; redirectTo: string }
  /** `cancelled`: they said no at Discord. `expired`: no attempt, or someone else's. */
  | { problem: "cancelled" | "expired" };

/** Checks what Discord sent back against the attempt this browser started. */
export function checkCallback(
  params: URLSearchParams,
  attempt: Partial<SignInAttempt> | null | undefined,
): CallbackResult {
  if (params.get("error")) return { problem: "cancelled" };
  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state || !attempt?.state || attempt.state !== state) return { problem: "expired" };
  return { code, redirectTo: attempt.redirectTo ?? "/" };
}
