import type { Viewer } from "~/campaign/types";
import { canView } from "~/campaign/visibility";
import type { Services } from "~/context";
import { FIGHT_ROOM, type ServerMessage } from "~/live/messages";
import type { MapId } from "~/maps/types";
import { mapVersion } from "../maps/load";
import { fightView } from "../combat/fight-view";
import { loadMapTokens } from "../maps/tokens";

type Deps = Pick<
  Services,
  "config" | "vault" | "maps" | "fogs" | "tokens" | "characters" | "fight"
>;

/**
 * A map's state as one viewer may know it: its version, or `gone` if it's missing or hidden
 * from them, which look the same. The same rule as the map's page and `/maps/:id/version`.
 */
export async function mapState(services: Deps, id: MapId, viewer: Viewer): Promise<ServerMessage> {
  const map = await services.maps.get(id);
  if (!map || !canView(viewer, map.visibility)) return { type: "gone", map: id };
  return { type: "map", map: id, version: await mapVersion(services, map) };
}

/** The fight the table is in, as one viewer may see it. */
export async function fightState(
  services: Pick<Services, "fight" | "characters">,
  viewer: Viewer,
): Promise<ServerMessage> {
  const fight = await services.fight.get();
  return {
    type: "fight",
    map: FIGHT_ROOM,
    fight: fight ? await fightView(services, fight, viewer) : null,
  };
}

/**
 * The map's tokens as one viewer may see them, or nothing for a map they can't see. Sent as a
 * whole each time: only a few, and the hub never repeats what a connection already has.
 */
export async function tokensState(
  services: Deps,
  id: MapId,
  viewer: Viewer,
): Promise<ServerMessage | undefined> {
  const map = await services.maps.get(id);
  if (!map || !canView(viewer, map.visibility)) return undefined;
  return { type: "tokens", map: id, ...(await loadMapTokens(services, map, viewer)) };
}
