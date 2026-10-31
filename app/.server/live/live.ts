import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { canView } from "~/campaign/visibility";
import type { Character } from "~/characters/types";
import type { Services } from "~/context";
import { FIGHT_ROOM, type ClientMessage } from "~/live/messages";
import type { FogMask } from "~/maps/fog/types";
import { fightAllowsMove, type Fight } from "~/combat/fight";
import { canMoveToken } from "~/maps/tokens/permissions";
import type { Token, TokenId } from "~/maps/tokens/types";
import { tokensForViewer } from "~/maps/tokens/visibility";
import type { CampaignMap, MapId, Point } from "~/maps/types";
import { ancestors } from "~/maps/tree";
import { isTokenStunt, stuntSeenBy, type StuntEvent } from "~/maps/stunts";
import { loadTokens, partyControllers, partyFor } from "../maps/tokens";
import { Holds } from "./holds";
import { LiveHub, type BuildMessage, type Connection } from "./hub";
import { fightState, mapState, tokensState } from "./map-rooms";
import { LiveSockets } from "./sockets";

type Deps = Omit<Services, "live">;

/** What a drag is checked against, read once a second at most rather than 20 times. */
interface DragContext {
  map: CampaignMap;
  tokens: Token[];
  fog: FogMask;
  characters: Character[];
  fight: Fight | undefined;
  readAt: number;
}
const DRAG_CONTEXT_MS = 1000;

/**
 * Live updates: websockets on the same server, signed in like pages, with every message built
 * for the viewer who gets it. The rest of the server tells it what changed; browsers tell it
 * which tokens they're dragging, and it tells whoever may see them.
 */
export class Live {
  private readonly hub: LiveHub;
  private readonly sockets: LiveSockets;
  private readonly holds = new Holds();
  private readonly dragContexts = new Map<MapId, DragContext>();

  constructor(private readonly services: Deps) {
    this.hub = new LiveHub({
      members: services.members,
      join: async (map, viewer) => {
        if (map === FIGHT_ROOM) return [await fightState(services, viewer)];
        const state = await mapState(services, map, viewer);
        if (state.type === "gone") return [state];
        const tokens = await tokensState(services, map, viewer);
        return tokens ? [state, tokens] : [state];
      },
      onMessage: (connection, message) => void this.receive(connection, message),
      onClose: (connection) => this.holds.releaseAll(connection),
    });
    this.sockets = new LiveSockets(services, (socket, who) => this.hub.connect(socket, who));
  }

  /** PROTOTYPE: who has Guildhall open now. */
  online() {
    return this.hub.online();
  }

  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
    return this.sockets.handleUpgrade(req, socket, head);
  }

  /**
   * Something about the map changed (its areas, fog or tokens): everyone watching it hears its
   * new version, or `gone`, and its tokens as they may see them. Each hears only what's different
   * for them.
   */
  async mapChanged(map: MapId): Promise<void> {
    this.dragContexts.delete(map);
    await this.hub.publish(map, (viewer) => mapState(this.services, map, viewer));
    // The maps around it show who's inside their areas, so they may look different too.
    const around = [map, ...ancestors(map, await this.services.maps.list()).map((each) => each.id)];
    for (const each of around) {
      await this.publishOnMap(each, (viewer) => tokensState(this.services, each, viewer));
    }
  }

  /** The fight changed (or started, or ended): everyone watching it hears it as they may see it. */
  async fightChanged(): Promise<void> {
    // Whose turn it is decides who may drag.
    this.dragContexts.clear();
    await this.hub.publish(FIGHT_ROOM, (viewer) => fightState(this.services, viewer));
    // Monsters' tokens take their names, hit points and hiding from the fight, wherever they are.
    await Promise.all(
      this.hub
        .watchedMaps()
        .filter((map) => map !== FIGHT_ROOM)
        .map((map) => this.publishOnMap(map, (viewer) => tokensState(this.services, map, viewer))),
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

  /**
   * Whether someone else is moving a token just now, for a move being saved: the name of whoever
   * has it, or nothing. The DM is never kept out.
   */
  heldByOther(map: MapId, token: TokenId, discordId: string, isDm: boolean): string | undefined {
    return this.holds.heldByOther(map, token, discordId, isDm);
  }

  close(): void {
    this.hub.close();
    this.sockets.close();
  }

  private async receive(connection: Connection, message: ClientMessage): Promise<void> {
    if (message.type === "release") {
      return this.holds.release(message.map, message.token, connection);
    }
    if (message.type === "drag") {
      await this.dragged(connection, message.map, message.token, message.at);
    }
  }

  /**
   * A token being dragged: checked like a saved move (the map visible to them, the token on it
   * and theirs to move), held for them, and shown to those watching who may see it there.
   */
  private async dragged(connection: Connection, mapId: MapId, id: TokenId, at: Point) {
    const { viewer, account } = connection.who;
    if (!connection.maps.has(mapId)) return;
    const context = await this.dragContext(mapId);
    if (!context || !canView(viewer, context.map.visibility)) return;
    const token = context.tokens.find((each) => each.id === id);
    const vault = this.services.vault.current;
    const controllers =
      token?.kind === "character" ? partyControllers(vault)(token.note) : "unknown";
    if (!token || !canMoveToken(viewer, token, controllers)) return;
    if (token.kind === "character" && !fightAllowsMove(context.fight, mapId, token.note, viewer)) {
      return;
    }

    const name = account.member.name;
    const grab = this.holds.grab(mapId, id, {
      connection,
      discordId: account.member.discordId,
      name,
      isDm: viewer.role === "dm",
    });
    if (!grab.granted) {
      return this.hub.reply(connection, { type: "held", map: mapId, token: id, by: grab.by });
    }

    const moved = { ...token, at };
    await this.publishOnMap(
      mapId,
      (other) => {
        const seen = tokensForViewer({
          tokens: [moved],
          viewer: other,
          fog: context.fog,
          party: partyFor(vault, context.characters, other),
          fight: context.fight,
        });
        return seen.length > 0
          ? { type: "moving", map: mapId, token: id, at, by: name }
          : undefined;
      },
      connection,
    );
  }

  private async dragContext(mapId: MapId): Promise<DragContext | undefined> {
    const cached = this.dragContexts.get(mapId);
    if (cached && Date.now() - cached.readAt < DRAG_CONTEXT_MS) return cached;
    const map = await this.services.maps.get(mapId);
    if (!map) return undefined;
    const [tokens, fog, characters, fight] = await Promise.all([
      this.services.tokens.onMap(mapId),
      this.services.fogs.get(mapId, map.image),
      this.services.characters.list(),
      this.services.fight.get(),
    ]);
    const context = { map, tokens, fog: fog.mask, characters, fight, readAt: Date.now() };
    this.dragContexts.set(mapId, context);
    return context;
  }

  /**
   * The DM played a stunt on a map: everyone watching who may see the map hears it at once, and
   * a token's stunt only those who may see the token.
   */
  async stunt(mapId: MapId, stunt: StuntEvent): Promise<void> {
    const map = await this.services.maps.get(mapId);
    if (!map) return;
    await this.publishOnMap(mapId, async (viewer) => {
      const tokens =
        isTokenStunt(stunt) && viewer.role !== "dm"
          ? await loadTokens(this.services, map, viewer)
          : [];
      const seen = stuntSeenBy(stunt, viewer, (id) => tokens.some((token) => token.id === id));
      return seen ? { type: "stunt", map: mapId, stunt } : undefined;
    });
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
}
