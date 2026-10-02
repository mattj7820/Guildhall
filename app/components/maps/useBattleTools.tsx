import type { ReactNode } from "react";
import { toPixels } from "~/maps/geometry";
import { feetAlong, formatFeet } from "~/maps/grid/distance";
import { snapToGrid, toPixels as gridInPixels } from "~/maps/grid/grid";
import { caughtIn, coveredSquares } from "~/maps/grid/shapes";
import type { TokenView } from "~/maps/tokens/types";
import type { MapView } from "~/maps/types";
import type { CanvasTools } from "./MapCanvas";
import { MapToolbar } from "./MapToolbar";
import { MeasureLayer } from "./MeasureLayer";
import { SpellAreaLayer } from "./SpellAreaLayer";
import { SpellAreaOptions } from "./SpellAreaOptions";
import { useMapTools } from "./useMapTools";

/**
 * A battle map's tools, the same for the DM and players: the toolbar over the map, and what the
 * ruler and spell areas draw on it. Nothing on a map without a grid. `enabled` is false while
 * other tools have the map (the DM's fog tools, placing tokens, presenting).
 */
export function useBattleTools({
  map,
  tokens,
  enabled,
}: {
  map: MapView;
  tokens: readonly TokenView[];
  enabled: boolean;
}): {
  toolbar: ReactNode;
  layers: (canvas: CanvasTools) => ReactNode;
  /** The tokens a spell area catches. */
  caught: string[];
} {
  const tools = useMapTools(!!map.grid && enabled);
  if (!map.grid || !enabled) return { toolbar: null, layers: () => null, caught: [] };

  const squares = gridInPixels(map.grid, map.size);
  const { ruler, area, spell } = tools;
  const rulerLabel = ruler
    ? formatFeet(feetAlong(squares, [...ruler.points, ruler.cursor]))
    : undefined;
  const caught = area
    ? caughtIn(
        squares,
        coveredSquares(squares, area),
        tokens.map((token) => ({
          id: token.id,
          at: toPixels(token.at, map.size),
          size: token.size,
        })),
      )
    : [];
  const areaLabel = area
    ? `In the area: ${
        tokens
          .filter((token) => caught.includes(token.id))
          .map((token) => token.name)
          .join(", ") || "nobody"
      }`
    : undefined;

  return {
    caught,
    toolbar: (
      <MapToolbar tool={tools.tool} onTool={tools.choose} result={areaLabel ?? rulerLabel}>
        {tools.tool === "area" && (
          <SpellAreaOptions
            shape={spell.shape}
            feet={spell.feet}
            onShape={spell.setShape}
            onFeet={spell.setFeet}
          />
        )}
      </MapToolbar>
    ),
    layers: (canvas) => (
      <>
        <SpellAreaLayer
          size={map.size}
          canvas={canvas}
          squares={squares}
          active={tools.tool === "area"}
          area={area}
          // A spell starts on a grid corner when tokens snap to it, unless Alt is held.
          onPlace={(at, free) =>
            spell.place(map.snapToGrid && !free ? snapToGrid(squares, at, 2) : at)
          }
          onAim={spell.aim}
        />
        <MeasureLayer
          size={map.size}
          canvas={canvas}
          active={tools.tool === "measure"}
          ruler={ruler}
          label={rulerLabel}
          onStart={tools.measure.start}
          onMove={tools.measure.move}
          onEnd={tools.measure.end}
        />
      </>
    ),
  };
}
