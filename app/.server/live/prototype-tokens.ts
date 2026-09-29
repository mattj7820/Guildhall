// PROTOTYPE (removed before the PR): party tokens dragged live between browsers, to try the feel.
// Positions live in memory only. Only party members (PCs and the companion) have tokens, each
// viewer only hears about those they may see, and only those they may move can be moved. The fog
// is ignored.
import { z } from "zod";
import { DM_VIEWER, type EntityId, type Viewer } from "~/campaign/types";
import { characterAccess } from "~/characters/permissions";
import type { Services } from "~/context";
import type { ServerMessage } from "~/live/messages";
import type { MapId, Point } from "~/maps/types";
import { controllersFor } from "../characters/controllers";
import type { Note } from "../vault/parse-note";
import type { BuildMessage, Connection } from "./hub";

const point = z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]);
const clientMessage = z.object({
  type: z.enum(["drag", "drop"]),
  map: z.string().max(100),
  token: z.string().max(200),
  at: point,
});

type Publish = (map: MapId, build: BuildMessage, except?: Connection) => Promise<void>;

/** Party notes: PCs and companions. */
export function partyNotes(vault: Services["vault"]): Note[] {
  return vault.current
    .notes(DM_VIEWER)
    .filter((note) => note.type === "pc" || note.type === "companion");
}

export function prototypeAccess(viewer: Viewer, note: Note) {
  return characterAccess(viewer, controllersFor(note.type === "pc" ? "pc" : "companion", note));
}

export class PrototypeTokens {
  private readonly positions = new Map<MapId, Map<EntityId, Point>>();

  constructor(
    private readonly services: Pick<Services, "vault">,
    private readonly publish: Publish,
  ) {}

  join(map: MapId, viewer: Viewer): ServerMessage[] {
    return [this.positionsFor(map, viewer)];
  }

  receive(connection: Connection, raw: unknown): void {
    const parsed = clientMessage.safeParse(raw);
    if (!parsed.success || !connection.maps.has(parsed.data.map)) return;
    const { type, map, token, at } = parsed.data;
    const { viewer, account } = connection.who;
    const note = partyNotes(this.services.vault).find((each) => each.id === token);
    if (!note || prototypeAccess(viewer, note) !== "edit") return;

    if (type === "drag") {
      const by = account.member.name;
      void this.publish(
        map,
        (other) =>
          prototypeAccess(other, note) === "none"
            ? undefined
            : { type: "drag", map, token, at, by },
        connection,
      );
      return;
    }
    this.onMap(map).set(note.id, at);
    void this.publish(map, (other) => this.positionsFor(map, other));
  }

  private onMap(map: MapId): Map<EntityId, Point> {
    let positions = this.positions.get(map);
    if (!positions) {
      positions = new Map();
      this.positions.set(map, positions);
    }
    return positions;
  }

  /** Where each party member this viewer may see stands; new ones start in a row mid-map. */
  private positionsFor(map: MapId, viewer: Viewer): ServerMessage {
    const positions = this.onMap(map);
    const result: Record<EntityId, Point> = {};
    partyNotes(this.services.vault).forEach((note, index) => {
      if (!positions.has(note.id)) positions.set(note.id, [0.4 + index * 0.05, 0.5]);
      if (prototypeAccess(viewer, note) !== "none") result[note.id] = positions.get(note.id)!;
    });
    return { type: "positions", map, positions: result };
  }
}
