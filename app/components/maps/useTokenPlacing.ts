import { useState } from "react";
import { normalise, offset, toPixels } from "~/maps/geometry";
import { snapToGrid, toPixels as gridInPixels } from "~/maps/grid/grid";
import type { TokenAction } from "~/maps/tokens/actions";
import type { PartyPlacement, Token } from "~/maps/tokens/types";
import type { MapView, Point } from "~/maps/types";
import { newId } from "~/shared/ids";
import { TOKEN_RADIUS } from "./TokenLayer";
import type { Placing } from "./PlacingHint";

/**
 * The DM placing tokens on the map: what the next click places (a party member, the whole party,
 * new markers, or one brought from elsewhere), and placing it where the click lands, on a square
 * while tokens snap to the grid. Several go side by side.
 */
export function useTokenPlacing({
  map,
  party,
  send,
  onPlaced,
}: {
  map: MapView;
  party: PartyPlacement[];
  send: (actions: TokenAction[]) => unknown;
  /** A single token was placed (to select it). */
  onPlaced: (id: string) => void;
}) {
  const [placing, setPlacing] = useState<Placing>();

  /** Where a token placed here lands: on a square while tokens snap to the grid. */
  const landing = (point: Point): Point => {
    if (!map.grid || !map.snapToGrid) return point;
    const [x, y] = snapToGrid(gridInPixels(map.grid, map.size), toPixels(point, map.size));
    return normalise(x, y, map.size);
  };

  /**
   * Points for `count` tokens side by side around a click: in neighbouring squares on a battle
   * map, else far enough apart on screen for their names.
   */
  function sideBySide(clicked: Point, count: number, scale: number): Point[] {
    const at = landing(clicked);
    const step = map.grid ? map.grid.square : (TOKEN_RADIUS * 4.5) / scale / map.size.width;
    const first = at[0] - step * Math.floor((count - 1) / 2);
    return Array.from({ length: count }, (_, index) =>
      landing(clamp(offset([first, at[1]], step * index, 0))),
    );
  }

  function place(clicked: Point, scale: number) {
    if (!placing) return;
    let actions: TokenAction[];
    if (placing.kind === "bring") {
      actions = [{ type: "move", id: placing.id, to: landing(clicked), map: map.id }];
    } else if (placing.kind === "party") {
      const points = sideBySide(clicked, party.length, scale);
      actions = party.map((member, index) => ({
        type: "place",
        token: {
          kind: "character",
          id: newId(),
          map: map.id,
          at: points[index],
          note: member.note,
        },
      }));
    } else if (placing.kind === "markers") {
      const points = sideBySide(clicked, placing.markers.length, scale);
      actions = placing.markers.map((draft, index) => ({
        type: "place",
        token: { kind: "marker", id: newId(), map: map.id, at: points[index], ...draft },
      }));
    } else {
      const token: Token = {
        kind: "character",
        id: newId(),
        map: map.id,
        at: landing(clicked),
        note: placing.note,
      };
      actions = [{ type: "place", token }];
    }
    void send(actions);
    setPlacing(undefined);
    const placed = actions.map((action) => (action.type === "place" ? action.token.id : action.id));
    if (placed.length === 1) onPlaced(placed[0]);
  }

  return { placing, setPlacing, place };
}

/** Kept on the image. */
function clamp([x, y]: Point): Point {
  return [Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y))];
}
