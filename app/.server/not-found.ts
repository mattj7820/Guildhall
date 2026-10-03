import { data } from "react-router";
import type { Viewer } from "~/campaign/types";

/**
 * Ends the request with a 404. Also what anyone gets for something they may not see, so it's
 * indistinguishable from something that isn't there.
 */
export function notFound(message = "Not found"): never {
  throw data(message, { status: 404 });
}

/** The DM's pages and actions: anyone else gets the same 404 as for a page that doesn't exist. */
export function requireDm(viewer: Viewer, message?: string): void {
  if (viewer.role !== "dm") notFound(message);
}
