import type { PointerEvent } from "react";
import type { Size } from "~/maps/types";
import type { CanvasTools } from "./MapCanvas";
import type { Ruler } from "./useMapTools";

interface Props {
  size: Size;
  canvas: CanvasTools;
  /** Whether the measuring tool is in use: the map then takes presses for the ruler. */
  active: boolean;
  ruler?: Ruler;
  label?: string;
  onStart: (at: [number, number]) => void;
  onMove: (at: [number, number]) => void;
  onEnd: () => void;
}

/**
 * The ruler: drag across the map to measure, with Space for turns along the way. Drawn over
 * everything, on this viewer's screen only.
 */
export function MeasureLayer({
  size,
  canvas,
  active,
  ruler,
  label,
  onStart,
  onMove,
  onEnd,
}: Props) {
  const at = (event: PointerEvent) => canvas.clientToImage(event.clientX, event.clientY);
  const points = ruler ? [...ruler.points, ruler.cursor] : [];
  const end = points[points.length - 1];

  return (
    <>
      {ruler && end && (
        <g className="pointer-events-none" aria-hidden="true">
          <polyline
            points={points.map(([x, y]) => `${x},${y}`).join(" ")}
            className="fill-none stroke-sky-600"
            strokeWidth={3}
            strokeDasharray="8 5"
            vectorEffect="non-scaling-stroke"
          />
          {points.map(([x, y], index) => (
            <circle key={index} cx={x} cy={y} r={4 / canvas.scale} className="fill-sky-600" />
          ))}
          {label && (
            <text
              x={end[0] + 10 / canvas.scale}
              y={end[1] - 10 / canvas.scale}
              fontSize={15 / canvas.scale}
              strokeWidth={4 / canvas.scale}
              className="fill-sky-900 stroke-white font-bold [paint-order:stroke]"
            >
              {label}
            </text>
          )}
        </g>
      )}
      {active && (
        <rect
          {...size}
          fill="transparent"
          className="cursor-crosshair"
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            // Measuring, not panning.
            event.stopPropagation();
            event.currentTarget.setPointerCapture(event.pointerId);
            const point = at(event);
            if (point) onStart(point);
          }}
          onPointerMove={(event) => {
            const point = at(event);
            if (point) onMove(point);
          }}
          onPointerUp={onEnd}
          onClick={(event) => event.stopPropagation()}
        />
      )}
    </>
  );
}
