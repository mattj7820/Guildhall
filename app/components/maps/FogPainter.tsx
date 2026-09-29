import { useState, type PointerEvent } from "react";
import { normalise, svgPoints } from "~/maps/geometry";
import { LONG_SIDE_CELLS } from "~/maps/fog/mask";
import { STROKE_POINTS_MAX } from "~/maps/fog/schema";
import type { FogChange, FogMask, FogMode } from "~/maps/fog/types";
import type { AreaView, Size } from "~/maps/types";
import type { CanvasTools } from "./MapCanvas";
import { FogLayer } from "./FogLayer";

export type FogTool = "brush" | "area" | "rectangle";

interface Props {
  mask: FogMask;
  size: Size;
  canvas: CanvasTools;
  tool: FogTool;
  mode: FogMode;
  /** The brush's radius as a share of the image's longer side. */
  radius: number;
  areas: AreaView[];
  /** While Space is held, drags pan the map instead of painting. */
  panning: boolean;
  /** How dark the DM's fog is: see-through. */
  opacity: number;
  onChange: (change: FogChange) => void;
}

type Pixel = [number, number];

/**
 * The fog with the DM's tools over it: drag to brush, drag a rectangle, or click an area. A
 * stroke or rectangle in progress is drawn into the fog at once and becomes one change (one undo
 * step) when the pointer is released.
 */
export function FogPainter({
  mask,
  size,
  canvas,
  tool,
  mode,
  radius,
  areas,
  panning,
  opacity,
  onChange,
}: Props) {
  const [stroke, setStroke] = useState<Pixel[] | null>(null);
  const [corner, setCorner] = useState<Pixel | null>(null);
  const [pointer, setPointer] = useState<Pixel>();
  const longSide = Math.max(size.width, size.height);
  const radiusPx = radius * longSide;
  const cellPx = longSide / LONG_SIDE_CELLS;
  const at = (event: PointerEvent) => canvas.clientToImage(event.clientX, event.clientY);
  const toPoint = ([x, y]: Pixel) => normalise(x, y, size);

  function onPointerDown(event: PointerEvent<SVGRectElement>) {
    if (panning || event.button !== 0) return;
    const point = at(event);
    if (!point) return;
    // Keep the press from panning the map.
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === "brush") setStroke([point]);
    if (tool === "rectangle") setCorner(point);
  }

  function onPointerMove(event: PointerEvent<SVGRectElement>) {
    const point = at(event);
    setPointer(point);
    if (!point || !stroke) return;
    const last = stroke[stroke.length - 1];
    // Points closer together than half a cell add nothing to the fog.
    if (Math.hypot(point[0] - last[0], point[1] - last[1]) < cellPx / 2) return;
    if (stroke.length < STROKE_POINTS_MAX) setStroke([...stroke, point]);
  }

  function onPointerUp() {
    if (stroke) {
      onChange({
        type: "paint",
        mode,
        shape: { kind: "stroke", points: stroke.map(toPoint), radius },
      });
    }
    if (corner && pointer && Math.abs(pointer[0] - corner[0]) >= cellPx) {
      const [x0, y0] = corner;
      const [x1, y1] = pointer;
      if (Math.abs(y1 - y0) >= cellPx) {
        const points: Pixel[] = [
          [x0, y0],
          [x1, y0],
          [x1, y1],
          [x0, y1],
        ];
        onChange({ type: "paint", mode, shape: { kind: "polygon", points: points.map(toPoint) } });
      }
    }
    setStroke(null);
    setCorner(null);
  }

  // Black clears fog in the mask, white adds it.
  const paint = mode === "reveal" ? "black" : "white";
  const preview = (
    <>
      {stroke && (
        <path
          d={stroke.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ")}
          fill="none"
          stroke={paint}
          strokeWidth={radiusPx * 2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {corner && pointer && (
        <rect
          x={Math.min(corner[0], pointer[0])}
          y={Math.min(corner[1], pointer[1])}
          width={Math.abs(pointer[0] - corner[0])}
          height={Math.abs(pointer[1] - corner[1])}
          fill={paint}
        />
      )}
    </>
  );

  return (
    <>
      <FogLayer mask={mask} size={size} opacity={opacity} preview={preview} />
      {tool === "area" ? (
        <g aria-hidden="true">
          {areas.map((area) => (
            <polygon
              key={area.id}
              points={svgPoints(area.outline, size)}
              vectorEffect="non-scaling-stroke"
              strokeWidth={2}
              className="cursor-pointer fill-transparent stroke-amber-500 hover:fill-amber-400/25"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() =>
                onChange({ type: "paint", mode, shape: { kind: "polygon", points: area.outline } })
              }
            />
          ))}
        </g>
      ) : (
        <rect
          {...size}
          fill="transparent"
          pointerEvents={panning ? "none" : "all"}
          className={panning ? "cursor-grab" : "cursor-crosshair"}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={() => setPointer(undefined)}
        />
      )}
      {tool === "brush" && pointer && !panning && (
        <circle
          cx={pointer[0]}
          cy={pointer[1]}
          r={radiusPx}
          fill="none"
          strokeWidth={1.5 / canvas.scale}
          className={mode === "reveal" ? "stroke-amber-400" : "stroke-rose-500"}
          pointerEvents="none"
        />
      )}
    </>
  );
}
