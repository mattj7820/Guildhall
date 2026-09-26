import { createCookie } from "react-router";
import { DM_VIEWER, PLAYER_VIEWER, type Role, type Viewer } from "~/campaign/types";

/**
 * The DM/player toggle. This is a preview of what players would see, NOT access control:
 * anyone can flip the cookie. Real authentication will replace this when multiplayer arrives.
 */
const viewCookie = createCookie("guildhall-view", {
  path: "/",
  httpOnly: true,
  sameSite: "lax",
  maxAge: 60 * 60 * 24 * 365,
});

export async function viewerFromRequest(request: Request): Promise<Viewer> {
  const role: unknown = await viewCookie.parse(request.headers.get("Cookie"));
  return role === "player" ? PLAYER_VIEWER : DM_VIEWER;
}

export function serializeViewCookie(role: Role): Promise<string> {
  return viewCookie.serialize(role);
}
