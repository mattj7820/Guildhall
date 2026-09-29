import { data } from "react-router";
import { DM_VIEWER, type Viewer } from "~/campaign/types";
import { canEdit } from "~/characters/permissions";
import type { Character, CharacterId } from "~/characters/types";
import type { Services } from "~/context";
import { controllersOf } from "./controllers";

/**
 * The character, if this viewer may open (and so change) it. Anyone else gets the same 404 as for
 * a character that doesn't exist, so a player can't tell someone else's sheet is there.
 */
export async function openableCharacter(
  services: Pick<Services, "characters" | "vault">,
  id: CharacterId,
  viewer: Viewer,
): Promise<Character> {
  const character = await services.characters.get(id);
  if (!character || !canEdit(viewer, controllersOf(character, noteLookup(services)))) {
    throw data("Not found", { status: 404 });
  }
  return character;
}

/** Looks notes up as the DM would: who plays a character is decided from notes players may not see. */
export const noteLookup = (services: Pick<Services, "vault">) => (note: string) =>
  services.vault.current.noteById(note, DM_VIEWER);
