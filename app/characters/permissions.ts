/**
 * Who may see and change a character. Decided on the server from the explicit Viewer, never from
 * anything the browser says.
 */
import type { PlayerId, Viewer } from "~/campaign/types";

/**
 * Who plays a character: the players named for it (a PC's one player, from its note's `player`),
 * or the whole party (a shared companion). Unknown when its vault note has gone, so only the DM
 * can reach it until it's linked again.
 */
export type Controllers = { players: readonly PlayerId[] } | "party" | "unknown";

/**
 * - `edit`: the whole sheet and bag, and changing them (the DM; the character's own players; every
 *   player, for a companion the party shares).
 * - `summary`: name, portrait, species, class, level and equipped items only (other players).
 * - `none`: nothing at all; the character looks like it doesn't exist.
 */
export type CharacterAccess = "edit" | "summary" | "none";

export function characterAccess(viewer: Viewer, controllers: Controllers): CharacterAccess {
  if (viewer.role === "dm") return "edit";
  if (controllers === "unknown") return "none";
  // A companion the whole party shares is every player's, whoever they are.
  if (controllers === "party") return "edit";
  // A player the DM hasn't said is anyone (or the DM previewing) plays no character of their own.
  if (viewer.playerId === undefined) return "summary";
  return controllers.players.includes(viewer.playerId) ? "edit" : "summary";
}

/** Opening the full sheet and bag, and changing them, go together. */
export const canEdit = (viewer: Viewer, controllers: Controllers) =>
  characterAccess(viewer, controllers) === "edit";

/**
 * Giving an item: from a bag the viewer may change, to anyone they can see is in the party.
 * Nobody can take from someone else's bag.
 */
export function canGive(viewer: Viewer, from: Controllers, to: Controllers): boolean {
  return canEdit(viewer, from) && characterAccess(viewer, to) !== "none";
}
