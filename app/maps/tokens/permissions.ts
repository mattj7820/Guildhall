/**
 * Who may change which token. Decided on the server from the explicit Viewer, never from anything
 * the browser says; the browser uses the same rules only to offer what will work.
 */
import type { EntityId, Viewer } from "~/campaign/types";
import { characterAccess, type Controllers } from "~/characters/permissions";
import type { MapId } from "../types";
import type { TokenAction } from "./actions";
import type { Token } from "./types";

/**
 * Whether the viewer may move this token about its map: the DM, anything; a player, a party
 * member they may change (their own PC, and the companion the party shares). Never a marker.
 */
export function canMoveToken(viewer: Viewer, token: Token, controllers: Controllers): boolean {
  if (viewer.role === "dm") return true;
  return token.kind === "character" && characterAccess(viewer, controllers) === "edit";
}

/**
 * Whether the viewer may make this change on this map, given the tokens as they are now. Players
 * may only move their tokens about the map they're looking at; placing, removing, markers and
 * moving between maps are the DM's.
 */
export function mayApply(
  viewer: Viewer,
  map: MapId,
  action: TokenAction,
  tokens: readonly Token[],
  controllersOf: (note: EntityId) => Controllers,
): boolean {
  if (viewer.role === "dm") return true;
  if (action.type !== "move" || action.map) return false;
  const token = tokens.find((each) => each.id === action.id);
  return (
    !!token &&
    token.kind === "character" &&
    token.map === map &&
    canMoveToken(viewer, token, controllersOf(token.note))
  );
}
