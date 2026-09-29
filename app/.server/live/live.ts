import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import type { Services } from "~/context";
import type { MapId } from "~/maps/types";
import { canView } from "~/campaign/visibility";
import { LiveHub, type BuildMessage, type Connection } from "./hub";
import { mapState } from "./map-rooms";
import { PrototypeTokens } from "./prototype-tokens";
import { LiveSockets } from "./sockets";

type Deps = Omit<Services, "live">;

/**
 * Live updates: websockets on the same server, signed in like pages, with every message built
 * for the viewer who gets it. The rest of the server tells it what changed.
 */
export class Live {
  private readonly hub: LiveHub;
  private readonly sockets: LiveSockets;

  constructor(private readonly services: Deps) {
    // PROTOTYPE (removed before the PR).
    const prototype = new PrototypeTokens(services, (map, build, except) =>
      this.publishOnMap(map, build, except),
    );
    this.hub = new LiveHub({
      members: services.members,
      join: async (map, viewer) => {
        const state = await mapState(services, map, viewer);
        return state.type === "gone" ? [state] : [state, ...prototype.join(map, viewer)];
      },
      onOther: (connection, message) => prototype.receive(connection, message),
    });
    this.sockets = new LiveSockets(services, (socket, who) => this.hub.connect(socket, who));
  }

  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
    return this.sockets.handleUpgrade(req, socket, head);
  }

  /** Something about the map changed: everyone watching it hears its new version, or `gone`. */
  mapChanged(map: MapId): Promise<void> {
    return this.hub.publish(map, (viewer) => mapState(this.services, map, viewer));
  }

  /**
   * Sends something that's on a map, to those watching it who may see the map. A connection
   * stays watching a map it can't see, to hear if it's shared later, so everything but the map's
   * own state goes through here.
   */
  private async publishOnMap(map: MapId, build: BuildMessage, except?: Connection): Promise<void> {
    const found = await this.services.maps.get(map);
    if (!found) return;
    await this.hub.publish(
      map,
      (viewer) => (canView(viewer, found.visibility) ? build(viewer) : undefined),
      except,
    );
  }

  /** The vault changed, which any map's notes or image may depend on. */
  async allMapsChanged(): Promise<void> {
    await Promise.all(this.hub.watchedMaps().map((map) => this.mapChanged(map)));
  }

  /** A member was let in, removed or given another player: their connections start afresh. */
  memberChanged(discordId: string): Promise<void> {
    return this.hub.recheck(discordId);
  }

  close(): void {
    this.hub.close();
    this.sockets.close();
  }
}
