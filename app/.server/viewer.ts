import { createCookie } from "react-router";
import type { Role } from "~/campaign/types";

/**
 * The DM's "preview as player" setting. It only changes what the DM sees: for anyone else the
 * view comes from who they signed in as (see `viewerFor` in `auth/account.ts`).
 */
const viewCookie = createCookie("guildhall-view", {
  path: "/",
  httpOnly: true,
  sameSite: "lax",
  maxAge: 60 * 60 * 24 * 365,
});

export async function previewingAsPlayer(request: Request): Promise<boolean> {
  return (await viewCookie.parse(request.headers.get("Cookie"))) === "player";
}

export function serializeViewCookie(role: Role): Promise<string> {
  return viewCookie.serialize(role);
}
