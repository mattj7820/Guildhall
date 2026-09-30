import { useMemo, type PointerEvent } from "react";
import type { PixelGrid } from "~/maps/grid/grid";
import { areaPath, coveredSquares, type SpellArea } from "~/maps/grid/shapes";
import type { Size } from "~/maps/types";
import type { CanvasTools } from "./MapCanvas";

interface Props {
  size: Size;
  canvas: CanvasTools;
  squares: PixelGrid;
  /** Whether the spell area tool is in use: the map then takes presses to place it. */
  active: boolean;
  area?: SpellArea;
  onPlace: (at: [number, number], free: boolean) => void;
  onAim: (at: [number, number]) => void;
}

/**
 * A spell's area on the map: the squares it covers, and its own outline. Click to place it, drag
 * to aim; it stays until cleared. On this viewer's screen only.
 */
export function SpellAreaLayer({ size, canvas, squares, active, area, onPlace, onAim }: Props) {
  const covered = useMemo(() => (area ? coveredSquares(squares, area) : []), [squares, area]);
  const at = (event: PointerEvent) => canvas.clientToImage(event.clientX, event.clientY);

  return (
    <>
      {area && (
        <g className="pointer-events-none" aria-hidden="true">
          {covered.map(([col, row]) => (
            <rect
              key={`${col},${row}`}
              x={squares.x + col * squares.square}
              y={squares.y + row * squares.square}
              width={squares.square}
              height={squares.square}
              className="fill-rose-500/30"
            />
          ))}
          <path
            d={areaPath(squares, area)}
            className="fill-none stroke-rose-600"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      )}
      {active && (
        <rect
          {...size}
          fill="transparent"
          className="cursor-crosshair"
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            // Placing a spell, not panning.
            event.stopPropagation();
            event.currentTarget.setPointerCapture(event.pointerId);
            const point = at(event);
            if (point) onPlace(point, event.altKey);
          }}
          onPointerMove={(event) => {
            if (!event.buttons) return;
            const point = at(event);
            if (point) onAim(point);
          }}
          onClick={(event) => event.stopPropagation()}
        />
      )}
    </>
  );
}
