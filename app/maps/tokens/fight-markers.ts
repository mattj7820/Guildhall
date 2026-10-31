/** Markers for monsters placed from the tracker: pure and isomorphic. */
import type { MonsterCombatant } from "~/combat/types";
import type { MapId, Point } from "../types";
import { guessTokenIcon } from "./icons";
import { MARKER_NAME_MAX } from "./schema";
import type { MarkerToken, TokenId, TokenSize } from "./types";

/**
 * A monster from the tracker as a marker linked to it, like one that joined from the map: its
 * name, red with an icon guessed from its statblock, and shown unless it's hidden.
 */
export function monsterMarker(
  monster: MonsterCombatant,
  place: { id: TokenId; map: MapId; at: Point; size: TokenSize },
): MarkerToken {
  const icon = guessTokenIcon(monster.statblock.name) ?? guessTokenIcon(monster.name);
  return {
    kind: "marker",
    id: place.id,
    map: place.map,
    at: place.at,
    ...(place.size > 1 && { size: place.size }),
    name: monster.name.slice(0, MARKER_NAME_MAX),
    colour: "red",
    visibility: monster.hidden ? "dm" : "players",
    ...(icon && { picture: "icon" as const, icon }),
    statblock: monster.statblock,
    combatant: monster.id,
  };
}
