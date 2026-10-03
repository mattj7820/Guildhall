import { useState } from "react";
import { normalise, offset, toPixels } from "~/maps/geometry";
import { snapToGrid, toPixels as gridInPixels } from "~/maps/grid/grid";
import type { TokenAction } from "~/maps/tokens/actions";
import type { PartyPlacement, Token } from "~/maps/tokens/types";
import type { MapView, Point } from "~/maps/types";
import { newId } from "~/shared/ids";
import { TOKEN_RADIUS } from "./TokenLayer";
import type { Placing } from "./TokenPanel";

/**
 * The DM placing tokens on the map: what the next click places (a party member, the whole party,
 * or a marker), and placing it where the click lands, on a square while tokens snap to the grid.
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

  function place(clicked: Point, scale: number) {
    const at = landing(clicked);
    if (placing?.kind === "party") {
      // Side by side around the click: in neighbouring squares on a battle map, else far enough
      // apart on screen for their names.
      const step = map.grid ? map.grid.square : (TOKEN_RADIUS * 4.5) / scale / map.size.width;
      const first = at[0] - step * Math.floor((party.length - 1) / 2);
      const placed = party.map((member, index): TokenAction => ({
        type: "place",
        token: {
          kind: "character",
          id: newId(),
          map: map.id,
          at: landing(offset([first, at[1]], step * index, 0)),
          note: member.note,
        },
      }));
      void send(placed);
      setPlacing(undefined);
      return;
    }
    const token: Token =
      placing?.kind === "character"
        ? { kind: "character", id: newId(), map: map.id, at, note: placing.note }
        : {
            kind: "marker",
            id: newId(),
            map: map.id,
            at,
            name: placing?.name ?? "",
            colour: placing?.kind === "marker" ? placing.colour : "red",
            visibility: placing?.kind === "marker" && placing.shown ? "players" : "dm",
          };
    void send([{ type: "place", token }]);
    setPlacing(undefined);
    onPlaced(token.id);
  }

  return { placing, setPlacing, place };
}
