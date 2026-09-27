import { DM_VIEWER, playerFromName, type Player } from "~/campaign/types";
import type { Vault } from "../vault/vault";

/**
 * Everyone named as a PC's player (`player:` on a `type: pc` note), once each, by name: who a
 * member can be.
 */
export function partyPlayers(vault: Vault): Player[] {
  const players = new Map<string, Player>();
  for (const note of vault.party(DM_VIEWER)) {
    const player = note.player ? playerFromName(note.player) : undefined;
    if (player && !players.has(player.id)) players.set(player.id, player);
  }
  return [...players.values()].sort((a, b) => a.name.localeCompare(b.name));
}
