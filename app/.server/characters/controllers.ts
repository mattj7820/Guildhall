import type { EntityId } from "~/campaign/types";
import { playerFromName } from "~/campaign/types";
import type { Controllers } from "~/characters/permissions";
import type { Character } from "~/characters/types";
import type { Note } from "../vault/parse-note";

/**
 * Who plays a character, read from its vault note every time, so the vault stays the one place
 * the DM says so:
 * - a PC: the player named in its note's `player` (none named: nobody but the DM);
 * - a companion: the whole party, or just the player named in `player`, if there is one.
 * Unknown if the note has gone or is no longer that kind of note, which keeps players out until
 * the DM links it again.
 *
 * `findNote` must look notes up as the DM would, since a PC's note may be kept from players.
 */
export function controllersOf(
  character: Character,
  findNote: (id: EntityId) => Note | undefined,
): Controllers {
  const note = findNote(character.note);
  if (!note || note.type !== (character.kind === "pc" ? "pc" : "companion")) return "unknown";
  const player = note.player ? playerFromName(note.player) : undefined;
  if (character.kind === "companion" && !player) return "party";
  return { players: player ? [player.id] : [] };
}
