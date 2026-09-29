// PROTOTYPE (removed before the PR): party tokens dragged live between browsers, to try the feel.
// Positions live in memory only. Only party members (PCs and the companion) have tokens, each
// viewer only hears about those they may see, and only those they may move can be moved. The fog
// is ignored.
import type { WebSocket } from "ws";
import { DM_VIEWER, type EntityId, type Viewer } from "~/campaign/types";
import { canView } from "~/campaign/visibility";
import { characterAccess } from "~/characters/permissions";
import type { Services } from "~/context";
import type { Point } from "~/maps/types";
import { z } from "zod";
import { controllersFor } from "../characters/controllers";
import type { Note } from "../vault/parse-note";
import type { Admitted } from "./sockets";

const point = z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]);
const clientMessage = z.discriminatedUnion("type", [
  z.object({ type: z.literal("watch"), map: z.string().max(100) }),
  z.object({ type: z.literal("drag"), token: z.string().max(200), at: point }),
  z.object({ type: z.literal("drop"), token: z.string().max(200), at: point }),
]);

export type PrototypeServerMessage =
  | { type: "positions"; positions: Record<EntityId, Point> }
  | { type: "drag"; token: EntityId; at: Point; by: string }
  | { type: "gone" };

interface Connection {
  socket: WebSocket;
  who: Admitted;
  map?: string;
}

type Deps = Pick<Services, "vault" | "maps">;

/** Party notes: PCs, then companions. */
export function partyNotes(vault: Deps["vault"]): Note[] {
  return vault.current
    .notes(DM_VIEWER)
    .filter((note) => note.type === "pc" || note.type === "companion");
}

export function prototypeAccess(viewer: Viewer, note: Note) {
  return characterAccess(viewer, controllersFor(note.type === "pc" ? "pc" : "companion", note));
}

export class PrototypeTokens {
  private readonly connections = new Set<Connection>();
  private readonly positions = new Map<string, Map<EntityId, Point>>();

  constructor(private readonly services: Deps) {}

  connect(socket: WebSocket, who: Admitted): void {
    const connection: Connection = { socket, who };
    this.connections.add(connection);
    socket.on("close", () => this.connections.delete(connection));
    socket.on("message", (data) => {
      let parsed;
      try {
        parsed = clientMessage.safeParse(JSON.parse(String(data)));
      } catch {
        return;
      }
      if (parsed.success) void this.receive(connection, parsed.data);
    });
  }

  private async receive(connection: Connection, message: z.infer<typeof clientMessage>) {
    const { viewer, account } = connection.who;
    if (message.type === "watch") {
      const map = await this.services.maps.get(message.map);
      if (!map || !canView(viewer, map.visibility)) {
        connection.map = undefined;
        return send(connection, { type: "gone" });
      }
      connection.map = map.id;
      return send(connection, { type: "positions", positions: this.visible(map.id, viewer) });
    }

    const mapId = connection.map;
    const note = partyNotes(this.services.vault).find((each) => each.id === message.token);
    if (!mapId || !note) return;
    if (prototypeAccess(viewer, note) !== "edit") {
      // Put the mover's copy back where it really is.
      return send(connection, { type: "positions", positions: this.visible(mapId, viewer) });
    }
    if (message.type === "drag") {
      const by = account.member.name;
      for (const other of this.watching(mapId)) {
        if (other !== connection && prototypeAccess(other.who.viewer, note) !== "none") {
          send(other, { type: "drag", token: note.id, at: message.at, by });
        }
      }
      return;
    }
    this.onMap(mapId).set(note.id, message.at);
    for (const other of this.watching(mapId)) {
      send(other, { type: "positions", positions: this.visible(mapId, other.who.viewer) });
    }
  }

  private watching(mapId: string): Connection[] {
    return [...this.connections].filter((connection) => connection.map === mapId);
  }

  private onMap(mapId: string): Map<EntityId, Point> {
    let positions = this.positions.get(mapId);
    if (!positions) {
      positions = new Map();
      this.positions.set(mapId, positions);
    }
    return positions;
  }

  /** Where each party member this viewer may see stands; new ones start in a row mid-map. */
  private visible(mapId: string, viewer: Viewer): Record<EntityId, Point> {
    const positions = this.onMap(mapId);
    const result: Record<EntityId, Point> = {};
    partyNotes(this.services.vault).forEach((note, index) => {
      if (!positions.has(note.id)) positions.set(note.id, [0.4 + index * 0.05, 0.5]);
      if (prototypeAccess(viewer, note) !== "none") result[note.id] = positions.get(note.id)!;
    });
    return result;
  }
}

function send(connection: Connection, message: PrototypeServerMessage): void {
  connection.socket.send(JSON.stringify(message));
}
