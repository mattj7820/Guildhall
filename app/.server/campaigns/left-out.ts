import { DM_VIEWER, type EntityId } from "~/campaign/types";
import type { Vault } from "../vault/vault";
import type { CampaignData } from "./campaign-data";

/**
 * What a campaign's stored data points to outside a folder, which running it in that folder
 * would leave out: maps' images and notes, tokens' notes and sheets' notes. Read against the
 * whole vault; things already missing from it aren't this folder's doing, so aren't listed.
 * In the DM's words: the names of their maps, tokens and notes.
 */
export async function leftOutOf(
  data: Pick<CampaignData, "maps" | "tokens" | "characters">,
  vault: Vault,
  folder: string | undefined,
): Promise<string[]> {
  if (!folder) return [];
  const prefix = `${folder}/`;
  const outside = (path: string) => !path.startsWith(prefix);
  const noteOutside = (id: EntityId | undefined) => {
    const note = id ? vault.noteById(id, DM_VIEWER) : undefined;
    return note && outside(note.path) ? note : undefined;
  };

  const found: string[] = [];
  for (const map of await data.maps.list()) {
    const image = vault.findImage(map.image.path);
    if (image && outside(image.path)) {
      found.push(`The map “${map.name}”: its image`);
    }
    if (noteOutside(map.note)) found.push(`The map “${map.name}”: its note`);
    for (const area of map.areas) {
      if (noteOutside(area.note))
        found.push(`The map “${map.name}”, area “${area.name}”: its note`);
    }
  }
  for (const token of await data.tokens.list()) {
    if (token.kind === "marker" && noteOutside(token.note)) {
      found.push(`The token “${token.name}”: its note`);
    }
  }
  for (const character of await data.characters.list()) {
    const note = noteOutside(character.note);
    if (note) found.push(`${note.title}: the sheet's note (the party token too)`);
  }
  return found;
}
