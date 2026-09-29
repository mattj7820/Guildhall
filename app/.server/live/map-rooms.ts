import type { Viewer } from "~/campaign/types";
import { canView } from "~/campaign/visibility";
import type { Services } from "~/context";
import type { ServerMessage } from "~/live/messages";
import type { MapId } from "~/maps/types";
import { mapVersion } from "../maps/load";

type Deps = Pick<Services, "config" | "vault" | "maps" | "fogs" | "tokens" | "characters">;

/**
 * A map's state as one viewer may know it: its version, or `gone` if it's missing or hidden
 * from them, which look the same. The same rule as the map's page and `/maps/:id/version`.
 */
export async function mapState(services: Deps, id: MapId, viewer: Viewer): Promise<ServerMessage> {
  const map = await services.maps.get(id);
  if (!map || !canView(viewer, map.visibility)) return { type: "gone", map: id };
  return { type: "map", map: id, version: await mapVersion(services, map, viewer) };
}
