import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import type { EditorAction } from "~/maps/editor";
import { midpoints, normalise, toPixels } from "~/maps/geometry";
import { OUTLINE_MIN } from "~/maps/schema";
import type { Area, Point, Size } from "~/maps/types";
import type { CanvasTools } from "./MapCanvas";

/** Arrow keys move a point this fraction of the image; with Shift, ten times as far. */
const NUDGE = 0.001;

export interface VertexDrag {
  index: number;
  point: Point;
}

interface Props {
  area: Area;
  size: Size;
  canvas: CanvasTools;
  dispatch: (action: EditorAction) => void;
  /** The point being dragged, shown live but only committed (and saved) when released. */
  onDrag: (drag: VertexDrag | null) => void;
}

/**
 * Handles for reshaping the selected area: drag a point, or focus it and use the arrow keys;
 * Delete removes it. The "+" between two points adds one there.
 */
export function VertexHandles({ area, size, canvas, dispatch, onDrag }: Props) {
  /** The press on a handle, and whether it has moved (a press that doesn't move changes nothing). */
  const drag = useRef<(VertexDrag & { moved: boolean }) | null>(null);
  const radius = 6 / canvas.scale;
  const canRemove = area.outline.length > OUTLINE_MIN;

  const pointerAt = (event: PointerEvent): Point | undefined => {
    const position = canvas.clientToImage(event.clientX, event.clientY);
    return position && normalise(position[0], position[1], size);
  };

  function onKeyDown(event: KeyboardEvent, index: number) {
    const step = event.shiftKey ? NUDGE * 10 : NUDGE;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      dispatch({ type: "nudgeVertex", id: area.id, index, dx: move[0], dy: move[1] });
    } else if ((event.key === "Delete" || event.key === "Backspace") && canRemove) {
      event.preventDefault();
      dispatch({ type: "removeVertex", id: area.id, index });
    }
  }

  return (
    <g>
      {midpoints(area.outline).map((point, index) => {
        const [x, y] = toPixels(point, size);
        return (
          <g
            key={`mid-${index}`}
            role="button"
            aria-label={`Add a point to ${area.name} after point ${index + 1}`}
            tabIndex={0}
            className="group cursor-copy outline-none"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              dispatch({ type: "insertVertex", id: area.id, index, point });
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              dispatch({ type: "insertVertex", id: area.id, index, point });
            }}
          >
            <circle
              cx={x}
              cy={y}
              r={radius * 0.8}
              className="fill-white/70 stroke-sky-700 group-hover:fill-sky-200 group-focus-visible:fill-amber-400"
              vectorEffect="non-scaling-stroke"
              strokeWidth={1.5}
            />
            <path
              d={`M${x - radius / 2},${y}H${x + radius / 2}M${x},${y - radius / 2}V${y + radius / 2}`}
              className="pointer-events-none stroke-sky-800"
              vectorEffect="non-scaling-stroke"
              strokeWidth={1.5}
            />
          </g>
        );
      })}
      {area.outline.map((point, index) => {
        const [x, y] = toPixels(point, size);
        return (
          <circle
            key={index}
            role="button"
            tabIndex={0}
            aria-label={`Point ${index + 1} of ${area.name} at ${percent(point[0])}, ${percent(point[1])}`}
            cx={x}
            cy={y}
            r={radius}
            vectorEffect="non-scaling-stroke"
            strokeWidth={2}
            className="cursor-move fill-sky-600 stroke-white outline-none hover:fill-sky-400 focus-visible:fill-amber-400 focus-visible:stroke-amber-900"
            onKeyDown={(event) => onKeyDown(event, index)}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              // Not a pan: the canvas mustn't see this press.
              event.stopPropagation();
              event.currentTarget.setPointerCapture(event.pointerId);
              drag.current = { index, point, moved: false };
            }}
            onPointerMove={(event) => {
              if (!drag.current || drag.current.index !== index) return;
              const position = pointerAt(event);
              if (!position) return;
              drag.current = { index, point: position, moved: true };
              onDrag({ index, point: position });
            }}
            onPointerUp={(event) => {
              const done = drag.current;
              drag.current = null;
              onDrag(null);
              event.currentTarget.releasePointerCapture(event.pointerId);
              if (done?.moved) {
                dispatch({ type: "moveVertex", id: area.id, index, point: done.point });
              }
            }}
            onClick={(event) => event.stopPropagation()}
          />
        );
      })}
    </g>
  );
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
