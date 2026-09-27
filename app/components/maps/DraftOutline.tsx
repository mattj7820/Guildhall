import { toPixels } from "~/maps/geometry";
import type { Point, Size } from "~/maps/types";

interface Props {
  points: Point[];
  /** Where the pointer is, in image pixels, to show the next edge. */
  pointer?: [number, number];
  size: Size;
  scale: number;
  canFinish: boolean;
  onFinish: () => void;
}

/**
 * The outline being drawn: the points so far, a line on to the pointer, and a larger first point
 * that closes the shape when clicked.
 */
export function DraftOutline({ points, pointer, size, scale, canFinish, onFinish }: Props) {
  const pixels = points.map((point) => toPixels(point, size));
  const path = pointer ? [...pixels, pointer] : pixels;
  const radius = 5 / scale;
  return (
    <g aria-hidden="true">
      <polyline
        points={path.map((p) => p.join(",")).join(" ")}
        vectorEffect="non-scaling-stroke"
        strokeWidth={2}
        className="pointer-events-none fill-sky-400/20 stroke-sky-600"
      />
      {pixels.map(([x, y], index) => {
        const isFirst = index === 0;
        const closes = isFirst && canFinish;
        return (
          <circle
            key={index}
            cx={x}
            cy={y}
            r={closes ? radius * 1.8 : radius}
            vectorEffect="non-scaling-stroke"
            strokeWidth={2}
            className={
              closes
                ? "cursor-pointer fill-white stroke-sky-700 hover:fill-sky-200"
                : "pointer-events-none fill-sky-600 stroke-white"
            }
            onClick={
              closes
                ? (event) => {
                    event.stopPropagation();
                    onFinish();
                  }
                : undefined
            }
          />
        );
      })}
    </g>
  );
}
