import type { Viewer, Visibility } from "./types";

/** Whether a viewer may see content with the given visibility. The DM sees everything. */
export function canView(viewer: Viewer, visibility: Visibility): boolean {
  return viewer.role === "dm" || visibility === "players";
}

/**
 * Normalises a raw frontmatter value into a Visibility. Anything other than an explicit
 * `players` (including missing, misspelt or malformed values) fails closed to `dm`.
 */
export function parseVisibility(raw: unknown): Visibility {
  return typeof raw === "string" && raw.trim().toLowerCase() === "players" ? "players" : "dm";
}
